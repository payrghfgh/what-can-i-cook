// What Can I Cook — matching, ranking and scaling engine.
// Pure functions, no DOM. Imported by app.js in the browser and by tests/run.mjs in Node.

/* ------------------------------------------------------------------ *
 * 1. Pantry categories
 * ------------------------------------------------------------------ */

export const GROUPS = [
  { id: 'vegetables', label: 'Vegetables' },
  { id: 'herbs', label: 'Herbs & aromatics' },
  { id: 'dal', label: 'Dal & legumes' },
  { id: 'grains', label: 'Grains & flours' },
  { id: 'dairy', label: 'Dairy & eggs' },
  { id: 'meat', label: 'Meat & fish' },
  { id: 'spices', label: 'Spices & masalas' },
  { id: 'sauces', label: 'Oils, sauces & condiments' },
  { id: 'nuts', label: 'Nuts, seeds & sweeteners' },
  { id: 'fruit', label: 'Fruit' }
];

/* ------------------------------------------------------------------ *
 * 2. Ingredient vocabulary
 * Each entry: canonical key, display label, pantry group, aliases.
 * ------------------------------------------------------------------ */

export const VOCAB = [
  // vegetables
  { key: 'onion', label: 'onion', group: 'vegetables', aliases: ['onion', 'onions', 'pyaz', 'pyaaz', 'pyaj', 'kanda', 'vengayam', 'ulli', 'ullipaya', 'red onion', 'white onion'] },
  { key: 'tomato', label: 'tomato', group: 'vegetables', aliases: ['tomato', 'tomatoes', 'tamatar', 'tamaatar', 'thakkali', 'tomatoe', 'cherry tomato'] },
  { key: 'potato', label: 'potato', group: 'vegetables', aliases: ['potato', 'potatoes', 'aloo', 'alu', 'batata', 'urulai', 'bangaladumpa'] },
  { key: 'sweet potato', label: 'sweet potato', group: 'vegetables', aliases: ['sweet potato', 'shakarkandi', 'shakarkand', 'ratalu'] },
  { key: 'cauliflower', label: 'cauliflower', group: 'vegetables', aliases: ['cauliflower', 'gobi', 'phool gobi', 'gobhi'] },
  { key: 'cabbage', label: 'cabbage', group: 'vegetables', aliases: ['cabbage', 'patta gobi', 'bandh gobi'] },
  { key: 'carrot', label: 'carrot', group: 'vegetables', aliases: ['carrot', 'carrots', 'gajar', 'gajjar'] },
  { key: 'peas', label: 'peas', group: 'vegetables', aliases: ['peas', 'matar', 'green peas', 'mutter', 'frozen peas'] },
  { key: 'beans', label: 'beans', group: 'vegetables', aliases: ['beans', 'french beans', 'green beans', 'phali', 'bean'] },
  { key: 'capsicum', label: 'capsicum', group: 'vegetables', aliases: ['capsicum', 'bell pepper', 'bell peppers', 'shimla mirch', 'koda milagai'] },
  { key: 'brinjal', label: 'brinjal', group: 'vegetables', aliases: ['brinjal', 'baingan', 'eggplant', 'aubergine', 'vankaya', 'begun'] },
  { key: 'bhindi', label: 'bhindi', group: 'vegetables', aliases: ['bhindi', 'okra', 'ladyfinger', 'lady finger', 'vendakkai', 'bendakaya'] },
  { key: 'lauki', label: 'lauki', group: 'vegetables', aliases: ['lauki', 'bottle gourd', 'doodhi', 'dudhi', 'opo squash', 'ghiya'] },
  { key: 'karela', label: 'karela', group: 'vegetables', aliases: ['karela', 'bitter gourd', 'bitter melon', 'pavakkai'] },
  { key: 'parwal', label: 'parwal', group: 'vegetables', aliases: ['parwal', 'pointed gourd', 'parval', 'potol'] },
  { key: 'tinda', label: 'tinda', group: 'vegetables', aliases: ['tinda', 'apple gourd', 'tindora'] },
  { key: 'chayote', label: 'chow chow', group: 'vegetables', aliases: ['chow chow', 'chayote', 'chowchow', 'seeme badanekai'] },
  { key: 'pumpkin', label: 'pumpkin', group: 'vegetables', aliases: ['pumpkin', 'kaddu', 'sitaphal sabzi', 'mathanga'] },
  { key: 'spinach', label: 'spinach', group: 'vegetables', aliases: ['spinach', 'palak', 'palak leaves', 'baby spinach', 'keerai'] },
  { key: 'methi', label: 'methi leaves', group: 'vegetables', aliases: ['methi', 'fenugreek leaves', 'methi leaves', 'vendhaya keerai'] },
  { key: 'cucumber', label: 'cucumber', group: 'vegetables', aliases: ['cucumber', 'kheera', 'kakdi', 'cucumbers', 'kheere'] },
  { key: 'radish', label: 'radish', group: 'vegetables', aliases: ['radish', 'mooli', 'daikon', 'mullangi'] },
  { key: 'beetroot', label: 'beetroot', group: 'vegetables', aliases: ['beetroot', 'beet', 'chukandar'] },
  { key: 'turnip', label: 'turnip', group: 'vegetables', aliases: ['turnip', 'shalgam', 'shaljam'] },
  { key: 'mushroom', label: 'mushroom', group: 'vegetables', aliases: ['mushroom', 'mushrooms', 'khumb', 'button mushroom'] },
  { key: 'corn', label: 'sweetcorn', group: 'vegetables', aliases: ['corn', 'sweetcorn', 'sweet corn', 'makka', 'bhutta', 'makkai'] },
  { key: 'drumstick', label: 'drumstick', group: 'vegetables', aliases: ['drumstick', 'moringa', 'sahjan', 'murungakkai'] },
  { key: 'raw banana', label: 'raw banana', group: 'vegetables', aliases: ['raw banana', 'kacha kela', 'plantain', 'vazhakkai'] },
  { key: 'arbi', label: 'arbi', group: 'vegetables', aliases: ['arbi', 'colocasia', 'taro', 'arbi root', 'chembu'] },
  { key: 'broccoli', label: 'broccoli', group: 'vegetables', aliases: ['broccoli'] },
  { key: 'zucchini', label: 'zucchini', group: 'vegetables', aliases: ['zucchini', 'courgette'] },
  { key: 'lettuce', label: 'lettuce', group: 'vegetables', aliases: ['lettuce', 'salad leaves'] },
  { key: 'spring onion', label: 'spring onion', group: 'vegetables', aliases: ['spring onion', 'scallion', 'spring onions', 'hara pyaz', 'salad onion'] },

  // herbs & aromatics
  { key: 'ginger', label: 'ginger', group: 'herbs', aliases: ['ginger', 'adrak', 'adhrak', 'inji', 'ginger paste', 'ginger garlic paste'] },
  { key: 'garlic', label: 'garlic', group: 'herbs', aliases: ['garlic', 'lehsun', 'lasan', 'lasoon', 'lehsan', 'garlic paste', 'garlic cloves'] },
  { key: 'green chilli', label: 'green chilli', group: 'herbs', aliases: ['green chilli', 'green chili', 'green chillies', 'hari mirch', 'hari mirchi', 'mirchi', 'chilli', 'chili', 'chillies', 'jalapeno'] },
  { key: 'coriander', label: 'coriander', group: 'herbs', aliases: ['coriander', 'dhania', 'dhaniya', 'cilantro', 'coriander leaves', 'fresh coriander', 'kothmir'] },
  { key: 'mint', label: 'mint', group: 'herbs', aliases: ['mint', 'pudina', 'mint leaves'] },
  { key: 'curry leaves', label: 'curry leaves', group: 'herbs', aliases: ['curry leaves', 'curry leaf', 'kadi patta', 'karuveppilai', 'meetha neem'] },

  // dal & legumes
  { key: 'toor dal', label: 'toor dal', group: 'dal', aliases: ['toor dal', 'toor', 'arhar dal', 'arhar', 'tuvar dal', 'tur dal', 'dal', 'daal', 'dhal', 'pigeon pea', 'pigeon peas'] },
  { key: 'moong dal', label: 'moong dal', group: 'dal', aliases: ['moong dal', 'moong', 'mung dal', 'mung', 'green gram', 'moong daal', 'yellow moong dal', 'pesara pappu'] },
  { key: 'masoor dal', label: 'masoor dal', group: 'dal', aliases: ['masoor dal', 'masoor', 'red lentil', 'red lentils', 'masur dal'] },
  { key: 'urad dal', label: 'urad dal', group: 'dal', aliases: ['urad dal', 'urad', 'black gram', 'udad dal', 'minapappu'] },
  { key: 'chana dal', label: 'chana dal', group: 'dal', aliases: ['chana dal', 'bengal gram', 'split chana', 'senaga pappu'] },
  { key: 'rajma', label: 'rajma', group: 'dal', aliases: ['rajma', 'kidney bean', 'kidney beans', 'rajma beans'] },
  { key: 'chana', label: 'chana', group: 'dal', aliases: ['chana', 'chickpea', 'chickpeas', 'kabuli chana', 'chole', 'chhole', 'garbanzo', 'garbanzo beans'] },
  { key: 'lobia', label: 'lobia', group: 'dal', aliases: ['lobia', 'black eyed peas', 'black-eyed peas', 'cowpea', 'chawli'] },
  { key: 'soya chunks', label: 'soya chunks', group: 'dal', aliases: ['soya chunks', 'soya', 'soy chunks', 'meal maker', 'soya nuggets'] },
  { key: 'sprouts', label: 'sprouts', group: 'dal', aliases: ['sprouts', 'moong sprouts', 'bean sprouts', 'ankurit'] },

  // grains & flours
  { key: 'rice', label: 'rice', group: 'grains', aliases: ['rice', 'chawal', 'chaawal', 'basmati', 'basmati rice', 'sona masoori', 'raw rice', 'cooked rice', 'leftover rice'] },
  { key: 'atta', label: 'atta', group: 'grains', aliases: ['atta', 'flour', 'wheat flour', 'gehun', 'gehun ka atta', 'whole wheat flour', 'chapati flour'] },
  { key: 'maida', label: 'maida', group: 'grains', aliases: ['maida', 'all purpose flour', 'all-purpose flour', 'refined flour', 'plain flour'] },
  { key: 'rava', label: 'rava', group: 'grains', aliases: ['rava', 'sooji', 'suji', 'semolina', 'rava sooji'] },
  { key: 'poha', label: 'poha', group: 'grains', aliases: ['poha', 'flattened rice', 'beaten rice', 'aval', 'chivda', 'avalakki'] },
  { key: 'besan', label: 'besan', group: 'grains', aliases: ['besan', 'gram flour', 'chickpea flour', 'besan flour'] },
  { key: 'oats', label: 'oats', group: 'grains', aliases: ['oats', 'oatmeal', 'rolled oats', 'porridge oats'] },
  { key: 'pasta', label: 'pasta', group: 'grains', aliases: ['pasta', 'penne', 'macaroni', 'spaghetti', 'fusilli'] },
  { key: 'noodles', label: 'noodles', group: 'grains', aliases: ['noodles', 'hakka noodles', 'instant noodles', 'maggi'] },
  { key: 'vermicelli', label: 'vermicelli', group: 'grains', aliases: ['vermicelli', 'seviyan', 'semiya', 'sewai'] },
  { key: 'bread', label: 'bread', group: 'grains', aliases: ['bread', 'slice bread', 'bread slices', 'pav', 'toast', 'sandwich bread'] },
  { key: 'cornflour', label: 'cornflour', group: 'grains', aliases: ['cornflour', 'corn flour', 'cornstarch', 'corn starch'] },
  { key: 'sabudana', label: 'sabudana', group: 'grains', aliases: ['sabudana', 'sago', 'tapioca pearls', 'saboodana'] },
  { key: 'dosa batter', label: 'dosa batter', group: 'grains', aliases: ['dosa batter', 'idli batter', 'batter', 'fermented batter'] },
  { key: 'bajra', label: 'bajra', group: 'grains', aliases: ['bajra', 'millet', 'pearl millet', 'bajri'] },

  // dairy & eggs
  { key: 'milk', label: 'milk', group: 'dairy', aliases: ['milk', 'doodh', 'dudh', 'paal'] },
  { key: 'curd', label: 'curd', group: 'dairy', aliases: ['curd', 'curds', 'dahi', 'yogurt', 'yoghurt', 'thayir'] },
  { key: 'paneer', label: 'paneer', group: 'dairy', aliases: ['paneer', 'panir', 'cottage cheese', 'indian cheese'] },
  { key: 'butter', label: 'butter', group: 'dairy', aliases: ['butter', 'makhan', 'white butter', 'unsalted butter'] },
  { key: 'ghee', label: 'ghee', group: 'dairy', aliases: ['ghee', 'clarified butter', 'desi ghee'] },
  { key: 'cheese', label: 'cheese', group: 'dairy', aliases: ['cheese', 'mozzarella', 'cheddar', 'parmesan', 'cheese slice'] },
  { key: 'cream', label: 'cream', group: 'dairy', aliases: ['cream', 'fresh cream', 'malai', 'heavy cream', 'whipping cream'] },
  { key: 'khoya', label: 'khoya', group: 'dairy', aliases: ['khoya', 'mawa', 'khoa', 'milk solids'] },
  { key: 'condensed milk', label: 'condensed milk', group: 'dairy', aliases: ['condensed milk', 'milkmaid', 'sweetened condensed milk'] },
  { key: 'egg', label: 'egg', group: 'dairy', aliases: ['egg', 'eggs', 'anda', 'ande', 'dim', 'dimer'] },
  { key: 'buttermilk', label: 'buttermilk', group: 'dairy', aliases: ['buttermilk', 'chaas', 'chhach', 'mor'] },

  // meat & fish
  { key: 'chicken', label: 'chicken', group: 'meat', aliases: ['chicken', 'murgh', 'murgi', 'chicken pieces', 'chicken thigh', 'chicken breast', 'poultry'] },
  { key: 'mutton', label: 'mutton', group: 'meat', aliases: ['mutton', 'lamb', 'goat meat', 'gosht'] },
  { key: 'fish', label: 'fish', group: 'meat', aliases: ['fish', 'machli', 'machh', 'maach', 'rohu', 'bhetki', 'fish fillet', 'fish fillets'] },
  { key: 'prawn', label: 'prawn', group: 'meat', aliases: ['prawn', 'prawns', 'shrimp', 'jhinga', 'kolambi'] },

  // spices & masalas
  { key: 'cumin', label: 'cumin', group: 'spices', aliases: ['cumin', 'jeera', 'zeera', 'cumin seeds'] },
  { key: 'turmeric', label: 'turmeric', group: 'spices', aliases: ['turmeric', 'haldi', 'halad', 'turmeric powder'] },
  { key: 'coriander powder', label: 'coriander powder', group: 'spices', aliases: ['coriander powder', 'dhania powder', 'dhaniya powder', 'ground coriander'] },
  { key: 'garam masala', label: 'garam masala', group: 'spices', aliases: ['garam masala', 'garam masala powder'] },
  { key: 'red chilli powder', label: 'red chilli powder', group: 'spices', aliases: ['red chilli powder', 'chilli powder', 'chili powder', 'lal mirch', 'kashmiri chilli', 'kashmiri red chilli'] },
  { key: 'mustard seeds', label: 'mustard seeds', group: 'spices', aliases: ['mustard seeds', 'mustard', 'rai', 'sarson', 'black mustard', 'sarson seeds'] },
  { key: 'asafoetida', label: 'asafoetida', group: 'spices', aliases: ['asafoetida', 'hing', 'heeng'] },
  { key: 'black pepper', label: 'black pepper', group: 'spices', aliases: ['black pepper', 'kali mirch', 'peppercorn', 'peppercorns', 'pepper', 'ground pepper'] },
  { key: 'cardamom', label: 'cardamom', group: 'spices', aliases: ['cardamom', 'elaichi', 'green cardamom'] },
  { key: 'cinnamon', label: 'cinnamon', group: 'spices', aliases: ['cinnamon', 'dalchini'] },
  { key: 'cloves', label: 'cloves', group: 'spices', aliases: ['cloves', 'laung', 'lavang'] },
  { key: 'bay leaf', label: 'bay leaf', group: 'spices', aliases: ['bay leaf', 'bay leaves', 'tej patta', 'tejpatta'] },
  { key: 'fennel', label: 'fennel seeds', group: 'spices', aliases: ['fennel', 'saunf', 'fennel seeds', 'sompu'] },
  { key: 'ajwain', label: 'ajwain', group: 'spices', aliases: ['ajwain', 'carom seeds', 'omam'] },
  { key: 'kalonji', label: 'kalonji', group: 'spices', aliases: ['kalonji', 'nigella seeds', 'onion seeds'] },
  { key: 'kasuri methi', label: 'kasuri methi', group: 'spices', aliases: ['kasuri methi', 'dried fenugreek leaves', 'kasoori methi'] },
  { key: 'amchur', label: 'amchur', group: 'spices', aliases: ['amchur', 'dry mango powder', 'aamchur'] },
  { key: 'chaat masala', label: 'chaat masala', group: 'spices', aliases: ['chaat masala', 'chat masala'] },
  { key: 'pav bhaji masala', label: 'pav bhaji masala', group: 'spices', aliases: ['pav bhaji masala'] },
  { key: 'sambar powder', label: 'sambar powder', group: 'spices', aliases: ['sambar powder', 'sambar masala', 'sambhar powder'] },
  { key: 'rasam powder', label: 'rasam powder', group: 'spices', aliases: ['rasam powder', 'rasam masala'] },
  { key: 'biryani masala', label: 'biryani masala', group: 'spices', aliases: ['biryani masala', 'biryani powder'] },
  { key: 'saffron', label: 'saffron', group: 'spices', aliases: ['saffron', 'kesar', 'zafran'] },
  { key: 'star anise', label: 'star anise', group: 'spices', aliases: ['star anise', 'chakra phool'] },
  { key: 'cocoa', label: 'cocoa powder', group: 'nuts', aliases: ['cocoa', 'cocoa powder', 'cacao'] },
  { key: 'vanilla', label: 'vanilla essence', group: 'nuts', aliases: ['vanilla', 'vanilla essence', 'vanilla extract'] },
  { key: 'baking soda', label: 'baking soda', group: 'spices', aliases: ['baking soda', 'soda bicarb', 'bicarbonate of soda', 'eno'] },
  { key: 'baking powder', label: 'baking powder', group: 'spices', aliases: ['baking powder'] },
  { key: 'salt', label: 'salt', group: 'spices', aliases: ['salt', 'namak', 'noon', 'rock salt', 'sendha namak'] },

  // oils, sauces & condiments
  { key: 'oil', label: 'oil', group: 'sauces', aliases: ['oil', 'tel', 'cooking oil', 'vegetable oil', 'sunflower oil', 'refined oil'] },
  { key: 'mustard oil', label: 'mustard oil', group: 'sauces', aliases: ['mustard oil', 'sarson ka tel', 'kachi ghani'] },
  { key: 'olive oil', label: 'olive oil', group: 'sauces', aliases: ['olive oil', 'extra virgin olive oil'] },
  { key: 'soy sauce', label: 'soy sauce', group: 'sauces', aliases: ['soy sauce', 'soya sauce', 'soy'] },
  { key: 'vinegar', label: 'vinegar', group: 'sauces', aliases: ['vinegar', 'sirka', 'white vinegar', 'rice vinegar'] },
  { key: 'ketchup', label: 'ketchup', group: 'sauces', aliases: ['ketchup', 'tomato ketchup', 'tomato sauce'] },
  { key: 'mayonnaise', label: 'mayonnaise', group: 'sauces', aliases: ['mayonnaise', 'mayo'] },
  { key: 'coconut milk', label: 'coconut milk', group: 'sauces', aliases: ['coconut milk', 'nariyal doodh'] },
  { key: 'tamarind', label: 'tamarind', group: 'sauces', aliases: ['tamarind', 'imli', 'tamarind paste', 'puli'] },
  { key: 'tomato puree', label: 'tomato purée', group: 'sauces', aliases: ['tomato puree', 'tomato purée', 'passata', 'canned tomatoes', 'tinned tomatoes'] },
  { key: 'coconut', label: 'coconut', group: 'sauces', aliases: ['coconut', 'nariyal', 'fresh coconut', 'grated coconut', 'desiccated coconut', 'copra'] },
  { key: 'posto', label: 'posto', group: 'sauces', aliases: ['posto', 'poppy seeds', 'khus khus', 'poppy seed'] },
  { key: 'sev', label: 'sev', group: 'sauces', aliases: ['sev', 'namkeen sev', 'sev bhujia', 'bhujia'] },

  // nuts, seeds & sweeteners
  { key: 'peanut', label: 'peanut', group: 'nuts', aliases: ['peanut', 'peanuts', 'moongphali', 'groundnut', 'groundnuts', 'shengdana', 'peanut butter'] },
  { key: 'cashew', label: 'cashew', group: 'nuts', aliases: ['cashew', 'cashews', 'kaju', 'cashew nuts'] },
  { key: 'almond', label: 'almond', group: 'nuts', aliases: ['almond', 'almonds', 'badam'] },
  { key: 'raisin', label: 'raisin', group: 'nuts', aliases: ['raisin', 'raisins', 'kishmish'] },
  { key: 'sesame', label: 'sesame', group: 'nuts', aliases: ['sesame', 'til', 'sesame seeds', 'til seeds'] },
  { key: 'sugar', label: 'sugar', group: 'nuts', aliases: ['sugar', 'cheeni', 'chini', 'shakkar', 'sugar powder'] },
  { key: 'jaggery', label: 'jaggery', group: 'nuts', aliases: ['jaggery', 'gud', 'gur', 'gul'] },
  { key: 'honey', label: 'honey', group: 'nuts', aliases: ['honey', 'shahad'] },

  // fruit
  { key: 'lemon', label: 'lemon', group: 'fruit', aliases: ['lemon', 'lemons', 'nimbu', 'lime', 'limbu', 'lemon juice', 'lime juice'] },
  { key: 'banana', label: 'banana', group: 'fruit', aliases: ['banana', 'bananas', 'kela', 'vazhaipazham'] },
  { key: 'apple', label: 'apple', group: 'fruit', aliases: ['apple', 'apples', 'seb'] },
  { key: 'mango', label: 'mango', group: 'fruit', aliases: ['mango', 'mangoes', 'aam', 'aamphal'] },
  { key: 'orange', label: 'orange', group: 'fruit', aliases: ['orange', 'oranges', 'santra', 'narangi'] },
  { key: 'pineapple', label: 'pineapple', group: 'fruit', aliases: ['pineapple', 'ananas', 'annachi pazham'] },
  { key: 'pomegranate', label: 'pomegranate', group: 'fruit', aliases: ['pomegranate', 'anar', 'anaar'] },
  { key: 'water', label: 'water', group: 'sauces', aliases: ['water', 'pani', 'paani', 'hot water', 'warm water'] }
];

const ALIAS = new Map();
for (const entry of VOCAB) {
  for (const alias of entry.aliases) ALIAS.set(alias, entry);
}

export const BY_KEY = new Map(VOCAB.map((v) => [v.key, v]));

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
  'pinch', 'pinches', 'inch', 'inches', 'slice', 'slices',
  'sprig', 'sprigs', 'leaves', 'leaf', 'seeds', 'seed', 'paste', 'powder'
]);

function lookupPhrase(phrase) {
  if (!phrase) return null;
  const direct = ALIAS.get(phrase);
  if (direct) return direct;
  const singular = phrase.replace(/ies$/, 'y').replace(/es$/, '').replace(/s$/, '');
  const hit = ALIAS.get(singular);
  if (hit) return hit;
  return ALIAS.get(phrase + 's') || null;
}

/**
 * Canonicalise one free-text ingredient.
 * "pyaz", "1 onion", "2 medium onions" and "Onion" all return the onion entry.
 * Unknown items come back with known:false so the UI can still show a chip.
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

  for (let i = 0; i < tokens.length; i++) {
    const hit = lookupPhrase(tokens.slice(i).join(' '));
    if (hit) return { key: hit.key, label: hit.label, group: hit.group, known: true };
  }

  const fallback = tokens.join(' ');
  return { key: fallback, label: fallback, group: 'other', known: false };
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
 * 3. Quantity scaling
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
    case 'pinch':
      // you cannot have 1.75 pinches
      value = Math.max(1, Math.round(raw));
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
 * 4. Options the UI offers
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
  { id: 'maharashtrian', label: 'Maharashtrian' },
  { id: 'indo-chinese', label: 'Indo-Chinese' },
  { id: 'continental', label: 'Continental' }
];

export const COURSES = [
  { id: 'any', label: 'Anything' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'main', label: 'Main course' },
  { id: 'side', label: 'Side' },
  { id: 'snack', label: 'Snack' },
  { id: 'dessert', label: 'Dessert' },
  { id: 'drink', label: 'Drink' }
];

export const SORTS = [
  { id: 'match', label: 'Best match' },
  { id: 'missing', label: 'Fewest missing' },
  { id: 'quick', label: 'Quickest' }
];

const DIET_ALLOWS = {
  vegan: ['vegan'],
  veg: ['vegan', 'veg'],
  egg: ['vegan', 'veg', 'egg'],
  'non-veg': ['vegan', 'veg', 'egg', 'non-veg']
};

/* ------------------------------------------------------------------ *
 * 5. Matching and scoring
 * ------------------------------------------------------------------ */

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

/** Hard filters: diet, max time, cuisine, course, avoided ingredients. */
export function passesFilters(recipe, options = {}) {
  const { diet = 'non-veg', maxMinutes = null, cuisine = 'any', course = 'any', avoid = [] } = options;

  const allowed = DIET_ALLOWS[diet];
  if (allowed && !allowed.includes(recipe.diet)) return false;

  if (maxMinutes != null && recipe.minutes > maxMinutes) return false;
  if (cuisine && cuisine !== 'any' && recipe.cuisine !== cuisine) return false;
  if (course && course !== 'any' && recipe.course !== course) return false;

  const avoidSet = avoid instanceof Set ? avoid : new Set(avoid || []);
  if (avoidSet.size) {
    const hit = (recipe.ingredients || []).some((i) => avoidSet.has(i.item));
    if (hit) return false;
  }

  return true;
}

function sorter(sortBy) {
  if (sortBy === 'quick') {
    return (a, b) => {
      if (a.recipe.minutes !== b.recipe.minutes) return a.recipe.minutes - b.recipe.minutes;
      return b.score - a.score;
    };
  }
  if (sortBy === 'missing') {
    return (a, b) => {
      if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
      return b.score - a.score;
    };
  }
  return (a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.matchedCount !== a.matchedCount) return b.matchedCount - a.matchedCount;
    if (a.recipe.minutes !== b.recipe.minutes) return a.recipe.minutes - b.recipe.minutes;
    return a.recipe.name.localeCompare(b.recipe.name);
  };
}

/**
 * Rank recipes.
 * Returns the sorted list plus the three buckets the results page shows:
 * makeNow (nothing missing), almost (one missing), twoAway (two missing).
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
    .sort(sorter(options.sortBy));

  if (results.length) {
    return {
      results,
      fallback: false,
      closest: [],
      explanation: '',
      makeNow: results.filter((m) => m.missing.length === 0),
      almost: results.filter((m) => m.missing.length === 1),
      twoAway: results.filter((m) => m.missing.length === 2),
      stats: {
        total: results.length,
        makeable: results.filter((m) => m.missing.length === 0).length
      }
    };
  }

  const closest = scored.sort(sorter('match')).slice(0, 3);
  return {
    results: [],
    fallback: true,
    closest,
    explanation: explainEmpty(options, pantry),
    makeNow: [],
    almost: [],
    twoAway: [],
    stats: { total: 0, makeable: 0 }
  };
}

/** Plain-language reason the pantry came up empty. */
export function explainEmpty(options = {}, pantryKeys = new Set()) {
  const { diet = 'non-veg', maxMinutes = null, cuisine = 'any', course = 'any', avoid = [] } = options;
  const bits = [];

  bits.push(DIET_LABEL[diet] || diet);
  bits.push('recipe');

  if (maxMinutes != null) bits.push(`under ${maxMinutes} minutes`);
  if (course && course !== 'any') {
    const c = COURSES.find((x) => x.id === course);
    bits.push(`for ${(c ? c.label : course).toLowerCase()}`);
  }
  if (cuisine && cuisine !== 'any') {
    const c = CUISINES.find((x) => x.id === cuisine);
    bits.push(`from ${c ? c.label : cuisine}`);
  }

  let sentence = `No ${bits.join(' ')}`;
  const pantrySize = pantryKeys instanceof Set ? pantryKeys.size : 0;
  sentence += pantrySize === 0 ? ' matches — your pantry is empty.' : ' with what you have.';

  const avoidList = avoid instanceof Set ? [...avoid] : (avoid || []);
  if (avoidList.length) {
    const labels = avoidList.map((a) => (typeof a === 'string' ? a : (a.label || a.key || a))).join(', ');
    sentence += ` You are also avoiding ${labels}.`;
  }

  return sentence;
}

/**
 * "Popular additions" — which single ingredient would unlock the most dishes.
 * For every pantry item the cook does not have, count how many filtered recipes
 * are exactly one ingredient away and would become cookable with it.
 */
export function suggestUnlocks(recipes, pantryKeys, options = {}, limit = 4) {
  const pantry = pantryKeys instanceof Set ? pantryKeys : new Set(pantryKeys);
  if (!pantry.size) return [];

  const eligible = recipes
    .filter((r) => passesFilters(r, options))
    .map((r) => {
      const required = requiredIngredients(r);
      const missing = required.filter((i) => !pantry.has(i.item));
      return { required, missing };
    })
    .filter((x) => x.missing.length === 1);

  const counts = new Map();
  for (const { missing } of eligible) {
    const key = missing[0].item;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      label: (BY_KEY.get(key) || { label: key }).label,
      count
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/* ------------------------------------------------------------------ *
 * 6. Small helpers used by the UI
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
