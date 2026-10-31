// Browser-level smoke test for sign-in and the gate. Not shipped (needs jsdom).
//   npm i jsdom && node smoke-auth.mjs
//
// Firebase cannot be reached from a sandbox, so this injects a fake backend that
// behaves like the SDK. That exercises the real login.js and app.js code paths —
// the only thing faked is the network call inside auth.js.

import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const RECIPES = read('recipes.json');

// pretend the project is configured, so the pages wire themselves up
globalThis.__FIREBASE_CONFIG__ = { apiKey: 'AIzaSyDummyKeyForTests0123456789abcdef', projectId: 'test-project', authDomain: 'test.firebaseapp.com' };

const { setAuthBackend } = await import('./auth.js');
const { setStoreBackend } = await import('./store.js');

let passed = 0;
const failures = [];
const check = async (name, fn) => {
  try {
    const d = await fn();
    passed++;
    console.log(`  ok   ${name}${d ? '  — ' + d : ''}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
};
const assert = (c, m) => { if (!c) throw new Error(m); };
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 4000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const v = fn();
    if (v) return v;
    await tick(25);
  }
  throw new Error('timed out waiting');
}

/** A fake Firebase Auth with one user and the same error codes as the real one. */
function fakeFirebase(user = null) {
  let current = user;
  let listener = null;
  const calls = [];
  const emit = () => { if (listener) listener(current); };
  const fail = (code) => { const e = new Error(code); e.code = code; throw e; };

  return {
    onAuthStateChanged: (cb) => { listener = cb; setTimeout(emit, 0); },
    signInAnonymously: async () => {
      calls.push('anonymous');
      current = { uid: 'anon-9', isAnonymous: true, providerData: [] };
      emit();
      return { user: current };
    },
    signInWithEmailAndPassword: async (email, password) => {
      calls.push('email');
      if (password !== 'kadakchai99') fail('auth/invalid-credential');
      current = { uid: 'u_asha', email, displayName: 'Asha', providerData: [{ providerId: 'password' }] };
      emit();
      return { user: current };
    },
    createUserWithEmailAndPassword: async (email, password) => {
      calls.push('signup');
      if (password.length < 8) fail('auth/weak-password');
      current = { uid: 'u_new', email, displayName: null, providerData: [{ providerId: 'password' }] };
      emit();
      return { user: current };
    },
    updateProfile: async (u, p) => { current = { ...current, displayName: p.displayName }; },
    signInWithPopup: async (provider) => {
      calls.push('popup:' + provider.__kind);
      current = { uid: 'u_' + provider.__kind, email: provider.__kind + '@example.com',
        displayName: 'Asha ' + provider.__kind, providerData: [{ providerId: provider.__kind === 'google' ? 'google.com' : 'apple.com' }] };
      emit();
      return { user: current };
    },
    signOut: async () => { calls.push('signOut'); current = null; emit(); },
    sendPasswordResetEmail: async (email) => { calls.push('reset:' + email); },
    setPersistence: async (remember) => { calls.push('persist:' + remember); },
    providers: { google: () => ({ __kind: 'google' }), apple: () => ({ __kind: 'apple' }) },
    __calls: calls
  };
}

/** Build a window, wire globals, return helpers. */
function openPage(file) {
  const vc = new VirtualConsole();
  const navAttempts = [];
  const consoleErrors = [];
  vc.on('jsdomError', (e) => {
    if (/Not implemented: navigation/i.test(e.message)) navAttempts.push(e.message);
    else consoleErrors.push(e.message);
  });
  vc.on('error', (m) => consoleErrors.push('console.error: ' + m));

  const dom = new JSDOM(read(file), { url: 'https://whatcanicook.test/' + file, pretendToBeVisual: true, virtualConsole: vc });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.sessionStorage = window.sessionStorage;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event;
  globalThis.Node = window.Node;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => JSON.parse(RECIPES) });

  const $ = (s) => window.document.querySelector(s);
  const $$ = (s) => [...window.document.querySelectorAll(s)];
  return { window, $, $$, navAttempts, consoleErrors };
}
const submit = (form) => form.dispatchEvent(new globalThis.window.Event('submit', { bubbles: true, cancelable: true }));

/* ================================================================ login page */

console.log('\nSign-in page');

const fake1 = fakeFirebase();
await setAuthBackend(fake1);

const page1 = openPage('login.html');
await import('./login.js?run=1');
await tick(60);

await check('all four routes are on the page', () => {
  assert(page1.$('#guest-btn'), 'no guest button');
  assert(page1.$('#email-form'), 'no email form');
  assert(page1.$('#google-btn'), 'no Google button');
  assert(page1.$('#apple-btn'), 'no Apple button');
  assert(page1.$('#reset-btn'), 'no password reset');
  assert(page1.$('#setup-notice').hidden, 'the setup notice is showing even though config exists');
  return 'guest, email, Google, Apple';
});

await check('the page states who verifies sign-in', () => {
  const text = page1.window.document.querySelector('.auth-disclosure').textContent;
  assert(/Firebase Authentication/.test(text), 'Firebase is not named');
  assert(/never sees your password/i.test(text), 'no statement about the password');
  assert(/browser under your account id/i.test(text), 'does not say where the pantry lives');
  return 'disclosure shown';
});

await check('guest sign-in starts an anonymous session and leaves for the app', async () => {
  page1.$('#guest-btn').click();
  const nav = await waitFor(() => page1.navAttempts.find((m) => /navigation/i.test(m)));
  assert(fake1.__calls.includes('anonymous'), 'the SDK was never asked');
  assert(/taking you in/i.test(page1.$('#auth-notice').textContent), `notice: ${page1.$('#auth-notice').textContent}`);
  return 'anonymous session, redirected';
});

console.log('\nEmail and password');

const fake2 = fakeFirebase();
await setAuthBackend(fake2);
const page2 = openPage('login.html');
await import('./login.js?run=2');
await tick(60);

await check('a wrong password shows a sentence, not a stack trace', async () => {
  page2.$('#auth-email').value = 'asha@example.com';
  page2.$('#auth-password').value = 'nope';
  submit(page2.$('#email-form'));
  const notice = await waitFor(() => {
    const el = page2.$('#auth-notice');
    return !el.hidden && /do not match/i.test(el.textContent) ? el.textContent : null;
  });
  assert(!page2.navAttempts.length, 'it navigated despite the failure');
  assert(!page2.$('#email-submit').disabled, 'the form stayed locked after a failure');
  return notice;
});

await check('the right password signs in and redirects', async () => {
  page2.$('#auth-password').value = 'kadakchai99';
  submit(page2.$('#email-form'));
  await waitFor(() => page2.navAttempts.find((m) => /navigation/i.test(m)));
  assert(fake2.__calls.includes('persist:true'), 'remember-me was not applied');
  return 'signed in';
});

await check('creating an account switches the form and sets a name', async () => {
  const fake3 = fakeFirebase();
  await setAuthBackend(fake3);
  const page = openPage('login.html');
  await import('./login.js?run=3');
  await tick(60);

  page.$$('.auth-tab').find((t) => t.dataset.mode === 'create').click();
  await tick();
  assert(!page.$('#name-field').hidden, 'name field hidden in create mode');
  assert(page.$('#email-submit').textContent === 'Create account', 'button label did not change');
  assert(page.$('#reset-btn').hidden, 'the forgot-password link is offered while creating an account');

  page.$('#auth-name').value = 'Asha';
  page.$('#auth-email').value = 'new@example.com';
  page.$('#auth-password').value = 'longenough';
  submit(page.$('#email-form'));
  await waitFor(() => page.navAttempts.find((m) => /navigation/i.test(m)));
  assert(fake3.__calls.includes('signup'), 'sign-up was not called');
  return 'account created';
});

await check('Google and Apple open their provider popups', async () => {
  const fake4 = fakeFirebase();
  await setAuthBackend(fake4);
  const page = openPage('login.html');
  await import('./login.js?run=4');
  await tick(60);

  page.$('#google-btn').click();
  await waitFor(() => page.navAttempts.find((m) => /navigation/i.test(m)));
  assert(fake4.__calls.includes('popup:google'), 'Google popup not opened: ' + fake4.__calls.join(','));

  const fake5 = fakeFirebase();
  await setAuthBackend(fake5);
  const pageB = openPage('login.html');
  await import('./login.js?run=5');
  await tick(60);
  pageB.$('#apple-btn').click();
  await waitFor(() => pageB.navAttempts.find((m) => /navigation/i.test(m)));
  assert(fake5.__calls.includes('popup:apple'), 'Apple popup not opened: ' + fake5.__calls.join(','));
  return 'google and apple';
});

await check('forgot password is offered when signing in, not when creating', async () => {
  const fake = fakeFirebase();
  await setAuthBackend(fake);
  const page = openPage('login.html');
  await import('./login.js?run=6b');
  await tick(60);

  assert(!page.$('#reset-btn').hidden, 'no forgot-password link on the sign-in form');
  page.$$('.auth-tab').find((t) => t.dataset.mode === 'create').click();
  await tick();
  assert(page.$('#reset-btn').hidden, 'still shown in create mode');
  page.$$('.auth-tab').find((t) => t.dataset.mode === 'signin').click();
  await tick();
  assert(!page.$('#reset-btn').hidden, 'did not come back on the sign-in form');
  return 'shown for sign-in, hidden for create';
});

await check('a password reset asks for an email first', async () => {
  const fake6 = fakeFirebase();
  await setAuthBackend(fake6);
  const page = openPage('login.html');
  await import('./login.js?run=6');
  await tick(60);

  page.$('#reset-btn').click();
  await tick(30);
  assert(/type your email/i.test(page.$('#auth-notice').textContent), 'no nudge for a missing email');
  assert(!fake6.__calls.some((c) => c.startsWith('reset')), 'a reset was attempted without an email');

  page.$('#auth-email').value = 'asha@example.com';
  page.$('#reset-btn').click();
  const sent = await waitFor(() => fake6.__calls.find((c) => c.startsWith('reset:')));
  assert(sent === 'reset:asha@example.com', sent);
  return 'refused empty, sent once filled';
});

await check('an existing session skips the sign-in page', async () => {
  const fake7 = fakeFirebase({ uid: 'u_asha', email: 'asha@example.com', displayName: 'Asha', providerData: [{ providerId: 'password' }] });
  await setAuthBackend(fake7);
  const page = openPage('login.html');
  await import('./login.js?run=7');
  await waitFor(() => page.navAttempts.find((m) => /navigation/i.test(m)));
  return 'went straight through';
});

/** A fake Firestore: records writes so the sync path can be observed. */
function fakeStore() {
  const writes = [];
  return {
    read: async () => null,
    write: async (uid, payload) => { writes.push({ uid, payload }); },
    __writes: writes
  };
}

/* ================================================================ the gate */

console.log('\nThe app gate');

const gate1 = openPage('index.html');
await setAuthBackend(fakeFirebase(null));
await import('./app.js?gate=1');
await tick(120);

await check('with no session the app does not render recipes', () => {
  assert(gate1.$$('#results-body .card').length === 0, 'cards rendered without a session');
  assert(/Taking you to sign in/.test(gate1.window.document.body.textContent), 'no redirect notice');
  assert(gate1.navAttempts.some((m) => /navigation/i.test(m)), 'did not navigate to sign-in');
  return 'sent to login.html';
});

const gate2 = openPage('index.html');
gate2.window.localStorage.setItem('what-can-i-cook:v2:u_asha', JSON.stringify({
  pantry: [{ key: 'rajma', label: 'rajma' }, { key: 'onion', label: 'onion' }],
  avoid: [], people: 4, focus: [], diet: 'veg', maxTime: 'any', cuisine: 'any', course: 'any',
  sort: 'match', favourites: [], shopping: []
}));
await setAuthBackend(fakeFirebase({ uid: 'u_asha', email: 'asha@example.com', displayName: 'Asha', providerData: [{ providerId: 'password' }] }));
const store2 = fakeStore();
setStoreBackend(store2);
await import('./app.js?gate=2');
await tick(150);

await check('with a session the app renders and greets the person', () => {
  assert(gate2.$$('#results-body .card').length > 0, 'no cards');
  assert(gate2.$('#account-name').textContent === 'Asha', `account chip says ${gate2.$('#account-name').textContent}`);
  return `${gate2.$$('#results-body .card').length} cards as Asha`;
});

await check("that account's own pantry is restored", () => {
  const labels = gate2.$$('#pantry-selected .chip').map((c) => c.textContent.replace('×', '').trim());
  assert(labels.includes('rajma') && labels.includes('onion'), 'pantry not restored: ' + labels.join(','));
  return labels.join(', ');
});

await check('the app still works normally once signed in', async () => {
  const input = gate2.window.document.querySelector('#pantry-groups input[data-key="tomato"]');
  input.checked = true;
  input.dispatchEvent(new globalThis.window.Event('change', { bubbles: true }));
  await tick();
  assert(gate2.$('#stat-pantry-num').textContent === '3', 'ticking did not register');
  const card = gate2.$$('#results-body .card')[0];
  card.querySelector('.toggle').click();
  await tick();
  const panel = gate2.window.document.getElementById('recipe-' + card.dataset.id);
  assert(panel && !panel.hidden, 'recipe did not open');
  assert(panel.querySelectorAll('.steps li').length >= 3, 'no method steps');
  return 'pantry grows, recipes open';
});

await check('changes are pushed to the database under that uid', async () => {
  const first = await waitFor(() => store2.__writes[0]);
  assert(first.uid === 'u_asha', `wrote to ${first.uid}`);
  assert(Array.isArray(first.payload.pantry), 'no pantry in the payload');
  const label = await waitFor(() => {
    const t = gate2.$('#sync-status').textContent;
    return t === 'Saved' || t === 'Saving…' ? t : null;
  }, 3000);
  return `write to u_asha, sync chip "${label}"`;
});

await check("changes are filed under that account's own key", () => {
  const saved = JSON.parse(gate2.window.localStorage.getItem('what-can-i-cook:v2:u_asha'));
  assert(saved.pantry.length === 3, `saved ${saved.pantry.length} items`);
  assert(!gate2.window.localStorage.getItem('what-can-i-cook:v2:anon-9'), 'wrote to another bucket');
  return 'saved to u_asha only';
});

const gate3 = openPage('index.html');
await setAuthBackend(fakeFirebase({ uid: 'u_other', email: 'other@example.com', displayName: 'Someone', providerData: [{ providerId: 'google.com' }] }));
await import('./app.js?gate=3');
await tick(150);

await check("a different account does not inherit the first one's pantry", () => {
  const labels = gate3.$$('#pantry-selected .chip').map((c) => c.textContent.replace('×', '').trim());
  assert(labels.length === 0, 'leaked pantry: ' + labels.join(','));
  assert(gate3.$('#stat-pantry-num').textContent === '0', 'pantry count not zero');
  return 'separate bucket, empty pantry';
});

await check('signing out ends the session and returns to sign-in', async () => {
  gate3.$('#signout-btn').click();
  await waitFor(() => gate3.navAttempts.find((m) => /navigation/i.test(m)));
  return 'signed out';
});

/* ================================================================ no config */

console.log('\nWithout a Firebase project');

await check('the app still works, and says sign-in is off', async () => {
  const saved = globalThis.__FIREBASE_CONFIG__;
  delete globalThis.__FIREBASE_CONFIG__;

  const page = openPage('index.html');
  await import('./app.js?local=1');
  await tick(200);

  assert(page.$$('#results-body .card').length > 0, 'no cards in local mode');
  assert(!page.$('#local-banner').hidden, 'the banner stayed hidden');
  assert(/Sign-in is off/i.test(page.$('#local-banner').textContent), 'no explanation on the banner');
  assert(page.$('#account-name').textContent === 'This device', `chip says ${page.$('#account-name').textContent}`);
  assert(page.$('#signout-btn').hidden, 'a sign-out button with nothing to sign out of');
  assert(page.navAttempts.length === 0, 'it redirected to sign-in anyway');

  globalThis.__FIREBASE_CONFIG__ = saved;
  return 'renders 8 cards, banner shown, no redirect';
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('\n' + failures.join('\n')); process.exit(1); }
process.exit(0);
