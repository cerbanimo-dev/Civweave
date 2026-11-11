import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const carrierURL = process.env.POCKET_CARRIER_PATH
  ? pathToFileURL(process.env.POCKET_CARRIER_PATH)
  : new URL('../../../../public/labs/pocket-commons/core.mjs', import.meta.url);
const { decodeFrame } = await import(carrierURL);
const fixtures = JSON.parse(await readFile(new URL('./wire-fixtures.json', import.meta.url), 'utf8'));
const bytes = hex => Uint8Array.from(Buffer.from(hex, 'hex'));
assert.equal(decodeFrame(bytes(fixtures.carrierBeaconHex)).messageId, 0x10203040);
assert.throws(() => decodeFrame(bytes(fixtures.labTextHex)), /magic mismatch/);
console.log('PASS: existing Pocket Commons carrier accepts its own fixture and rejects CL lab plaintext.');
