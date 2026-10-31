// What Can I Cook — UI wiring.
// All the matching and scaling lives in logic.js; this file only touches the DOM.

import {
  canonicalise, canonicaliseAll, scaleIngredient,
  isStaple, rankRecipes,
  FOCUS_TAGS, DIETS, CUISINES, parseMaxTime, timeLabel, costLabel, costWords
} from './logic.js';

const STORAGE_KEY = 'what-can-i-cook:v1';
const PAGE_SIZE = 6;

const COMMON = [
  'onion', 'tomato', 'potato', 'rice', 'atta', 'toor dal', 'rajma', 'chana',
  'paneer', 'curd', 'egg', 'chicken', 'ginger', 'garlic', 'green chilli',
  'peas', 'spinach', 'poha', 'besan', 'lemon', 'oil', 'salt'
];

const state = {
  pantry: [],          // [{key, label, known}]
  avoid: [],
  people: 4,
  focus: new Set(),
  diet: 'veg',
  maxTime: 'any',
  cuisine: 'any',
  limit: PAGE_SIZE,
  expanded: new Set()
};

let recipes = [];

/* ------------------------------------------------------------------ utils */

const $ = (sel, root = document) => root.querySelector(sel);

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const pantryKeys = () => new Set(state.pantry.map((p) => p.key));
const avoidKeys = () => new Set(state.avoid.map((a) => a.key));

/* --------------------------------------------------------------- storage */

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      pantry: state.pantry,
      avoid: state.avoid,
      people: state.people,
      focus: [...state.focus],
      diet: state.diet,
      maxTime: state.maxTime,
      cuisine: state.cuisine
    }));
  } catch (err) {
    /* private mode or storage full — the app still works, it just won't remember */
  }
}

function restore() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
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
  if (Number.isFinite(saved.people)) state.people = Math.min(20, Math.max(1, saved.people));
  if (Array.isArray(saved.focus)) {
    state.focus = new Set(saved.focus.filter((f) => FOCUS_TAGS.some((t) => t.id === f)));
  }
  if (DIETS.some((d) => d.id === saved.diet)) state.diet = saved.diet;
  if (['any', '20', '30', '45', '60+'].includes(saved.maxTime)) state.maxTime = saved.maxTime;
  if (CUISINES.some((c) => c.id === saved.cuisine)) state.cuisine = saved.cuisine;
}

/* ------------------------------------------------------------ chip rows */

function renderPantryChips() {
  const list = $('#pantry-chips');
  list.innerHTML = '';
  for (const item of state.pantry) {
    const li = document.createElement('li');
    li.className = 'chip' + (item.known ? '' : ' is-unknown');
    li.innerHTML =
      `<span class="chip-label">${esc(item.label)}</span>` +
      `<button type="button" class="chip-remove" aria-label="Remove ${esc(item.label)}" data-key="${esc(item.key)}">×</button>`;
    if (!item.known) li.title = 'Not in our ingredient list — kept, but it will not match any recipe.';
    list.appendChild(li);
  }
  // keep the common row in sync
  const have = pantryKeys();
  for (const btn of document.querySelectorAll('#common-chips .chip-btn')) {
    const on = have.has(btn.dataset.key);
    btn.setAttribute('aria-pressed', String(on));
  }
}

function renderAvoidChips() {
  const list = $('#avoid-chips');
  list.innerHTML = '';
  for (const item of state.avoid) {
    const li = document.createElement('li');
    li.className = 'chip';
    li.innerHTML =
      `<span class="chip-label">${esc(item.label)}</span>` +
      `<button type="button" class="chip-remove" aria-label="Stop avoiding ${esc(item.label)}" data-key="${esc(item.key)}">×</button>`;
    list.appendChild(li);
  }
}

function buildCommonChips() {
  const list = $('#common-chips');
  list.innerHTML = '';
  for (const name of COMMON) {
    const hit = canonicalise(name);
    if (!hit) continue;
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-btn';
    btn.dataset.key = hit.key;
    btn.textContent = hit.label;
    btn.setAttribute('aria-pressed', 'false');
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function buildChoiceChips() {
  const focusWrap = $('#focus-chips');
  focusWrap.innerHTML = FOCUS_TAGS.map((t) => (
    `<button type="button" class="chip-btn" data-focus="${t.id}" aria-pressed="false">${esc(t.label)}</button>`
  )).join('');

  const dietWrap = $('#diet-chips');
  dietWrap.innerHTML = DIETS.map((d) => (
    `<button type="button" class="chip-btn" data-diet="${d.id}" aria-pressed="${d.id === state.diet}">${esc(d.label)}</button>`
  )).join('');

  const timeWrap = $('#time-chips');
  const times = [
    { id: 'any', label: 'Any' },
    { id: '20', label: '20 min' },
    { id: '30', label: '30 min' },
    { id: '45', label: '45 min' },
    { id: '60+', label: '60+ min' }
  ];
  timeWrap.innerHTML = times.map((t) => (
    `<button type="button" class="chip-btn" data-time="${t.id}" aria-pressed="${t.id === state.maxTime}">${esc(t.label)}</button>`
  )).join('');

  const select = $('#cuisine-select');
  select.innerHTML = CUISINES.map((c) => (
    `<option value="${c.id}"${c.id === state.cuisine ? ' selected' : ''}>${esc(c.label)}</option>`
  )).join('');
}

/* --------------------------------------------------------------- results */

function cardHTML(match, opts = {}) {
  const { recipe } = match;
  const isOpen = state.expanded.has(recipe.id);
  const pantry = pantryKeys();
  const missingKeys = new Set(match.missing.map((i) => i.item));

  const missingLabels = match.missing.map((i) => i.label);
  const shown = missingLabels.slice(0, 3);
  const extra = missingLabels.length - shown.length;

  let needLine;
  if (!missingLabels.length) {
    needLine = '<p class="need is-complete">You have everything for this.</p>';
  } else {
    needLine = `<p class="need">You'll need <strong>${esc(shown.join(', '))}</strong>` +
      (extra > 0 ? ` and ${extra} more` : '') + '.</p>';
  }

  const serveNote = state.people === recipe.serves
    ? `Serves ${state.people}`
    : `Serves ${state.people} · written for ${recipe.serves}`;

  const meta = [
    timeLabel(recipe.minutes),
    serveNote,
    `<span title="Estimated cost: ${costWords(recipe.costTier)}">${costLabel(recipe.costTier)}</span>`
  ].map((m) => `<span>${m}</span>`).join('');

  const ings = recipe.ingredients.map((ing) => {
    const scaled = scaleIngredient(ing, state.people, recipe.serves);
    const classes = ['ing'];
    if (isStaple(ing)) classes.push('is-staple');
    if (missingKeys.has(ing.item)) classes.push('is-missing');
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

  const recipePanel =
    `<div class="recipe" id="recipe-${esc(recipe.id)}"${isOpen ? '' : ' hidden'}>` +
      `<p class="scale-note">Quantities are for ${state.people} ${state.people === 1 ? 'person' : 'people'}` +
        (state.people === recipe.serves ? '.' : `, scaled from a recipe that serves ${recipe.serves}.`) + '</p>' +
      `<h4>Ingredients</h4>` +
      `<ul class="ing-list">${ings}</ul>` +
      `<h4>Method</h4>` +
      `<ol class="steps">${steps}</ol>` +
    '</div>';

  return (
    `<article class="card${opts.fallback ? ' is-fallback' : ''}">` +
      '<div class="card-head">' +
        `<h3>${esc(recipe.name)}</h3>` +
        `<span class="match">${match.percent}% match</span>` +
      '</div>' +
      `<div class="match-bar" aria-hidden="true"><span style="--pct:${match.percent}%"></span></div>` +
      `<p class="card-meta">${meta}</p>` +
      needLine +
      `<button type="button" class="toggle" data-toggle="${esc(recipe.id)}" aria-expanded="${isOpen}" aria-controls="recipe-${esc(recipe.id)}">` +
        (isOpen ? 'Hide recipe' : 'Show recipe') +
      '</button>' +
      recipePanel +
    '</article>'
  );
}

function options() {
  return {
    diet: state.diet,
    maxMinutes: parseMaxTime(state.maxTime),
    cuisine: state.cuisine,
    avoid: [...avoidKeys()],
    focus: [...state.focus]
  };
}

function render() {
  const body = $('#results-body');
  const count = $('#results-count');
  const moreBtn = $('#show-more');
  const opts = options();

  if (!recipes.length) {
    body.innerHTML = '<p class="notice">The recipe box did not load. If you opened this file straight from disk, serve the folder over HTTP instead — see the README.</p>';
    count.textContent = '';
    moreBtn.hidden = true;
    return;
  }

  const { results, fallback, closest, explanation } = rankRecipes(recipes, pantryKeys(), opts);

  if (fallback) {
    count.textContent = 'nothing matches every filter';
    body.innerHTML =
      '<div class="notice">' +
        `<h3>Nothing lines up</h3>` +
        `<p>${esc(explanation)}</p>` +
        '<p>Here are the three closest, with what they are still missing.</p>' +
      '</div>' +
      '<p class="section-label">Closest matches</p>' +
      closest.map((m) => cardHTML(m, { fallback: true })).join('');
    moreBtn.hidden = true;
    return;
  }

  const total = results.length;
  const visible = results.slice(0, state.limit);

  count.textContent = total === 1 ? '1 dish' : `${total} dishes`;

  const nudge = state.pantry.length === 0
    ? '<div class="notice"><h3>Start with your pantry</h3><p>Add a few things above and these suggestions will rank by what you can actually cook.</p></div>'
    : '';

  body.innerHTML = nudge + visible.map((m) => cardHTML(m)).join('');

  moreBtn.hidden = total <= state.limit;
  if (!moreBtn.hidden) {
    moreBtn.textContent = `Show ${Math.min(PAGE_SIZE, total - state.limit)} more of ${total}`;
  }
}

/* ---------------------------------------------------------------- events */

function addPantry(raw) {
  const hit = canonicalise(raw);
  if (!hit) return;
  if (state.pantry.some((p) => p.key === hit.key)) return;
  state.pantry.push(hit);
  state.limit = PAGE_SIZE;
  save();
  renderPantryChips();
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

function wire() {
  // pantry
  $('#pantry-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#pantry-input');
    // allow comma or newline separated batches
    const parts = input.value.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    parts.forEach(addPantry);
    input.value = '';
    input.focus();
  });

  $('#pantry-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-remove');
    if (!btn) return;
    state.pantry = state.pantry.filter((p) => p.key !== btn.dataset.key);
    state.limit = PAGE_SIZE;
    save();
    renderPantryChips();
    render();
  });

  $('#common-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (!btn) return;
    const key = btn.dataset.key;
    if (state.pantry.some((p) => p.key === key)) {
      state.pantry = state.pantry.filter((p) => p.key !== key);
    } else {
      const hit = canonicalise(btn.textContent);
      if (hit) state.pantry.push(hit);
    }
    state.limit = PAGE_SIZE;
    save();
    renderPantryChips();
    render();
  });

  // people
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

  // focus (multi-select)
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

  // diet (single select)
  $('#diet-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (!btn) return;
    state.diet = btn.dataset.diet;
    for (const b of document.querySelectorAll('#diet-chips .chip-btn')) {
      b.setAttribute('aria-pressed', String(b.dataset.diet === state.diet));
    }
    state.limit = PAGE_SIZE;
    save();
    render();
  });

  // max time (single select)
  $('#time-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-btn');
    if (!btn) return;
    state.maxTime = btn.dataset.time;
    for (const b of document.querySelectorAll('#time-chips .chip-btn')) {
      b.setAttribute('aria-pressed', String(b.dataset.time === state.maxTime));
    }
    state.limit = PAGE_SIZE;
    save();
    render();
  });

  // cuisine
  $('#cuisine-select').addEventListener('change', (e) => {
    state.cuisine = e.target.value;
    state.limit = PAGE_SIZE;
    save();
    render();
  });

  // avoid
  $('#avoid-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#avoid-input');
    const parts = input.value.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    parts.forEach(addAvoid);
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

  // show more / recipe expanders (delegated: cards are re-rendered often)
  $('#results-body').addEventListener('click', (e) => {
    const toggle = e.target.closest('.toggle');
    if (!toggle) return;
    const id = toggle.dataset.toggle;
    const panel = document.getElementById('recipe-' + id);
    if (!panel) return;
    const open = state.expanded.has(id);
    if (open) state.expanded.delete(id);
    else state.expanded.add(id);
    panel.hidden = open;
    toggle.setAttribute('aria-expanded', String(!open));
    toggle.textContent = open ? 'Show recipe' : 'Hide recipe';
  });

  $('#show-more').addEventListener('click', () => {
    state.limit += PAGE_SIZE;
    render();
  });
}

/* ------------------------------------------------------------------ boot */

async function boot() {
  restore();
  buildCommonChips();
  buildChoiceChips();
  renderPantryChips();
  renderAvoidChips();
  $('#people-value').textContent = state.people;
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
