// What Can I Cook — UI wiring.
// Matching, ranking and scaling live in logic.js; this file only touches the DOM.

import {
  VOCAB, GROUPS, BY_KEY, canonicalise, canonicaliseAll, scaleIngredient,
  isStaple, rankRecipes, suggestUnlocks,
  FOCUS_TAGS, DIETS, CUISINES, COURSES, SORTS, parseMaxTime,
  timeLabel, costLabel, costWords
} from './logic.js';
import { initAuth, waitForSession, isConfigured, signOutUser, dataKeyFor } from './auth.js';
import { getFirebaseConfig } from './firebase-runtime.js';
import { initStore, loadProfile, saveProfile, flush, onSyncStatus, resetStore } from './store.js';

const PAGE_SIZE = 8;
const LEGACY_KEY = 'what-can-i-cook:v2';

// set in boot() from the stored session; the pantry is filed under the person
let session = null;
const storageKey = () => dataKeyFor(session);

const PRESETS = {
  basics: ['onion', 'tomato', 'potato', 'rice', 'atta', 'toor dal', 'ginger', 'garlic', 'green chilli', 'curd', 'cumin', 'turmeric'],
  fridge: ['egg', 'bread', 'cheese', 'butter', 'milk', 'capsicum', 'carrot', 'peas', 'mushroom', 'pasta', 'soy sauce', 'mayonnaise'],
  bakery: ['maida', 'sugar', 'butter', 'egg', 'milk', 'baking powder', 'cocoa', 'vanilla', 'curd', 'condensed milk']
};

const state = {
  pantry: [],
  avoid: [],
  people: 4,
  focus: new Set(),
  diet: 'veg',
  maxTime: 'any',
  cuisine: 'any',
  course: 'any',
  sort: 'match',
  savedOnly: false,
  limit: PAGE_SIZE,
  expanded: new Set(),
  favourites: new Set(),
  shopping: [],
  pantryOpen: true
};

let recipes = [];

/* ------------------------------------------------------------------ utils */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const pantryKeys = () => new Set(state.pantry.map((p) => p.key));
const avoidKeys = () => new Set(state.avoid.map((a) => a.key));
const labelFor = (key) => (BY_KEY.get(key) || { label: key }).label;

/* --------------------------------------------------------------- storage */

/** The bit of state worth keeping — identical shape locally and in Firestore. */
function serialiseState() {
  return {
    pantry: state.pantry,
    avoid: state.avoid,
    people: state.people,
    focus: [...state.focus],
    diet: state.diet,
    maxTime: state.maxTime,
    cuisine: state.cuisine,
    course: state.course,
    sort: state.sort,
    favourites: [...state.favourites],
    shopping: state.shopping
  };
}

function save() {
  const payload = serialiseState();
  try {
    localStorage.setItem(storageKey(), JSON.stringify({ ...payload, pantryOpen: state.pantryOpen }));
  } catch (err) {
    /* private mode or full storage — the app still works, it just won't remember */
  }
  // the durable copy follows the account; a failure here never blocks the UI
  if (session) saveProfile(session.userId, payload);
}

/** Apply a profile that came back from Firestore. */
function applyRemoteProfile(remote) {
  if (!remote) return false;
  state.pantry = canonicaliseAll(remote.pantry.map((p) => p.label || p.key));
  state.avoid = canonicaliseAll(remote.avoid.map((p) => p.label || p.key));
  state.shopping = canonicaliseAll(remote.shopping.map((p) => p.label || p.key));
  state.favourites = new Set(remote.favourites);
  state.people = remote.people;
  state.focus = new Set(remote.focus.filter((f) => FOCUS_TAGS.some((t) => t.id === f)));
  state.diet = remote.diet;
  state.maxTime = remote.maxTime;
  state.cuisine = remote.cuisine;
  state.course = remote.course;
  state.sort = remote.sort;
  state.limit = PAGE_SIZE;
  // keep the local cache in step so the next cold start is instant
  try {
    localStorage.setItem(storageKey(), JSON.stringify({ ...serialiseState(), pantryOpen: state.pantryOpen }));
  } catch (err) { /* ignore */ }
  return true;
}

const SYNC_LABELS = {
  local: '',
  saving: 'Saving…',
  synced: 'Saved',
  offline: 'Local only',
  error: 'Not saved'
};

function paintSync(status) {
  const el = $('#sync-status');
  if (!el) return;
  el.textContent = SYNC_LABELS[status] || '';
  el.dataset.state = status;
  el.title = status === 'offline'
    ? 'Saved on this device. Your account copy could not be reached.'
    : status === 'synced'
      ? 'Saved to your account.'
      : '';
}

function restore() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(storageKey()) || 'null');
    // an older single-user pantry, from before sign-in existed
    if (!saved) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        saved = JSON.parse(legacy);
        localStorage.setItem(storageKey(), legacy);
        localStorage.removeItem(LEGACY_KEY);
      }
    }
  } catch (err) {
    saved = null;
  }
  if (!saved || typeof saved !== 'object') return;

  if (Array.isArray(saved.pantry)) {
    state.pantry = canonicaliseAll(saved.pantry.map((p) => (typeof p === 'string' ? p : p.label)));
  }
  if (Array.isArray(saved.avoid)) {
    state.avoid = canonicaliseAll(saved.avoid.map((p) => (typeof p === 'string' ? p : p.label)));
  }
  if (Array.isArray(saved.shopping)) {
    state.shopping = canonicaliseAll(saved.shopping.map((p) => (typeof p === 'string' ? p : p.label)));
  }
  if (Array.isArray(saved.favourites)) {
    state.favourites = new Set(saved.favourites.filter((f) => typeof f === 'string'));
  }
  if (Number.isFinite(saved.people)) state.people = Math.min(20, Math.max(1, saved.people));
  if (Array.isArray(saved.focus)) {
    state.focus = new Set(saved.focus.filter((f) => FOCUS_TAGS.some((t) => t.id === f)));
  }
  if (DIETS.some((d) => d.id === saved.diet)) state.diet = saved.diet;
  if (['any', '20', '30', '45', '60+'].includes(saved.maxTime)) state.maxTime = saved.maxTime;
  if (CUISINES.some((c) => c.id === saved.cuisine)) state.cuisine = saved.cuisine;
  if (COURSES.some((c) => c.id === saved.course)) state.course = saved.course;
  if (SORTS.some((s) => s.id === saved.sort)) state.sort = saved.sort;
  if (typeof saved.pantryOpen === 'boolean') state.pantryOpen = saved.pantryOpen;
}

/* ------------------------------------------------------------ pantry UI */

/** Build the categorised, searchable ingredient browser once. */
function buildPantryGroups() {
  const wrap = $('#pantry-groups');
  wrap.innerHTML = GROUPS.map((group) => {
    const items = VOCAB.filter((v) => v.group === group.id);
    const chips = items.map((v) => (
      `<span class="ing-chip">` +
        `<input type="checkbox" data-key="${esc(v.key)}" id="ing-${esc(v.key.replace(/\s+/g, '-'))}"` +
        ` aria-label="${esc(v.label)}">` +
        `<span class="tick">${esc(v.label)}</span>` +
      `</span>`
    )).join('');
    return (
      `<details class="group" data-group="${group.id}">` +
        `<summary>${esc(group.label)}` +
          `<span class="group-count" data-count-for="${group.id}" hidden>0</span>` +
        `</summary>` +
        `<div class="ing-grid">${chips}</div>` +
      `</details>`
    );
  }).join('');

  // open the vegetable drawer by default — most people start there
  const first = wrap.querySelector('.group');
  if (first) first.open = true;
}

function syncPantryCheckboxes() {
  const have = pantryKeys();
  for (const input of $$('#pantry-groups input[type="checkbox"]')) {
    input.checked = have.has(input.dataset.key);
  }
  // per-group counts of what you have
  for (const group of GROUPS) {
    const total = VOCAB.filter((v) => v.group === group.id && have.has(v.key)).length;
    const badge = $(`[data-count-for="${group.id}"]`);
    if (!badge) continue;
    badge.textContent = String(total);
    badge.hidden = total === 0;
  }
}

function renderSelectedChips() {
  const list = $('#pantry-selected');
  list.innerHTML = state.pantry.map((item) => (
    `<li class="chip${item.known === false ? ' is-unknown' : ''}">` +
      `<span>${esc(item.label)}</span>` +
      `<button type="button" class="chip-remove" aria-label="Remove ${esc(item.label)}" data-key="${esc(item.key)}">×</button>` +
    `</li>`
  )).join('');

  const hint = $('#pantry-empty-hint');
  hint.hidden = state.pantry.length > 0;
}

function renderAvoidChips() {
  const list = $('#avoid-chips');
  list.innerHTML = state.avoid.map((item) => (
    `<li class="chip">` +
      `<span>${esc(item.label)}</span>` +
      `<button type="button" class="chip-remove" aria-label="Stop avoiding ${esc(item.label)}" data-key="${esc(item.key)}">×</button>` +
    `</li>`
  )).join('');
}

/** Filter the visible ingredient chips by the search box. */
function applyPantrySearch(term) {
  const q = String(term || '').trim().toLowerCase();
  for (const group of $$('#pantry-groups .group')) {
    let shown = 0;
    for (const chip of $$('.ing-chip', group)) {
      const key = chip.querySelector('input').dataset.key;
      const label = labelFor(key);
      const hit = !q || label.includes(q) || key.includes(q);
      chip.hidden = !hit;
      if (hit) shown++;
    }
    group.hidden = shown === 0;
    if (q && shown > 0) group.open = true;
  }
}

/* ------------------------------------------------------------- filters */

function buildFilterControls() {
  const fill = (sel, options, current) => {
    const el = $(sel);
    el.innerHTML = options.map((o) => (
      `<option value="${o.id}"${o.id === current ? ' selected' : ''}>${esc(o.label)}</option>`
    )).join('');
  };

  fill('#f-course', COURSES, state.course);
  fill('#f-diet', DIETS, state.diet);
  fill('#f-cuisine', CUISINES, state.cuisine);
  fill('#f-sort', SORTS, state.sort);
  fill('#f-time', [
    { id: 'any', label: 'Any' },
    { id: '20', label: '20 min' },
    { id: '30', label: '30 min' },
    { id: '45', label: '45 min' },
    { id: '60+', label: '60+ min' }
  ], state.maxTime);

  $('#focus-chips').innerHTML = FOCUS_TAGS.map((t) => (
    `<button type="button" class="chip-btn" data-focus="${t.id}" aria-pressed="${state.focus.has(t.id)}">${esc(t.label)}</button>`
  )).join('');
}

function options() {
  return {
    diet: state.diet,
    maxMinutes: parseMaxTime(state.maxTime),
    cuisine: state.cuisine,
    course: state.course,
    avoid: [...avoidKeys()],
    focus: [...state.focus],
    sortBy: state.sort
  };
}

/* ------------------------------------------------------------- results */

function cardHTML(match, opts = {}) {
  const { recipe } = match;
  const isOpen = state.expanded.has(recipe.id);
  const pantry = pantryKeys();
  const missingKeys = new Set(match.missing.map((i) => i.item));
  const isFav = state.favourites.has(recipe.id);

  const complete = match.missing.length === 0;
  const missingLabels = match.missing.map((i) => i.label);
  const shown = missingLabels.slice(0, 3);
  const extra = missingLabels.length - shown.length;

  const needLine = complete
    ? '<p class="need is-complete">You have everything for this.</p>'
    : `<p class="need">Missing <strong>${esc(shown.join(', '))}</strong>${extra > 0 ? ` and ${extra} more` : ''}.</p>`;

  const serveNote = state.people === recipe.serves
    ? `Serves ${state.people}`
    : `Serves ${state.people} · written for ${recipe.serves}`;

  const meta = [
    timeLabel(recipe.minutes),
    serveNote,
    `<span title="Estimated cost: ${costWords(recipe.costTier)}">${costLabel(recipe.costTier)}</span>`,
    esc(recipe.cuisine.replace('-', ' '))
  ].map((m) => `<span>${m}</span>`).join('');

  const ings = recipe.ingredients.map((ing) => {
    const scaled = scaleIngredient(ing, state.people, recipe.serves);
    const classes = ['ing'];
    if (isStaple(ing)) classes.push('is-staple');
    else if (missingKeys.has(ing.item)) classes.push('is-missing');
    else classes.push('is-have');
    const tag = isStaple(ing)
      ? '<span class="ing-orig">assumed</span>'
      : (ing.optional ? '<span class="ing-orig">optional</span>' : '');
    const orig = state.people === recipe.serves ? '' : `<span class="ing-orig">was ${esc(scaled.original)}</span>`;
    return `<li class="${classes.join(' ')}">` +
      `<span class="ing-qty">${esc(scaled.text)}</span>` +
      `<span class="ing-name">${esc(ing.item)}${tag}${orig}</span>` +
      '</li>';
  }).join('');

  const steps = recipe.steps.map((s) => `<li>${esc(s)}</li>`).join('');

  const shopBtn = match.missing.length
    ? `<button type="button" class="btn-shop-item" data-shop="${esc(recipe.id)}">Add ${match.missing.length} to list</button>`
    : '';

  const panel =
    `<div class="recipe" id="recipe-${esc(recipe.id)}"${isOpen ? '' : ' hidden'}>` +
      `<p class="scale-note">Quantities for ${state.people} ${state.people === 1 ? 'person' : 'people'}` +
        (state.people === recipe.serves ? '.' : `, scaled from a recipe that serves ${recipe.serves}.`) + '</p>' +
      '<h4>Ingredients</h4>' +
      `<ul class="ing-list">${ings}</ul>` +
      '<h4>Method</h4>' +
      `<ol class="steps">${steps}</ol>` +
    '</div>';

  return (
    `<article class="card${complete ? ' is-ready' : ''}${opts.fallback ? ' is-fallback' : ''}" data-id="${esc(recipe.id)}">` +
      '<div class="card-head">' +
        `<h3>${esc(recipe.name)}</h3>` +
        `<span class="have-badge${complete ? ' is-full' : ''}">` +
          `${complete ? '✓ ' : ''}${match.matchedCount}/${match.requiredCount}` +
        '</span>' +
      '</div>' +
      `<p class="card-meta">${meta}</p>` +
      needLine +
      '<div class="card-actions">' +
        `<button type="button" class="toggle" data-toggle="${esc(recipe.id)}" aria-expanded="${isOpen}" aria-controls="recipe-${esc(recipe.id)}">` +
          (isOpen ? 'Hide recipe' : 'Show recipe') +
        '</button>' +
        shopBtn +
        `<button type="button" class="btn-fav" data-fav="${esc(recipe.id)}" aria-pressed="${isFav}" ` +
          `aria-label="${isFav ? 'Remove from saved' : 'Save this recipe'}">${isFav ? '★' : '☆'}</button>` +
      '</div>' +
      panel +
    '</article>'
  );
}

function sectionHTML(label, note, matches, opts) {
  if (!matches.length) return '';
  return (
    `<div class="section-head"><h3>${esc(label)}</h3>` +
      (note ? `<span class="section-note">${esc(note)}</span>` : '') +
    '</div>' +
    matches.map((m) => cardHTML(m, opts)).join('')
  );
}

function render() {
  const body = $('#results-body');
  const countEl = $('#results-count');
  const moreBtn = $('#show-more');
  const opts = options();

  if (!recipes.length) {
    body.innerHTML = '<p class="notice">The recipe box did not load. If you opened this file straight from disk, serve the folder over HTTP instead — see the README.</p>';
    countEl.textContent = '';
    moreBtn.hidden = true;
    return;
  }

  const ranked = rankRecipes(recipes, pantryKeys(), opts);

  // saved-only is a view filter, applied after ranking
  const savedFilter = (list) => (state.savedOnly ? list.filter((m) => state.favourites.has(m.recipe.id)) : list);

  if (ranked.fallback) {
    countEl.textContent = 'nothing matches every filter';
    body.innerHTML =
      '<div class="notice">' +
        '<h3>Nothing lines up</h3>' +
        `<p>${esc(ranked.explanation)}</p>` +
        '<p>Here are the three closest, with what they are still missing.</p>' +
      '</div>' +
      ranked.closest.map((m) => cardHTML(m, { fallback: true })).join('');
    moreBtn.hidden = true;
    updateUnlock(ranked);
    updateStats(0);
    return;
  }

  const ordered = savedFilter(ranked.results);
  const visible = ordered.slice(0, state.limit);

  if (state.savedOnly && !ordered.length) {
    countEl.textContent = 'no saved recipes yet';
    body.innerHTML = '<div class="notice"><h3>Nothing saved yet</h3>' +
      '<p>Tap the star on any recipe to keep it here.</p></div>';
    moreBtn.hidden = true;
    updateUnlock(ranked);
    updateStats(ranked.stats.makeable);
    return;
  }

  const bucket = (list, n) => list.filter((m) => m.missing.length === n);
  const makeNow = bucket(visible, 0);
  const almost = bucket(visible, 1);
  const twoAway = bucket(visible, 2);
  const further = visible.filter((m) => m.missing.length > 2);

  let html = '';

  if (state.pantry.length === 0) {
    html += '<div class="notice"><h3>Start with your pantry</h3>' +
      '<p>Tick what you have on the left — or tap a Quick fill preset — and these will rank by what you can actually cook.</p></div>';
  }

  html += sectionHTML('Make right now', `${makeNow.length} ready to cook`, makeNow);
  html += sectionHTML('One ingredient away', '', almost);
  html += sectionHTML('Two away', '', twoAway);
  html += sectionHTML('Further off', 'the rest of the recipe box', further);

  if (!html.trim()) {
    html = '<div class="notice"><h3>Nothing here</h3><p>Try widening a filter.</p></div>';
  }

  body.innerHTML = html;

  const shownCount = visible.length;
  countEl.textContent = state.savedOnly
    ? `${ordered.length} saved`
    : `${ranked.stats.total} recipes · ${ranked.stats.makeable} cookable now`;

  moreBtn.hidden = shownCount >= ordered.length;
  if (!moreBtn.hidden) {
    moreBtn.textContent = `Show ${Math.min(PAGE_SIZE, ordered.length - shownCount)} more of ${ordered.length}`;
  }

  updateUnlock(ranked);
  updateStats(ranked.stats.makeable);
}

function updateStats(makeable) {
  $('#stat-pantry-num').textContent = String(state.pantry.length);
  $('#stat-recipes-num').textContent = String(makeable);
}

/** "Add eggs to unlock 12 more" — the popular-additions hint. */
function updateUnlock(ranked) {
  const el = $('#unlock-hint');
  if (!state.pantry.length) {
    el.hidden = true;
    return;
  }

  const unlocks = suggestUnlocks(recipes, pantryKeys(), options(), 3);
  if (!unlocks.length) {
    el.hidden = true;
    return;
  }

  const parts = unlocks.map((u) => (
    `<button type="button" class="chip-btn" data-unlock="${esc(u.key)}">${esc(u.label)}</button> ` +
    `<span>unlocks ${u.count}</span>`
  ));

  el.innerHTML = `<strong>One ingredient away:</strong> ` + parts.join(' &nbsp;·&nbsp; ');
  el.hidden = false;
}

/* ------------------------------------------------------------- shopping */

function renderShop() {
  const list = $('#shop-list');
  list.innerHTML = state.shopping.map((item) => (
    `<li><span>${esc(item.label)}</span>` +
      `<button type="button" class="chip-remove" data-shop-remove="${esc(item.key)}" aria-label="Remove ${esc(item.label)} from the list">×</button>` +
    `</li>`
  )).join('');
  $('#shop-count').textContent = String(state.shopping.length);
}

function addMissingToShop(recipeId) {
  const recipe = recipes.find((r) => r.id === recipeId);
  if (!recipe) return;
  const have = pantryKeys();
  const add = recipe.ingredients
    .filter((i) => !i.optional && !isStaple(i) && !have.has(i.item));

  for (const ing of add) {
    if (state.shopping.some((s) => s.key === ing.item)) continue;
    state.shopping.push({ key: ing.item, label: labelFor(ing.item) });
  }
  save();
  renderShop();
  openShop();
}

function openShop() {
  const pane = $('#shop-pane');
  pane.hidden = false;
  $('#shop-toggle').setAttribute('aria-expanded', 'true');
}

function closeShop() {
  const pane = $('#shop-pane');
  pane.hidden = true;
  $('#shop-toggle').setAttribute('aria-expanded', 'false');
}

/* ---------------------------------------------------------------- events */

function addPantry(raw) {
  const hit = canonicalise(raw);
  if (!hit) return;
  if (state.pantry.some((p) => p.key === hit.key)) return;
  state.pantry.push(hit);
  state.limit = PAGE_SIZE;
  save();
  syncPantryCheckboxes();
  renderSelectedChips();
  render();
}

function addAvoid(raw) {
  const hit = canonicalise(raw);
  if (!hit) return;
  if (state.avoid.some((a) => a.key === hit.key)) return;
  state.avoid.push(hit);
  state.limit = PAGE_SIZE;
  save();
  renderAvoidChips();
  render();
}

function removePantry(key) {
  state.pantry = state.pantry.filter((p) => p.key !== key);
  state.limit = PAGE_SIZE;
  save();
  syncPantryCheckboxes();
  renderSelectedChips();
  render();
}

function setPantryOpen(open) {
  state.pantryOpen = open;
  $('#pantry-body').hidden = !open;
  const btn = $('#pantry-collapse');
  btn.textContent = open ? 'Hide' : 'Show';
  btn.setAttribute('aria-expanded', String(open));
  save();
}

function wire() {
  // pantry checkboxes (delegated — 140 of them)
  $('#pantry-groups').addEventListener('change', (e) => {
    const input = e.target.closest('input[type="checkbox"]');
    if (!input) return;
    const key = input.dataset.key;
    if (input.checked) {
      const hit = canonicalise(key);
      if (hit && !state.pantry.some((p) => p.key === hit.key)) state.pantry.push(hit);
    } else {
      state.pantry = state.pantry.filter((p) => p.key !== key);
    }
    state.limit = PAGE_SIZE;
    save();
    syncPantryCheckboxes();
    renderSelectedChips();
    render();
  });

  $('#pantry-selected').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-remove');
    if (btn) removePantry(btn.dataset.key);
  });

  $('#ingredient-search').addEventListener('input', (e) => {
    applyPantrySearch(e.target.value);
  });

  $('#presets').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    const name = btn.dataset.preset;
    if (name === 'clear') {
      state.pantry = [];
    } else {
      const list = PRESETS[name] || [];
      const merged = [...state.pantry];
      for (const key of list) {
        if (merged.some((p) => p.key === key)) continue;
        const hit = canonicalise(key);
        if (hit) merged.push(hit);
      }
      state.pantry = merged;
    }
    state.limit = PAGE_SIZE;
    save();
    syncPantryCheckboxes();
    renderSelectedChips();
    render();
  });

  $('#custom-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#custom-input');
    input.value.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).forEach(addPantry);
    input.value = '';
    input.focus();
  });

  $('#pantry-collapse').addEventListener('click', () => setPantryOpen(!state.pantryOpen));

  // filters
  $('#f-course').addEventListener('change', (e) => {
    state.course = e.target.value; state.limit = PAGE_SIZE; save(); render();
  });
  $('#f-diet').addEventListener('change', (e) => {
    state.diet = e.target.value; state.limit = PAGE_SIZE; save(); render();
  });
  $('#f-time').addEventListener('change', (e) => {
    state.maxTime = e.target.value; state.limit = PAGE_SIZE; save(); render();
  });
  $('#f-cuisine').addEventListener('change', (e) => {
    state.cuisine = e.target.value; state.limit = PAGE_SIZE; save(); render();
  });
  $('#f-sort').addEventListener('change', (e) => {
    state.sort = e.target.value; state.limit = PAGE_SIZE; save(); render();
  });

  $('#f-saved').addEventListener('change', (e) => {
    state.savedOnly = e.target.value === 'saved';
    state.limit = PAGE_SIZE;
    render();
  });

  // headcount stepper — scaling follows this
  $('#people-down').addEventListener('click', () => {
    state.people = Math.max(1, state.people - 1);
    $('#people-value').textContent = state.people;
    save();
    render();
  });
  $('#people-up').addEventListener('click', () => {
    state.people = Math.min(20, state.people + 1);
    $('#people-value').textContent = state.people;
    save();
    render();
  });

  $('#focus-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (!btn) return;
    const id = btn.dataset.focus;
    if (state.focus.has(id)) state.focus.delete(id);
    else state.focus.add(id);
    btn.setAttribute('aria-pressed', String(state.focus.has(id)));
    state.limit = PAGE_SIZE;
    save();
    render();
  });

  // avoid
  $('#avoid-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#avoid-input');
    input.value.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).forEach(addAvoid);
    input.value = '';
    input.focus();
  });

  $('#avoid-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-remove');
    if (!btn) return;
    state.avoid = state.avoid.filter((a) => a.key !== btn.dataset.key);
    state.limit = PAGE_SIZE;
    save();
    renderAvoidChips();
    render();
  });

  // unlock hint
  $('#unlock-hint').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-unlock]');
    if (btn) addPantry(btn.dataset.unlock);
  });

  // results: expand, favourite, shopping
  $('#results-body').addEventListener('click', (e) => {
    const toggle = e.target.closest('.toggle');
    if (toggle) {
      const id = toggle.dataset.toggle;
      const panel = document.getElementById('recipe-' + id);
      if (!panel) return;
      const open = state.expanded.has(id);
      if (open) state.expanded.delete(id);
      else state.expanded.add(id);
      panel.hidden = open;
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.textContent = open ? 'Show recipe' : 'Hide recipe';
      return;
    }

    const fav = e.target.closest('[data-fav]');
    if (fav) {
      const id = fav.dataset.fav;
      if (state.favourites.has(id)) state.favourites.delete(id);
      else state.favourites.add(id);
      const on = state.favourites.has(id);
      fav.setAttribute('aria-pressed', String(on));
      fav.textContent = on ? '★' : '☆';
      fav.setAttribute('aria-label', on ? 'Remove from saved' : 'Save this recipe');
      save();
      if (state.savedOnly) render();
      return;
    }

    const shop = e.target.closest('[data-shop]');
    if (shop) addMissingToShop(shop.dataset.shop);
  });

  $('#show-more').addEventListener('click', () => {
    state.limit += PAGE_SIZE;
    render();
  });

  // shopping list
  $('#shop-toggle').addEventListener('click', () => {
    const open = $('#shop-toggle').getAttribute('aria-expanded') === 'true';
    if (open) closeShop();
    else openShop();
  });
  $('#shop-close').addEventListener('click', closeShop);

  $('#shop-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-shop-remove]');
    if (!btn) return;
    state.shopping = state.shopping.filter((s) => s.key !== btn.dataset.shopRemove);
    save();
    renderShop();
  });

  $('#shop-clear').addEventListener('click', () => {
    state.shopping = [];
    save();
    renderShop();
  });

  $('#shop-copy').addEventListener('click', async () => {
    const text = state.shopping.map((s) => `- ${s.label}`).join('\n');
    if (!text) return;
    const btn = $('#shop-copy');
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied';
    } catch (err) {
      btn.textContent = 'Copy failed';
    }
    setTimeout(() => { btn.textContent = 'Copy list'; }, 1600);
  });
}

/* ------------------------------------------------------------------ boot */

function showCard(title, body, linkLabel) {
  document.body.innerHTML =
    '<main class="auth-wrap"><section class="auth-card">' +
      `<h1>${title}</h1>` +
      `<p class="auth-lede">${body}</p>` +
      `<p><a href="login.html">${linkLabel}</a></p>` +
    '</section></main>';
}

async function boot() {
  const configured = isConfigured(getFirebaseConfig());

  if (!configured) {
    // No Firebase keys yet. Rather than wall the site off, run it exactly as it
    // did before accounts existed: one local profile on this device, and a
    // banner that says so. The moment keys are added, the gate switches on.
    session = { userId: 'local', name: 'This device', provider: 'local', anonymous: true };
    const banner = $('#local-banner');
    if (banner) banner.hidden = false;
    const nameEl = $('#account-name');
    if (nameEl) nameEl.textContent = 'This device';
    const out = $('#signout-btn');
    if (out) out.hidden = true;
  } else {
    await initAuth(getFirebaseConfig());
    session = await waitForSession();

    if (!session) {
      showCard(
        'Taking you to sign in…',
        'Your pantry is kept per person, so we need to know who you are.',
        'Continue to sign in'
      );
      window.location.replace('login.html');
      return;
    }

    const nameEl = $('#account-name');
    if (nameEl) nameEl.textContent = session.name || 'Guest';
    $('#signout-btn').addEventListener('click', async () => {
      await flush();
      resetStore();
      await signOutUser();
      window.location.replace('login.html');
    });
  }

  await initStore(getFirebaseConfig());
  onSyncStatus(paintSync);
  paintSync('local');

  restore(); // the instant local copy, so something is on screen immediately

  const remote = await loadProfile(session.userId);
  if (remote && remote.updatedAt) {
    applyRemoteProfile(remote);
  } else {
    // nothing in the database for this account yet — push what is on this device
    saveProfile(session.userId, serialiseState());
  }

  buildPantryGroups();
  buildFilterControls();
  syncPantryCheckboxes();
  renderSelectedChips();
  renderAvoidChips();
  renderShop();
  setPantryOpen(state.pantryOpen);
  $('#people-value').textContent = state.people;
  $('#f-saved').value = state.savedOnly ? 'saved' : 'all';
  wire();

  try {
    const res = await fetch('recipes.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    recipes = await res.json();
    if (!Array.isArray(recipes) || !recipes.length) throw new Error('empty recipe list');
  } catch (err) {
    recipes = [];
  }

  render();
}

boot();
