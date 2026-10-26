// One canonical, browser-safe contract for Civweave's direct-distribution Android host.
// The trust root MUST be pinned in shipped source, not supplied by a downloaded manifest.
export const HOST_PACKAGE = 'cc.civweave.devicehost';
export const RELEASE_ORIGIN = 'https://civweave.cc';
export const MANIFEST_PATH = '/downloads/device-host/stable.json';
export const MAX_APK_BYTES = 128 * 1024 * 1024;
export const RELEASE_SCHEMA = 'civweave.android-host-release.v1';

const validInteger = x => Number.isSafeInteger(x) && x > 0;
const hex64 = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
  }
  return value;
}

export function canonicalReleaseBytes(payload) {
  return new TextEncoder().encode(JSON.stringify(ordered(payload)));
}

export function validateRelease(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error('Release payload missing.');
  if (payload.schema !== RELEASE_SCHEMA || payload.packageName !== HOST_PACKAGE)
    throw Error('Unexpected native host package or release schema.');
  if (!validInteger(payload.versionCode) || !/^\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9]+)*$/.test(payload.versionName || ''))
    throw Error('Invalid native host version.');
  const timestamp = Date.parse(payload.publishedAt || '');
  if (!Number.isFinite(timestamp) || timestamp > Date.now() + 5 * 60_000)
    throw Error('Invalid release publication time.');
  const apk = payload.apk;
  if (!apk || !hex64(apk.sha256) || !validInteger(apk.sizeBytes) || apk.sizeBytes > MAX_APK_BYTES)
    throw Error('Invalid APK checksum or size.');
  let url;
  try { url = new URL(apk.url); } catch { throw Error('Invalid APK URL.'); }
  if (url.origin !== RELEASE_ORIGIN || url.username || url.password || url.search || url.hash ||
      !/^\/downloads\/device-host\/[a-zA-Z0-9._-]+\.apk$/.test(url.pathname))
    throw Error('APK must be hosted on the pinned Civweave release origin.');
  return true;
}

function decodeBase64Url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error('Invalid signing key or signature.');
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export async function verifySignedRelease(envelope, {publicKeyBase64Url, keyId} = {}) {
  if (!publicKeyBase64Url || !keyId) throw Error('No trusted native host signing key is configured.');
  if (!envelope || typeof envelope !== 'object' || !envelope.signature ||
      envelope.signature.algorithm !== 'Ed25519' || envelope.signature.keyId !== keyId)
    throw Error('Release signature is absent or signed by an unknown key.');
  validateRelease(envelope.payload);
  const publicKey = decodeBase64Url(publicKeyBase64Url);
  const signature = decodeBase64Url(envelope.signature.value);
  if (publicKey.byteLength !== 32 || signature.byteLength !== 64)
    throw Error('Unexpected signing key or signature size.');
  if (!globalThis.crypto?.subtle) throw Error('Cryptographic verification unavailable.');
  const key = await crypto.subtle.importKey('raw', publicKey, 'Ed25519', false, ['verify']);
  if (!await crypto.subtle.verify('Ed25519', key, signature, canonicalReleaseBytes(envelope.payload)))
    throw Error('Native host release signature verification failed.');
  return envelope.payload;
}

export function updateDecision(installedVersionCode, latestVersionCode) {
  if (!validInteger(latestVersionCode)) throw Error('Invalid available release version.');
  if (!validInteger(installedVersionCode)) return 'installation-status-unknown';
  if (latestVersionCode > installedVersionCode) return 'update-available';
  if (latestVersionCode === installedVersionCode) return 'current';
  return 'older-release';
}

export async function verifyApkBytes(input, metadata) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!bytes.length || bytes.byteLength > MAX_APK_BYTES ||
      bytes.byteLength !== metadata?.sizeBytes || !hex64(metadata?.sha256))
    throw Error('Downloaded APK does not match the signed size.');
  if (!globalThis.crypto?.subtle) throw Error('Cryptographic verification unavailable.');
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const digest = Array.from(hash, x => x.toString(16).padStart(2,'0')).join('');
  if (digest !== metadata.sha256) throw Error('Downloaded APK failed SHA-256 integrity verification.');
  return bytes;
}

// Reject redirects to ensure the signed URL stays on the pinned origin.
// No installation is attempted here: Android still owns package verification and user approval.
export async function fetchVerifiedApk(release, fetcher = fetch) {
  validateRelease(release);
  const response = await fetcher(release.apk.url, {
    mode: 'cors', cache: 'no-store', credentials: 'omit', redirect: 'error'
  });
  if (!response.ok || response.url !== release.apk.url || !response.body)
    throw Error('APK download failed or was redirected.');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > release.apk.sizeBytes || total > MAX_APK_BYTES) {
      await reader.cancel(); throw Error('APK download exceeded its signed size.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.byteLength; }
  return verifyApkBytes(bytes, release.apk);
}
