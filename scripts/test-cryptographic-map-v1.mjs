import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHORD_SCHEMA,
  STITCH_SCHEMA,
  WEAVE_SCHEMA,
  appendChord,
  buildWeaveIndex,
  createWeave,
  structuralChordAt,
  validateWeave,
} from '../public/app/shared/civweave-cryptographic-map-v1.mjs';

test('recursive topology begins ABBA BAAB BAAB ABBA', () => {
  const chords = Array.from({ length: 4 }, (_, index) => structuralChordAt(index));
  assert.equal(chords.map((chord) => chord.bitString).join(' '), '1001 0110 0110 1001');
  assert.equal(chords.map((chord) => chord.roleString).join(' '), 'ABBA BAAB BAAB ABBA');
});

test('Seed Chord is uniquely ABBA in structure and color', async () => {
  const weave = await createWeave(['seed', 'one', 'two', 'three']);
  assert.equal(weave.schema, WEAVE_SCHEMA);
  assert.equal(weave.chords[0].schema, CHORD_SCHEMA);
  assert.equal(weave.chords[0].isSeedChord, true);
  assert.equal(weave.chords[0].structure.roleString, 'ABBA');
  assert.equal(weave.chords[0].color.roleString, 'ABBA');
  assert.equal(weave.chords.slice(1).some((chord) => chord.isSeedChord), false);
});

test('color lineage advances ABBA ACCD DEEF FGGH by single-position Stitch', async () => {
  const weave = await createWeave(['seed', 'one', 'two', 'three']);
  const [zero, one, two, three] = weave.chords;

  assert.equal(zero.color.roleString, 'ABBA');
  assert.equal(one.color.roleString, 'ACCD');
  assert.equal(two.color.roleString, 'DEEF');
  assert.equal(three.color.roleString, 'FGGH');

  assert.equal(zero.positions[0].colorUid, zero.positions[3].colorUid);
  assert.equal(zero.positions[1].colorUid, zero.positions[2].colorUid);
  assert.equal(one.positions[0].colorUid, zero.positions[3].colorUid);
  assert.equal(one.positions[1].colorUid, one.positions[2].colorUid);
  assert.equal(two.positions[0].colorUid, one.positions[3].colorUid);
  assert.equal(two.positions[1].colorUid, two.positions[2].colorUid);
  assert.equal(three.positions[0].colorUid, two.positions[3].colorUid);
  assert.equal(three.positions[1].colorUid, three.positions[2].colorUid);

  for (const chord of weave.chords.slice(1)) {
    assert.equal(chord.stitch.schema, STITCH_SCHEMA);
    assert.equal(chord.positions.filter((position) => position.stitchUid).length, 1);
  }
  assert.equal(one.stitch.fromPositionUid, zero.positions[3].positionUid);
  assert.equal(one.stitch.toPositionUid, one.positions[0].positionUid);
});

test('position and Stitch UIDs make next relative direct', async () => {
  const weave = await createWeave(Array.from({ length: 12 }, (_, index) => ({ chord: index })));
  const index = buildWeaveIndex(weave);
  const sourcePositionUid = weave.chords[4].positions[3].positionUid;
  const next = index.stitchedSuccessors(sourcePositionUid);
  assert.equal(next.length, 1);
  assert.equal(next[0].chord.chordUid, weave.chords[5].chordUid);
  assert.equal(next[0].stitch.fromPositionUid, sourcePositionUid);
});

test('Weaving can append one Chord without rebuilding prior Chords', async () => {
  const weave = await createWeave(['seed', 'one']);
  const previousHash = weave.chords[1].chordHash;
  const next = await appendChord(weave, { payload: 'two', payloadRef: 'Chord 2' });
  assert.equal(next.chords.length, 3);
  assert.equal(next.chords[1].chordHash, previousHash);
  assert.equal(next.chords[2].previousChordHash, previousHash);
});

test('hash validation detects Chord and Weave tampering', async () => {
  const weave = await createWeave(['a', 'b', 'c']);
  assert.equal((await validateWeave(weave)).ok, true);

  const tampered = structuredClone(weave);
  tampered.chords[1].positions[0].colorCode = '#00000000';
  const invalid = await validateWeave(tampered);
  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.some((issue) => issue.code === 'chord-hash'));

  const hashTampered = structuredClone(weave);
  hashTampered.chords[1].chordHash = '0'.repeat(64);
  const invalidHash = await validateWeave(hashTampered);
  assert.ok(invalidHash.issues.some((issue) => issue.code === 'chord-hash'));
  assert.ok(invalidHash.issues.some((issue) => issue.code === 'weave-hash'));
});
