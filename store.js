// What Can I Cook — where a person's pantry lives.
//
// localStorage is the instant copy: it is what the app reads on the first frame
// and what keeps everything working with no network. Firestore is the durable
// copy, filed under the signed-in uid, so the same account on another device
// picks up the same pantry.
//
// The shape of the sync is deliberately simple: read once on load, write when
// something changes (debounced). That covers "it follows my account" without the
// echo loops that live listeners bring. See the README for the real-time
// upgrade.
//
// Like auth.js, the network layer is injectable (`setStoreBackend`) so the tests
// can exercise the sync rules with no project and no network.

import { FIREBASE_SDK_VERSION, getFirebaseConfig } from './firebase-runtime.js';

const SDK_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/`;
const COLLECTION = 'users';
const SCHEMA_VERSION = 2;
const SAVE_DELAY_MS = 700;

let backend = null;          // { read, write } once the SDK is up
let status = 'local';        // local | saving | synced | offline | error
let timer = null;
let pendingPayload = null;
let pendingUid = null;
let lastError = null;

const listeners = new Set();

function setStatus(next) {
  if (status === next) return;
  status = next;
  for (const fn of listeners) {
    try {
      fn(status);
    } catch (err) { /* a listener must never break saving */ }
  }
}

export function syncStatus() {
  return status;
}

export function syncError() {
  return lastError;
}

export function onSyncStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ------------------------------------------------------------------ *
 * init
 * ------------------------------------------------------------------ */

async function loadFirestore(config) {
  const [{ initializeApp }, firestoreModule] = await Promise.all([
    import(SDK_BASE + 'firebase-app.js'),
    import(SDK_BASE + 'firebase-firestore.js')
  ]);

  // same default app as auth.js — initializeApp returns the existing instance
  const app = initializeApp(config);
  const db = firestoreModule.getFirestore(app);

  return {
    read: async (uid) => {
      const ref = firestoreModule.doc(db, COLLECTION, uid);
      const snap = await firestoreModule.getDoc(ref);
      return snap.exists() ? snap.data() : null;
    },
    write: async (uid, payload) => {
      const ref = firestoreModule.doc(db, COLLECTION, uid);
      await firestoreModule.setDoc(ref, payload, { merge: true });
    }
  };
}

/**
 * Start the store. Never throws: if Firestore cannot load (blocked CDN, offline,
 * no config) the app stays on the local copy and says so.
 */
export async function initStore(config = getFirebaseConfig()) {
  if (backend) return true;
  if (!config || !config.projectId) {
    setStatus('local');
    return false;
  }
  try {
    backend = await loadFirestore(config);
    setStatus('local');
    return true;
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
    backend = null;
    setStatus('offline');
    return false;
  }
}

/** For tests: swap in a fake store and skip the CDN entirely. */
export function setStoreBackend(fake) {
  backend = fake;
  lastError = null;
  setStatus(fake ? 'local' : 'offline');
  return Boolean(fake);
}

export function isStoreReady() {
  return Boolean(backend);
}

/* ------------------------------------------------------------------ *
 * reading
 * ------------------------------------------------------------------ */

/** Normalise whatever came back from the database into something safe to apply. */
export function sanitiseProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const cleanList = (list, { requireKnown = false } = {}) => {
    if (!Array.isArray(list)) return [];
    const out = [];
    const seen = new Set();
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const key = typeof item.key === 'string' ? item.key.slice(0, 80) : '';
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        key,
        label: typeof item.label === 'string' ? item.label.slice(0, 80) : key,
        known: requireKnown ? item.known !== false : item.known !== false
      });
    }
    return out;
  };

  const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
  const number = (value, min, max, fallback) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  };

  return {
    pantry: cleanList(raw.pantry),
    avoid: cleanList(raw.avoid),
    shopping: cleanList(raw.shopping),
    favourites: Array.isArray(raw.favourites)
      ? raw.favourites.filter((f) => typeof f === 'string').slice(0, 500)
      : [],
    people: number(raw.people, 1, 20, 4),
    focus: Array.isArray(raw.focus) ? raw.focus.filter((f) => typeof f === 'string').slice(0, 20) : [],
    diet: oneOf(raw.diet, ['veg', 'vegan', 'non-veg', 'egg'], 'veg'),
    maxTime: oneOf(raw.maxTime, ['any', '20', '30', '45', '60+'], 'any'),
    cuisine: typeof raw.cuisine === 'string' ? raw.cuisine : 'any',
    course: typeof raw.course === 'string' ? raw.course : 'any',
    sort: oneOf(raw.sort, ['match', 'missing', 'quick'], 'match'),
    updatedAt: raw.updatedAt || null,
    version: SCHEMA_VERSION
  };
}

/**
 * Read a person's saved profile. Returns null when there is nothing saved, when
 * Firestore is unavailable, or when the read fails — the app then stays on the
 * local copy rather than wiping anything.
 */
export async function loadProfile(uid) {
  if (!backend || !uid) return null;
  try {
    const raw = await backend.read(uid);
    setStatus('local');
    return sanitiseProfile(raw);
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
    setStatus('offline');
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * writing
 * ------------------------------------------------------------------ */

function stamp(payload) {
  return { ...payload, updatedAt: new Date().toISOString(), version: SCHEMA_VERSION };
}

/** Queue a save. Rapid changes collapse into one write. */
export function saveProfile(uid, payload) {
  if (!backend || !uid) {
    setStatus('local');
    return false;
  }
  pendingUid = uid;
  pendingPayload = stamp(payload);
  setStatus('saving');

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { flush(); }, SAVE_DELAY_MS);
  return true;
}

/** Write whatever is queued right now. Safe to call at any time. */
export async function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!backend || !pendingUid || !pendingPayload) return false;

  const uid = pendingUid;
  const payload = pendingPayload;
  pendingPayload = null;
  pendingUid = null;

  try {
    await backend.write(uid, payload);
    setStatus('synced');
    return true;
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
    // put it back so the next change (or the next flush) retries
    pendingUid = uid;
    pendingPayload = payload;
    setStatus('offline');
    return false;
  }
}

/** Drop anything queued — used when signing out. */
export function resetStore() {
  if (timer) clearTimeout(timer);
  timer = null;
  pendingUid = null;
  pendingPayload = null;
  lastError = null;
  setStatus('local');
}

export const STORE_COLLECTION = COLLECTION;
export const STORE_SAVE_DELAY = SAVE_DELAY_MS;
