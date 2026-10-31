// What Can I Cook — authentication, backed by Firebase Authentication.
//
// Firebase does the parts a static site cannot do on its own: it checks
// passwords server-side, verifies Google and Apple identity tokens, and issues
// the session. This module is the thin seam between that SDK and the rest of the
// app, so `app.js` and `login.js` never touch Firebase directly.
//
// The SDK is loaded on demand from Google's CDN rather than bundled, which is
// what keeps this a no-build-step site. The network layer is injectable
// (`setAuthBackend`) so the test suite can exercise every flow without a live
// Firebase project.

import { FIREBASE_SDK_VERSION, getFirebaseConfig, isConfigured } from './firebase-runtime.js';

const SDK_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/`;

/* ------------------------------------------------------------------ *
 * state
 * ------------------------------------------------------------------ */

let backend = null;          // the auth SDK, real or injected
let currentSession = null;
let ready = false;
let configured = false;
let initError = null;
let readyPromise = null;
let resolveReady = null;

const listeners = new Set();

function freshReadyPromise() {
  readyPromise = new Promise((resolve) => { resolveReady = resolve; });
}

function settle() {
  if (ready) return;
  ready = true;
  if (resolveReady) resolveReady(currentSession);
}

function notify() {
  for (const fn of listeners) {
    try {
      fn(currentSession);
    } catch (err) { /* a listener must never break sign-in */ }
  }
}

/* ------------------------------------------------------------------ *
 * config
 * ------------------------------------------------------------------ */

// re-exported so pages and tests can keep importing it from auth.js
export { isConfigured };

/* ------------------------------------------------------------------ *
 * session shape
 * ------------------------------------------------------------------ */

/** Map a Firebase user onto the small session object the app understands. */
export function sessionFromUser(user) {
  if (!user || !user.uid) return null;
  const email = user.email || '';
  const providerData = Array.isArray(user.providerData) ? user.providerData : [];
  const providerId = providerData[0] && providerData[0].providerId;
  return {
    userId: user.uid,
    name: user.displayName || (email ? email.split('@')[0] : '') || 'Guest',
    email,
    provider: user.isAnonymous ? 'guest' : (providerId || 'password'),
    anonymous: Boolean(user.isAnonymous)
  };
}

/** Where a signed-in person's pantry lives. One bucket per Firebase uid. */
export function dataKeyFor(session) {
  const id = (session && session.userId) || 'anonymous';
  return `what-can-i-cook:v2:${id}`;
}

/* ------------------------------------------------------------------ *
 * init
 * ------------------------------------------------------------------ */

async function loadFirebase(config) {
  const [{ initializeApp }, authModule] = await Promise.all([
    import(SDK_BASE + 'firebase-app.js'),
    import(SDK_BASE + 'firebase-auth.js')
  ]);

  const app = initializeApp(config);
  const auth = authModule.getAuth(app);

  return {
    auth,
    onAuthStateChanged: (cb) => authModule.onAuthStateChanged(auth, cb),
    signInAnonymously: () => authModule.signInAnonymously(auth),
    signInWithEmailAndPassword: (email, password) => authModule.signInWithEmailAndPassword(auth, email, password),
    createUserWithEmailAndPassword: (email, password) => authModule.createUserWithEmailAndPassword(auth, email, password),
    updateProfile: (user, profile) => authModule.updateProfile(user, profile),
    signInWithPopup: (provider) => authModule.signInWithPopup(auth, provider),
    signOut: () => authModule.signOut(auth),
    sendPasswordResetEmail: (email) => authModule.sendPasswordResetEmail(auth, email),
    setPersistence: (remember) => authModule.setPersistence(
      auth,
      remember ? authModule.browserLocalPersistence : authModule.browserSessionPersistence
    ),
    providers: {
      google: () => new authModule.GoogleAuthProvider(),
      apple: () => new authModule.OAuthProvider('apple.com')
    }
  };
}

/**
 * Start the auth layer. Safe to call from both pages — it only initialises once.
 * Resolves once the first auth state is known.
 */
export async function initAuth(config = getFirebaseConfig()) {
  if (readyPromise) return readyPromise;

  freshReadyPromise();
  configured = isConfigured(config);

  if (!configured) {
    initError = new Error(
      'Firebase is not configured. Add your project keys to firebase-config.js.'
    );
    settle();
    return readyPromise;
  }

  try {
    backend = await loadFirebase(config);
    backend.onAuthStateChanged((user) => {
      currentSession = sessionFromUser(user);
      notify();
      settle();
    });
  } catch (err) {
    initError = err instanceof Error ? err : new Error(String(err));
    settle();
  }

  return readyPromise;
}

/** For tests: swap in a fake backend and skip the CDN entirely. */
export function setAuthBackend(fake, { assumeConfigured = true } = {}) {
  backend = fake;
  configured = assumeConfigured;
  ready = false;
  initError = null;
  currentSession = null;
  freshReadyPromise();
  if (fake && typeof fake.onAuthStateChanged === 'function') {
    fake.onAuthStateChanged((user) => {
      currentSession = sessionFromUser(user);
      notify();
      settle();
    });
  } else {
    settle();
  }
  return readyPromise;
}

export function onSessionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The session as it stands right now, or null. */
export function getSession() {
  return currentSession;
}

export function authError() {
  return initError;
}

export function isReady() {
  return ready;
}

/**
 * Wait for the first auth state, so a page reload does not bounce a signed-in
 * person back to the sign-in screen. Times out rather than hanging forever.
 */
export async function waitForSession(timeoutMs = 8000) {
  if (!readyPromise) await initAuth();
  if (ready) return currentSession;

  return Promise.race([
    readyPromise,
    new Promise((resolve) => {
      setTimeout(() => resolve(currentSession), timeoutMs);
    })
  ]);
}

/* ------------------------------------------------------------------ *
 * sign-in methods
 * ------------------------------------------------------------------ */

function requireBackend() {
  if (!configured) {
    throw new Error('Firebase is not configured yet — add your keys to firebase-config.js.');
  }
  if (!backend) {
    throw new Error('Sign-in is still starting up. Try again in a moment.');
  }
  return backend;
}

export async function signInGuest() {
  const result = await requireBackend().signInAnonymously();
  return sessionFromUser(result && result.user);
}

export async function signInWithEmail(email, password) {
  const result = await requireBackend().signInWithEmailAndPassword(
    String(email || '').trim(), password
  );
  return sessionFromUser(result && result.user);
}

export async function signUpWithEmail(email, password, name) {
  const b = requireBackend();
  const result = await b.createUserWithEmailAndPassword(String(email || '').trim(), password);
  const user = result && result.user;
  const displayName = String(name || '').trim();
  if (user && displayName && typeof b.updateProfile === 'function') {
    try {
      await b.updateProfile(user, { displayName });
      // updateProfile does not refire the auth listener, so patch the copy we hold
      currentSession = { ...sessionFromUser(user), name: displayName };
      notify();
    } catch (err) { /* a missing display name is not worth failing sign-up over */ }
  }
  return currentSession || sessionFromUser(user);
}

export async function signInWithGoogle() {
  const b = requireBackend();
  const result = await b.signInWithPopup(b.providers.google());
  return sessionFromUser(result && result.user);
}

export async function signInWithApple() {
  const b = requireBackend();
  const result = await b.signInWithPopup(b.providers.apple());
  return sessionFromUser(result && result.user);
}

export async function resetPassword(email) {
  const clean = String(email || '').trim();
  if (!clean) throw new Error('Enter your email first, then ask for a reset link.');
  await requireBackend().sendPasswordResetEmail(clean);
  return clean;
}

/**
 * Remember-me, done Firebase's way: local persistence survives a browser
 * restart, session persistence ends when the tab closes.
 */
export async function setPersistence(remember) {
  const b = requireBackend();
  if (typeof b.setPersistence === 'function') {
    await b.setPersistence(Boolean(remember));
  }
  return Boolean(remember);
}

export async function signOutUser() {
  if (backend) {
    try {
      await backend.signOut();
    } catch (err) { /* sign out locally regardless */ }
  }
  currentSession = null;
  notify();
  return null;
}

/* ------------------------------------------------------------------ *
 * readable messages for Firebase error codes
 * ------------------------------------------------------------------ */

const MESSAGES = {
  'auth/invalid-credential': 'That email and password do not match an account.',
  'auth/invalid-login-credentials': 'That email and password do not match an account.',
  'auth/wrong-password': 'That email and password do not match an account.',
  'auth/user-not-found': 'No account with that email. Create one instead.',
  'auth/invalid-email': 'That does not look like an email address.',
  'auth/email-already-in-use': 'There is already an account with that email. Sign in instead.',
  'auth/weak-password': 'Use a password of at least 8 characters.',
  'auth/missing-password': 'Enter your password.',
  'auth/popup-closed-by-user': 'The sign-in window closed before it finished.',
  'auth/cancelled-popup-request': 'Another sign-in window is already open.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site.',
  'auth/operation-not-allowed': 'That sign-in method is not switched on in the Firebase console yet.',
  'auth/unauthorized-domain': 'This domain is not authorised in Firebase. Add it under Authentication → Settings → Authorised domains.',
  'auth/network-request-failed': 'Could not reach Firebase. Check your connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/account-exists-with-different-credential': 'That email already uses a different sign-in method. Use that one instead.',
  'auth/requires-recent-login': 'Please sign in again to do that.',
  'auth/admin-restricted-operation': 'Anonymous sign-in is switched off. Enable it in the Firebase console to allow guest mode.'
};

/** Turn a Firebase error into something a person can act on. */
export function friendlyError(err) {
  if (!err) return 'Something went wrong.';
  const code = err.code || (err.errorInfo && err.errorInfo.code) || '';
  if (code && MESSAGES[code]) return MESSAGES[code];
  const message = err.message || String(err);
  if (/Firebase is not configured/.test(message)) return message;
  return message;
}
