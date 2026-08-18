export const WEAVE_SCHEMA = 'civweave.weave.v1';
export const CHORD_SCHEMA = 'civweave.chord.v1';
export const STITCH_SCHEMA = 'civweave.stitch.v1';
export const POSITION_COUNT = 4;
export const POSITION_NAMES = Object.freeze(['A1', 'B1', 'B2', 'A2']);

const encoder = new TextEncoder();
const clean = (value, max = 4096) => String(value ?? '').trim().slice(0, max);

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, normalize(value[key])]),
    );
  }
  return value;
}

export function canonicalize(value) {
  return JSON.stringify(normalize(value));
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parity(value) {
  let n = Math.max(0, Math.floor(Number(value) || 0));
  let result = 0;
  while (n > 0) {
    result ^= n & 1;
    n = Math.floor(n / 2);
  }
  return result;
}

export function structuralBitAt(globalPositionIndex) {
  return 1 ^ parity(globalPositionIndex);
}

export function structuralChordAt(chordIndex) {
  const start = Math.max(0, Math.floor(Number(chordIndex) || 0)) * POSITION_COUNT;
  const bits = Array.from({ length: POSITION_COUNT }, (_, offset) => structuralBitAt(start + offset));
  const roles = bits.map((bit) => (bit ? 'A' : 'B'));
  return { bits, bitString: bits.join(''), roles, roleString: roles.join('') };
}

async function deterministicUid(prefix, seed) {
  return `${prefix}_${(await sha256Hex(seed)).slice(0, 32)}`;
}

async function colorMarkerFromSeed(seed) {
  const digest = await sha256Hex(seed);
  return {
    colorUid: `cwcolor_${digest.slice(8, 40)}`,
    colorCode: `#${digest.slice(0, 8).toUpperCase()}`,
  };
}

function rotateToIndex(values, sourceIndex, targetIndex) {
  const length = values.length;
  const shift = ((targetIndex - sourceIndex) % length + length) % length;
  return values.map((_, index) => values[((index - shift) % length + length) % length]);
}

function chordByUid(weave, chordUid) {
  return weave?.chords?.find((chord) => chord.chordUid === chordUid) || null;
}

function positionByUid(chord, positionUid) {
  return chord?.positions?.find((position) => position.positionUid === positionUid) || null;
}

async function createChordCore({
  namespace,
  chordIndex,
  payload,
  payloadRef,
  previousChord,
  stitchFromPositionUid,
  stitchIntoPositionIndex,
}) {
  const index = Math.max(0, Math.floor(Number(chordIndex) || 0));
  const isSeedChord = !previousChord;
  if (!isSeedChord && index <= Number(previousChord.chordIndex)) {
    throw new Error('chordIndex must advance beyond the previous Chord.');
  }
  if (isSeedChord && index !== 0) throw new Error('The Seed Chord must be Chord 0.');

  const payloadDigest = await sha256Hex(canonicalize(payload));
  const previousChordUid = clean(previousChord?.chordUid, 128);
  const previousChordHash = clean(previousChord?.chordHash, 128);
  const chordSeed = canonicalize({ namespace, index, payloadDigest, previousChordUid, previousChordHash });
  const chordUid = await deterministicUid('cwchord', chordSeed);
  const structure = structuralChordAt(index);
  const positionUids = await Promise.all(
    Array.from({ length: POSITION_COUNT }, (_, slotIndex) => deterministicUid('cwpos', `${chordUid}:${slotIndex}`)),
  );

  let stitchSource = null;
  if (previousChord) {
    const requested = clean(stitchFromPositionUid, 128);
    stitchSource = requested
      ? positionByUid(previousChord, requested)
      : previousChord.positions?.[POSITION_COUNT - 1] || null;
    if (!stitchSource) throw new Error('stitchFromPositionUid does not belong to the previous Chord.');
  }

  const pairColor = await colorMarkerFromSeed(`${chordSeed}:pair`);
  const outgoingColor = await colorMarkerFromSeed(`${chordSeed}:outgoing`);
  const seedA = await colorMarkerFromSeed(`${chordSeed}:seed:a`);
  const seedB = await colorMarkerFromSeed(`${chordSeed}:seed:b`);

  let colorMarkers;
  if (isSeedChord) {
    colorMarkers = [seedA, seedB, seedB, seedA];
  } else {
    const incoming = { colorUid: stitchSource.colorUid, colorCode: stitchSource.colorCode };
    const canonicalOverlay = [incoming, pairColor, pairColor, outgoingColor];
    colorMarkers = rotateToIndex(canonicalOverlay, 0, Math.max(0, Math.min(3, stitchIntoPositionIndex)));
  }

  const stitchTargetIndex = isSeedChord ? -1 : Math.max(0, Math.min(3, stitchIntoPositionIndex));
  const positions = positionUids.map((positionUid, slotIndex) => ({
    positionUid,
    positionName: POSITION_NAMES[slotIndex],
    slotIndex,
    structuralBit: structure.bits[slotIndex],
    structuralRole: structure.roles[slotIndex],
    colorUid: colorMarkers[slotIndex].colorUid,
    colorCode: colorMarkers[slotIndex].colorCode,
    stitchUid: null,
  }));

  let stitch = null;
  if (!isSeedChord) {
    const target = positions[stitchTargetIndex];
    const stitchSeed = canonicalize({
      previousChordUid,
      chordUid,
      fromPositionUid: stitchSource.positionUid,
      toPositionUid: target.positionUid,
      colorUid: stitchSource.colorUid,
    });
    stitch = {
      schema: STITCH_SCHEMA,
      stitchUid: await deterministicUid('cwstitch', stitchSeed),
      fromChordUid: previousChordUid,
      fromPositionUid: stitchSource.positionUid,
      toChordUid: chordUid,
      toPositionUid: target.positionUid,
      colorUid: stitchSource.colorUid,
      colorCode: stitchSource.colorCode,
    };
    target.stitchUid = stitch.stitchUid;
  }

  const colorRoleString = (() => {
    const names = new Map();
    let nextCode = 65;
    return positions.map((position) => {
      if (!names.has(position.colorUid)) names.set(position.colorUid, String.fromCharCode(nextCode++));
      return names.get(position.colorUid);
    }).join('');
  })();

  const core = {
    schema: CHORD_SCHEMA,
    chordUid,
    chordIndex: index,
    isSeedChord,
    payloadDigest,
    payloadRef: clean(payloadRef, 256),
    previousChordUid: previousChordUid || null,
    previousChordHash: previousChordHash || null,
    structure: {
      bitString: structure.bitString,
      roleString: structure.roleString,
    },
    color: {
      roleString: colorRoleString,
    },
    positions,
    stitch,
  };
  const chordHash = await sha256Hex(canonicalize(core));
  return { ...core, chordHash };
}

export async function createSeedChord({ namespace = 'civweave', payload = null, payloadRef = '' } = {}) {
  return createChordCore({
    namespace,
    chordIndex: 0,
    payload,
    payloadRef,
    previousChord: null,
    stitchFromPositionUid: '',
    stitchIntoPositionIndex: 0,
  });
}

export async function appendChord(weave, {
  payload = null,
  payloadRef = '',
  stitchFromPositionUid = '',
  stitchIntoPositionIndex = 0,
} = {}) {
  if (!weave || weave.schema !== WEAVE_SCHEMA || !Array.isArray(weave.chords) || weave.chords.length === 0) {
    throw new Error('appendChord requires an existing Weave with a Seed Chord.');
  }
  const previousChord = weave.chords[weave.chords.length - 1];
  const chord = await createChordCore({
    namespace: weave.namespace,
    chordIndex: previousChord.chordIndex + 1,
    payload,
    payloadRef,
    previousChord,
    stitchFromPositionUid,
    stitchIntoPositionIndex,
  });
  const chords = [...weave.chords, chord];
  const weaveHash = await sha256Hex(canonicalize({
    schema: WEAVE_SCHEMA,
    weaveUid: weave.weaveUid,
    seedChordUid: weave.seedChordUid,
    chordHashes: chords.map((row) => row.chordHash),
  }));
  return { ...weave, chords, weaveHash };
}

export async function createWeave(payloads = [], options = {}) {
  const rows = Array.isArray(payloads) ? payloads : [];
  if (rows.length === 0) throw new Error('A Weave requires a Seed Chord payload.');
  const namespace = clean(options.namespace || 'civweave', 160) || 'civweave';
  const payloadRef = (payload, index) => typeof options.payloadRef === 'function' ? options.payloadRef(payload, index) : '';
  const seedChord = await createSeedChord({ namespace, payload: rows[0], payloadRef: payloadRef(rows[0], 0) });
  const weaveUid = await deterministicUid('cwweave', `${namespace}:${seedChord.chordUid}`);
  let weave = {
    schema: WEAVE_SCHEMA,
    namespace,
    weaveUid,
    seedChordUid: seedChord.chordUid,
    chords: [seedChord],
    weaveHash: '',
  };
  weave.weaveHash = await sha256Hex(canonicalize({
    schema: WEAVE_SCHEMA,
    weaveUid,
    seedChordUid: seedChord.chordUid,
    chordHashes: [seedChord.chordHash],
  }));

  for (let index = 1; index < rows.length; index += 1) {
    const previousChord = weave.chords[weave.chords.length - 1];
    const sourceIndex = typeof options.stitchSourceIndex === 'function'
      ? Number(options.stitchSourceIndex(previousChord, index))
      : Number.isInteger(options.stitchSourceIndex)
        ? options.stitchSourceIndex
        : POSITION_COUNT - 1;
    const targetIndex = typeof options.stitchTargetIndex === 'function'
      ? Number(options.stitchTargetIndex(previousChord, index))
      : Number.isInteger(options.stitchTargetIndex)
        ? options.stitchTargetIndex
        : 0;
    const source = previousChord.positions[Math.max(0, Math.min(3, sourceIndex))];
    weave = await appendChord(weave, {
      payload: rows[index],
      payloadRef: payloadRef(rows[index], index),
      stitchFromPositionUid: source.positionUid,
      stitchIntoPositionIndex: Math.max(0, Math.min(3, targetIndex)),
    });
  }
  return weave;
}

export function buildWeaveIndex(weaveOrChords = []) {
  const chords = Array.isArray(weaveOrChords) ? weaveOrChords : weaveOrChords?.chords || [];
  const byChordUid = new Map();
  const byPositionUid = new Map();
  const byStitchUid = new Map();
  const nextChordsByChordUid = new Map();
  const stitchesFromPositionUid = new Map();

  for (const chord of chords) {
    if (!chord?.chordUid) continue;
    byChordUid.set(chord.chordUid, chord);
    for (const position of chord.positions || []) byPositionUid.set(position.positionUid, { chord, position });
    if (chord.stitch) {
      byStitchUid.set(chord.stitch.stitchUid, chord.stitch);
      const stitches = stitchesFromPositionUid.get(chord.stitch.fromPositionUid) || [];
      stitches.push(chord.stitch);
      stitchesFromPositionUid.set(chord.stitch.fromPositionUid, stitches);
    }
    if (chord.previousChordUid) {
      const next = nextChordsByChordUid.get(chord.previousChordUid) || [];
      next.push(chord);
      nextChordsByChordUid.set(chord.previousChordUid, next);
    }
  }

  return {
    byChordUid,
    byPositionUid,
    byStitchUid,
    nextChordsByChordUid,
    stitchesFromPositionUid,
    nextChords(chordUid) { return [...(nextChordsByChordUid.get(chordUid) || [])]; },
    stitchesFrom(positionUid) { return [...(stitchesFromPositionUid.get(positionUid) || [])]; },
    stitchedSuccessors(positionUid) {
      return this.stitchesFrom(positionUid).map((stitch) => ({
        stitch,
        ...byPositionUid.get(stitch.toPositionUid),
      })).filter((row) => row.chord && row.position);
    },
  };
}

export async function validateWeave(weave) {
  const issues = [];
  if (!weave || weave.schema !== WEAVE_SCHEMA || !Array.isArray(weave.chords) || weave.chords.length === 0) {
    return { ok: false, issues: [{ code: 'weave' }], index: buildWeaveIndex([]) };
  }
  const chords = weave.chords;
  const index = buildWeaveIndex(weave);
  const seed = chords[0];

  if (seed.chordUid !== weave.seedChordUid || !seed.isSeedChord || seed.chordIndex !== 0) {
    issues.push({ chordUid: seed.chordUid, code: 'seed-chord' });
  }
  if (seed.structure?.roleString !== 'ABBA' || seed.color?.roleString !== 'ABBA') {
    issues.push({ chordUid: seed.chordUid, code: 'seed-abba' });
  }

  for (let indexNumber = 0; indexNumber < chords.length; indexNumber += 1) {
    const chord = chords[indexNumber];
    if (chord?.schema !== CHORD_SCHEMA) {
      issues.push({ chordUid: chord?.chordUid || null, code: 'chord-schema' });
      continue;
    }
    if (chord.chordIndex !== indexNumber) issues.push({ chordUid: chord.chordUid, code: 'chord-index' });
    if (!Array.isArray(chord.positions) || chord.positions.length !== POSITION_COUNT) {
      issues.push({ chordUid: chord.chordUid, code: 'position-count' });
      continue;
    }
    if (new Set(chord.positions.map((position) => position.positionUid)).size !== POSITION_COUNT) {
      issues.push({ chordUid: chord.chordUid, code: 'position-uid-duplicate' });
    }
    const { chordHash, ...core } = chord;
    if (await sha256Hex(canonicalize(core)) !== chordHash) issues.push({ chordUid: chord.chordUid, code: 'chord-hash' });

    const expectedStructure = structuralChordAt(chord.chordIndex);
    if (chord.structure?.bitString !== expectedStructure.bitString || chord.structure?.roleString !== expectedStructure.roleString) {
      issues.push({ chordUid: chord.chordUid, code: 'structure' });
    }

    if (indexNumber === 0) {
      if (chord.stitch) issues.push({ chordUid: chord.chordUid, code: 'seed-stitch' });
      continue;
    }

    const previous = chords[indexNumber - 1];
    if (chord.isSeedChord) issues.push({ chordUid: chord.chordUid, code: 'duplicate-seed' });
    if (chord.previousChordUid !== previous.chordUid || chord.previousChordHash !== previous.chordHash) {
      issues.push({ chordUid: chord.chordUid, code: 'previous-chord' });
    }
    if (!chord.stitch || chord.stitch.schema !== STITCH_SCHEMA) {
      issues.push({ chordUid: chord.chordUid, code: 'stitch-missing' });
      continue;
    }
    const source = index.byPositionUid.get(chord.stitch.fromPositionUid);
    const target = index.byPositionUid.get(chord.stitch.toPositionUid);
    if (!source || source.chord.chordUid !== previous.chordUid || !target || target.chord.chordUid !== chord.chordUid) {
      issues.push({ chordUid: chord.chordUid, code: 'stitch-endpoints' });
      continue;
    }
    if (source.position.colorUid !== target.position.colorUid || source.position.colorCode !== target.position.colorCode) {
      issues.push({ chordUid: chord.chordUid, code: 'stitch-color' });
    }
    if (target.position.stitchUid !== chord.stitch.stitchUid) issues.push({ chordUid: chord.chordUid, code: 'stitch-target' });
  }

  const expectedWeaveHash = await sha256Hex(canonicalize({
    schema: WEAVE_SCHEMA,
    weaveUid: weave.weaveUid,
    seedChordUid: weave.seedChordUid,
    chordHashes: chords.map((chord) => chord.chordHash),
  }));
  if (expectedWeaveHash !== weave.weaveHash) issues.push({ code: 'weave-hash' });

  return { ok: issues.length === 0, issues, index };
}

// Compatibility aliases for the first staging prototype. New code should use Weave/Chord/Stitch names.
export const CRYPTOGRAPHIC_MAP_SCHEMA = WEAVE_SCHEMA;
export const structuralBeatAt = structuralChordAt;
export async function createCryptographicChain(payloads, options = {}) {
  return (await createWeave(payloads, options)).chords;
}
export const buildCryptographicMapIndex = buildWeaveIndex;
export async function validateCryptographicChain(chords = []) {
  if (!Array.isArray(chords) || chords.length === 0) return { ok: false, issues: [{ code: 'weave' }], index: buildWeaveIndex([]) };
  const weaveUid = await deterministicUid('cwweave', `compat:${chords[0].chordUid}`);
  const weave = {
    schema: WEAVE_SCHEMA,
    namespace: 'compat',
    weaveUid,
    seedChordUid: chords[0].chordUid,
    chords,
    weaveHash: await sha256Hex(canonicalize({ schema: WEAVE_SCHEMA, weaveUid, seedChordUid: chords[0].chordUid, chordHashes: chords.map((row) => row.chordHash) })),
  };
  return validateWeave(weave);
}
