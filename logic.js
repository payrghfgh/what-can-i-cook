// What Can I Cook — matching and scaling engine.
// Pure functions, no DOM. Imported by app.js in the browser and by tests/run.mjs in Node.

/* ------------------------------------------------------------------ *
 * 1. Ingredient vocabulary
 * Each entry: canonical key, display label, aliases.
 * ------------------------------------------------------------------ */

export const VOCAB = [
  { key: 'onion', label: 'onion', aliases: ['onion', 'onions', 'pyaz', 'pyaaz', 'pyaj', 'kanda', 'vengayam', 'ulli', 'ullipaya'] },
  { key: 'tomato', label: 'tomato', aliases: ['tomato', 'tomatoes', 'tamatar', 'tamaatar', 'thakkali', 'tomatoe'] },
  { key: 'potato', label: 'potato', aliases: ['potato', 'potatoes', 'aloo', 'alu', 'batata', 'urulai', 'bangaladumpa'] },
  { key: 'rice', label: 'rice', aliases: ['rice', 'chawal', 'chaawal', 'basmati', 'basmati rice', 'sona masoori', 'raw rice', 'cooked rice', 'leftover rice'] },
  { key: 'atta', label: 'atta', aliases: ['atta', 'flour', 'wheat flour', 'gehun', 'gehun ka atta', 'whole wheat flour', 'maida', 'chapati flour'] },
  { key: 'toor dal', label: 'toor dal', aliases: ['toor dal', 'toor', 'arhar dal', 'arhar', 'tuvar dal', 'tur dal', 'dal', 'daal', 'dhal', 'pigeon pea', 'pigeon peas'] },
  { key: 'moong dal', label: 'moong dal', aliases: ['moong dal', 'moong', 'mung dal', 'mung', 'green gram', 'moong daal', 'yellow moong dal'] },
  { key: 'masoor dal', label: 'masoor dal', aliases: ['masoor dal', 'masoor', 'red lentil', 'red lentils', 'masur dal'] },
  { key: 'urad dal', label: 'urad dal', aliases: ['urad dal', 'urad', 'black gram', 'udad dal'] },
  { key: 'chana dal', label: 'chana dal', aliases: ['chana dal', 'bengal gram', 'split chana'] },
  { key: 'rajma', label: 'rajma', aliases: ['rajma', 'kidney bean', 'kidney beans', 'rajma beans'] },
  { key: 'chana', label: 'chana', aliases: ['chana', 'chickpea', 'chickpeas', 'kabuli chana', 'chole', 'chhole', 'garbanzo', 'garbanzo beans'] },
  { key: 'paneer', label: 'paneer', aliases: ['paneer', 'panir', 'cottage cheese', 'indian cheese'] },
  { key: 'curd', label: 'curd', aliases: ['curd', 'curds', 'dahi', 'yogurt', 'yoghurt', 'yoghurt plain', 'thayir'] },
  { key: 'milk', label: 'milk', aliases: ['milk', 'doodh', 'dudh', 'paal'] },
  { key: 'butter', label: 'butter', aliases: ['butter', 'makhan', 'white butter', 'unsalted butter'] },
  { key: 'ghee', label: 'ghee', aliases: ['ghee', 'clarified butter', 'desi ghee'] },
  { key: 'cheese', label: 'cheese', aliases: ['cheese', 'mozzarella', 'cheddar', 'parmesan', 'cheese slice'] },
  { key: 'egg', label: 'egg', aliases: ['egg', 'eggs', 'anda', 'ande', 'dim', 'dimer'] },
  { key: 'chicken', label: 'chicken', aliases: ['chicken', 'murgh', 'murgi', 'chicken pieces', 'chicken thigh', 'chicken breast', 'poultry'] },
  { key: 'fish', label: 'fish', aliases: ['fish', 'machli', 'machh', 'maach', 'rohu', 'bhetki', 'fish fillet', 'fish fillets'] },
  { key: 'ginger', label: 'ginger', aliases: ['ginger', 'adrak', 'adhrak', 'inji', 'ginger paste', 'ginger garlic paste'] },
  { key: 'garlic', label: 'garlic', aliases: ['garlic', 'lehsun', 'lasan', 'lasoon', 'lehsan', 'garlic paste', 'garlic cloves'] },
  { key: 'green chilli', label: 'green chilli', aliases: ['green chilli', 'green chili', 'green chillies', 'hari mirch', 'hari mirchi', 'mirchi', 'chilli', 'chili', 'chillies', 'jalapeno'] },
  { key: 'coriander', label: 'coriander', aliases: ['coriander', 'dhania', 'dhaniya', 'cilantro', 'coriander leaves', 'fresh coriander'] },
  { key: 'mint', label: 'mint', aliases: ['mint', 'pudina', 'mint leaves'] },
  { key: 'cumin', label: 'cumin', aliases: ['cumin', 'jeera', 'zeera', 'cumin seeds'] },
  { key: 'turmeric', label: 'turmeric', aliases: ['turmeric', 'haldi', 'halad', 'turmeric powder'] },
  { key: 'coriander powder', label: 'coriander powder', aliases: ['coriander powder', 'dhania powder', 'dhaniya powder', 'ground coriander'] },
  { key: 'garam masala', label: 'garam masala', aliases: ['garam masala', 'garam masala powder'] },
  { key: 'mustard seeds', label: 'mustard seeds', aliases: ['mustard seeds', 'mustard', 'rai', 'sarson', 'black mustard', 'sarson seeds'] },
  { key: 'red chilli powder', label: 'red chilli powder', aliases: ['red chilli powder', 'chilli powder', 'chili powder', 'lal mirch', 'kashmiri chilli', 'kashmiri red chilli'] },
  { key: 'asafoetida', label: 'asafoetida', aliases: ['asafoetida', 'hing', 'heeng'] },
  { key: 'curry leaves', label: 'curry leaves', aliases: ['curry leaves', 'curry leaf', 'kadi patta', 'karuveppilai', 'meetha neem'] },
  { key: 'black pepper', label: 'black pepper', aliases: ['black pepper', 'kali mirch', 'peppercorn', 'peppercorns', 'pepper', 'ground pepper'] },
  { key: 'salt', label: 'salt', aliases: ['salt', 'namak', 'noon', 'rock salt', 'sendha namak'] },
  { key: 'sugar', label: 'sugar', aliases: ['sugar', 'cheeni', 'chini', 'shakkar', 'sugar powder'] },
  { key: 'oil', label: 'oil', aliases: ['oil', 'tel', 'cooking oil', 'vegetable oil', 'sunflower oil', 'mustard oil', 'refined oil'] },
  { key: 'water', label: 'water', aliases: ['water', 'pani', 'paani', 'hot water', 'warm water'] },
  { key: 'lemon', label: 'lemon', aliases: ['lemon', 'lemons', 'nimbu', 'lime', 'limbu', 'lemon juice', 'lime juice'] },
  { key: 'peanut', label: 'peanut', aliases: ['peanut', 'peanuts', 'moongphali', 'groundnut', 'groundnuts', 'shengdana', 'peanut butter'] },
  { key: 'coconut', label: 'coconut', aliases: ['coconut', 'nariyal', 'fresh coconut', 'grated coconut', 'desiccated coconut', 'copra'] },
  { key: 'coconut milk', label: 'coconut milk', aliases: ['coconut milk', 'nariyal doodh'] },
  { key: 'poha', label: 'poha', aliases: ['poha', 'flattened rice', 'beaten rice', 'aval', 'chivda', 'avalakki'] },
  { key: 'besan', label: 'besan', aliases: ['besan', 'gram flour', 'chickpea flour', 'besan flour'] },
  { key: 'rava', label: 'rava', aliases: ['rava', 'sooji', 'suji', 'semolina', 'rava sooji'] },
  { key: 'cabbage', label: 'cabbage', aliases: ['cabbage', 'patta gobi', 'bandh gobi', 'gobhi patta'] },
  { key: 'carrot', label: 'carrot', aliases: ['carrot', 'carrots', 'gajar', 'gajjar'] },
  { key: 'peas', label: 'peas', aliases: ['peas', 'matar', 'green peas', 'mutter', 'frozen peas'] },
  { key: 'cauliflower', label: 'cauliflower', aliases: ['cauliflower', 'gobi', 'phool gobi', 'gobhi'] },
  { key: 'spinach', label: 'spinach', aliases: ['spinach', 'palak', 'palak leaves', 'baby spinach'] },
  { key: 'bhindi', label: 'bhindi', aliases: ['bhindi', 'okra', 'ladyfinger', 'lady finger', 'vendakkai', 'bendakaya'] },
  { key: 'lauki', label: 'lauki', aliases: ['lauki', 'bottle gourd', 'doodhi', 'dudhi', 'opo squash', 'ghiya'] },
  { key: 'brinjal', label: 'brinjal', aliases: ['brinjal', 'baingan', 'eggplant', 'aubergine', 'vankaya', 'begun'] },
  { key: 'capsicum', label: 'capsicum', aliases: ['capsicum', 'bell pepper', 'bell peppers', 'shimla mirch', 'koda milagai'] },
  { key: 'beans', label: 'beans', aliases: ['beans', 'french beans', 'green beans', 'phali', 'bean'] },
  { key: 'cucumber', label: 'cucumber', aliases: ['cucumber', 'kheera', 'kakdi', 'cucumbers', 'kheere'] },
  { key: 'mushroom', label: 'mushroom', aliases: ['mushroom', 'mushrooms', 'khumb', 'button mushroom'] },
  { key: 'pasta', label: 'pasta', aliases: ['pasta', 'penne', 'macaroni', 'spaghetti', 'fusilli', 'noodles'] },
  { key: 'bread', label: 'bread', aliases: ['bread', 'slice bread', 'bread slices', 'pav', 'toast', 'sandwich bread'] },
  { key: 'soy sauce', label: 'soy sauce', aliases: ['soy sauce', 'soya sauce', 'soy'] },
  { key: 'tamarind', label: 'tamarind', aliases: ['tamarind', 'imli', 'tamarind paste', 'puli'] },
  { key: 'jaggery', label: 'jaggery', aliases: ['jaggery', 'gud', 'gur', 'gul'] },
  { key: 'sesame', label: 'sesame', aliases: ['sesame', 'til', 'sesame seeds', 'til seeds'] },
  { key: 'posto', label: 'posto', aliases: ['posto', 'poppy seeds', 'khus khus', 'poppy seed'] },
  { key: 'sambar powder', label: 'sambar powder', aliases: ['sambar powder', 'sambar masala', 'sambhar powder'] },
  { key: 'sev', label: 'sev', aliases: ['sev', 'namkeen sev', 'sev bhujia', 'bhujia'] },
  { key: 'vermicelli', label: 'vermicelli', aliases: ['vermicelli', 'seviyan', 'semiya', 'sewai'] }
];

const ALIAS = new Map();
for (const entry of VOCAB) {
  for (const alias of entry.aliases) ALIAS.set(alias, entry);
}

/** Ingredients assumed to be in every kitchen — never counted as missing. */
export const STAPLES = new Set([
  'salt', 'water', 'oil', 'sugar', 'cumin', 'turmeric', 'coriander powder',
  'garam masala', 'mustard seeds', 'asafoetida', 'black pepper', 'red chilli powder'
]);

/** Words stripped before matching: quantities, units and filler. */
const STRIP = new Set([
  'a', 'an', 'the', 'some', 'few', 'of', 'and', 'plus', 'or',
  'fresh', 'dried', 'dry', 'chopped', 'sliced', 'diced', 'grated', 'crushed',
  'finely', 'roughly', 'medium', 'large', 'small', 'big', 'whole', 'ground',
  'powdered', 'cooked', 'boiled', 'plain', 'raw', 'frozen', 'packet', 'pack',
  'tin', 'can', 'bunch', 'handful', 'taste', 'optional', 'about', 'approx',
  'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
  'g', 'gm', 'gms', 'gram', 'grams', 'kg', 'kilo', 'kilos', 'ml', 'l', 'litre',
  'liter', 'litres', 'liters', 'piece', 'pieces', 'pcs', 'pc', 'no', 'nos',
  'pinch', 'pinches', 'clove', 'cloves', 'inch', 'inches', 'slice', 'slices',
  'sprig', 'sprigs', 'leaves', 'leaf', 'seeds', 'seed', 'paste', 'powder'
]);

function lookupPhrase(phrase) {
  if (!phrase) return null;
  const direct = ALIAS.get(phrase);
  if (direct) return direct;
  // crude singularisation: "onions" -> "onion", "berries" -> "berry"
  const singular = phrase.replace(/ies$/, 'y').replace(/es$/, '').replace(/s$/, '');
  const hit = ALIAS.get(singular);
  if (hit) return hit;
  const plural = ALIAS.get(phrase + 's');
  return plural || null;
}

/**
 * Canonicalise one free-text ingredient.
 * "pyaz", "1 onion", "2 medium onions" and "Onion" all return the onion entry.
 * Unknown items are returned with known:false so the UI can still show a chip.
 */
export function canonicalise(raw) {
  if (raw == null) return null;
  const cleaned = String(raw)
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;

  const tokens = cleaned
    .split(' ')
    .filter((t) => t && !/^\d+$/.test(t) && !STRIP.has(t));

  if (!tokens.length) return null;

  // Try the full phrase, then drop leading words ("fresh green chilli" -> "green chilli")
  for (let i = 0; i < tokens.length; i++) {
    const phrase = tokens.slice(i).join(' ');
    const hit = lookupPhrase(phrase);
    if (hit) return { key: hit.key, label: hit.label, known: true };
  }

  // Unknown but usable as-is: keep the longest meaningful phrase.
  const fallback = tokens.join(' ');
  return { key: fallback, label: fallback, known: false };
}

/** Canonicalise a list of free-text entries, de-duplicated, order preserved. */
export function canonicaliseAll(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    const hit = canonicalise(raw);
    if (!hit || seen.has(hit.key)) continue;
    seen.add(hit.key);
    out.push(hit);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 2. Quantity scaling
 * ------------------------------------------------------------------ */

const FRACTIONS = [[0.25, '¼'], [0.5, '½'], [0.75, '¾']];

function tidy(n) {
  return Math.round(n * 100) / 100;
}

/** Format a number for display: 2 -> "2", 1.5 -> "1½", 0.25 -> "¼". */
export function formatQty(n) {
  if (!isFinite(n)) return '';
  const v = tidy(n);
  if (Number.isInteger(v)) return String(v);
  const whole = Math.floor(v);
  const frac = tidy(v - whole);
  for (const [value, glyph] of FRACTIONS) {
    if (Math.abs(frac - value) < 0.01) return (whole ? String(whole) : '') + glyph;
  }
  return String(v);
}

function roundTo(value, step) {
  return Math.round(value / step) * step;
}

/**
 * Eggs never show a fraction.
 * 1.33 and 1.5 -> "1 egg + 1 yolk", 2.5 -> "2 or 3 eggs".
 */
export function formatEggs(count) {
  const x = tidy(count);
  if (!isFinite(x) || x <= 0) return '0 eggs';
  const nearest = Math.round(x);
  if (Math.abs(x - nearest) < 0.06) {
    return `${nearest} ${nearest === 1 ? 'egg' : 'eggs'}`;
  }
  if (x < 2) {
    const base = Math.floor(x);
    const frac = x - base;
    if (frac <= 0.25) return `${base} ${base === 1 ? 'egg' : 'eggs'}`;
    if (frac <= 0.75) {
      if (base === 0) return '1 yolk';
      return `${base} ${base === 1 ? 'egg' : 'eggs'} + 1 yolk`;
    }
    return `${base + 1} ${base + 1 === 1 ? 'egg' : 'eggs'}`;
  }
  const lo = Math.floor(x);
  return `${lo} or ${lo + 1} eggs`;
}

const UNIT_LABEL = {
  g: 'g', ml: 'ml', tsp: 'tsp', tbsp: 'tbsp',
  piece: '', clove: 'cloves', inch: 'inch', cup: 'cup', pinch: 'pinch'
};

const PLURAL = { clove: 'cloves', cup: 'cups', piece: '', inch: 'inch', pinch: 'pinch' };

/**
 * Scale one ingredient line for a different number of people.
 * Returns { text, original } — original is the unscaled line, shown in small text.
 */
export function scaleIngredient(ing, people, serves) {
  const from = Number(serves) > 0 ? Number(serves) : 1;
  const to = Number(people) > 0 ? Number(people) : from;
  const raw = Number(ing.qty) * to / from;
  const unit = ing.unit || '';

  const original = `${formatQty(ing.qty)}${unit === 'piece' ? '' : ' ' + (UNIT_LABEL[unit] ?? unit)}`.trim();

  if (ing.item === 'egg') {
    return { text: formatEggs(raw), original: `${formatQty(ing.qty)} ${Number(ing.qty) === 1 ? 'egg' : 'eggs'}` };
  }

  let value;
  switch (unit) {
    case 'g':
    case 'ml':
      value = raw < 20 ? roundTo(raw, 1) : roundTo(raw, 5);
      break;
    case 'tsp':
    case 'tbsp':
    case 'cup':
      value = roundTo(raw, 0.25);
      break;
    case 'piece':
      value = roundTo(raw, 0.5);
      if (value >= 2) value = Math.round(value);
      break;
    case 'clove':
      value = Math.max(1, Math.round(raw));
      break;
    case 'inch':
      value = Math.max(0.5, roundTo(raw, 0.5));
      break;
    default:
      value = tidy(raw);
  }

  let label = UNIT_LABEL[unit] ?? unit;
  if ((unit === 'clove' || unit === 'cup') && value > 1) label = PLURAL[unit] || label;

  const text = unit === 'piece' || !unit
    ? formatQty(value)
    : `${formatQty(value)} ${label}`;

  return { text, original };
}

/* ------------------------------------------------------------------ *
 * 3. Matching and scoring
 * ------------------------------------------------------------------ */

export const FOCUS_TAGS = [
  { id: 'high-protein', label: 'High protein' },
  { id: 'low-oil', label: 'Low oil' },
  { id: 'quick', label: 'Quick (under 30 min)' },
  { id: 'budget', label: 'Budget-friendly' },
  { id: 'one-pot', label: 'One pot' },
  { id: 'kid-friendly', label: 'Kid-friendly' },
  { id: 'high-fibre', label: 'High fibre' }
];

export const DIETS = [
  { id: 'veg', label: 'Veg only' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'non-veg', label: 'Non-veg OK' },
  { id: 'egg', label: 'Egg OK' }
];

export const DIET_LABEL = {
  veg: 'vegetarian',
  vegan: 'vegan',
  'non-veg': 'non-veg',
  egg: 'egg'
};

export const CUISINES = [
  { id: 'any', label: 'Any' },
  { id: 'north-indian', label: 'North Indian' },
  { id: 'south-indian', label: 'South Indian' },
  { id: 'bengali', label: 'Bengali' },
  { id: 'gujarati', label: 'Gujarati' },
  { id: 'punjabi', label: 'Punjabi' },
  { id: 'continental', label: 'Continental' }
];

const DIET_ALLOWS = {
  vegan: ['vegan'],
  veg: ['vegan', 'veg'],
  egg: ['vegan', 'veg', 'egg'],
  'non-veg': ['vegan', 'veg', 'egg', 'non-veg']
};

export function isStaple(ing) {
  return ing.staple === true || STAPLES.has(ing.item);
}

/** Ingredients the cook must actually have for this recipe. */
export function requiredIngredients(recipe) {
  return (recipe.ingredients || []).filter((i) => !i.optional && !isStaple(i));
}

/**
 * Score one recipe against a pantry.
 * coverage = matched required / total required
 * score = coverage*100 - missing*12 + focusBonus (max +24)
 */
export function scoreRecipe(recipe, pantryKeys, focus = []) {
  const required = requiredIngredients(recipe);
  const pantry = pantryKeys instanceof Set ? pantryKeys : new Set(pantryKeys);

  const missing = required.filter((i) => !pantry.has(i.item));
  const matchedCount = required.length - missing.length;
  const coverage = required.length ? matchedCount / required.length : 1;

  let bonus = 0;
  for (const tag of focus) {
    if (!(recipe.focus || []).includes(tag)) continue;
    if (tag === 'quick' && recipe.minutes > 30) continue;
    if (tag === 'budget' && recipe.costTier !== 1) continue;
    bonus += 8;
  }
  bonus = Math.min(bonus, 24);

  const score = coverage * 100 - missing.length * 12 + bonus;

  return {
    recipe,
    score,
    coverage,
    missing,
    matchedCount,
    requiredCount: required.length,
    bonus,
    percent: Math.max(0, Math.min(100, Math.round(score)))
  };
}

/** Hard filters: diet, max time, cuisine, avoided ingredients. */
export function passesFilters(recipe, options = {}) {
  const { diet = 'non-veg', maxMinutes = null, cuisine = 'any', avoid = [] } = options;

  const allowed = DIET_ALLOWS[diet];
  if (allowed && !allowed.includes(recipe.diet)) return false;

  if (maxMinutes != null && recipe.minutes > maxMinutes) return false;

  if (cuisine && cuisine !== 'any' && recipe.cuisine !== cuisine) return false;

  const avoidSet = avoid instanceof Set ? avoid : new Set(avoid || []);
  if (avoidSet.size) {
    const hit = (recipe.ingredients || []).some((i) => avoidSet.has(i.item));
    if (hit) return false;
  }

  return true;
}

function sortMatches(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (b.matchedCount !== a.matchedCount) return b.matchedCount - a.matchedCount;
  if (a.recipe.minutes !== b.recipe.minutes) return a.recipe.minutes - b.recipe.minutes;
  return a.recipe.name.localeCompare(b.recipe.name);
}

/**
 * Rank recipes. Returns { results, fallback, closest, explanation }.
 * When nothing survives the filters, `fallback` is true and `closest` holds the
 * three best-scoring recipes regardless of filters, with their gaps spelled out.
 */
export function rankRecipes(recipes, pantryKeys, options = {}) {
  const focus = options.focus || [];
  const pantry = pantryKeys instanceof Set ? pantryKeys : new Set(pantryKeys);

  const scored = recipes.map((r) => scoreRecipe(r, pantry, focus));

  // A dish that shares nothing with the pantry is not a suggestion, even if it
  // clears every filter. With an empty pantry there is nothing to compare
  // against, so every dish stays in and the list is ranked on focus alone.
  const results = scored
    .filter((m) => passesFilters(m.recipe, options))
    .filter((m) => pantry.size === 0 || m.matchedCount > 0 || m.requiredCount === 0)
    .sort(sortMatches);

  if (results.length) {
    return { results, fallback: false, closest: [], explanation: '' };
  }

  const closest = scored.sort(sortMatches).slice(0, 3);
  return {
    results: [],
    fallback: true,
    closest,
    explanation: explainEmpty(options, pantry)
  };
}

/** Plain-language reason the pantry came up empty. */
export function explainEmpty(options = {}, pantryKeys = new Set()) {
  const { diet = 'non-veg', maxMinutes = null, cuisine = 'any', avoid = [] } = options;
  const bits = [];

  const dietWord = DIET_LABEL[diet] || diet;
  bits.push(dietWord);
  bits.push('recipe');

  if (maxMinutes != null) bits.push(`under ${maxMinutes} minutes`);
  if (cuisine && cuisine !== 'any') {
    const c = CUISINES.find((x) => x.id === cuisine);
    bits.push(`from ${c ? c.label : cuisine}`);
  }

  let sentence = `No ${bits.join(' ')}`;
  const pantrySize = pantryKeys instanceof Set ? pantryKeys.size : 0;
  if (pantrySize === 0) {
    sentence += ' matches — your pantry is empty.';
  } else {
    sentence += ' with what you have.';
  }

  const avoidList = avoid instanceof Set ? [...avoid] : (avoid || []);
  if (avoidList.length) {
    const labels = avoidList.map((a) => (typeof a === 'string' ? a : (a.label || a.key || a))).join(', ');
    sentence += ` You are also avoiding ${labels}.`;
  }

  return sentence;
}

/* ------------------------------------------------------------------ *
 * 4. Small helpers used by the UI
 * ------------------------------------------------------------------ */

export function costLabel(tier) {
  return ['', '₹', '₹₹', '₹₹₹'][tier] || '₹';
}

export function costWords(tier) {
  return { 1: 'budget', 2: 'moderate', 3: 'premium' }[tier] || 'moderate';
}

export function timeLabel(minutes) {
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} hr${minutes % 60 ? ' ' + (minutes % 60) + ' min' : ''}`
    : `${minutes} min`;
}

export function parseMaxTime(value) {
  if (value === 'any' || value == null || value === '') return null;
  if (value === '60+') return null; // "60+" means no upper limit
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
