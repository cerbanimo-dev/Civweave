export const CRYPTOGRAPHIC_MAP_SCHEMA = 'civweave.cryptographic-map.v1';
export const POSITION_COUNT = 4;
export const POSITION_NAMES = Object.freeze(['A1', 'B1', 'B2', 'A2']);

const encoder = new TextEncoder();
const clean = (value, max = 4096) => String(value ?? '').trim().slice(0, max);

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, normalize(value[key])]),
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

export function structuralBeatAt(recordIndex) {
  const start = Math.max(0, Math.floor(Number(recordIndex) || 0)) * POSITION_COUNT;
  const bits = Array.from({ length: POSITION_COUNT }, (_, offset) => structuralBitAt(start + offset));
  return {
    bits,
    bitString: bits.join(''),
    roles: bits.map((bit) => (bit ? 'A' : 'B')),
    roleString: bits.map((bit) => (bit ? 'A' : 'B')).join(''),
  };
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

function positionByUid(record, positionUid) {
  return record?.positions?.find((position) => position.positionUid === positionUid) || null;
}

export async function createCryptographicRecord({
  namespace = 'civweave',
  recordIndex = 0,
  payload = null,
  payloadRef = '',
  previousRecord = null,
  inheritFromPositionUid = '',
  inheritIntoPositionIndex = 0,
} = {}) {
  const index = Math.max(0, Math.floor(Number(recordIndex) || 0));
  if (previousRecord && index <= Number(previousRecord.recordIndex)) {
    throw new Error('recordIndex must advance beyond the previous record.');
  }

  const payloadDigest = await sha256Hex(canonicalize(payload));
  const previousRecordUid = clean(previousRecord?.recordUid, 128);
  const previousRecordHash = clean(previousRecord?.recordHash, 128);
  const recordSeed = canonicalize({ namespace, index, payloadDigest, previousRecordUid, previousRecordHash });
  const recordUid = await deterministicUid('cwrec', recordSeed);
  const structure = structuralBeatAt(index);
  const positionUids = await Promise.all(
    Array.from({ length: POSITION_COUNT }, (_, slotIndex) =>
      deterministicUid('cwpos', `${recordUid}:${slotIndex}`),
    ),
  );

  let inheritedSource = null;
  if (previousRecord) {
    const requested = clean(inheritFromPositionUid, 128);
    inheritedSource = requested
      ? positionByUid(previousRecord, requested)
      : previousRecord.positions?.[POSITION_COUNT - 1] || null;
    if (!inheritedSource) throw new Error('inheritFromPositionUid does not belong to previousRecord.');
  }

  const pairColor = await colorMarkerFromSeed(`${recordSeed}:pair`);
  const outgoingColor = await colorMarkerFromSeed(`${recordSeed}:outgoing`);
  const genesisA = await colorMarkerFromSeed(`${recordSeed}:genesis:a`);
  const genesisB = await colorMarkerFromSeed(`${recordSeed}:genesis:b`);

  let colorMarkers;
  if (!previousRecord) {
    colorMarkers = [genesisA, genesisB, genesisB, genesisA];
  } else {
    const inheritedColor = { colorUid: inheritedSource.colorUid, colorCode: inheritedSource.colorCode };
    const canonicalOverlay = [inheritedColor, pairColor, pairColor, outgoingColor];
    colorMarkers = rotateToIndex(canonicalOverlay, 0, Math.max(0, Math.min(3, inheritIntoPositionIndex)));
  }

  const inheritedTargetIndex = previousRecord ? Math.max(0, Math.min(3, inheritIntoPositionIndex)) : -1;
  const positions = positionUids.map((positionUid, slotIndex) => ({
    positionUid,
    positionName: POSITION_NAMES[slotIndex],
    slotIndex,
    structuralBit: structure.bits[slotIndex],
    structuralRole: structure.roles[slotIndex],
    colorUid: colorMarkers[slotIndex].colorUid,
    colorCode: colorMarkers[slotIndex].colorCode,
    inheritedFromPositionUid: slotIndex === inheritedTargetIndex ? inheritedSource.positionUid : null,
  }));

  const core = {
    schema: CRYPTOGRAPHIC_MAP_SCHEMA,
    recordUid,
    recordIndex: index,
    payloadDigest,
    payloadRef: clean(payloadRef, 256),
    previousRecordUid: previousRecordUid || null,
    previousRecordHash: previousRecordHash || null,
    structure: {
      bitString: structure.bitString,
      roleString: structure.roleString,
    },
    positions,
  };
  const recordHash = await sha256Hex(canonicalize(core));
  return { ...core, recordHash };
}

export async function createCryptographicChain(payloads, options = {}) {
  const rows = Array.isArray(payloads) ? payloads : [];
  const records = [];
  let previousRecord = null;
  for (let index = 0; index < rows.length; index += 1) {
    const sourceIndex = typeof options.inheritSourceIndex === 'function'
      ? Number(options.inheritSourceIndex(previousRecord, index))
      : Number.isInteger(options.inheritSourceIndex)
        ? options.inheritSourceIndex
        : POSITION_COUNT - 1;
    const targetIndex = typeof options.inheritTargetIndex === 'function'
      ? Number(options.inheritTargetIndex(previousRecord, index))
      : Number.isInteger(options.inheritTargetIndex)
        ? options.inheritTargetIndex
        : 0;
    const source = previousRecord?.positions?.[Math.max(0, Math.min(3, sourceIndex))] || null;
    const record = await createCryptographicRecord({
      namespace: options.namespace || 'civweave',
      recordIndex: index,
      payload: rows[index],
      payloadRef: typeof options.payloadRef === 'function' ? options.payloadRef(rows[index], index) : '',
      previousRecord,
      inheritFromPositionUid: source?.positionUid || '',
      inheritIntoPositionIndex: Math.max(0, Math.min(3, targetIndex)),
    });
    records.push(record);
    previousRecord = record;
  }
  return records;
}

export function buildCryptographicMapIndex(records = []) {
  const byRecordUid = new Map();
  const byPositionUid = new Map();
  const successorsByRecordUid = new Map();
  const successorsByPositionUid = new Map();

  for (const record of records) {
    if (!record?.recordUid) continue;
    byRecordUid.set(record.recordUid, record);
    for (const position of record.positions || []) {
      byPositionUid.set(position.positionUid, { record, position });
      if (position.inheritedFromPositionUid) {
        const rows = successorsByPositionUid.get(position.inheritedFromPositionUid) || [];
        rows.push({ record, position });
        successorsByPositionUid.set(position.inheritedFromPositionUid, rows);
      }
    }
    if (record.previousRecordUid) {
      const rows = successorsByRecordUid.get(record.previousRecordUid) || [];
      rows.push(record);
      successorsByRecordUid.set(record.previousRecordUid, rows);
    }
  }

  return {
    byRecordUid,
    byPositionUid,
    successorsByRecordUid,
    successorsByPositionUid,
    successorRecords(recordUid) {
      return [...(successorsByRecordUid.get(recordUid) || [])];
    },
    successorPositions(positionUid) {
      return [...(successorsByPositionUid.get(positionUid) || [])];
    },
  };
}

export async function validateCryptographicChain(records = []) {
  const issues = [];
  const index = buildCryptographicMapIndex(records);

  for (const record of records) {
    if (record?.schema !== CRYPTOGRAPHIC_MAP_SCHEMA) {
      issues.push({ recordUid: record?.recordUid || null, code: 'schema' });
      continue;
    }
    if (!Array.isArray(record.positions) || record.positions.length !== POSITION_COUNT) {
      issues.push({ recordUid: record.recordUid, code: 'position-count' });
      continue;
    }
    const positionUids = new Set(record.positions.map((position) => position.positionUid));
    if (positionUids.size !== POSITION_COUNT) issues.push({ recordUid: record.recordUid, code: 'position-uid-duplicate' });

    const { recordHash, ...core } = record;
    const expectedHash = await sha256Hex(canonicalize(core));
    if (expectedHash !== recordHash) issues.push({ recordUid: record.recordUid, code: 'record-hash' });

    const expectedStructure = structuralBeatAt(record.recordIndex);
    if (record.structure?.bitString !== expectedStructure.bitString || record.structure?.roleString !== expectedStructure.roleString) {
      issues.push({ recordUid: record.recordUid, code: 'structure' });
    }

    const inherited = record.positions.filter((position) => position.inheritedFromPositionUid);
    if (!record.previousRecordUid) {
      if (inherited.length) issues.push({ recordUid: record.recordUid, code: 'genesis-inheritance' });
      if (record.positions[0].colorCode !== record.positions[3].colorCode || record.positions[1].colorCode !== record.positions[2].colorCode) {
        issues.push({ recordUid: record.recordUid, code: 'genesis-color-overlay' });
      }
      continue;
    }

    const previous = index.byRecordUid.get(record.previousRecordUid);
    if (!previous) {
      issues.push({ recordUid: record.recordUid, code: 'previous-record-missing' });
      continue;
    }
    if (record.previousRecordHash !== previous.recordHash) issues.push({ recordUid: record.recordUid, code: 'previous-record-hash' });
    if (inherited.length !== 1) {
      issues.push({ recordUid: record.recordUid, code: 'inheritance-count' });
      continue;
    }
    const source = index.byPositionUid.get(inherited[0].inheritedFromPositionUid);
    if (!source || source.record.recordUid !== previous.recordUid) {
      issues.push({ recordUid: record.recordUid, code: 'inheritance-source' });
      continue;
    }
    if (source.position.colorCode !== inherited[0].colorCode) {
      issues.push({ recordUid: record.recordUid, code: 'inheritance-color' });
    }
  }

  return { ok: issues.length === 0, issues, index };
}
