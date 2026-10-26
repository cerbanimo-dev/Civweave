import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import {
  canonicalReleaseBytes, validateRelease, verifySignedRelease,
  updateDecision, verifyApkBytes, MAX_APK_BYTES,
} from '../public/app/device-host-updates.mjs';

const ORIGIN = 'https://civweave.cc';
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const rawPublicKey = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
const b64 = bytes => Buffer.from(bytes).toString('base64url');
const release = () => ({
  schema: 'civweave.android-host-release.v1',
  packageName: 'cc.civweave.devicehost',
  versionCode: 4,
  versionName: '0.1.4',
  publishedAt: '2026-10-26T00:00:00Z',
  apk: { url: ORIGIN + '/downloads/device-host/civweave-host-4.apk',
    sha256: 'a'.repeat(64), sizeBytes: 123456 },
});

test('release validation fails closed for untrusted artifacts or rollback metadata', () => {
  const value = release();
  assert.equal(validateRelease(value), true);
  assert.throws(() => validateRelease({...value, apk: {...value.apk, url: 'https://attacker.invalid/host.apk'}}));
  assert.throws(() => validateRelease({...value, packageName: 'com.other.app'}));
  assert.throws(() => validateRelease({...value, versionCode: 0}));
  assert.throws(() => validateRelease({...value, apk: {...value.apk, sizeBytes: MAX_APK_BYTES + 1}}));
});

test('canonical JSON is order independent, and an Ed25519 signature cannot be forged by metadata tampering', async () => {
  const payload = release();
  const signed = {payload, signature: {keyId: 'fixture', algorithm: 'Ed25519',
    value: b64(sign(null, Buffer.from(canonicalReleaseBytes(payload)), privateKey))}};
  assert.deepEqual(canonicalReleaseBytes({apk: {...payload.apk}, ...payload}), canonicalReleaseBytes(payload));
  assert.equal((await verifySignedRelease(signed, {publicKeyBase64Url: b64(rawPublicKey), keyId:'fixture'})).versionCode, 4);
  await assert.rejects(verifySignedRelease(
    {...signed, payload: {...payload, versionCode: 5}},
    {publicKeyBase64Url: b64(rawPublicKey), keyId:'fixture'}
  ));
  await assert.rejects(verifySignedRelease(signed, {publicKeyBase64Url: '', keyId:'fixture'}));
  await assert.rejects(verifySignedRelease(signed, {publicKeyBase64Url: b64(rawPublicKey), keyId:'wrong'}));
});

test('update decisions never imply that a missing host was detected', () => {
  assert.equal(updateDecision(3, 4), 'update-available');
  assert.equal(updateDecision(4, 4), 'current');
  assert.equal(updateDecision(5, 4), 'older-release');
  assert.equal(updateDecision(null, 4), 'installation-status-unknown');
});

test('APK verification requires exact byte count and SHA256, not just a trusted URL', async () => {
  const bytes = new TextEncoder().encode('test-only-apk-bytes');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const metadata = {sizeBytes: bytes.byteLength, sha256: digest};
  await verifyApkBytes(bytes, metadata);
  await assert.rejects(verifyApkBytes(bytes, {...metadata, sha256: '0'.repeat(64)}));
  await assert.rejects(verifyApkBytes(bytes, {...metadata, sizeBytes: bytes.length + 1}));
});
