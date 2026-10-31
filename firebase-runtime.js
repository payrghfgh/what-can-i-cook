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

/** A Firebase web config needs at least an apiKey and a projectId. */
export function isConfigured(config = getFirebaseConfig()) {
  return Boolean(config && config.apiKey && config.projectId);
}
