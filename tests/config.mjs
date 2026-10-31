// Config generator checks. Run with: node tests/config.mjs
//
// Verifies that environment variables can fill firebase-config.js at build time,
// that a half-set environment fails loudly instead of shipping a broken config,
// and that nothing secret can end up in the generated file.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { FIELDS, renderConfig, readEnv } from '../scripts/generate-config.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const configPath = path.join(root, 'firebase-config.js');
const original = fs.readFileSync(configPath, 'utf8');

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

const FULL_ENV = {
  FIREBASE_API_KEY: 'AIzaSyExampleKey',
  FIREBASE_AUTH_DOMAIN: 'what-can-i-cook.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'what-can-i-cook',
  FIREBASE_STORAGE_BUCKET: 'what-can-i-cook.appspot.com',
  FIREBASE_MESSAGING_SENDER_ID: '1234567890',
  FIREBASE_APP_ID: '1:1234567890:web:abcdef'
};

function runGenerator(env) {
  // strip any inherited Firebase vars so each run is isolated
  const base = { ...process.env };
  for (const [, name] of FIELDS) delete base[name];
  return execFileSync('node', ['scripts/generate-config.mjs'], {
    cwd: root,
    env: { ...base, ...env },
    encoding: 'utf8'
  });
}

console.log('\nReading the environment');

await check('no variables means no variables', () => {
  const { values, missing } = readEnv({});
  assert(Object.keys(values).length === 0, 'found values in an empty env');
  assert(missing.length === FIELDS.length, `${missing.length} of ${FIELDS.length} reported missing`);
  return `${FIELDS.length} names checked`;
});

await check('a complete environment reads cleanly', () => {
  const { values, missing } = readEnv(FULL_ENV);
  assert(missing.length === 0, 'reported missing: ' + missing.join(','));
  assert(values.projectId === 'what-can-i-cook', 'project id not read');
  assert(Object.keys(values).length === 6, `${Object.keys(values).length} values`);
  return 'six values, none missing';
});

await check('a partial environment names exactly what is absent', () => {
  const { missing } = readEnv({ FIREBASE_API_KEY: 'x', FIREBASE_PROJECT_ID: 'y' });
  assert(missing.length === 4, `${missing.length} missing`);
  assert(missing.includes('FIREBASE_APP_ID'), 'app id not listed');
  assert(!missing.includes('FIREBASE_API_KEY'), 'a present value was reported missing');
  return missing.join(', ');
});

await check('whitespace is not mistaken for a value', () => {
  const { missing } = readEnv({ FIREBASE_API_KEY: '   ' });
  assert(missing.includes('FIREBASE_API_KEY'), 'blank treated as set');
  return 'blank counts as missing';
});

console.log('\nRendering the file');

await check('the generated file is valid JavaScript carrying the values', async () => {
  const body = renderConfig(Object.fromEntries(FIELDS.map(([k]) => [k, FULL_ENV[FIELDS.find(f => f[0] === k)[1]]])));
  assert(/export const FIREBASE_CONFIG = \{/.test(body), 'no exported config');
  assert(body.includes('"what-can-i-cook"'), 'project id missing from the output');
  assert(/Do not edit by hand/.test(body), 'the generated file does not say it is generated');
  // prove it parses
  const tmp = path.join(root, '.config-test.mjs');
  fs.writeFileSync(tmp, body, 'utf8');
  try {
    const mod = await import('file://' + tmp + '?t=' + Date.now());
    assert(mod.FIREBASE_CONFIG.projectId === 'what-can-i-cook', 'generated module did not parse into the right shape');
  } finally {
    fs.unlinkSync(tmp);
  }
  return 'parses, correct shape';
});

console.log('\nRunning the build step');

await check('with no variables the committed file is left alone', () => {
  const before = fs.readFileSync(configPath, 'utf8');
  const out = runGenerator({});
  const after = fs.readFileSync(configPath, 'utf8');
  assert(before === after, 'the file was rewritten with no variables set');
  assert(/leaving firebase-config.js as committed/i.test(out), `unexpected output: ${out.trim()}`);
  return 'untouched';
});

await check('with a full environment it writes the config', async () => {
  try {
    const out = runGenerator(FULL_ENV);
    const written = fs.readFileSync(configPath, 'utf8');
    assert(written.includes('what-can-i-cook'), 'project id not written');
    assert(written.includes('AIzaSyExampleKey'), 'api key not written');
    assert(/Wrote firebase-config\.js/.test(out), `unexpected output: ${out.trim()}`);
    const mod = await import('file://' + configPath + '?t=' + Date.now());
    assert(mod.FIREBASE_CONFIG.authDomain === 'what-can-i-cook.firebaseapp.com', 'generated module is wrong');
    return 'written and importable';
  } finally {
    fs.writeFileSync(configPath, original, 'utf8');
  }
});

await check('a partial environment fails instead of shipping half a config', () => {
  let failed = false;
  let message = '';
  try {
    runGenerator({ FIREBASE_API_KEY: 'only-this-one' });
  } catch (err) {
    failed = true;
    message = String(err.stderr || err.message);
  }
  const after = fs.readFileSync(configPath, 'utf8');
  assert(failed, 'a partial environment exited successfully');
  assert(after === original, 'a partial environment still wrote the file');
  assert(/Missing 5 of 6/.test(message), `unhelpful message: ${message.split('\n')[0]}`);
  return 'exits 1, names the gaps, writes nothing';
});

console.log('\nSafety');

await check('the committed file holds no values and no server credential', () => {
  const src = fs.readFileSync(configPath, 'utf8');
  for (const [key] of FIELDS) {
    assert(new RegExp(key + ":\\s*''").test(src), `${key} is not empty in the committed file`);
  }
  assert(!/private_key|serviceAccount|client_secret|BEGIN PRIVATE KEY/i.test(src), 'a server credential is present');
  return 'six empty fields';
});

await check('the generator never invents a secret field', () => {
  const body = renderConfig(Object.fromEntries(FIELDS.map(([k]) => [k, 'x'])));
  assert(!/private_key|serviceAccount|client_secret/i.test(body), 'the generator emits secret fields');
  const keys = [...body.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
  assert(keys.length === 6, `${keys.length} fields emitted`);
  return keys.join(', ');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('\nFailures:\n - ' + failures.join('\n - ')); process.exit(1); }
