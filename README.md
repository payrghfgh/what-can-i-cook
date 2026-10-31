# What Can I Cook

A static recipe suggester. You type in what is actually in the kitchen, set a few
constraints, and it ranks the dishes you can cook right now — best match first,
with quantities scaled to the number of people at your table.

No backend, no API keys, no build step. Plain HTML, CSS and JavaScript plus
`recipes.json`, deployable anywhere that serves files.

## Run it locally

The page loads `recipes.json` with `fetch`, so opening `index.html` straight
from your file manager will not work — browsers block that request on `file://`.
Serve the folder over HTTP instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

or, if you have Node:

```bash
npm run serve      # same thing, python http.server on :8000
```

## Tests

```bash
npm test           # node tests/run.mjs
```

25 checks covering every acceptance criterion in the brief: alias matching,
the scoring formula, the four diet filters, the hard `avoid` filter, the
rounding rules for grams / spoons / pieces, the egg formatting rules, the
"nothing matches" fallback, and the page wiring. The suite is plain Node with
no dependencies.

## Deploy

**Live:** https://payrghfgh.github.io/what-can-i-cook/ — GitHub Pages, serving
the `main` branch from the repo root. Push to `main` and it redeploys itself;
the `.nojekyll` file makes Pages serve the files verbatim rather than running
them through Jekyll.

Netlify works just as well: `netlify.toml` already sets the publish directory to
the repo root with no build command, so you only need to connect the repo. Any
other static host: upload the repo root as-is.

There are **no environment variables** to set on either host. `.env.example` is
present only to make that explicit.

## How it works

**`logic.js`** holds all the reasoning and touches no DOM, which is why the
tests can import it directly.

*Canonicalising.* Every free-text entry is lowercased, stripped of quantities,
units and filler words, then matched against a vocabulary of ~68 common
ingredients with aliases. `pyaz`, `onions`, `1 onion` and `2 medium onions,
finely chopped` all resolve to `onion`. Anything unrecognised is kept as a chip
but flagged, so it never silently pretends to match.

*Hard filters* run first: diet, max time, cuisine, and the `avoid` list. A dish
containing an avoided ingredient is excluded outright, even if that ingredient
is optional. Staples — salt, water, oil, sugar and the basic spices — are
assumed present and never counted as missing.

*Scoring.*

```
coverage = matched required ingredients / total required ingredients
score    = coverage * 100 - missingCount * 12 + focusBonus
```

`focusBonus` is +8 per matching focus tag, capped at +24. A `quick` tag only
counts if the dish is 30 minutes or under; a `budget` tag only counts at cost
tier 1. The displayed percentage is the score clamped to 0–100.

A dish that shares no ingredient at all with your pantry is not offered as a
suggestion — it would be a 0% match dressed up as a result. When nothing
qualifies, the page says what blocked it ("No vegan recipe under 20 minutes with
what you have") and shows the three closest dishes with their gaps spelled out.

*Scaling.* `qty * people / recipe.serves`, then rounded so the numbers are
usable in a kitchen rather than mathematically pure:

| unit | rule |
| --- | --- |
| grams / ml | nearest 5; below 20, nearest 1 |
| tsp / tbsp / cup | nearest quarter |
| pieces (onion, tomato…) | nearest half, then a whole number once the result is 2 or more |
| eggs | never a fraction — 1.33 and 1.5 show as "1 egg + 1 yolk", 2.5 as "2 or 3 eggs" |

The original quantity sits in small text next to the scaled one so you can check
it at a glance.

## Adding a recipe

Append an object to `recipes.json`. No code changes needed — the page reads the
file at load.

```json
{
  "id": "rajma",
  "name": "Rajma",
  "cuisine": "punjabi",
  "diet": "vegan",
  "minutes": 45,
  "serves": 4,
  "costTier": 1,
  "protein": "high",
  "oil": "low",
  "focus": ["high-protein", "one-pot", "budget", "high-fibre"],
  "ingredients": [
    { "item": "rajma", "qty": 200, "unit": "g" },
    { "item": "onion", "qty": 1, "unit": "piece" },
    { "item": "coriander", "qty": 2, "unit": "tbsp", "optional": true },
    { "item": "salt", "qty": 1, "unit": "tsp", "staple": true }
  ],
  "steps": ["Soak the rajma overnight.", "…"]
}
```

Notes on the fields:

- `id` must be unique — it keys the expand/collapse state.
- `cuisine` is one of `north-indian`, `south-indian`, `bengali`, `gujarati`,
  `punjabi`, `continental`.
- `diet` is one of `vegan`, `veg`, `egg`, `non-veg`. `veg` may contain dairy but
  never egg or meat; keep this honest, the filter trusts it.
- `costTier` is 1, 2 or 3 (₹, ₹₹, ₹₹₹). Only tier 1 satisfies "budget-friendly".
- `focus` tags must be internally consistent: do not tag something `quick` if it
  takes more than 30 minutes, or `budget` at tier 2. `npm test` fails if you do.
- `ingredients[].item` must be a key from the `VOCAB` list in `logic.js`,
  otherwise the recipe can never match that ingredient. Add new ingredients to
  `VOCAB` with their aliases first.
- `optional: true` ingredients are never counted as missing.
- `staple: true` (or any item in the `STAPLES` set) is assumed to be in the
  kitchen.

Run `npm test` after editing — it validates every recipe's shape, units and
diet consistency.

## What's in here

```
index.html      the page: three steps, one screen
styles.css      warm kitchen-notebook styling, mobile first, dark mode aware
app.js          DOM wiring, chip inputs, live re-render, localStorage
logic.js        vocabulary, canonicalising, filters, scoring, scaling (pure)
recipes.json    50 recipes
tests/run.mjs   the acceptance suite
netlify.toml    publish config
```

The last pantry you typed is kept in `localStorage` under
`what-can-i-cook:v1`, along with your diet, focus, headcount and cuisine, so the
next visit opens where you left off.

## Content notes

The recipes are written as ordinary home cooking — ingredient lists, methods and
timings are plausible and internally consistent, but they have not been tested
in a kitchen by a cook. Treat the timings as estimates and adjust to your own
stove. Cost tiers are relative (1 = everyday staples, 3 = a treat), not rupee
amounts.
