// Runtime helpers for Firebase — the parts that never change per project.
//
// Kept separate from firebase-config.js so that file can be pure data: committed
// as an empty placeholder, or generated at build time from environment
// variables by scripts/generate-config.mjs.

import { FIREBASE_CONFIG } from './firebase-config.js';

/** Bump this if you need a newer Firebase JS SDK. */
export const FIREBASE_SDK_VERSION = '10.12.2';

/**
 * The config the app actually uses.
 *
 * The object in firebase-config.js wins by default. If something sets
 * `globalThis.__FIREBASE_CONFIG__` before the scripts run, that is used instead —
 * handy for injecting keys at runtime, or for tests that must not talk to a real
 * project.
 */
export function getFirebaseConfig() {
  const override = globalThis.__FIREBASE_CONFIG__;
  if (override && override.apiKey && override.projectId) return override;
  return FIREBASE_CONFIG;
}

/**
 * Why a config cannot be used, or '' when it looks real.
 *
 * This exists because a config full of placeholders — `apiKey: FIREBASE_API_KEY`,
 * `projectId: PROJID` — is non-empty, so a naive check says "configured" and the
 * app then fails inside Firebase with something unreadable. Catching it here
 * means the site says "these look like placeholders" instead.
 */
export function configProblem(config = getFirebaseConfig()) {
  if (!config || typeof config !== 'object') return 'No Firebase config found.';

  const apiKey = String(config.apiKey || '').trim();
  const projectId = String(config.projectId || '').trim();
  const authDomain = String(config.authDomain || '').trim();

  if (!apiKey && !projectId) return 'Firebase config is empty — add your project keys.';
  if (!apiKey || !projectId) return 'Firebase config is incomplete — it needs an apiKey and a projectId.';

  // real keys are ~39 chars of base64url; placeholders are words
  if (!/^[A-Za-z0-9_-]{20,}$/.test(apiKey)) {
    return 'That apiKey does not look like a Firebase key — check you copied the value, not the field name.';
  }
  // project ids are lowercase letters, digits and hyphens
  if (!/^[a-z0-9][a-z0-9-]{2,}$/.test(projectId)) {
    return 'That projectId does not look like a Firebase project id — it should be lowercase letters, digits and hyphens.';
  }
  if (authDomain && !authDomain.includes('.')) {
    return 'That authDomain is not a domain — it should look like your-project.firebaseapp.com.';
  }
  return '';
}

/** True only when the config looks like a real project. */
export function isConfigured(config = getFirebaseConfig()) {
  return configProblem(config) === '';
}
