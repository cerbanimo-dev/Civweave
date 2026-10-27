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

test('the Settings owner and offline installer package expose exactly the canonical updater', async () => {
  const {readFile} = await import('node:fs/promises');
  const settings = await readFile(new URL('../public/app/settings-gateway-v317.js', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8');
  const owner = JSON.parse(await readFile(new URL('../config/system-ownership.json', import.meta.url), 'utf8'));
  assert.ok(settings.includes('href="/app/device-host-updates.html"'));
  for (const path of ['device-host-updates.html','device-host-updates.mjs','device-host-update-ui.mjs','device-host-client.mjs'])
    assert.ok(worker.includes("'/app/" + path + "'"), 'mobile install CORE must include ' + path);
  assert.equal(owner.systems['android-device-host-updates'].owner, 'public/app/device-host-updates.mjs');
});

test('release signing tool signs APK metadata with an external key, never embedding private material', async () => {
  const {mkdtemp, writeFile, readFile} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const {signHostRelease} = await import('./sign-android-host-release.mjs');
  const folder = await mkdtemp(join(tmpdir(), 'civweave-host-sign-'));
  const apk = join(folder, 'civweave-host-fixture.apk');
  const pem = join(folder, 'release-key.pem');
  const out = join(folder, 'stable.json');
  await writeFile(apk, 'Not a real APK: testing the signed metadata protocol');
  await writeFile(pem, privateKey.export({format:'pem',type:'pkcs8'}));
  const result = await signHostRelease({apk,'version-code':'8','version-name':'0.1.8',
    'signing-key':pem,'key-id':'fixture','out':out});
  const envelope = JSON.parse(await readFile(out,'utf8'));
  assert.equal(result.keyId, 'fixture');
  assert.equal((await verifySignedRelease(envelope,
    {publicKeyBase64Url: result.publicKeyBase64Url, keyId:'fixture'})).versionCode, 8);
  assert.ok(!JSON.stringify(envelope).includes('PRIVATE KEY'));
});

test('local Android Host pairing requires an explicit code and never caches secret credentials', async () => {
  const {pairHost, readHostStatus, HOST_API_ORIGIN} =
    await import('../public/app/device-host-client.mjs');
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({url, options});
    if (url.endsWith('/v1/pair')) return {
      ok: true, url, json: async () => ({schema:'civweave.device-host-pair.v1',token:'z'.repeat(43)})
    };
    return {ok:true,url,json:async()=>({schema:'civweave.device-host-status.v1',
      packageName:'cc.civweave.devicehost',versionCode:2,versionName:'0.1.2',
      capabilities:['android.host.status.v1']})};
  };
  await assert.rejects(pairHost('0000000000',fetcher));
  await assert.rejects(pairHost('BADC0DE',fetcher));
  const token = await pairHost('ABCDEFGHJK',fetcher);
  assert.equal(token.length,43);
  assert.equal(calls[0].url,HOST_API_ORIGIN+'/v1/pair');
  assert.equal(calls[0].options.credentials,'omit');
  const info=await readHostStatus(token,fetcher);
  assert.equal(info.versionCode,2);
  assert.equal(calls[1].options.headers.Authorization,'Bearer '+token);
  await assert.rejects(readHostStatus('not-a-token',fetcher));
  await assert.rejects(readHostStatus(token,async()=>({ok:true,url:HOST_API_ORIGIN+'/v1/status',
    json:async()=>({schema:'civweave.device-host-status.v1',packageName:'attacker',versionCode:900})})));
});

test('native Android Host keeps the first protocol scoped to loopback and paired status', async () => {
  const {readFile} = await import('node:fs/promises');
  const base = new URL('../native/android/device-host/app/src/main/', import.meta.url);
  const kotlin = await readFile(new URL('java/cc/civweave/devicehost/LoopbackHostServer.kt', base), 'utf8');
  const manifest = await readFile(new URL('AndroidManifest.xml', base), 'utf8');
  const gradle = await readFile(new URL('../native/android/device-host/app/build.gradle.kts', import.meta.url), 'utf8');
  assert.ok(kotlin.includes('127.0.0.1') && kotlin.includes('/v1/status') && kotlin.includes('/v1/pair'));
  assert.ok(kotlin.includes('access-control-allow-origin') || kotlin.includes('Access-Control-Allow-Origin'));
  assert.ok(kotlin.includes('MessageDigest.isEqual'));
  assert.ok(kotlin.includes('expiresAt') && kotlin.includes('badAttempts >= 5'));
  assert.ok(!kotlin.includes('Runtime.getRuntime().exec('));
  assert.ok(!kotlin.includes('PackageInstaller'));
  assert.ok(!manifest.includes('REQUEST_INSTALL_PACKAGES'));
  assert.match(gradle,/applicationId = "cc.civweave.devicehost"/);
});

test('Android Host lifecycle has an opt-in foreground service, explicit stop, and no automatic boot', async () => {
  const {readFile} = await import('node:fs/promises');
  const base = new URL('../native/android/device-host/app/src/main/', import.meta.url);
  const manifest=await readFile(new URL('AndroidManifest.xml',base),'utf8');
  const activity=await readFile(new URL('java/cc/civweave/devicehost/MainActivity.kt',base),'utf8');
  const service=await readFile(new URL('java/cc/civweave/devicehost/DeviceHostService.kt',base),'utf8');
  assert.match(manifest,/android:foregroundServiceType="specialUse"/);
  assert.match(manifest,/android\.permission\.FOREGROUND_SERVICE_SPECIAL_USE/);
  assert.match(manifest,/android:exported="false"/);
  assert.doesNotMatch(manifest,/BOOT_COMPLETED/);
  assert.match(service,/startForeground\(/);
  assert.match(service,/LoopbackHostServer/);
  assert.match(service,/ACTION_STOP/);
  assert.match(service,/START_NOT_STICKY/);
  assert.match(activity,/startForegroundService\(/);
  assert.match(activity,/bindService\(/);
  assert.doesNotMatch(activity,/server\?\.close\(\)/);
});

test('Native APK install lane is disabled without an embedded release verification key', async () => {
  const {readFile}=await import('node:fs/promises');
  const file=await readFile(new URL('../native/android/device-host/app/src/main/java/cc/civweave/devicehost/HostReleasePolicy.kt',import.meta.url),'utf8');
  assert.match(file,/PINNED_ED25519_PUBLIC_KEY_B64URL = ""/);
  assert.match(file,/verificationKeyConfigured\(\)/);
  assert.match(file,/cc\.civweave\.devicehost/);
  assert.match(file,/https:\/\/civweave\.cc\/downloads\/device-host\//);
});

test('native updater only stages a self-update from an authenticated signed release and requires Android confirmation', async () => {
  const {readFile}=await import('node:fs/promises');
  const root=new URL('../native/android/device-host/app/src/main/',import.meta.url);
  const updater=await readFile(new URL('java/cc/civweave/devicehost/HostUpdateManager.kt',root),'utf8');
  const result=await readFile(new URL('java/cc/civweave/devicehost/HostInstallResultReceiver.kt',root),'utf8');
  const manifest=await readFile(new URL('AndroidManifest.xml',root),'utf8');
  assert.match(updater,/HostReleasePolicy\.verifyEnvelope/);
  assert.match(updater,/MessageDigest\.getInstance\("SHA-256"\)/);
  assert.match(updater,/PackageInstaller\.SessionParams/);
  assert.match(updater,/USER_ACTION_REQUIRED/);
  assert.match(updater,/canRequestPackageInstalls/);
  assert.match(updater,/getPackageArchiveInfo/);
  assert.match(updater,/EXPE(C|C)TED_PACKAGE|EXPECTED_PACKAGE/);
  assert.match(result,/STATUS_PENDING_USER_ACTION/);
  assert.match(result,/PendingIntent\.getActivity/);
  assert.match(manifest,/REQUEST_INSTALL_PACKAGES/);
  assert.match(manifest,/HostInstallResultReceiver/);
  assert.doesNotMatch(updater,/exec\(|Runtime\.getRuntime/);
});
