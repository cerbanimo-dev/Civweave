import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [tool, campus, installed] = await Promise.all([
  read('public/app/clear-signal-v1.html'),
  read('public/app/working-campus-v440.html'),
  read('public/app/working-campus-v156.html'),
]);

assert.match(tool, /<title>Clear Signal/);
assert.match(tool, /Self-check tool · Not a threat detector/);
assert.match(tool, /It cannot detect magic, psychic signals, surveillance, attacks, or medical conditions/);
assert.match(tool, /Sudden confusion, fainting, difficulty speaking, weakness/);
assert.match(tool, /What did I directly notice\?/);
assert.match(tool, /What explanation am I considering\?/);
assert.match(tool, /aria-live="polite"/);
assert.match(tool, /href="\/app\/working-campus-v440\.html"/);
for (const id of ['checkin','ground','facts','support']) {
  assert.match(tool, new RegExp(`id="${id}"`));
  assert.match(tool, new RegExp(`data-target="${id}"`));
}
// Self-contained, no model inference, no telemetry, no persistent personal data.
assert.doesNotMatch(tool, /<script[^>]*\bsrc=/i);
assert.doesNotMatch(tool, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(/);
assert.doesNotMatch(tool, /\b(?:localStorage|sessionStorage|indexedDB)\b/);
for (const source of [campus, installed]) {
  assert.match(source, /href="\/app\/clear-signal-v1\.html"/);
  assert.match(source, /aria-label="Open Clear Signal grounding tools"/);
}
console.log('Clear Signal: page, no-network privacy, accessibility markers and both campus entry points PASS');
