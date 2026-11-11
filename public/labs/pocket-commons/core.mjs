const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number(n) || 0));

export const FRAME = Object.freeze({
  magic0: 0x43,
  magic1: 0x57,
  version: 1,
  headerBytes: 13,
  maxPayload: 180,
  maxFrameBytes: 193,
  flags: Object.freeze({
    encryptedEnvelope: 0x01,
    beacon: 0x02,
    ack: 0x04,
  }),
});

export function crc16Ccitt(bytes) {
  let crc = 0xffff;
  for (const value of bytes) {
    crc ^= (value & 0xff) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc;
}

function crcInput(headerPrefix, payload) {
  const data = new Uint8Array(headerPrefix.length + payload.length);
  data.set(headerPrefix, 0);
  data.set(payload, headerPrefix.length);
  return data;
}

export function encodeFrame({
  flags = 0,
  messageId = 0,
  partIndex = 0,
  partCount = 1,
  payload = new Uint8Array(),
} = {}) {
  if (!(payload instanceof Uint8Array)) payload = new Uint8Array(payload);
  if (payload.length > FRAME.maxPayload) throw new RangeError(`Payload exceeds ${FRAME.maxPayload} bytes.`);
  if (!Number.isInteger(partCount) || partCount < 1 || partCount > 255) throw new RangeError('partCount must be 1..255.');
  if (!Number.isInteger(partIndex) || partIndex < 0 || partIndex >= partCount) throw new RangeError('partIndex must be within partCount.');

  const out = new Uint8Array(FRAME.headerBytes + payload.length);
  const view = new DataView(out.buffer);
  out[0] = FRAME.magic0;
  out[1] = FRAME.magic1;
  out[2] = FRAME.version;
  out[3] = flags & 0xff;
  view.setUint32(4, messageId >>> 0, true);
  out[8] = partIndex & 0xff;
  out[9] = partCount & 0xff;
  out[10] = payload.length & 0xff;
  out.set(payload, FRAME.headerBytes);
  const crc = crc16Ccitt(crcInput(out.subarray(0, 11), payload));
  view.setUint16(11, crc, true);
  return out;
}

export function decodeFrame(bytes) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  if (bytes.length < FRAME.headerBytes) throw new Error('Frame is shorter than the Pocket Commons header.');
  if (bytes[0] !== FRAME.magic0 || bytes[1] !== FRAME.magic1) throw new Error('Pocket Commons frame magic mismatch.');
  if (bytes[2] !== FRAME.version) throw new Error(`Unsupported Pocket Commons frame version ${bytes[2]}.`);
  const payloadLength = bytes[10];
  if (payloadLength > FRAME.maxPayload || bytes.length !== FRAME.headerBytes + payloadLength) throw new Error('Pocket Commons payload length mismatch.');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const expected = view.getUint16(11, true);
  const payload = bytes.slice(FRAME.headerBytes);
  const actual = crc16Ccitt(crcInput(bytes.subarray(0, 11), payload));
  if (actual !== expected) throw new Error('Pocket Commons CRC mismatch.');

  const partIndex = bytes[8];
  const partCount = bytes[9];
  if (!partCount || partIndex >= partCount) throw new Error('Pocket Commons fragment metadata is invalid.');

  return {
    version: bytes[2],
    flags: bytes[3],
    messageId: view.getUint32(4, true),
    partIndex,
    partCount,
    payload,
    crc: expected,
  };
}

export function fragmentPayload(payload, {
  messageId = (Date.now() >>> 0),
  flags = FRAME.flags.encryptedEnvelope,
} = {}) {
  if (!(payload instanceof Uint8Array)) payload = new Uint8Array(payload);
  const count = Math.max(1, Math.ceil(payload.length / FRAME.maxPayload));
  if (count > 255) throw new RangeError('Payload needs more than 255 radio fragments.');
  const result = [];
  for (let index = 0; index < count; index += 1) {
    const start = index * FRAME.maxPayload;
    const end = Math.min(payload.length, start + FRAME.maxPayload);
    result.push(encodeFrame({
      flags,
      messageId,
      partIndex: index,
      partCount: count,
      payload: payload.slice(start, end),
    }));
  }
  return result;
}

export function reassembleFrames(frames) {
  if (!Array.isArray(frames) || frames.length === 0) throw new Error('No fragments to reassemble.');
  const first = frames[0];
  const count = first.partCount;
  const id = first.messageId;
  if (frames.length !== count) throw new Error(`Expected ${count} fragments, got ${frames.length}.`);
  const ordered = [...frames].sort((a, b) => a.partIndex - b.partIndex);
  const seen = new Set();
  let total = 0;
  for (const frame of ordered) {
    if (frame.messageId !== id || frame.partCount !== count) throw new Error('Fragments do not belong to one message.');
    if (seen.has(frame.partIndex)) throw new Error('Duplicate fragment.');
    seen.add(frame.partIndex);
    total += frame.payload.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const frame of ordered) {
    out.set(frame.payload, offset);
    offset += frame.payload.length;
  }
  return out;
}

function hashSeed(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createPet(seed = 'pocket-commons') {
  const h = hashSeed(seed);
  return Object.freeze({
    species: 'Threadling',
    variant: ['ember', 'moss', 'violet', 'sky'][h % 4],
    energy: 82,
    curiosity: 50,
    trust: 10,
    xp: 0,
    encounters: 0,
    carried: 0,
    delivered: 0,
    mood: 'bright',
  });
}

function moodFor(state) {
  if (state.energy < 18) return 'sleepy';
  if (state.carried > 2) return 'busy';
  if (state.curiosity > 76) return 'spark';
  if (state.trust > 70) return 'cozy';
  return 'bright';
}

export function applyPetEvent(state, event = {}) {
  const next = { ...state };
  switch (event.type) {
    case 'tick':
      next.energy = clamp(next.energy - 0.35);
      next.curiosity = clamp(next.curiosity + 0.12);
      break;
    case 'encounter':
      next.encounters += 1;
      next.curiosity = clamp(next.curiosity + 12);
      next.xp += 4;
      break;
    case 'carry':
      next.carried += 1;
      next.energy = clamp(next.energy - 2);
      next.xp += 1;
      break;
    case 'deliver':
      if (next.carried > 0) {
        next.carried -= 1;
        next.delivered += 1;
        next.trust = clamp(next.trust + 6);
        next.xp += 8;
      }
      break;
    case 'receive':
      next.curiosity = clamp(next.curiosity + 8);
      next.trust = clamp(next.trust + 2);
      next.xp += 3;
      break;
    case 'rest':
      next.energy = clamp(next.energy + 24);
      next.curiosity = clamp(next.curiosity - 4);
      break;
    default:
      break;
  }
  next.energy = clamp(next.energy);
  next.curiosity = clamp(next.curiosity);
  next.trust = clamp(next.trust);
  next.mood = moodFor(next);
  return Object.freeze(next);
}
