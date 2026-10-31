// Firebase project configuration.
//
// These values are PUBLIC. They identify your project to the browser; they are
// not credentials and it is normal for them to ship in the page. Nothing here is
// a secret — never add a service-account key or an admin SDK credential to this
// file, because anything in a static site is readable by anyone.
//
// Two ways to fill this in:
//
//   A. Paste the values in by hand (below), and commit them. Fine, and simplest.
//   B. Leave it empty and let the build fill it from environment variables:
//        npm run config        # locally, from a .env file or your shell
//      On Netlify the same script runs as the build command, reading the
//      FIREBASE_* variables set in the dashboard. That keeps project ids out of
//      git and lets dev and production point at different Firebase projects.
//      The generated file is still served to browsers — env vars tidy the repo,
//      they do not hide anything.
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
//   6. Firestore Database → Create database → Rules → paste firestore.rules
//
// With these fields empty the site runs as a single local profile and says so,
// rather than failing silently.

export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};
