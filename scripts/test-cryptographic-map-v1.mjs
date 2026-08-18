import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCryptographicMapIndex,
  createCryptographicChain,
  structuralBeatAt,
  validateCryptographicChain,
} from '../public/app/shared/civweave-cryptographic-map-v1.mjs';

test('recursive structural expansion begins 1001 0110 0110 1001', () => {
  const beats = Array.from({ length: 4 }, (_, index) => structuralBeatAt(index));
  assert.equal(beats.map((beat) => beat.bitString).join(' '), '1001 0110 0110 1001');
  assert.equal(beats.map((beat) => beat.roleString).join(' '), 'ABBA BAAB BAAB ABBA');
});

test('color overlay starts ABBA then inherits exactly one direct position', async () => {
  const records = await createCryptographicChain(['spark', 'call', 'stakes', 'counsel']);
  const [first, second, third, fourth] = records;

  assert.equal(first.positions[0].colorCode, first.positions[3].colorCode);
  assert.equal(first.positions[1].colorCode, first.positions[2].colorCode);
  assert.equal(second.positions[0].colorCode, first.positions[3].colorCode);
  assert.equal(second.positions[0].colorUid, first.positions[3].colorUid);
  assert.equal(second.positions[1].colorCode, second.positions[2].colorCode);
  assert.equal(third.positions[0].colorCode, second.positions[3].colorCode);
  assert.equal(fourth.positions[0].colorCode, third.positions[3].colorCode);

  for (const record of records.slice(1)) {
    const inherited = record.positions.filter((position) => position.inheritedFromPositionUid);
    assert.equal(inherited.length, 1);
  }
  assert.equal(second.positions[0].inheritedFromPositionUid, first.positions[3].positionUid);
});

test('position UIDs are unique and successor lookup is direct', async () => {
  const records = await createCryptographicChain(Array.from({ length: 12 }, (_, index) => ({ beat: index })));
  const allPositionUids = records.flatMap((record) => record.positions.map((position) => position.positionUid));
  assert.equal(new Set(allPositionUids).size, records.length * 4);

  const map = buildCryptographicMapIndex(records);
  const sourcePositionUid = records[4].positions[3].positionUid;
  const successors = map.successorPositions(sourcePositionUid);
  assert.equal(successors.length, 1);
  assert.equal(successors[0].record.recordUid, records[5].recordUid);
  assert.equal(successors[0].position.inheritedFromPositionUid, sourcePositionUid);
});

test('hash validation detects tampering', async () => {
  const records = await createCryptographicChain(['a', 'b', 'c']);
  const valid = await validateCryptographicChain(records);
  assert.equal(valid.ok, true);

  const tampered = structuredClone(records);
  tampered[1].positions[0].colorCode = '#00000000';
  const invalid = await validateCryptographicChain(tampered);
  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.some((issue) => issue.code === 'record-hash'));
});
