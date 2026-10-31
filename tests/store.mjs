// Firestore persistence checks. Run with: node tests/store.mjs
//
// The database is never contacted: a fake backend stands in for the SDK, so the
// sync rules, the sanitising of whatever comes back, the debounce and the
// failure handling are all exercised directly.

import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '..');

const {
  initStore, setStoreBackend, isStoreReady, loadProfile, saveProfile, flush,
  resetStore, syncStatus, syncError, onSyncStatus, sanitiseProfile,
  STORE_COLLECTION, STORE_SAVE_DELAY
} = await import('../store.js');

function fakeStore({ failRead = false, failWrite = false } = {}) {
  const docs = new Map();
  const calls = { reads: 0, writes: [] };
  return {
    read: async (uid) => {
      calls.reads++;
      if (failRead) throw new Error('read failed');
      return docs.get(uid) ?? null;
    },
    write: async (uid, payload) => {
      if (failWrite) throw new Error('write failed');
      calls.writes.push({ uid, payload });
      docs.set(uid, payload);
    },
    __calls: calls,
    __docs: docs
  };
}

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
const sample = () => ({
  pantry: [{ key: 'rajma', label: 'rajma' }, { key: 'onion', label: 'onion' }],
  avoid: [], shopping: [{ key: 'curd', label: 'curd' }],
  people: 4, focus: ['quick'], diet: 'veg', maxTime: 'any', cuisine: 'any',
  course: 'any', sort: 'match', favourites: ['rajma']
});

console.log('\nWhat comes back from the database');

await check('a well-formed document is accepted as-is', () => {
  const clean = sanitiseProfile(sample());
  assert(clean.pantry.length === 2, 'pantry lost');
  assert(clean.shopping[0].key === 'curd', 'shopping lost');
  assert(clean.favourites[0] === 'rajma', 'favourites lost');
  return 'pantry, shopping and favourites survive';
});

await check('junk is refused rather than trusted', () => {
  assert(sanitiseProfile(null) === null, 'null accepted');
  assert(sanitiseProfile('a string') === null, 'string accepted');
  assert(sanitiseProfile(42) === null, 'number accepted');
  const empty = sanitiseProfile({});
  assert(empty.pantry.length === 0 && empty.people === 4, 'empty doc did not fall back to defaults');
  return 'only objects are read';
});

await check('numbers are clamped to sane ranges', () => {
  assert(sanitiseProfile({ people: 0 }).people === 1, 'zero people allowed');
  assert(sanitiseProfile({ people: 999 }).people === 20, '999 people allowed');
  assert(sanitiseProfile({ people: 'many' }).people === 4, 'junk people not defaulted');
  return '1–20, default 4';
});

await check('unknown filter values fall back instead of breaking the UI', () => {
  const p = sanitiseProfile({ diet: 'carnivore', maxTime: '5', sort: 'random' });
  assert(p.diet === 'veg', `diet ${p.diet}`);
  assert(p.maxTime === 'any', `maxTime ${p.maxTime}`);
  assert(p.sort === 'match', `sort ${p.sort}`);
  return 'safe defaults';
});

await check('lists are cleaned: duplicates dropped, junk ignored, long strings cut', () => {
  const p = sanitiseProfile({
    pantry: [
      { key: 'onion', label: 'onion' },
      { key: 'onion', label: 'onion again' },
      { key: 'x'.repeat(500), label: 'huge' },
      'not an object',
      null,
      { label: 'no key' }
    ],
    favourites: ['a', 42, null, 'b']
  });
  assert(p.pantry.length === 2, `expected 2 pantry items, got ${p.pantry.length}`);
  assert(p.pantry[1].key.length === 80, 'a long key was not cut');
  assert(p.favourites.length === 2, `favourites ${p.favourites.length}`);
  return 'deduped, capped, filtered';
});

console.log('\nReading');

await check('with no backend there is nothing to read', async () => {
  setStoreBackend(null);
  assert(!isStoreReady(), 'store reported ready');
  assert((await loadProfile('u1')) === null, 'returned something without a backend');
  return 'null, no crash';
});

await check('initStore with no project id stays local', async () => {
  const ok = await initStore({});
  assert(ok === false, 'claimed to start without a project');
  assert(syncStatus() === 'local', `status ${syncStatus()}`);
  return 'local mode';
});

await check('a saved document is read back for that uid', async () => {
  const fake = fakeStore();
  setStoreBackend(fake);
  await saveProfile('u1', sample());
  await flush();
  const got = await loadProfile('u1');
  assert(got && got.pantry.length === 2, 'document not read back');
  assert(fake.__calls.reads === 1, `${fake.__calls.reads} reads`);
  return 'read once, correct uid';
});

await check('another uid does not see it', async () => {
  const fake = fakeStore();
  setStoreBackend(fake);
  await saveProfile('u1', sample());
  await flush();
  assert((await loadProfile('u2')) === null, 'u2 saw u1 data');
  return 'per-account isolation';
});

await check('a failed read leaves the app on its local copy', async () => {
  const fake = fakeStore({ failRead: true });
  setStoreBackend(fake);
  const got = await loadProfile('u1');
  assert(got === null, 'returned a profile from a failed read');
  assert(syncStatus() === 'offline', `status ${syncStatus()}`);
  assert(syncError(), 'no error recorded');
  return 'null and offline, nothing wiped';
});

console.log('\nWriting');

await check('rapid changes collapse into one write', async () => {
  const fake = fakeStore();
  setStoreBackend(fake);
  saveProfile('u1', sample());
  saveProfile('u1', { ...sample(), people: 5 });
  saveProfile('u1', { ...sample(), people: 6 });
  assert(syncStatus() === 'saving', `status ${syncStatus()}`);
  await flush();
  assert(fake.__calls.writes.length === 1, `${fake.__calls.writes.length} writes`);
  assert(fake.__calls.writes[0].payload.people === 6, 'the last change did not win');
  assert(syncStatus() === 'synced', `status ${syncStatus()}`);
  return `1 write, debounced at ${STORE_SAVE_DELAY}ms`;
});

await check('every write is stamped and versioned', async () => {
  const fake = fakeStore();
  setStoreBackend(fake);
  saveProfile('u1', sample());
  await flush();
  const payload = fake.__calls.writes[0].payload;
  assert(typeof payload.updatedAt === 'string' && !Number.isNaN(Date.parse(payload.updatedAt)), 'no usable timestamp');
  assert(payload.version === 2, `version ${payload.version}`);
  return payload.updatedAt;
});

await check('flushing with nothing queued does nothing', async () => {
  const fake = fakeStore();
  setStoreBackend(fake);
  assert((await flush()) === false, 'flushed nothing but claimed success');
  assert(fake.__calls.writes.length === 0, 'wrote anyway');
  return 'no-op';
});

await check('a failed write keeps the data and retries', async () => {
  const fake = fakeStore({ failWrite: true });
  setStoreBackend(fake);
  saveProfile('u1', sample());
  const first = await flush();
  assert(first === false, 'a failed write reported success');
  assert(syncStatus() === 'offline', `status ${syncStatus()}`);

  // the data must still be queued, so a retry can succeed
  fake.write = async (uid, payload) => { fake.__calls.writes.push({ uid, payload }); };
  const retry = await flush();
  assert(retry === true, 'the retry did not happen');
  assert(fake.__calls.writes.length === 1, 'nothing was written on retry');
  assert(syncStatus() === 'synced', `status ${syncStatus()}`);
  return 'failure is not data loss';
});

await check('saving without a backend stays local and says so', async () => {
  setStoreBackend(null);
  const queued = saveProfile('u1', sample());
  assert(queued === false, 'queued a write with no backend');
  assert(syncStatus() === 'local', `status ${syncStatus()}`);
  return 'local, no error';
});

await check('signing out drops anything queued', async () => {
  const fake = fakeStore();
  setStoreBackend(fake);
  saveProfile('u1', sample());
  resetStore();
  await flush();
  assert(fake.__calls.writes.length === 0, 'wrote after a reset');
  assert(syncStatus() === 'local', `status ${syncStatus()}`);
  return 'queue cleared';
});

await check('status changes are broadcast to the UI', async () => {
  const fake = fakeStore();
  setStoreBackend(fake);
  const seen = [];
  const stop = onSyncStatus((s) => seen.push(s));
  saveProfile('u1', sample());
  await flush();
  stop();
  assert(seen.includes('saving') && seen.includes('synced'), `saw ${seen.join(',')}`);
  return seen.join(' → ');
});

console.log('\nSecurity rules');

await check('the rules lock each document to its owner', () => {
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  assert(/request\.auth\.uid == uid/.test(rules), 'no owner check');
  assert(/request\.auth != null/.test(rules), 'does not require sign-in');
  assert(/allow read: if isOwner\(uid\)/.test(rules), 'reads are not restricted');
  assert(/match \/\{document=\*\*\}/.test(rules) && /allow read, write: if false/.test(rules), 'no catch-all deny');
  return 'owner-only, everything else denied';
});

await check('the rules cap document growth', () => {
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  assert(/data\.size\(\) <= 40/.test(rules), 'no field cap');
  assert(/pantry\.size\(\) <= 300/.test(rules), 'no pantry cap');
  return 'bounded documents';
});

await check('the collection name matches between code and rules', () => {
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  assert(STORE_COLLECTION === 'users', `collection is ${STORE_COLLECTION}`);
  assert(new RegExp(`match /${STORE_COLLECTION}/`).test(rules), 'rules use a different collection');
  return `/${STORE_COLLECTION}/{uid}`;
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('\nFailures:\n - ' + failures.join('\n - ')); process.exit(1); }
