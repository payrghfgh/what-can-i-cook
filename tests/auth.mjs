// Sign-in checks. Run with: node tests/auth.mjs
//
// Firebase itself cannot be reached from here, so these tests drive the seam in
// auth.js with a fake backend that behaves like the SDK: it holds one user, fires
// the auth listener, and throws the same error codes. Every flow the login page
// uses is exercised through that seam.

import {
  isConfigured, sessionFromUser, dataKeyFor, initAuth, setAuthBackend,
  waitForSession, getSession, isReady, authError,
  signInGuest, signInWithEmail, signUpWithEmail, signInWithGoogle,
  signInWithApple, resetPassword, signOutUser, setPersistence,
  onSessionChange, friendlyError
} from '../auth.js';

/* ------------------------------------------------------------------ *
 * a fake Firebase Auth
 * ------------------------------------------------------------------ */

function fakeFirebase(initialUser = null) {
  let user = initialUser;
  let listener = null;
  const calls = [];

  const emit = () => { if (listener) listener(user); };
  const fail = (code) => { const e = new Error(code); e.code = code; throw e; };

  const api = {
    onAuthStateChanged: (cb) => { listener = cb; setTimeout(emit, 0); },

    signInAnonymously: async () => {
      calls.push(['anonymous']);
      user = { uid: 'anon-123', isAnonymous: true, providerData: [] };
      emit();
      return { user };
    },

    signInWithEmailAndPassword: async (email, password) => {
      calls.push(['email-signin', email]);
      if (password !== 'kadakchai99') fail('auth/invalid-credential');
      user = { uid: 'u_email', email, displayName: null, providerData: [{ providerId: 'password' }] };
      emit();
      return { user };
    },

    createUserWithEmailAndPassword: async (email, password) => {
      calls.push(['email-signup', email, password.length]);
      if (password.length < 8) fail('auth/weak-password');
      user = { uid: 'u_new', email, displayName: null, providerData: [{ providerId: 'password' }] };
      emit();
      return { user };
    },

    updateProfile: async (u, profile) => {
      calls.push(['updateProfile', profile.displayName]);
      user = { ...user, displayName: profile.displayName };
    },

    signInWithPopup: async (provider) => {
      calls.push(['popup', provider.__kind]);
      user = {
        uid: `u_${provider.__kind}`,
        email: `${provider.__kind}@example.com`,
        displayName: provider.__kind === 'google' ? 'Asha G' : 'Asha A',
        providerData: [{ providerId: provider.__kind === 'google' ? 'google.com' : 'apple.com' }]
      };
      emit();
      return { user };
    },

    signOut: async () => { calls.push(['signOut']); user = null; emit(); },

    sendPasswordResetEmail: async (email) => {
      calls.push(['reset', email]);
      if (!email) fail('auth/missing-password');
    },

    setPersistence: async (remember) => { calls.push(['persistence', remember]); },

    providers: {
      google: () => ({ __kind: 'google' }),
      apple: () => ({ __kind: 'apple' })
    },

    // test hooks
    __calls: calls,
    __setUser: (u) => { user = u; emit(); }
  };

  return api;
}

const fake = fakeFirebase();
await setAuthBackend(fake);

let passed = 0;
const failures = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    passed++;
    console.log(`  ok   ${name}${detail ? '  — ' + detail : ''}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
async function expectThrow(fn, match) {
  try {
    await fn();
  } catch (err) {
    const msg = friendlyError(err);
    assert(!match || match.test(msg), `unexpected message: ${msg}`);
    return msg;
  }
  throw new Error('expected this to fail');
}
const lastCall = () => fake.__calls[fake.__calls.length - 1];

/* ------------------------------------------------------------------ *
 * configuration
 * ------------------------------------------------------------------ */

console.log('\nConfiguration');

await check('an empty config is reported as not configured', () => {
  assert(!isConfigured({}), 'empty object considered configured');
  assert(!isConfigured({ apiKey: 'x' }), 'apiKey alone considered configured');
  assert(!isConfigured(null), 'null considered configured');
  assert(isConfigured({ apiKey: 'x', projectId: 'y' }), 'a real config was rejected');
  return 'needs apiKey and projectId';
});

await check('the committed config ships empty', async () => {
  const { FIREBASE_CONFIG } = await import('../firebase-config.js');
  assert(!FIREBASE_CONFIG.apiKey, 'an API key is committed');
  assert(!FIREBASE_CONFIG.projectId, 'a project id is committed');
  assert(!/serviceAccount|private_key/i.test(JSON.stringify(FIREBASE_CONFIG)), 'a server credential is committed');
  return 'placeholders only';
});

await check('a runtime override can supply the config instead', async () => {
  const { getFirebaseConfig } = await import('../firebase-config.js');
  globalThis.__FIREBASE_CONFIG__ = { apiKey: 'test-key', projectId: 'test-project' };
  const cfg = getFirebaseConfig();
  assert(cfg.apiKey === 'test-key', 'override ignored');
  delete globalThis.__FIREBASE_CONFIG__;
  assert(getFirebaseConfig().apiKey === '', 'override leaked after removal');
  return 'injectable at deploy time';
});

/* ------------------------------------------------------------------ *
 * session shape
 * ------------------------------------------------------------------ */

console.log('\nSession shape');

await check('a Firebase user maps onto the app session', () => {
  const s = sessionFromUser({
    uid: 'abc123', email: 'asha@example.com', displayName: 'Asha R',
    providerData: [{ providerId: 'google.com' }]
  });
  assert(s.userId === 'abc123', 'uid not used as the id');
  assert(s.name === 'Asha R', 'display name dropped');
  assert(s.provider === 'google.com', 'provider not read');
  assert(s.anonymous === false, 'flagged anonymous');
  return `${s.name} · ${s.provider}`;
});

await check('an anonymous user is a guest, and names fall back sensibly', () => {
  const anon = sessionFromUser({ uid: 'a1', isAnonymous: true, providerData: [] });
  assert(anon.provider === 'guest' && anon.anonymous === true, 'anonymous not treated as guest');
  assert(anon.name === 'Guest', `fallback name ${anon.name}`);
  const noName = sessionFromUser({ uid: 'b2', email: 'someone@example.com', providerData: [] });
  assert(noName.name === 'someone', `email prefix not used: ${noName.name}`);
  assert(sessionFromUser(null) === null, 'null user produced a session');
  return 'guest and email-prefix fallbacks';
});

await check('each account gets its own pantry bucket', () => {
  const a = dataKeyFor({ userId: 'uidA' });
  const b = dataKeyFor({ userId: 'uidB' });
  assert(a !== b, 'buckets collide');
  assert(a === 'what-can-i-cook:v2:uidA', `unexpected key ${a}`);
  assert(dataKeyFor(null) === 'what-can-i-cook:v2:anonymous', 'no anonymous fallback');
  return a;
});

/* ------------------------------------------------------------------ *
 * init
 * ------------------------------------------------------------------ */

console.log('\nStarting up');

await check('with no keys the layer reports the problem instead of hanging', async () => {
  const real = await import('../auth.js');
  const fresh = await import('../auth.js?fresh=1'); // separate module instance
  const err = await fresh.initAuth({});
  assert(err === null, 'expected no session');
  assert(!fresh.isReady() === false, 'never settled');
  assert(fresh.authError() && /not configured/i.test(fresh.authError().message), 'no explanation');
  return fresh.authError().message;
});

await check('waitForSession settles rather than waiting forever', async () => {
  const session = await waitForSession(50);
  assert(session === null, 'unexpected session');
  assert(isReady(), 'not ready');
  return 'resolved null';
});

/* ------------------------------------------------------------------ *
 * the four ways in
 * ------------------------------------------------------------------ */

console.log('\nSigning in');

await check('guest mode starts an anonymous session', async () => {
  const s = await signInGuest();
  assert(s.provider === 'guest' && s.anonymous === true, 'not a guest session');
  assert(getSession().userId === 'anon-123', 'session not stored');
  assert(lastCall()[0] === 'anonymous', 'the SDK was not asked for an anonymous user');
  return `${s.name} · ${s.userId}`;
});

await check('email and password signs in when the password is right', async () => {
  const s = await signInWithEmail(' asha@example.com ', 'kadakchai99');
  assert(s.email === 'asha@example.com', `email ${s.email}`);
  assert(s.provider === 'password', `provider ${s.provider}`);
  assert(fake.__calls.some((c) => c[0] === 'email-signin' && c[1] === 'asha@example.com'), 'email not trimmed before the call');
  return 'signed in, email trimmed';
});

await check('a wrong password is reported as a mismatch, not a crash', async () => {
  const msg = await expectThrow(() => signInWithEmail('asha@example.com', 'wrong'), /do not match/i);
  return msg;
});

await check('creating an account sets the display name', async () => {
  const s = await signUpWithEmail('new@example.com', 'longenough', 'Asha');
  assert(s.name === 'Asha', `name ${s.name}`);
  assert(fake.__calls.some((c) => c[0] === 'updateProfile' && c[1] === 'Asha'), 'display name never set');
  return 'profile updated after sign-up';
});

await check('a short password is refused by the provider', async () => {
  const msg = await expectThrow(() => signUpWithEmail('x@example.com', 'short'), /8 characters/i);
  return msg;
});

await check('Google and Apple open their providers', async () => {
  const g = await signInWithGoogle();
  assert(g.provider === 'google.com', `google provider ${g.provider}`);
  assert(g.name === 'Asha G', 'google display name missing');
  const a = await signInWithApple();
  assert(a.provider === 'apple.com', `apple provider ${a.provider}`);
  return `${g.provider}, ${a.provider}`;
});

await check('a password reset is sent to the address typed', async () => {
  await resetPassword('  asha@example.com ');
  const call = fake.__calls.filter((c) => c[0] === 'reset').pop();
  assert(call[1] === 'asha@example.com', `reset sent to "${call[1]}"`);
  const msg = await expectThrow(() => resetPassword(''), /enter your email/i);
  return `sent, and empty input refused ("${msg}")`;
});

await check('remember-me is handed to the provider', async () => {
  await setPersistence(true);
  assert(lastCall()[1] === true, 'remember=true not passed');
  await setPersistence(false);
  assert(lastCall()[1] === false, 'remember=false not passed');
  return 'local vs session persistence';
});

await check('signing out clears the session and tells the app', async () => {
  let seen = 'untouched';
  const stop = onSessionChange((s) => { seen = s; });
  await signOutUser();
  assert(getSession() === null, 'session survived');
  assert(seen === null, 'listeners were not told');
  stop();
  return 'cleared and broadcast';
});

/* ------------------------------------------------------------------ *
 * errors
 * ------------------------------------------------------------------ */

console.log('\nError messages');

await check('Firebase codes become sentences a person can act on', () => {
  const cases = {
    'auth/unauthorized-domain': /authorised in Firebase/i,
    'auth/popup-blocked': /blocked the sign-in window/i,
    'auth/operation-not-allowed': /not switched on in the Firebase console/i,
    'auth/email-already-in-use': /already an account/i,
    'auth/too-many-requests': /Wait a minute/i,
    'auth/network-request-failed': /Could not reach Firebase/i,
    'auth/admin-restricted-operation': /Anonymous sign-in is switched off/i
  };
  for (const [code, pattern] of Object.entries(cases)) {
    const msg = friendlyError({ code });
    assert(pattern.test(msg), `${code} → "${msg}"`);
  }
  assert(/Something went wrong/.test(friendlyError(null)), 'null error not handled');
  assert(/odd one/.test(friendlyError(new Error('odd one'))), 'unknown message not passed through');
  return `${Object.keys(cases).length} codes mapped`;
});

await check('nothing works before a backend exists', async () => {
  const fresh = await import('../auth.js?unconfigured=1');
  await fresh.initAuth({});
  const msg = await expectThrow(() => fresh.signInGuest(), /not configured/i);
  return msg;
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('\nFailures:\n - ' + failures.join('\n - ')); process.exit(1); }
