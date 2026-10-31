// Sign-in page wiring. The rules live in auth.js; this file only touches the DOM.
// Firebase is the identity provider — Google, Apple, email/password and guest
// all resolve to a verified Firebase user.

import { getFirebaseConfig } from './firebase-runtime.js';
import {
  initAuth, isConfigured, waitForSession, onSessionChange,
  signInGuest, signInWithEmail, signUpWithEmail, signInWithGoogle,
  signInWithApple, resetPassword, setPersistence, friendlyError
} from './auth.js';

const HOME = 'index.html';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let mode = 'signin';
let busy = false;

function go(target = HOME) {
  window.location.replace(target);
}

function say(message, kind = 'error') {
  const el = $('#auth-notice');
  el.textContent = message;
  el.hidden = !message;
  el.dataset.kind = kind;
}

function rememberWanted() {
  const box = $('#auth-remember');
  return box ? box.checked : true;
}

function setBusy(next) {
  busy = next;
  for (const el of $$('#email-submit, #guest-btn, #apple-btn, #google-slot button, #reset-btn')) {
    if (el) el.disabled = next;
  }
}

/** Run one sign-in attempt: lock the form, report failures in plain words. */
async function attempt(label, work) {
  if (busy) return;
  setBusy(true);
  say(`${label}…`, 'ok');
  try {
    const session = await work();
    if (session) {
      say('Signed in — taking you in…', 'ok');
      go(HOME);
    }
  } catch (err) {
    say(friendlyError(err));
    setBusy(false);
  }
}

/* ------------------------------------------------------------------ *
 * email + password
 * ------------------------------------------------------------------ */

function setMode(next) {
  mode = next;
  for (const tab of $$('.auth-tab')) {
    tab.setAttribute('aria-pressed', String(tab.dataset.mode === mode));
  }
  const creating = mode === 'create';
  $('#name-field').hidden = !creating;
  // you cannot reset the password of an account you have not created yet
  $('#reset-btn').hidden = creating;
  $('#email-submit').textContent = creating ? 'Create account' : 'Sign in';
  $('#auth-password').setAttribute('autocomplete', creating ? 'new-password' : 'current-password');
  say('');
}

function submitEmail(event) {
  event.preventDefault();
  const email = $('#auth-email').value.trim();
  const password = $('#auth-password').value;
  const name = $('#auth-name').value.trim();

  if (!email) {
    say('Enter your email address.');
    $('#auth-email').focus();
    return;
  }
  if (mode === 'create' && password.length < 8) {
    say('Use a password of at least 8 characters.');
    $('#auth-password').focus();
    return;
  }
  if (mode !== 'create' && !password) {
    say('Enter your password.');
    $('#auth-password').focus();
    return;
  }

  attempt(mode === 'create' ? 'Creating your account' : 'Signing in', async () => {
    await setPersistence(rememberWanted());
    return mode === 'create'
      ? signUpWithEmail(email, password, name)
      : signInWithEmail(email, password);
  });
}

/* ------------------------------------------------------------------ *
 * guest, Google, Apple, password reset
 * ------------------------------------------------------------------ */

function guestIn() {
  attempt('Starting a guest session', async () => {
    await setPersistence(rememberWanted());
    return signInGuest();
  });
}

function googleIn() {
  attempt('Opening Google', () => signInWithGoogle());
}

function appleIn() {
  attempt('Opening Apple', () => signInWithApple());
}

function resetPasswordFlow() {
  const email = $('#auth-email').value.trim();
  if (!email) {
    say('Type your email above first, then ask for a reset link.');
    $('#auth-email').focus();
    return;
  }
  if (busy) return;
  setBusy(true);
  say('Sending a reset link…', 'ok');
  resetPassword(email)
    .then((sentTo) => {
      say(`Reset link sent to ${sentTo}. Check your inbox and spam folder.`, 'ok');
    })
    .catch((err) => say(friendlyError(err)))
    .finally(() => setBusy(false));
}

/* ------------------------------------------------------------------ *
 * boot
 * ------------------------------------------------------------------ */

function showNotConfigured() {
  const note = $('#setup-notice');
  if (note) note.hidden = false;
  setBusy(true);
  say('Firebase is not configured yet, so sign-in is switched off. See firebase-config.js.');
  const providerNote = $('#provider-note');
  if (providerNote) {
    providerNote.textContent = 'Add your Firebase project keys to firebase-config.js to switch sign-in on.';
  }
}

async function boot() {
  const params = new URLSearchParams(window.location.search);

  for (const tab of $$('.auth-tab')) {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  }
  $('#email-form').addEventListener('submit', submitEmail);
  $('#guest-btn').addEventListener('click', guestIn);
  $('#apple-btn').addEventListener('click', appleIn);
  $('#reset-btn').addEventListener('click', resetPasswordFlow);

  if (!isConfigured(getFirebaseConfig())) {
    showNotConfigured();
    return;
  }

  // Google and Apple buttons are real here — Firebase opens the provider popup.
  $('#google-btn').addEventListener('click', googleIn);
  $('#apple-btn').disabled = false;
  const note = $('#provider-note');
  if (note) note.textContent = 'Google and Apple sign-in open in a secure popup.';

  await initAuth(getFirebaseConfig());
  const session = await waitForSession();

  if (session && !params.has('switch')) {
    go(HOME);
    return;
  }

  // if the session appears while this page is open, follow it through
  onSessionChange((s) => {
    if (s && !params.has('switch')) go(HOME);
  });
}

boot();
