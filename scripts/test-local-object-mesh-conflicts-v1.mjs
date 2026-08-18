import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../public/app/local-object-mesh-v146.js', import.meta.url), 'utf8');

function extractFunction(name, nextMarker) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(nextMarker, start);
  assert.ok(start >= 0 && end > start, `${name} is missing from the mesh runtime.`);
  const text = source.slice(start, end).trim();
  return Function(`return (${text})`)();
}

test('revision policy prefers the higher signed revision', () => {
  const choose = extractFunction('chooseCanonicalRevision', '\nasync function recordConflict');
  assert.deepEqual(choose({revision: 3, revisionHash: 'bbb'}, {revision: 2, revisionHash: 'aaa'}), {relation: 'older', winner: 'local'});
  assert.deepEqual(choose({revision: 2, revisionHash: 'bbb'}, {revision: 3, revisionHash: 'aaa'}), {relation: 'newer', winner: 'incoming'});
});

test('identical hashes are duplicates, not conflicts', () => {
  const choose = extractFunction('chooseCanonicalRevision', '\nasync function recordConflict');
  assert.deepEqual(choose({revision: 4, revisionHash: 'same'}, {revision: 4, revisionHash: 'same'}), {relation: 'duplicate', winner: 'local'});
});

test('same-revision forks converge on the same revision hash independent of arrival order', () => {
  const choose = extractFunction('chooseCanonicalRevision', '\nasync function recordConflict');
  const first = {revision: 5, revisionHash: 'zzz'};
  const second = {revision: 5, revisionHash: 'aaa'};
  const a = choose(first, second);
  const b = choose(second, first);
  const winnerA = a.winner === 'local' ? first : second;
  const winnerB = b.winner === 'local' ? second : first;
  assert.equal(a.relation, 'conflict');
  assert.equal(b.relation, 'conflict');
  assert.equal(winnerA.revisionHash, 'aaa');
  assert.equal(winnerB.revisionHash, 'aaa');
});

test('runtime preserves fork evidence instead of arrival-order overwrite', () => {
  assert.match(source, /const DB_VERSION=3;/);
  assert.match(source, /createObjectStore\('conflicts',\{keyPath:'id'\}\)/);
  assert.match(source, /const CONFLICT_SCHEMA='civweave\.community-conflict\.v1';/);
  assert.match(source, /async function recordConflict\(/);
  assert.match(source, /const decision=chooseCanonicalRevision\(local,object\);/);
  assert.match(source, /decision\.relation==='conflict'/);
  assert.match(source, /listConflicts/);
  assert.match(source, /conflictPolicy:'same-revision-hash-tiebreak-preserve-both'/);
});
