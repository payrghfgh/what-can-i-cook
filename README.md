# What Can I Cook

A static recipe suggester. You tick off what is actually in the kitchen and it
ranks the dishes you can cook right now — split into "make right now", "one
ingredient away" and "two away" — with quantities scaled to the number of people
at your table, and a shopping list for the gap.

No backend, no API keys, no build step. Plain HTML, CSS and JavaScript plus
`recipes.json`, deployable anywhere that serves files.

Sign-in is real: Google, Apple, email/password and guest, all through Firebase
Authentication, and your pantry, saved recipes and shopping list are stored in
Firestore under your account so they follow you between devices. See
[Sign-in](#sign-in) below.

With no Firebase keys the site still works — it runs as a single local profile
with a banner saying sign-in is off, so nothing is walled off while you set the
project up.

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
npm test           # node tests/run.mjs && node tests/auth.mjs
```

38 checks on the recipe engine and the pages, 19 on sign-in, 20 on Firestore sync
and 10 on the config generator. Between them
they cover alias matching, the scoring formula, the four diet filters, the hard
`avoid` filter, the rounding rules for grams / spoons / pieces / pinches, the egg
formatting rules, the "nothing matches" fallback, course filtering, the three
sort modes, the result buckets, the unlock suggestions, the page wiring, the four
sign-in routes, remember-me persistence, per-account storage buckets and the
Firebase error messages. Plain Node, no dependencies.

The sign-in tests swap Firebase for a fake backend (`setAuthBackend`), so they
run without a project, a network or a key.

There are also two jsdom scripts that drive the real pages (`smoke.mjs`,
`smoke-auth.mjs`); they need `npm i jsdom` and are not part of `npm test`.

## Deploy

**Netlify:** `netlify.toml` sets the publish directory to the repo root with no
build command, so you only need to connect the repo — *Add new site → Import an
existing project → GitHub → `what-can-i-cook`* — and it builds on every push.
Then add the `*.netlify.app` host to Firebase's authorised domains, or sign-in
will refuse to run there.

**GitHub Pages** also works and is what the live URL currently uses: serving
`main` from the repo root, with `.nojekyll` so Pages serves the files verbatim
rather than running them through Jekyll. Push to `main` and it redeploys.

**Environment variables** are optional but supported: set the six `FIREBASE_*`
names on Netlify and the build writes `firebase-config.js` from them. With none
set, the committed file is used as-is. See
[Using environment variables](#using-environment-variables).

If you would rather not commit the config at all, you can also set
`globalThis.__FIREBASE_CONFIG__` before the scripts load (for example in a small
inline script in `login.html` and `index.html`); `getFirebaseConfig()` prefers it
over the file.

## Sign-in

`login.html` offers four ways in — **Google**, **Apple**, **email and password**
and **guest** — all backed by **Firebase Authentication**. Firebase checks the
password server-side and verifies the Google and Apple identity tokens, so this
is real authentication; the site itself never sees or stores a password.

Every route ends with a verified Firebase user, and `index.html` sends you to
`login.html` if there isn't one.

### Setting it up (about five minutes)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Project settings → General → Your apps → Web (`</>`)** and get the
   `firebaseConfig` object. Put the six values in `firebase-config.js` by hand,
   or set them as environment variables and let the build write that file (see
   [Using environment variables](#using-environment-variables)). They are public
   identifiers, not secrets — it is normal for them to ship in the page. Never
   put a service-account key there.
3. **Authentication → Sign-in method**, enable:
   - **Email/Password** — the form on the page
   - **Google** — one toggle, no extra keys needed
   - **Apple** — needs an Apple Developer account: a Services ID with "Sign in
     with Apple" enabled, plus your domain and return URL registered with Apple
   - **Anonymous** — this is what "Continue as guest" uses
4. **Authentication → Settings → Authorised domains**, add every host the site
   runs on — `localhost`, your `*.netlify.app` domain and `yourname.github.io`.
   Sign-in fails with `auth/unauthorized-domain` until a host is listed.
5. **Firestore Database → Create database**, then open the **Rules** tab, paste
   in `firestore.rules` from this repo and publish. Until you do, saving fails
   quietly and the app falls back to the local copy (the sync chip says
   "Local only"). Do **not** leave it in test mode — that opens the database to
   anyone for 30 days.

Until step 2 is done the site runs in "not configured" mode: the sign-in page
says so instead of failing silently, and `index.html` stops at a card telling you
the same thing.

### Using environment variables

The Firebase web config is public — whatever you put in it is served to the
browser. Environment variables are still worth using, because they keep project
ids out of git and let development and production point at different Firebase
projects. They do not make anything secret.

Set these six names, then run `npm run config`:

```
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
```

Locally, copy `.env.example` to `.env` and fill it in — `npm run config` reads
your shell environment, so export the variables (or use a tool that loads `.env`)
before running it. On Netlify, set the same six under **Site configuration →
Environment variables**; the build command in `netlify.toml` already runs
`node scripts/generate-config.mjs`, which writes `firebase-config.js` inside the
build container.

The generator is deliberately fussy: set all six and it writes the file, set none
and it leaves the committed placeholder untouched, set some and it exits 1 naming
exactly what is missing. That last case is the one that matters — a half-filled
config fails the build instead of shipping a site that silently can't sign anyone
in.

Paste the field names instead of the values — `apiKey: FIREBASE_API_KEY`, `projectId: PROJID` — and the site refuses to start rather than failing inside Firebase: `configProblem()` in `firebase-runtime.js` checks that the apiKey looks like a key and the projectId like a project id, and the page says which one is wrong.

**A static site cannot read environment variables at runtime.** There is no
server; Netlify exposes them to the build, not to the browser. That is why a
build step exists at all, and why the values still end up in the served
JavaScript.

If you host on GitHub Pages instead, there is no build step — Pages serves the
repo as-is — so commit the values in `firebase-config.js` and skip this section.

### What is remembered, and where

Firebase owns the session. **Remember me** (on by default) asks Firebase for
local persistence, so the session survives a browser restart; untick it and the
session ends when the tab closes.

Your pantry, filters, saved recipes and shopping list are kept in two places:

- **localStorage** — the instant copy. It is what paints on the first frame and
  what keeps the app working with no network. Keyed per account
  (`what-can-i-cook:v2:<uid>`).
- **Firestore** — the durable copy, one document at `users/{uid}`. Read once when
  the page loads, written back (debounced by 700 ms) whenever something changes.

So signing in on another device pulls the same kitchen down. The sync chip in the
header shows what is happening: *Saving…*, *Saved*, or *Local only* when the
database could not be reached. A failed write never loses data — the payload
stays queued and the next change retries it.

First sign-in on a fresh account with a pantry already on the device pushes that
local pantry up, so nothing is lost in the move.

Two things are deliberately not built yet: live cross-device updates (the second
device sees changes on reload, not instantly) and merging edits made offline on
two devices at once. Both are straightforward to add with `onSnapshot` and a
field-level merge; the sync is pull-on-load, push-on-change today.

Guest mode is an anonymous Firebase user: it gets its own `users/{uid}` document
and works across reloads, but cannot be recovered if browser data is cleared, and
it is not linked to a real account later.

### How the code is arranged

`auth.js` is the only file that touches Firebase. It exposes a small surface —
`initAuth`, `waitForSession`, `signInGuest`, `signInWithEmail`, `signUpWithEmail`,
`signInWithGoogle`, `signInWithApple`, `resetPassword`, `signOutUser`,
`setPersistence`, `friendlyError` — so the pages never import the SDK directly.

The SDK is pulled from Google's CDN at runtime (`firebase-config.js` holds the
version), which is what keeps this a no-build-step site. That means the sign-in
page needs a network connection the first time it loads.

`setAuthBackend()` replaces the SDK with a fake, which is how the test suite runs
every flow — Google popup, Apple popup, wrong password, password reset — without
a live Firebase project.

## How it works

**`logic.js`** holds all the reasoning and touches no DOM, which is why the
tests can import it directly.

*The pantry* is a browsable list of 137 ingredients in ten categories
(vegetables, herbs, dal, grains, dairy, meat, spices, sauces, nuts, fruit), each
searchable and tickable, plus free text for anything not listed. Every ingredient
in the vocabulary is used by at least one recipe — the test suite fails if that
stops being true, so nothing you can tick leads to a dead end.

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

*Sections and sorting.* Results are grouped into **make right now** (nothing
missing), **one ingredient away** and **two away**, with the rest under "further
off". Each card shows an x/y ingredient count and a tick when it is complete.
You can sort by best match, fewest missing, or quickest.

*Unlock suggestions.* Under the filters the page names the single ingredient
that would open up the most dishes — "eggs unlocks 12" — and adds it to the
pantry on one tap.

*Shopping list and favourites* live in the browser. "Add to list" on a card puts
that dish's missing ingredients on the list; the star saves a recipe, and the
Show filter can narrow the results to saved dishes only.

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
  "course": "main",
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
  `punjabi`, `maharashtrian`, `indo-chinese`, `continental`.
- `course` is one of `breakfast`, `main`, `side`, `snack`, `dessert`, `drink` —
  this is what the Meal filter reads.
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
index.html      the app: pantry browser, filters, results, shopping list
login.html      the sign-in page
styles.css      warm kitchen-notebook styling, mobile first, dark mode aware
app.js          app wiring, live re-render, per-profile storage
login.js        sign-in page wiring for all four routes
auth.js         Firebase seam: sessions, providers, readable errors
store.js        Firestore seam: local cache, debounced writes, sync status
firestore.rules security rules — owner-only access, paste into the console
firebase-config.js  Firebase web config — empty by default, public values only
firebase-runtime.js SDK version, config lookup, the configured check
scripts/generate-config.mjs  writes firebase-config.js from env vars at build time
logic.js        vocabulary, canonicalising, filters, scoring, scaling (pure)
recipes.json    166 recipes
tests/run.mjs   the recipe and page suite
tests/auth.mjs  the sign-in suite
netlify.toml    publish config
```

The last pantry you ticked is kept in `localStorage` under
`what-can-i-cook:v2:<userId>`, along with your diet, focus, headcount, cuisine, saved recipes and shopping
list, so the next visit opens where you left off. An older single-user key
(`what-can-i-cook:v2`) is migrated into the signed-in profile on first load.

## Content notes

The recipes are written as ordinary home cooking — ingredient lists, methods and
timings are plausible and internally consistent, but they have not been tested
in a kitchen by a cook. Treat the timings as estimates and adjust to your own
stove. Cost tiers are relative (1 = everyday staples, 3 = a treat), not rupee
amounts.
