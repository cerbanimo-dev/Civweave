import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

export const NODE_BACKUP_FORMAT = 'civweave.node-reconstruction-backup/v1';
export const NODE_BACKUP_PAYLOAD_FORMAT = 'civweave.node-reconstruction-payload/v1';
export const NODE_BACKUP_DOMAIN = 'CIVWEAVE:NODE-RECONSTRUCTION-BACKUP:V1';
export const DEFAULT_CHUNK_BYTES = 64 * 1024;
export const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const DEFAULT_RETENTION = 28;

const ALLOWED_SENSITIVITY = new Set(['portable-public', 'portable-private']);
const FORBIDDEN_METADATA = /(?:api[-_ ]?key|session[-_ ]?(?:token|bearer)|browser[-_ ]?bound.*sign|private[-_ ]?key|recovery[-_ ]?(?:secret|phrase)|refresh[-_ ]?token)/i;
const ABBA_ZERO = [0, 1, 1, 0];
const ABBA_ONE = [1, 0, 0, 1];

function hashBytes(...parts) {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(part);
  return hash.digest();
}

export function sha256Hex(...parts) {
  return hashBytes(...parts).toString('hex');
}

function canonicalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical backup values must contain finite numbers.');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const child = value[key];
      if (child !== undefined) out[key] = canonicalize(child);
    }
    return out;
  }
  throw new TypeError(`Unsupported canonical backup value: ${typeof value}`);
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function contentEnvelope(content) {
  if (Buffer.isBuffer(content) || content instanceof Uint8Array) {
    return { encoding: 'base64', data: Buffer.from(content).toString('base64') };
  }
  if (typeof content === 'string') {
    return { encoding: 'utf8', data: content };
  }
  return { encoding: 'canonical-json', data: canonicalize(content) };
}

function restoreEnvelope(envelope) {
  if (envelope.encoding === 'base64') return Buffer.from(envelope.data, 'base64');
  if (envelope.encoding === 'utf8') return envelope.data;
  if (envelope.encoding === 'canonical-json') return envelope.data;
  throw new Error(`Unsupported backup payload encoding: ${envelope.encoding}`);
}

function assertSafeRecord(record) {
  if (!record || typeof record !== 'object') throw new TypeError('Backup export records must be objects.');
  if (!record.system || typeof record.system !== 'string') throw new TypeError('Backup export record.system is required.');
  if (!record.path || typeof record.path !== 'string') throw new TypeError('Backup export record.path is required.');
  if (!ALLOWED_SENSITIVITY.has(record.sensitivity)) {
    throw new Error(`Backup record ${record.system}:${record.path} must explicitly use portable-public or portable-private sensitivity.`);
  }
  const metadataSurface = `${record.system}:${record.path}:${record.kind ?? ''}`;
  if (FORBIDDEN_METADATA.test(metadataSurface)) {
    throw new Error(`Backup record ${record.system}:${record.path} appears to contain non-portable authority or credential material.`);
  }
}

export function buildCanonicalNodePayload(records) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array.');
  const normalized = records.map((record) => {
    assertSafeRecord(record);
    return {
      system: record.system,
      path: record.path,
      sensitivity: record.sensitivity,
      mediaType: record.mediaType ?? 'application/octet-stream',
      version: record.version ?? 1,
      content: contentEnvelope(record.content),
    };
  }).sort((a, b) => `${a.system}\0${a.path}`.localeCompare(`${b.system}\0${b.path}`));

  const seen = new Set();
  for (const record of normalized) {
    const key = `${record.system}\0${record.path}`;
    if (seen.has(key)) throw new Error(`Duplicate backup record: ${record.system}:${record.path}`);
    seen.add(key);
  }

  return Buffer.from(canonicalJson({
    format: NODE_BACKUP_PAYLOAD_FORMAT,
    records: normalized,
  }));
}

function bytesToBits(bytes) {
  const bits = new Uint8Array(bytes.length * 8);
  let out = 0;
  for (const byte of bytes) {
    for (let bit = 7; bit >= 0; bit -= 1) bits[out++] = (byte >> bit) & 1;
  }
  return bits;
}

function bitsToBytes(bits, exactBitLength = bits.length) {
  const bytes = Buffer.alloc(Math.ceil(exactBitLength / 8));
  for (let i = 0; i < exactBitLength; i += 1) {
    if (bits[i]) bytes[i >> 3] |= 1 << (7 - (i & 7));
  }
  return bytes;
}

function readPackedBits(bytes, bitLength) {
  return bytesToBits(bytes).subarray(0, bitLength);
}

export function encodeAbbaResidualExact(input) {
  const source = Buffer.from(input);
  let current = bytesToBits(source);
  const layers = [];

  while (current.length > 256) {
    const inputBitLength = current.length;
    const groupCount = Math.ceil(inputBitLength / 4);
    const parents = new Uint8Array(groupCount);
    const residuals = new Uint8Array(groupCount * 3);

    for (let group = 0; group < groupCount; group += 1) {
      const base = group * 4;
      const parent = base < inputBitLength ? current[base] : 0;
      parents[group] = parent;
      const expected = parent ? ABBA_ONE : ABBA_ZERO;
      for (let child = 1; child < 4; child += 1) {
        const sourceIndex = base + child;
        const actual = sourceIndex < inputBitLength ? current[sourceIndex] : 0;
        residuals[group * 3 + (child - 1)] = actual ^ expected[child];
      }
    }

    layers.push({ inputBitLength, residualBitLength: residuals.length, residualBytes: bitsToBytes(residuals) });
    current = parents;
  }

  const rootBitLength = current.length;
  const rootBytes = bitsToBytes(current);
  const headerBytes = 4 + 4 + 2 + 4 + 4 + rootBytes.length + layers.reduce((sum, layer) => sum + 12 + layer.residualBytes.length, 0);
  const capsule = Buffer.alloc(headerBytes);
  let offset = 0;
  capsule.write('ABR1', offset, 4, 'ascii'); offset += 4;
  capsule.writeUInt32LE(source.length, offset); offset += 4;
  capsule.writeUInt16LE(layers.length, offset); offset += 2;
  capsule.writeUInt32LE(rootBitLength, offset); offset += 4;
  capsule.writeUInt32LE(rootBytes.length, offset); offset += 4;
  rootBytes.copy(capsule, offset); offset += rootBytes.length;
  for (const layer of layers) {
    capsule.writeUInt32LE(layer.inputBitLength, offset); offset += 4;
    capsule.writeUInt32LE(layer.residualBitLength, offset); offset += 4;
    capsule.writeUInt32LE(layer.residualBytes.length, offset); offset += 4;
    layer.residualBytes.copy(capsule, offset); offset += layer.residualBytes.length;
  }
  return deflateRawSync(capsule, { level: 9 });
}

export function decodeAbbaResidualExact(encoded) {
  const capsule = inflateRawSync(Buffer.from(encoded));
  let offset = 0;
  if (capsule.subarray(0, 4).toString('ascii') !== 'ABR1') throw new Error('Invalid ABBA residual capsule magic.');
  offset += 4;
  const originalByteLength = capsule.readUInt32LE(offset); offset += 4;
  const layerCount = capsule.readUInt16LE(offset); offset += 2;
  const rootBitLength = capsule.readUInt32LE(offset); offset += 4;
  const rootBytesLength = capsule.readUInt32LE(offset); offset += 4;
  const rootBytes = capsule.subarray(offset, offset + rootBytesLength); offset += rootBytesLength;
  const layers = [];
  for (let i = 0; i < layerCount; i += 1) {
    const inputBitLength = capsule.readUInt32LE(offset); offset += 4;
    const residualBitLength = capsule.readUInt32LE(offset); offset += 4;
    const residualBytesLength = capsule.readUInt32LE(offset); offset += 4;
    const residualBytes = capsule.subarray(offset, offset + residualBytesLength); offset += residualBytesLength;
    layers.push({ inputBitLength, residualBitLength, residualBytes });
  }
  if (offset !== capsule.length) throw new Error('Trailing bytes in ABBA residual capsule.');

  let current = readPackedBits(rootBytes, rootBitLength);
  for (let layerIndex = layers.length - 1; layerIndex >= 0; layerIndex -= 1) {
    const layer = layers[layerIndex];
    const residual = readPackedBits(layer.residualBytes, layer.residualBitLength);
    const groupCount = Math.ceil(layer.inputBitLength / 4);
    if (current.length !== groupCount) throw new Error('ABBA residual capsule shape mismatch.');
    const expanded = new Uint8Array(groupCount * 4);
    for (let group = 0; group < groupCount; group += 1) {
      const parent = current[group];
      const expected = parent ? ABBA_ONE : ABBA_ZERO;
      expanded[group * 4] = parent;
      for (let child = 1; child < 4; child += 1) {
        expanded[group * 4 + child] = expected[child] ^ residual[group * 3 + (child - 1)];
      }
    }
    current = expanded.subarray(0, layer.inputBitLength);
  }
  const restored = bitsToBytes(current, originalByteLength * 8);
  if (restored.length !== originalByteLength) throw new Error('ABBA residual restore length mismatch.');
  return restored;
}

export function encodeLosslessChunk(input, { minimumAbbaSavingsBytes = 16 } = {}) {
  const plain = Buffer.from(input);
  const raw = deflateRawSync(plain, { level: 9 });
  const abba = encodeAbbaResidualExact(plain);
  if (abba.length + minimumAbbaSavingsBytes <= raw.length) {
    return { codec: 'abba-quarter-residual+deflate/v1', bytes: abba };
  }
  return { codec: 'deflate-raw/v1', bytes: raw };
}

export function decodeLosslessChunk(codec, bytes) {
  if (codec === 'abba-quarter-residual+deflate/v1') return decodeAbbaResidualExact(bytes);
  if (codec === 'deflate-raw/v1') return inflateRawSync(Buffer.from(bytes));
  throw new Error(`Unsupported backup chunk codec: ${codec}`);
}

function merkleRootFromPlainHashes(plainHashes) {
  if (!plainHashes.length) return sha256Hex(`${NODE_BACKUP_DOMAIN}:EMPTY`);
  let level = plainHashes.map((hex, index) => hashBytes(
    `${NODE_BACKUP_DOMAIN}:LEAF\0${index}\0`,
    Buffer.from(hex, 'hex'),
  ));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      next.push(hashBytes(`${NODE_BACKUP_DOMAIN}:NODE\0`, left, right));
    }
    level = next;
  }
  return level[0].toString('hex');
}

function abbaChild(bit, quadrant) {
  return (bit ? ABBA_ONE : ABBA_ZERO)[quadrant];
}

export function deriveAbbaCoordinate(nodeRootHex, chunkIndex, depth = 8) {
  if (!/^[0-9a-f]{64}$/i.test(nodeRootHex)) throw new Error('nodeRoot must be a SHA-256 hex digest.');
  if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0) throw new Error('chunkIndex must be a non-negative integer.');
  const rootBits = bytesToBits(Buffer.from(nodeRootHex, 'hex'));
  const selector = hashBytes(`${NODE_BACKUP_DOMAIN}:COORD\0${nodeRootHex}\0${chunkIndex}`);
  let bit = rootBits[chunkIndex % rootBits.length];
  let pathDigits = '';
  for (let level = 0; level < depth; level += 1) {
    const byte = selector[level % selector.length];
    const quadrant = (byte >> ((level & 3) * 2)) & 3;
    pathDigits += String(quadrant);
    bit = abbaChild(bit, quadrant);
  }
  return `r${chunkIndex % rootBits.length}:${pathDigits}:b${bit}`;
}

function chunkBuffer(buffer, chunkBytes) {
  const chunks = [];
  for (let offset = 0; offset < buffer.length; offset += chunkBytes) {
    chunks.push(buffer.subarray(offset, Math.min(buffer.length, offset + chunkBytes)));
  }
  if (!chunks.length) chunks.push(Buffer.alloc(0));
  return chunks;
}

function assertEncryptionKey(key) {
  const normalized = Buffer.from(key ?? []);
  if (normalized.length !== 32) throw new Error('Node backup encryptionKey must contain exactly 32 bytes.');
  return normalized;
}

function chunkAad({ nodeRoot, index, codec, plainSha256, keyId }) {
  return Buffer.from(canonicalJson({
    domain: `${NODE_BACKUP_DOMAIN}:CHUNK`,
    nodeRoot,
    index,
    codec,
    plainSha256,
    keyId,
  }));
}

function encryptChunk(bytes, encryptionKey, metadata) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, nonce);
  cipher.setAAD(chunkAad(metadata));
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  const tag = cipher.getAuthTag();
  const objectBytes = Buffer.concat([nonce, tag, ciphertext]);
  const objectId = sha256Hex(`${NODE_BACKUP_DOMAIN}:OBJECT\0`, objectBytes);
  return { objectId, objectBytes };
}

function decryptChunk(objectBytes, encryptionKey, metadata) {
  if (objectBytes.length < 28) throw new Error('Encrypted backup object is truncated.');
  const nonce = objectBytes.subarray(0, 12);
  const tag = objectBytes.subarray(12, 28);
  const ciphertext = objectBytes.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, nonce);
  decipher.setAAD(chunkAad(metadata));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function manifestAuthInput(manifest) {
  const { manifestAuth, ...unsigned } = manifest;
  return Buffer.from(canonicalJson(unsigned));
}

function attachManifestAuth(manifest, key) {
  const digest = createHmac('sha256', key)
    .update(`${NODE_BACKUP_DOMAIN}:MANIFEST\0`)
    .update(manifestAuthInput(manifest))
    .digest('hex');
  return { ...manifest, manifestAuth: { algorithm: 'hmac-sha256', digest } };
}

export function verifyManifestAuth(manifest, encryptionKey) {
  if (manifest?.manifestAuth?.algorithm !== 'hmac-sha256' || !/^[0-9a-f]{64}$/i.test(manifest.manifestAuth.digest ?? '')) {
    throw new Error('Backup manifest authentication is missing or unsupported.');
  }
  const expected = createHmac('sha256', encryptionKey)
    .update(`${NODE_BACKUP_DOMAIN}:MANIFEST\0`)
    .update(manifestAuthInput(manifest))
    .digest();
  const actual = Buffer.from(manifest.manifestAuth.digest, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Backup manifest authentication failed.');
  return true;
}

function previousChunkIndex(previousManifest) {
  const index = new Map();
  if (!previousManifest?.chunks) return index;
  for (const chunk of previousManifest.chunks) {
    index.set(`${chunk.index}:${chunk.plainSha256}:${chunk.keyId}`, chunk);
  }
  return index;
}

export async function createNodeReconstructionBackup({
  records,
  store,
  encryptionKey,
  keyId,
  sequence = 1,
  previousManifest = null,
  chunkBytes = DEFAULT_CHUNK_BYTES,
  createdAt = new Date().toISOString(),
  sourceNodeId = null,
}) {
  if (!store) throw new Error('A backup store is required.');
  if (!keyId || typeof keyId !== 'string') throw new Error('keyId is required.');
  const key = assertEncryptionKey(encryptionKey);
  const payload = buildCanonicalNodePayload(records);
  const plaintextChunks = chunkBuffer(payload, chunkBytes);
  const plainHashes = plaintextChunks.map((chunk) => sha256Hex(`${NODE_BACKUP_DOMAIN}:PLAIN\0`, chunk));
  const nodeRoot = merkleRootFromPlainHashes(plainHashes);
  const prior = previousChunkIndex(previousManifest);
  const chunks = [];
  let reusedObjects = 0;

  for (let index = 0; index < plaintextChunks.length; index += 1) {
    const plain = plaintextChunks[index];
    const plainSha256 = plainHashes[index];
    const priorChunk = prior.get(`${index}:${plainSha256}:${keyId}`);
    if (priorChunk && await store.hasObject(priorChunk.objectId)) {
      chunks.push({ ...priorChunk, abbaCoordinate: deriveAbbaCoordinate(nodeRoot, index) });
      reusedObjects += 1;
      continue;
    }

    const encoded = encodeLosslessChunk(plain);
    const metadata = { nodeRoot, index, codec: encoded.codec, plainSha256, keyId };
    const encrypted = encryptChunk(encoded.bytes, key, metadata);
    await store.putObject(encrypted.objectId, encrypted.objectBytes);
    chunks.push({
      index,
      plainBytes: plain.length,
      plainSha256,
      codec: encoded.codec,
      encodedBytes: encoded.bytes.length,
      objectId: encrypted.objectId,
      keyId,
      abbaCoordinate: deriveAbbaCoordinate(nodeRoot, index),
    });
  }

  const manifestBase = {
    format: NODE_BACKUP_FORMAT,
    version: 1,
    createdAt,
    sequence,
    sourceNodeId,
    nodeRoot,
    payloadSha256: sha256Hex(`${NODE_BACKUP_DOMAIN}:PAYLOAD\0`, payload),
    payloadBytes: payload.length,
    chunkBytes,
    chunkCount: chunks.length,
    previousNodeRoot: previousManifest?.nodeRoot ?? null,
    previousSequence: previousManifest?.sequence ?? null,
    codecs: [...new Set(chunks.map((chunk) => chunk.codec))].sort(),
    encryption: { algorithm: 'aes-256-gcm', keyId },
    chunks,
  };
  const manifest = attachManifestAuth(manifestBase, key);
  const manifestId = sha256Hex(`${NODE_BACKUP_DOMAIN}:MANIFEST-ID\0`, manifestAuthInput(manifest), manifest.manifestAuth.digest);
  const storedManifest = { ...manifest, manifestId };
  await store.putManifest(manifestId, storedManifest);
  return { manifest: storedManifest, manifestId, reusedObjects, newObjects: chunks.length - reusedObjects };
}

function authManifestWithoutId(manifest) {
  const { manifestId, ...withoutId } = manifest;
  return withoutId;
}

export async function restoreNodeReconstructionBackup({ manifest, store, encryptionKey, preview = false }) {
  if (!manifest || manifest.format !== NODE_BACKUP_FORMAT || manifest.version !== 1) throw new Error('Unsupported node backup manifest.');
  const key = assertEncryptionKey(encryptionKey);
  const manifestForAuth = authManifestWithoutId(manifest);
  verifyManifestAuth(manifestForAuth, key);
  const expectedManifestId = sha256Hex(`${NODE_BACKUP_DOMAIN}:MANIFEST-ID\0`, manifestAuthInput(manifestForAuth), manifestForAuth.manifestAuth.digest);
  if (manifest.manifestId !== expectedManifestId) throw new Error('Backup manifest ID does not match its authenticated contents.');

  const chunks = [];
  const plainHashes = [];
  for (const descriptor of manifest.chunks) {
    if (descriptor.keyId !== manifest.encryption.keyId) throw new Error('Mixed backup key IDs are not supported by v1 restore.');
    const objectBytes = await store.getObject(descriptor.objectId);
    const actualObjectId = sha256Hex(`${NODE_BACKUP_DOMAIN}:OBJECT\0`, objectBytes);
    if (actualObjectId !== descriptor.objectId) throw new Error(`Backup object ${descriptor.index} failed its ciphertext commitment.`);
    const metadata = {
      nodeRoot: manifest.nodeRoot,
      index: descriptor.index,
      codec: descriptor.codec,
      plainSha256: descriptor.plainSha256,
      keyId: descriptor.keyId,
    };
    const encoded = decryptChunk(objectBytes, key, metadata);
    const plain = decodeLosslessChunk(descriptor.codec, encoded);
    const plainSha256 = sha256Hex(`${NODE_BACKUP_DOMAIN}:PLAIN\0`, plain);
    if (plainSha256 !== descriptor.plainSha256) throw new Error(`Backup chunk ${descriptor.index} failed plaintext verification.`);
    if (plain.length !== descriptor.plainBytes) throw new Error(`Backup chunk ${descriptor.index} length mismatch.`);
    chunks.push(plain);
    plainHashes.push(plainSha256);
  }

  const nodeRoot = merkleRootFromPlainHashes(plainHashes);
  if (nodeRoot !== manifest.nodeRoot) throw new Error('Reconstructed node root does not match the signed checkpoint commitment.');
  const payload = Buffer.concat(chunks);
  if (payload.length !== manifest.payloadBytes) throw new Error('Reconstructed backup payload length mismatch.');
  const payloadSha256 = sha256Hex(`${NODE_BACKUP_DOMAIN}:PAYLOAD\0`, payload);
  if (payloadSha256 !== manifest.payloadSha256) throw new Error('Reconstructed backup payload hash mismatch.');
  const parsed = JSON.parse(payload.toString('utf8'));
  if (parsed.format !== NODE_BACKUP_PAYLOAD_FORMAT || !Array.isArray(parsed.records)) throw new Error('Reconstructed backup payload format is invalid.');

  if (preview) {
    const systems = {};
    for (const record of parsed.records) systems[record.system] = (systems[record.system] ?? 0) + 1;
    return {
      verified: true,
      nodeRoot,
      sequence: manifest.sequence,
      createdAt: manifest.createdAt,
      recordCount: parsed.records.length,
      systems,
      payloadBytes: payload.length,
    };
  }

  return {
    verified: true,
    nodeRoot,
    records: parsed.records.map((record) => ({ ...record, content: restoreEnvelope(record.content) })),
  };
}

function safeObjectPath(rootDir, objectId) {
  if (!/^[0-9a-f]{64}$/i.test(objectId)) throw new Error('Invalid backup object ID.');
  return path.join(rootDir, 'objects', objectId.slice(0, 2), `${objectId}.bin`);
}

function safeManifestPath(rootDir, manifestId) {
  if (!/^[0-9a-f]{64}$/i.test(manifestId)) throw new Error('Invalid backup manifest ID.');
  return path.join(rootDir, 'manifests', `${manifestId}.json`);
}

export function createFilesystemBackupStore(rootDir) {
  if (!rootDir) throw new Error('rootDir is required.');
  return {
    rootDir,
    async putObject(objectId, bytes) {
      const filePath = safeObjectPath(rootDir, objectId);
      await mkdir(path.dirname(filePath), { recursive: true });
      try {
        const existing = await readFile(filePath);
        if (!existing.equals(Buffer.from(bytes))) throw new Error(`Content-addressed backup object collision: ${objectId}`);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        await writeFile(filePath, bytes, { flag: 'wx', mode: 0o600 });
      }
    },
    async getObject(objectId) {
      return readFile(safeObjectPath(rootDir, objectId));
    },
    async hasObject(objectId) {
      try { await readFile(safeObjectPath(rootDir, objectId)); return true; } catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
    },
    async listObjectIds() {
      const base = path.join(rootDir, 'objects');
      try {
        const prefixes = await readdir(base, { withFileTypes: true });
        const ids = [];
        for (const prefix of prefixes) {
          if (!prefix.isDirectory()) continue;
          for (const name of await readdir(path.join(base, prefix.name))) {
            if (/^[0-9a-f]{64}\.bin$/i.test(name)) ids.push(name.slice(0, -4));
          }
        }
        return ids.sort();
      } catch (error) { if (error?.code === 'ENOENT') return []; throw error; }
    },
    async deleteObject(objectId) {
      await rm(safeObjectPath(rootDir, objectId), { force: true });
    },
    async putManifest(manifestId, manifest) {
      const filePath = safeManifestPath(rootDir, manifestId);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, `${canonicalJson(manifest)}\n`, { mode: 0o600 });
    },
    async getManifest(manifestId) {
      return JSON.parse(await readFile(safeManifestPath(rootDir, manifestId), 'utf8'));
    },
    async listManifests() {
      const base = path.join(rootDir, 'manifests');
      try {
        const names = (await readdir(base)).filter((name) => /^[0-9a-f]{64}\.json$/i.test(name));
        const manifests = [];
        for (const name of names) manifests.push(JSON.parse(await readFile(path.join(base, name), 'utf8')));
        return manifests.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.sequence - b.sequence);
      } catch (error) { if (error?.code === 'ENOENT') return []; throw error; }
    },
    async deleteManifest(manifestId) {
      await rm(safeManifestPath(rootDir, manifestId), { force: true });
    },
  };
}

export async function pruneBackupStore(store, { keep = DEFAULT_RETENTION } = {}) {
  if (!Number.isInteger(keep) || keep < 1) throw new Error('Backup retention keep must be a positive integer.');
  const manifests = await store.listManifests();
  const remove = manifests.slice(0, Math.max(0, manifests.length - keep));
  for (const manifest of remove) await store.deleteManifest(manifest.manifestId);
  const kept = await store.listManifests();
  const referenced = new Set(kept.flatMap((manifest) => manifest.chunks.map((chunk) => chunk.objectId)));
  let removedObjects = 0;
  for (const objectId of await store.listObjectIds()) {
    if (!referenced.has(objectId)) {
      await store.deleteObject(objectId);
      removedObjects += 1;
    }
  }
  return { removedManifests: remove.length, removedObjects, keptManifests: kept.length };
}

export async function replicateBackup({ manifest, sourceStore, replicaStores, requiredReplicas = replicaStores.length }) {
  if (!Array.isArray(replicaStores) || !replicaStores.length) throw new Error('replicaStores must contain at least one backup store.');
  if (requiredReplicas < 1 || requiredReplicas > replicaStores.length) throw new Error('requiredReplicas is outside replicaStores bounds.');
  let completed = 0;
  const failures = [];
  for (const target of replicaStores) {
    try {
      for (const chunk of manifest.chunks) {
        if (!await target.hasObject(chunk.objectId)) {
          const bytes = await sourceStore.getObject(chunk.objectId);
          const actual = sha256Hex(`${NODE_BACKUP_DOMAIN}:OBJECT\0`, bytes);
          if (actual !== chunk.objectId) throw new Error(`Source object ${chunk.objectId} failed integrity before replication.`);
          await target.putObject(chunk.objectId, bytes);
        }
      }
      await target.putManifest(manifest.manifestId, manifest);
      completed += 1;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (completed < requiredReplicas) throw new Error(`Backup replication quorum failed: ${completed}/${requiredReplicas} replicas completed. ${failures.join(' | ')}`);
  return { completed, requiredReplicas, failures };
}

export async function answerRetrievalChallenge(store, objectId, nonce) {
  const objectBytes = await store.getObject(objectId);
  const commitment = sha256Hex(`${NODE_BACKUP_DOMAIN}:OBJECT\0`, objectBytes);
  if (commitment !== objectId) throw new Error('Stored object failed commitment before challenge response.');
  return sha256Hex(`${NODE_BACKUP_DOMAIN}:RETRIEVAL-CHALLENGE\0${nonce}\0`, objectBytes);
}

export function verifyRetrievalChallenge(objectBytes, objectId, nonce, response) {
  const bytes = Buffer.from(objectBytes);
  if (sha256Hex(`${NODE_BACKUP_DOMAIN}:OBJECT\0`, bytes) !== objectId) return false;
  return sha256Hex(`${NODE_BACKUP_DOMAIN}:RETRIEVAL-CHALLENGE\0${nonce}\0`, bytes) === response;
}

export function selectReplicaTargets({ nodeRoot, objectId, targetIds, replicas = 3 }) {
  if (!Array.isArray(targetIds) || !targetIds.length) return [];
  const coordinate = deriveAbbaCoordinate(nodeRoot, parseInt(objectId.slice(0, 8), 16), 10);
  return [...new Set(targetIds)].map((targetId) => ({
    targetId,
    score: sha256Hex(`${NODE_BACKUP_DOMAIN}:REPLICA-SLOT\0${coordinate}\0${objectId}\0${targetId}`),
  })).sort((a, b) => a.score.localeCompare(b.score)).slice(0, Math.min(replicas, targetIds.length)).map(({ targetId }) => targetId);
}

export async function runBackupCycle({
  exportRecords,
  store,
  encryptionKey,
  keyId,
  sourceNodeId = null,
  retention = DEFAULT_RETENTION,
  chunkBytes = DEFAULT_CHUNK_BYTES,
  createdAt = new Date().toISOString(),
}) {
  if (typeof exportRecords !== 'function') throw new Error('exportRecords callback is required.');
  const manifests = await store.listManifests();
  const previousManifest = manifests.at(-1) ?? null;
  const records = await exportRecords();
  const sequence = (previousManifest?.sequence ?? 0) + 1;
  const result = await createNodeReconstructionBackup({
    records,
    store,
    encryptionKey,
    keyId,
    sequence,
    previousManifest,
    chunkBytes,
    createdAt,
    sourceNodeId,
  });
  const retentionResult = await pruneBackupStore(store, { keep: retention });
  return { ...result, retention: retentionResult };
}

export function createNodeBackupScheduler({ intervalMs = DEFAULT_INTERVAL_MS, runCycle, onError = () => {} }) {
  if (!Number.isFinite(intervalMs) || intervalMs < 60_000) throw new Error('Backup interval must be at least 60 seconds.');
  if (typeof runCycle !== 'function') throw new Error('runCycle callback is required.');
  let timer = null;
  let running = null;

  const runNow = async () => {
    if (running) return running;
    running = Promise.resolve().then(runCycle).finally(() => { running = null; });
    return running;
  };

  const start = () => {
    if (timer) return;
    timer = setInterval(() => { runNow().catch(onError); }, intervalMs);
    timer.unref?.();
  };

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  return { start, stop, runNow, get running() { return Boolean(running); } };
}
