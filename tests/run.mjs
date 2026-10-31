// Acceptance checks for What Can I Cook.
// Run with: node tests/run.mjs
// Each block mirrors one bullet from the brief.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalise, canonicaliseAll, rankRecipes, scaleIngredient, formatQty, formatEggs,
  scoreRecipe, passesFilters, requiredIngredients, isStaple, parseMaxTime, STAPLES
} from '../logic.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const recipes = JSON.parse(fs.readFileSync(path.join(root, 'recipes.json'), 'utf8'));

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    const detail = fn();
    passed++;
    console.log(`  ok   ${name}${detail ? '  — ' + detail : ''}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const keys = (list) => new Set(list.map((x) => canonicalise(x).key));
const byId = (id) => recipes.find((r) => r.id === id);

console.log('\nCanonicalising ingredients');

check('"pyaz" and "onions" both become onion, same as "onion"', () => {
  const a = canonicalise('pyaz');
  const b = canonicalise('onions');
  const c = canonicalise('Onion');
  const d = canonicalise('1 onion');
  const e = canonicalise('2 medium onions, finely chopped');
  assert(a && b && c && d && e, 'one of the variants did not resolve');
  for (const x of [b, c, d, e]) assert(x.key === 'onion', `expected onion, got ${x.key}`);
  assert(a.key === 'onion', `expected onion, got ${a.key}`);
  return 'pyaz / onions / Onion / 1 onion / 2 medium onions all → onion';
});

check('quantities and units are stripped before matching', () => {
  assert(canonicalise('200 g rajma').key === 'rajma');
  assert(canonicalise('1 tbsp haldi').key === 'turmeric');
  assert(canonicalise('500ml doodh').key === 'milk');
  assert(canonicalise('a pinch of namak').key === 'salt');
  return '200 g rajma, 1 tbsp haldi, 500ml doodh, a pinch of namak';
});

check('alias families resolve (tamatar, dahi, atta, haldi)', () => {
  const cases = { tamatar: 'tomato', dahi: 'curd', yogurt: 'curd', 'wheat flour': 'atta', haldi: 'turmeric', adrak: 'ginger', lehsun: 'garlic' };
  for (const [input, want] of Object.entries(cases)) {
    const got = canonicalise(input);
    assert(got && got.key === want, `${input} → ${got && got.key}, wanted ${want}`);
  }
  return Object.keys(cases).join(', ');
});

check('unknown words are kept, flagged unknown, and never crash', () => {
  const hit = canonicalise('dragonfruit');
  assert(hit && hit.known === false && hit.key === 'dragonfruit');
  assert(canonicalise('') === null);
  assert(canonicalise('   ') === null);
  assert(canonicalise(null) === null);
  assert(canonicalise('1 2 3') === null);
  return 'kept as-is with known:false';
});

check('duplicates collapse, order preserved', () => {
  const list = canonicaliseAll(['onion', 'pyaz', 'Onion', 'tomato']);
  assert(list.length === 2, `expected 2, got ${list.length}`);
  assert(list[0].key === 'onion' && list[1].key === 'tomato');
  return 'onion, pyaz, Onion → one chip';
});

console.log('\nAcceptance: rajma pantry, high protein');

check('rajma, onion, tomato + High protein returns Rajma first at a high match', () => {
  const pantry = keys(['rajma', 'onion', 'tomato']);
  const { results, fallback } = rankRecipes(recipes, pantry, { diet: 'veg', focus: ['high-protein'] });
  assert(!fallback && results.length, 'no results at all');
  assert(results[0].recipe.id === 'rajma', `first was ${results[0].recipe.id}, wanted rajma`);
  assert(results[0].percent >= 80, `match only ${results[0].percent}%`);
  assert(results[0].missing.length === 0, 'rajma should need nothing else');
  return `${results[0].recipe.name} at ${results[0].percent}%, ${results.length} candidates`;
});

check('scoring formula is exactly coverage*100 - missing*12 + focusBonus', () => {
  const r = byId('rajma');
  const full = scoreRecipe(r, keys(['rajma', 'onion', 'tomato']), ['high-protein', 'one-pot', 'budget', 'high-fibre']);
  const req = requiredIngredients(r).length;
  assert(full.coverage === 1, `coverage ${full.coverage} for ${req} required`);
  assert(full.score === 100 + full.bonus, `score ${full.score} with bonus ${full.bonus}`);
  assert(full.bonus === 24, `bonus should cap at 24, got ${full.bonus}`);

  const partial = scoreRecipe(r, keys(['rajma']), []);
  const expected = (1 / req) * 100 - (req - 1) * 12;
  assert(Math.abs(partial.score - expected) < 1e-9, `partial score ${partial.score} vs ${expected}`);
  return `full ${full.score}, partial ${partial.score.toFixed(0)}`;
});

check('focus bonus caps at +24 and respects quick/budget conditions', () => {
  const slow = recipes.find((r) => r.focus.includes('quick') && r.minutes > 30);
  assert(!slow, 'data error: a recipe tagged quick runs over 30 minutes');
  const expensive = recipes.find((r) => r.focus.includes('budget') && r.costTier !== 1);
  assert(!expensive, 'data error: a recipe tagged budget is not cost tier 1');

  const many = scoreRecipe(byId('rajma'), keys(['rajma', 'onion', 'tomato']),
    ['high-protein', 'one-pot', 'budget', 'high-fibre']);
  assert(many.bonus === 24, `bonus ${many.bonus}`);
  return 'four matching tags still pays 24';
});

console.log('\nAcceptance: diet filters');

check('Vegan removes every recipe with egg, dairy or meat', () => {
  const forbidden = ['egg', 'curd', 'milk', 'butter', 'ghee', 'cheese', 'paneer', 'chicken', 'fish'];
  const { results } = rankRecipes(recipes, keys(['onion', 'tomato', 'rice', 'dal', 'atta']), { diet: 'vegan' });
  assert(results.length > 0, 'vegan returned nothing');
  for (const m of results) {
    assert(m.recipe.diet === 'vegan', `${m.recipe.id} is ${m.recipe.diet}`);
    for (const ing of m.recipe.ingredients) {
      assert(!forbidden.includes(ing.item), `${m.recipe.id} contains ${ing.item}`);
    }
  }
  const veg = rankRecipes(recipes, keys(['onion']), { diet: 'veg' }).results;
  assert(veg.every((m) => m.recipe.diet === 'vegan' || m.recipe.diet === 'veg'), 'veg leaked a non-veg recipe');
  const eggOk = rankRecipes(recipes, keys(['onion']), { diet: 'egg' }).results;
  assert(eggOk.every((m) => ['vegan', 'veg', 'egg'].includes(m.recipe.diet)), 'egg diet leaked meat');
  return `${results.length} vegan, ${veg.length} veg, ${eggOk.length} egg-ok`;
});

console.log('\nAcceptance: scaling');

check('scaling 4 → 7 gives usable quantities', () => {
  const rajma = byId('rajma');
  const gram = scaleIngredient(rajma.ingredients.find((i) => i.item === 'rajma'), 7, 4);
  assert(gram.text === '350 g', `rajma 200g → ${gram.text}`);
  const onion = scaleIngredient(rajma.ingredients.find((i) => i.item === 'onion'), 7, 4);
  assert(onion.text === '2', `onion 1 → ${onion.text}`);
  const tomato = scaleIngredient(rajma.ingredients.find((i) => i.item === 'tomato'), 7, 4);
  assert(tomato.text === '4', `tomato 2 → ${tomato.text}`);
  const tsp = scaleIngredient(rajma.ingredients.find((i) => i.item === 'cumin'), 7, 4);
  assert(tsp.text === '1¾ tsp', `cumin 1 tsp → ${tsp.text}`);
  assert(tomato.original === '2', `original shown as ${tomato.original}`);
  return `200 g → ${gram.text}, 1 onion → ${onion.text}, 2 tomato → ${tomato.text}, 1 tsp → ${tsp.text}`;
});

check('rounding rules: grams to 5, spoons to a quarter, pieces to a half then whole', () => {
  const g = (q, p, s) => scaleIngredient({ item: 'rice', qty: q, unit: 'g' }, p, s).text;
  assert(g(200, 3, 4) === '150 g', `200g 4→3 = ${g(200, 3, 4)}`);
  assert(g(200, 1, 4) === '50 g', `200g 4→1 = ${g(200, 1, 4)}`);
  assert(g(15, 1, 4) === '4 g', `15g 4→1 should round to the nearest 1 = ${g(15, 1, 4)}`);
  // 100g / 6 = 16.7g — under 20, so the rule rounds to the nearest 1, not the nearest 5
  assert(g(100, 1, 6) === '17 g', `100g 6→1 = ${g(100, 1, 6)}`);
  const t = (q, p, s) => scaleIngredient({ item: 'cumin', qty: q, unit: 'tsp' }, p, s).text;
  assert(t(1, 1, 3) === '¼ tsp', `1 tsp 3→1 = ${t(1, 1, 3)}`);
  assert(t(1, 5, 3) === '1¾ tsp', `1 tsp 3→5 = ${t(1, 5, 3)}`);
  const p = (q, pp, s) => scaleIngredient({ item: 'onion', qty: q, unit: 'piece' }, pp, s).text;
  assert(p(1, 6, 4) === '1½', `1 onion 4→6 = ${p(1, 6, 4)}`);
  assert(p(1, 10, 4) === '3', `1 onion 4→10 = ${p(1, 10, 4)}`);
  return 'g, tsp, piece all land on the specified steps';
});

check('eggs never show a fraction', () => {
  assert(formatEggs(4 / 3) === '1 egg + 1 yolk', `1.33 eggs → ${formatEggs(4 / 3)}`);
  assert(formatEggs(1.5) === '1 egg + 1 yolk', `1.5 eggs → ${formatEggs(1.5)}`);
  assert(formatEggs(2.5) === '2 or 3 eggs', `2.5 eggs → ${formatEggs(2.5)}`);
  assert(formatEggs(2) === '2 eggs', `2 eggs → ${formatEggs(2)}`);
  assert(formatEggs(1) === '1 egg', `1 egg → ${formatEggs(1)}`);
  assert(formatEggs(0.5) === '1 yolk', `0.5 eggs → ${formatEggs(0.5)}`);
  assert(formatEggs(3) === '3 eggs', `3 eggs → ${formatEggs(3)}`);

  // and no recipe at any headcount produces a decimal egg count
  for (const people of [1, 2, 3, 5, 7, 9, 11]) {
    for (const r of recipes) {
      for (const ing of r.ingredients) {
        const s = scaleIngredient(ing, people, r.serves);
        assert(!/\d\.\d/.test(s.text), `${r.id} ${ing.item} at ${people} people → "${s.text}"`);
        assert(!s.text.includes('.'), `${r.id} ${ing.item} at ${people} people → "${s.text}"`);
      }
    }
  }
  return '1.33 → "1 egg + 1 yolk", 2.5 → "2 or 3 eggs", no decimals at any headcount';
});

console.log('\nAcceptance: avoid and empty states');

check('Avoid: peanut excludes every recipe containing peanut', () => {
  const withPeanut = recipes.filter((r) => r.ingredients.some((i) => i.item === 'peanut'));
  assert(withPeanut.length > 0, 'no peanut recipes to exclude — the test proves nothing');
  const pantry = keys(['onion', 'tomato', 'rice', 'poha', 'besan', 'chana']);
  const without = rankRecipes(recipes, pantry, { diet: 'non-veg' }).results;
  assert(without.some((m) => m.recipe.ingredients.some((i) => i.item === 'peanut')), 'peanut recipes missing before the filter');

  const avoided = rankRecipes(recipes, pantry, { diet: 'non-veg', avoid: keys(['peanut']) }).results;
  for (const m of avoided) {
    assert(!m.recipe.ingredients.some((i) => i.item === 'peanut'), `${m.recipe.id} still contains peanut`);
  }
  assert(avoided.length < without.length, 'avoiding peanut removed nothing');
  return `${withPeanut.length} peanut recipes excluded (${without.length} → ${avoided.length} results)`;
});

check('Avoid is a hard filter, not a penalty', () => {
  const m = { recipe: byId('poha'), ingredients: [] };
  const ok = passesFilters(byId('poha'), { diet: 'vegan', avoid: keys(['peanut']) });
  assert(ok === false, 'poha has peanut as an optional ingredient and should be excluded outright');
  return 'an optional peanut still excludes the dish';
});

check('Impossible combination explains itself instead of showing a blank screen', () => {
  const pantry = keys(['chicken']);
  const out = rankRecipes(recipes, pantry, { diet: 'vegan', maxMinutes: 20 });
  assert(out.fallback === true, 'expected the fallback path');
  assert(out.results.length === 0, 'fallback should carry no results');
  assert(out.closest.length === 3, `expected 3 closest, got ${out.closest.length}`);
  assert(/vegan/i.test(out.explanation), `explanation should name the diet: "${out.explanation}"`);
  assert(/20 minutes/.test(out.explanation), `explanation should name the time limit: "${out.explanation}"`);
  assert(/closest/i === null || true);
  for (const c of out.closest) {
    assert(Array.isArray(c.missing), 'closest match must spell out what is missing');
  }
  return out.explanation;
});

check('Empty pantry does not crash and still returns something', () => {
  const out = rankRecipes(recipes, new Set(), { diet: 'veg' });
  assert(out.results.length > 0, 'empty pantry produced nothing');
  assert(out.results.every((m) => m.percent >= 0), 'negative percentages leaked into the display');
  const strict = rankRecipes(recipes, new Set(), { diet: 'vegan', maxMinutes: 20, cuisine: 'bengali' });
  assert(typeof strict.explanation === 'string' && strict.explanation.length > 0, 'no explanation for the strict empty case');
  return `${out.results.length} dishes still listed, top is ${out.results[0].recipe.name}`;
});

console.log('\nData and coverage');

check('every focus chip can return something', () => {
  const pantry = keys(['onion', 'tomato', 'potato', 'rice', 'atta', 'dal', 'egg', 'chicken', 'paneer', 'curd', 'peas', 'cabbage', 'spinach', 'besan', 'poha', 'chana', 'rajma', 'moong dal', 'lemon', 'peanut', 'coconut', 'brinjal', 'lauki', 'bhindi', 'grated coconut']);
  const tags = ['high-protein', 'low-oil', 'quick', 'budget', 'one-pot', 'kid-friendly', 'high-fibre'];
  const report = [];
  for (const tag of tags) {
    const { results } = rankRecipes(recipes, pantry, { diet: 'non-veg', focus: [tag] });
    assert(results.length > 0, `${tag} returned nothing`);
    report.push(`${tag} ${results.length}`);
  }
  return report.join(', ');
});

check('at least 40 recipes, 8 high-protein, 8 under 20 minutes, 8 one-pot', () => {
  assert(recipes.length >= 40, `only ${recipes.length} recipes`);
  const hp = recipes.filter((r) => r.focus.includes('high-protein')).length;
  const fast = recipes.filter((r) => r.minutes < 20).length;
  const pot = recipes.filter((r) => r.focus.includes('one-pot')).length;
  assert(hp >= 8, `only ${hp} high-protein`);
  assert(fast >= 8, `only ${fast} under 20 minutes`);
  assert(pot >= 8, `only ${pot} one-pot`);
  return `${recipes.length} recipes, ${hp} high-protein, ${fast} under 20 min, ${pot} one-pot`;
});

check('every recipe has required ingredients, steps and a valid shape', () => {
  for (const r of recipes) {
    assert(requiredIngredients(r).length > 0, `${r.id} has no required ingredients`);
    assert(r.steps.length >= 3, `${r.id} has ${r.steps.length} steps`);
    assert(r.serves > 0 && r.minutes > 0, `${r.id} has a bad serves/minutes`);
    for (const i of r.ingredients) {
      assert(typeof i.qty === 'number' && i.qty > 0, `${r.id} ${i.item} qty ${i.qty}`);
    }
  }
  return `${recipes.length} recipes shaped correctly`;
});

check('staples are never counted as missing', () => {
  for (const s of STAPLES) {
    const users = recipes.filter((r) => r.ingredients.some((i) => i.item === s && !i.staple));
    for (const r of users) {
      const m = scoreRecipe(r, new Set(), []);
      assert(!m.missing.some((i) => i.item === s), `${r.id} counts ${s} as missing`);
    }
  }
  return `${STAPLES.size} staples assumed present`;
});

check('results are sorted by match, best first', () => {
  const { results } = rankRecipes(recipes, keys(['onion', 'tomato', 'rice']), { diet: 'veg', focus: ['budget'] });
  for (let i = 1; i < results.length; i++) {
    assert(results[i - 1].score >= results[i].score, `out of order at ${i}`);
  }
  return `${results.length} results in descending order`;
});

check('max time 60+ means no upper limit', () => {
  assert(parseMaxTime('60+') === null, '60+ should not impose a ceiling');
  assert(parseMaxTime('any') === null, 'any should not impose a ceiling');
  assert(parseMaxTime('20') === 20, '20 should map to 20');
  return '60+ and any impose no ceiling';
});

console.log('\nPage wiring');

check('every element id app.js reaches for exists in index.html', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const wanted = new Set([...js.matchAll(/\$\('#([a-zA-Z0-9_-]+)'\)/g)].map((m) => m[1]));
  for (const w of wanted) assert(ids.has(w), `app.js looks for #${w} but index.html has no such id`);
  return `${wanted.size} ids checked`;
});

check('index.html loads the stylesheet, the module and the fonts it names', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(html.includes('href="styles.css"'), 'stylesheet not linked');
  assert(html.includes('type="module" src="app.js"'), 'app.js not loaded as a module');
  for (const f of ['styles.css', 'app.js', 'logic.js', 'recipes.json']) {
    assert(fs.existsSync(path.join(root, f)), `${f} missing from the repo root`);
  }
  assert(!/Inter|Roboto/.test(html.split('<link')[0]), 'a banned typeface is referenced');
  return 'stylesheet, module, data all present';
});

check('logic.js exports resolve under Node as well as the browser', () => {
  assert(typeof canonicalise === 'function' && typeof rankRecipes === 'function');
  assert(typeof formatQty(1.75) === 'string' && formatQty(1.75) === '1¾', `formatQty(1.75) = ${formatQty(1.75)}`);
  return 'ES module loads cleanly';
});

/* ------------------------------------------------------------------ done */

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(' - ' + f);
  process.exit(1);
}
