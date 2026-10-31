// Firebase project configuration.
//
// These values are PUBLIC. They identify your project to the browser; they are
// not credentials and it is normal for them to ship in the page. Nothing here is
// a secret — never add a service-account key or an admin SDK credential to this
// file, because anything in a static site is readable by anyone.
//
// Where to get them:
//   1. console.firebase.google.com → create (or open) a project
//   2. Project settings → General → Your apps → Web app (</>)
//   3. Copy the `firebaseConfig` object it shows you into the fields below
//
// Then, in the Firebase console:
//   4. Authentication → Sign-in method → enable:
//        · Email/Password
//        · Google
//        · Apple            (needs an Apple Developer account)
//        · Anonymous        (this is what "Continue as guest" uses)
//   5. Authentication → Settings → Authorised domains → add every host this
//      site runs on, e.g.
//        localhost
//        your-site.netlify.app
//        yourname.github.io
//      Sign-in fails with auth/unauthorized-domain until a host is listed.
//
// Leave the fields empty and the site runs in "not configured" mode: the app
// says so plainly instead of failing silently.

export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

/** Bump this if you need a newer Firebase JS SDK. */
export const FIREBASE_SDK_VERSION = '10.12.2';

/**
 * The config the app actually uses.
 *
 * The committed object above wins by default. If something sets
 * `globalThis.__FIREBASE_CONFIG__` before the scripts run, that is used instead —
 * handy for injecting keys at deploy time, or for tests that must not talk to a
 * real project.
 */
export function getFirebaseConfig() {
  const override = globalThis.__FIREBASE_CONFIG__;
  if (override && override.apiKey && override.projectId) return override;
  return FIREBASE_CONFIG;
}
