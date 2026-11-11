import assert from 'node:assert/strict';
import {
  FRAME,
  encodeFrame,
  decodeFrame,
  fragmentPayload,
  reassembleFrames,
  createPet,
  applyPetEvent,
} from '../public/labs/pocket-commons/core.mjs';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

{
  const payload = encoder.encode('hello pocket commons');
  const bytes = encodeFrame({
    flags: FRAME.flags.beacon,
    messageId: 0x10203040,
    partIndex: 0,
    partCount: 1,
    payload,
  });
  const decoded = decodeFrame(bytes);
  assert.equal(decoded.messageId, 0x10203040);
  assert.equal(decoded.flags, FRAME.flags.beacon);
  assert.equal(decoder.decode(decoded.payload), 'hello pocket commons');
}

{
  const source = encoder.encode('x'.repeat(FRAME.maxPayload * 2 + 17));
  const pieces = fragmentPayload(source, { messageId: 77, flags: FRAME.flags.encryptedEnvelope });
  assert.equal(pieces.length, 3);
  assert.ok(pieces.every(piece => piece.length <= FRAME.maxFrameBytes));
  const rebuilt = reassembleFrames(pieces.map(decodeFrame));
  assert.deepEqual([...rebuilt], [...source]);
}

{
  const bytes = encodeFrame({
    flags: FRAME.flags.beacon,
    messageId: 9,
    partIndex: 0,
    partCount: 1,
    payload: encoder.encode('crc me'),
  });
  bytes[bytes.length - 1] ^= 0xff;
  assert.throws(() => decodeFrame(bytes), /CRC/);
}

{
  let pet = createPet('thread-9');
  assert.equal(pet.species, 'Threadling');
  pet = applyPetEvent(pet, { type: 'encounter' });
  assert.equal(pet.encounters, 1);
  assert.ok(pet.curiosity > 50);
  pet = applyPetEvent(pet, { type: 'carry' });
  assert.equal(pet.carried, 1);
  pet = applyPetEvent(pet, { type: 'deliver' });
  assert.equal(pet.carried, 0);
  assert.ok(pet.xp > 0);
  for (let i = 0; i < 100; i += 1) pet = applyPetEvent(pet, { type: 'tick' });
  assert.ok(pet.energy >= 0 && pet.energy <= 100);
  assert.ok(pet.curiosity >= 0 && pet.curiosity <= 100);
}

console.log(JSON.stringify({
  ok: true,
  contract: 'pocket-commons-v1',
  frameBytes: FRAME.maxFrameBytes,
  maxPayload: FRAME.maxPayload,
  tests: ['binary-roundtrip', 'fragment-reassembly', 'crc-rejection', 'pet-state-bounds'],
}, null, 2));
