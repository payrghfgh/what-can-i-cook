// Browser-level smoke test for the app. Not shipped in the site (needs jsdom):
//   npm i jsdom && node smoke.mjs
// Loads index.html into jsdom, runs the real app.js against the real
// recipes.json, and drives the interface like a person would.

import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { setAuthBackend } from './auth.js';

// pretend the Firebase project is configured, so the app does not stop at the gate
globalThis.__FIREBASE_CONFIG__ = { apiKey: 'AIzaSyDummyKeyForTests0123456789abcdef', projectId: 'test-project', authDomain: 'test.firebaseapp.com' };

const root = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const recipesRaw = fs.readFileSync(path.join(root, 'recipes.json'), 'utf8');

const ENV_NOISE = /WebAssembly|undici|llhttp/i;
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  if (!ENV_NOISE.test(e.message) && !/Not implemented: navigation/i.test(e.message)) {
    errors.push('jsdom: ' + e.message);
  }
});
const dom = new JSDOM(html, { url: 'https://whatcanicook.test/', pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;

window.addEventListener('error', (e) => {
  if (!ENV_NOISE.test(e.message || '')) errors.push('window error: ' + e.message);
});
process.on('unhandledRejection', (e) => {
  const msg = (e && e.message) || String(e);
  if (!ENV_NOISE.test(msg)) errors.push('unhandled rejection: ' + msg);
});

// sign in first — the app refuses to render without a Firebase session. The SDK
// is replaced with a fake that reports one signed-in user.
await setAuthBackend({
  onAuthStateChanged: (cb) => setTimeout(() => cb({
    uid: 'u_smoke', email: 'asha@example.com', displayName: 'Asha',
    providerData: [{ providerId: 'password' }]
  }), 0),
  signOut: async () => {}
});

globalThis.window = window;
globalThis.document = window.document;
globalThis.localStorage = window.localStorage;
globalThis.sessionStorage = window.sessionStorage;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Event = window.Event;
globalThis.Node = window.Node;
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => JSON.parse(recipesRaw) });

const $ = (sel) => window.document.querySelector(sel);
const $$ = (sel) => [...window.document.querySelectorAll(sel)];
const tick = () => new Promise((r) => setTimeout(r, 5));

let passed = 0;
const failures = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    passed++;
    console.log(`  ok   ${name}${detail ? '  — ' + detail : ''}`);
  } catch (err) {
    failures.push(name + ': ' + err.message);
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

function tickIngredient(key) {
  const input = window.document.querySelector(`#pantry-groups input[data-key="${key}"]`);
  if (!input) throw new Error(`no pantry checkbox for ${key}`);
  if (!input.checked) {
    input.checked = true;
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  }
}
async function setSelect(sel, value) {
  const el = $(sel);
  el.value = value;
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
  await tick();
}
const cards = () => $$('#results-body .card');
const titles = () => cards().map((c) => c.querySelector('h3').textContent);
function clearPantry() {
  let guard = 0;
  while ($('#pantry-selected .chip-remove')) {
    $('#pantry-selected .chip-remove').click();
    if (++guard > 200) throw new Error('pantry would not clear');
  }
}

// a badge baked into the served HTML, present before our script executes
window.document.body.insertAdjacentHTML('beforeend',
  '<a id="static-badge" class="netlify-badge" href="https://www.netlify.com">Powered by Netlify</a>');

await import(path.join(root, 'app.js'));
await tick(); await tick();

console.log('\nLoading');

await check('the page boots and renders recipe cards', async () => {
  assert(cards().length > 0, 'no cards rendered');
  assert($('#account-name').textContent === 'Asha', 'account chip not filled');
  return `${cards().length} cards as ${$('#account-name').textContent}`;
});

await check('the pantry browser lists every ingredient in categories', async () => {
  const boxes = $$('#pantry-groups input[type="checkbox"]');
  const groups = $$('#pantry-groups .group');
  assert(boxes.length > 120, `only ${boxes.length} ingredients`);
  assert(groups.length === 10, `${groups.length} groups`);
  return `${boxes.length} ingredients in ${groups.length} categories`;
});

await check('the vegetables drawer is open and its chips are visible on first paint', async () => {
  const drawer = window.document.querySelector('.group[data-group="vegetables"]');
  assert(drawer, 'no vegetables drawer');
  assert(drawer.open, 'the drawer is not open on load — the chips would need a reflow to appear');
  const chips = [...drawer.querySelectorAll('.ing-chip')].filter((c) => !c.hidden);
  assert(chips.length > 20, `only ${chips.length} chips visible`);
  const first = chips[0].querySelector('.tick');
  assert(first && first.textContent.trim(), 'chips have no label');
  return `${chips.length} chips, e.g. "${first.textContent.trim()}"`;
});

await check('no JavaScript errors while booting', async () => {
  assert(errors.length === 0, errors.join('; '));
});

console.log('\nHost badge');

await check('a badge present in the served HTML is removed', () => {
  assert(!window.document.getElementById('static-badge'), 'the static badge survived');
  return 'swept on load';
});

await check('a badge injected after load is removed', async () => {
  const el = window.document.createElement('div');
  el.id = 'late-badge';
  el.textContent = 'Powered by Netlify';
  window.document.body.appendChild(el);
  await tick(30);
  assert(!window.document.getElementById('late-badge'), 'the late badge survived');
  return 'caught by the observer';
});

await check('a badge hidden inside a wrapper is removed too', async () => {
  const wrap = window.document.createElement('section');
  wrap.innerHTML = '<div class="wrapper"><iframe src="https://netlify.example/badge"></iframe></div>';
  wrap.id = 'badge-wrap';
  window.document.body.appendChild(wrap);
  await tick(30);
  const iframe = window.document.querySelector('iframe[src*="netlify"]');
  assert(!iframe, 'an injected badge frame survived');
  return 'nested frame gone';
});

await check('text that merely mentions the badge is left alone', async () => {
  const p = window.document.createElement('p');
  p.id = 'innocent';
  p.textContent = 'The Powered by Netlify badge sits in the bottom corner.';
  window.document.body.appendChild(p);
  await tick(30);
  assert(window.document.getElementById('innocent'), 'a paragraph was removed by mistake');
  return 'anchored label test held';
});

await check('the app itself is untouched by the sweep', () => {
  assert(cards().length > 0, 'the sweep removed app content');
  assert(window.document.querySelector('#pantry-groups input'), 'pantry inputs survived');
  return `${cards().length} cards intact`;
});

console.log('\nPantry');

await check('ticking a checkbox adds a chip', async () => {
  tickIngredient('rajma');
  await tick();
  assert($('#pantry-selected .chip'), 'no chip appeared');
  assert($('#stat-pantry-num').textContent === '1', 'pantry counter wrong');
  return $('#stat-pantry-num').textContent + ' in pantry';
});

await check('the search box narrows the ingredient list', async () => {
  const search = $('#ingredient-search');
  search.value = 'raj';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  await tick();
  const visible = $$('#pantry-groups .ing-chip').filter((c) => !c.hidden);
  assert(visible.length > 0 && visible.length < 10, `search showed ${visible.length}`);
  search.value = '';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  await tick();
  return `${visible.length} matches for "raj"`;
});

await check('a quick-fill preset populates the pantry', async () => {
  clearPantry();
  await tick();
  $$('#presets [data-preset]').find((b) => b.dataset.preset === 'basics').click();
  await tick();
  const n = Number($('#stat-pantry-num').textContent);
  assert(n >= 10, `preset only added ${n}`);
  return `${n} ingredients from Indian basics`;
});

console.log('\nRanking and sections');

await check('rajma + onion + tomato with High protein puts Rajma in "Make right now"', async () => {
  clearPantry();
  await tick();
  tickIngredient('rajma');
  tickIngredient('onion');
  tickIngredient('tomato');
  await tick();
  $$('#focus-chips .chip-btn').find((b) => b.dataset.focus === 'high-protein').click();
  await tick();
  const heads = $$('#results-body .section-head h3').map((h) => h.textContent);
  assert(heads.includes('Make right now'), 'no "Make right now" section: ' + heads.join('|'));
  assert(titles()[0] === 'Rajma', `first card was ${titles()[0]}`);
  const badge = cards()[0].querySelector('.have-badge').textContent.trim();
  assert(badge.startsWith('✓'), `badge reads ${badge}`);
  return `first card Rajma, badge "${badge}"`;
});

await check('cards carry the x/y ingredient count', async () => {
  const withGap = cards().find((c) => c.querySelector('.need') && !c.querySelector('.need').classList.contains('is-complete'));
  assert(withGap, 'no card with a gap found');
  const badge = withGap.querySelector('.have-badge').textContent.trim();
  assert(/^\d+\/\d+$/.test(badge), `badge "${badge}" is not x/y`);
  return 'e.g. ' + badge;
});

await check('sections separate ready dishes from the ones a shop away', async () => {
  const heads = $$('#results-body .section-head h3').map((h) => h.textContent);
  assert(heads.includes('One ingredient away'), 'no "One ingredient away" section');
  return heads.join(' / ');
});

console.log('\nRecipe panel and scaling');

await check('"Show recipe" opens scaled quantities and numbered steps', async () => {
  cards()[0].querySelector('.toggle').click();
  await tick();
  const panel = window.document.getElementById('recipe-' + cards()[0].dataset.id);
  assert(panel && !panel.hidden, 'panel did not open');
  assert(panel.querySelectorAll('.ing-list li').length > 2, 'no ingredients');
  assert(panel.querySelectorAll('.steps li').length >= 3, 'no steps');
  assert(panel.querySelector('.ing-list li.is-have') || panel.querySelector('.ing-list li.is-missing'),
    'ingredients are not marked have/missing');
  return 'panel opened with have/missing markers';
});

await check('the people stepper rescales to 7 and never shows a decimal', async () => {
  for (let i = 0; i < 3; i++) { $('#people-up').click(); await tick(); }
  assert($('#people-value').textContent === '7', 'stepper did not reach 7');
  const panel = window.document.getElementById('recipe-' + cards()[0].dataset.id);
  const text = panel.textContent;
  assert(/scaled from a recipe that serves/.test(text), 'no scaling note');
  assert(/350 g/.test(text), 'rajma should read 350 g at 7 people');
  assert(!/\d\.\d/.test(text), 'decimal quantity leaked');
  for (let i = 0; i < 3; i++) { $('#people-down').click(); await tick(); }
  return '200 g → 350 g at 7 people';
});

console.log('\nFilters');

await check('choosing Vegan removes dairy, egg and meat', async () => {
  await setSelect('#f-diet', 'vegan');
  for (const c of cards()) c.querySelector('.toggle').click();
  await tick();
  const forbidden = /paneer|curd|butter|ghee|cheese|cream|milk|egg|chicken|fish|mutton|prawn/i;
  for (const c of cards()) {
    const ings = c.querySelector('.ing-list').textContent;
    assert(!forbidden.test(ings), `${c.querySelector('h3').textContent} leaks ${ings.match(forbidden)}`);
  }
  return `${cards().length} vegan cards clean`;
});

await check('the meal filter shows only that course', async () => {
  await setSelect('#f-diet', 'veg');
  for (const k of ['maida', 'sugar', 'butter', 'milk', 'rava', 'ghee', 'cardamom', 'cashew']) tickIngredient(k);
  await tick();
  await setSelect('#f-course', 'dessert');
  assert(!$('#results-body .notice'), 'fell back instead of matching desserts');
  assert(cards().length > 0, 'no desserts');
  const bad = titles().filter((t) => !/Kheer|Halwa|Ladoo|Kesari|Payasam|Shrikhand|Payesh|Cake|Cookie|Pudding/.test(t));
  assert(bad.length === 0, 'non-desserts leaked: ' + bad.join(', '));
  await setSelect('#f-course', 'any');
  return 'dessert course only';
});

await check('Avoid: peanut drops every peanut dish', async () => {
  $('#avoid-input').value = 'peanut';
  $('#avoid-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert($$('#avoid-chips .chip').length === 1, 'avoid chip not added');
  assert(!titles().includes('Poha'), 'Poha still listed');
  assert(!titles().includes('Peanut Chutney'), 'Peanut Chutney still listed');
  $('#avoid-chips .chip-remove').click();
  await tick();
  return 'peanut excluded outright';
});

console.log('\nShopping list, favourites, unlocks');

await check('"Add to list" puts the missing ingredients on the shopping list', async () => {
  const btn = cards().map((c) => c.querySelector('[data-shop]')).find(Boolean);
  assert(btn, 'no add-to-list button on any card');
  btn.click();
  await tick();
  assert(!$('#shop-pane').hidden, 'shopping pane did not open');
  const n = Number($('#shop-count').textContent);
  assert(n > 0, 'badge did not update');
  assert($$('#shop-list li').length === n, 'list and badge disagree');
  $('#shop-close').click();
  return `${n} items on the list`;
});

await check('the star saves a recipe and the Saved filter shows it', async () => {
  const fav = cards()[0].querySelector('[data-fav]');
  const name = cards()[0].querySelector('h3').textContent;
  fav.click();
  await tick();
  assert(fav.getAttribute('aria-pressed') === 'true', 'star did not toggle');
  await setSelect('#f-saved', 'saved');
  assert(titles().length === 1 && titles()[0] === name, `saved view shows ${titles().join(',')}`);
  await setSelect('#f-saved', 'all');
  return `saved "${name}"`;
});

await check('the unlock hint suggests an ingredient and applies it', async () => {
  const hint = $('#unlock-hint');
  assert(!hint.hidden, 'no unlock hint shown');
  const btn = hint.querySelector('[data-unlock]');
  assert(btn, 'no clickable unlock suggestion');
  const key = btn.dataset.unlock;
  const before = Number($('#stat-pantry-num').textContent);
  btn.click();
  await tick();
  assert(Number($('#stat-pantry-num').textContent) === before + 1, 'pantry did not grow');
  return `added ${key}`;
});

console.log('\nPersistence and hygiene');

await check("the pantry is filed under this person's own key", async () => {
  const saved = JSON.parse(window.localStorage.getItem('what-can-i-cook:v2:u_smoke'));
  assert(saved && saved.pantry.length > 0, 'nothing saved to the session bucket');
  assert(Array.isArray(saved.favourites) && saved.favourites.length === 1, 'favourites not saved');
  assert(saved.shopping.length > 0, 'shopping list not saved');
  assert(!window.localStorage.getItem('what-can-i-cook:v2:guest'), 'leaked into another bucket');
  return `${saved.pantry.length} pantry, ${saved.favourites.length} saved, ${saved.shopping.length} to buy`;
});

await check('"Show more" pages eight at a time', async () => {
  const first = cards().length;
  const more = $('#show-more');
  assert(!more.hidden, 'show more hidden while results remain');
  more.click();
  await tick();
  assert(cards().length > first, `still ${cards().length} cards`);
  return `${first} → ${cards().length} cards`;
});

await check('nothing logged an error across the whole session', async () => {
  assert(errors.length === 0, errors.join('; '));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('\n' + failures.join('\n')); process.exit(1); }
process.exit(0);
