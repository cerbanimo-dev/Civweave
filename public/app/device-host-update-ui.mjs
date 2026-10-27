import {RELEASE_ORIGIN, MANIFEST_PATH, verifySignedRelease, fetchVerifiedApk, updateDecision} from './device-host-updates.mjs';
import {pairHost, readHostStatus} from './device-host-client.mjs';

// Provision these pinned values at source review, before publishing any APK.
// Never load a signing key from a remote manifest or localStorage.
const RELEASE_KEY_ID = '';
const RELEASE_PUBLIC_KEY_BASE64URL = '';

const status = document.getElementById('host-update-status');
const version = document.getElementById('host-update-version');
const check = document.getElementById('host-update-check');
const download = document.getElementById('host-update-download');
const pairButton = document.getElementById('host-pair');
const pairCode = document.getElementById('host-pair-code');
const pairStatus = document.getElementById('host-pair-status');
const SESSION_TOKEN = 'civweave.android-device-host.paired-session.v1';
let pairedHost = null;
let verified = null;
let working = false;

function show(message) { status.textContent = message; }
function busy(value) {
  working = value;
  check.disabled = value;
  download.disabled = value || !verified ||
    ['current', 'older-release'].includes(updateDecision(hostVersion(), verified.versionCode));
}
function hostVersion() {
  return pairedHost?.versionCode || null;
}

version.textContent = 'Installed host version: unknown. Pair the optional native host to check it.';
pairButton.addEventListener('click', async () => {
  if (working) return;
  busy(true);
  pairButton.disabled = true;
  try {
    pairStatus.textContent = 'Connecting to the local host on this phone…';
    let token;
    if (pairCode.value.trim()) {
      token = await pairHost(pairCode.value);
      sessionStorage.setItem(SESSION_TOKEN, token);
    } else {
      token = sessionStorage.getItem(SESSION_TOKEN);
      if (!token) throw Error('Enter the code displayed in the Android Host app.');
    }
    pairedHost = await readHostStatus(token);
    pairStatus.textContent = 'Paired: Android Host ' + pairedHost.versionName +
      '. Supported capabilities: ' + pairedHost.capabilities.join(', ');
    version.textContent = 'Installed host version: ' + pairedHost.versionName +
      ' (code ' + pairedHost.versionCode + ')';
    pairCode.value = '';
    if (verified) show('Signed release ' + verified.versionName +
      ' · ' + updateDecision(hostVersion(), verified.versionCode));
  } catch (error) {
    sessionStorage.removeItem(SESSION_TOKEN);
    pairedHost = null;
    version.textContent = 'Installed host version: unknown (no active pairing).';
    pairStatus.textContent = 'Connection unavailable: ' + String(error?.message || error) +
      '. The Android Host must be open and local-network access permitted.';
  } finally {
    pairButton.disabled = false;
    busy(false);
  }
});

show(RELEASE_PUBLIC_KEY_BASE64URL
  ? 'Ready to check signed Civweave Android Host releases.'
  : 'Direct APK updates are not active yet: the pinned release verification key has not been provisioned.');

check.addEventListener('click', async () => {
  if (working) return;
  verified = null;
  busy(true);
  try {
    if (!RELEASE_PUBLIC_KEY_BASE64URL || !RELEASE_KEY_ID)
      throw Error('No trusted release key is provisioned. Downloads remain disabled.');
    show('Checking signed release metadata…');
    const response = await fetch(RELEASE_ORIGIN + MANIFEST_PATH, {
      mode: 'cors', cache: 'no-store', credentials: 'omit', redirect: 'error'
    });
    if (!response.ok || response.url !== RELEASE_ORIGIN + MANIFEST_PATH)
      throw Error('Civweave release metadata could not be loaded securely.');
    const envelope = await response.json();
    const release = await verifySignedRelease(envelope, {
      publicKeyBase64Url: RELEASE_PUBLIC_KEY_BASE64URL, keyId: RELEASE_KEY_ID
    });
    verified = release;
    show('Verified release: ' + release.versionName +
      '\nInstalled version: unknown. Android will determine whether installation or an update is allowed.');
  } catch (error) {
    show('No verified download available: ' + String(error?.message || error));
  } finally { busy(false); }
});

download.addEventListener('click', async () => {
  if (working || !verified) return;
  busy(true);
  try {
    show('Downloading and verifying the APK; nothing will be installed automatically…');
    const bytes = await fetchVerifiedApk(verified);
    const url = URL.createObjectURL(new Blob([bytes], {type: 'application/vnd.android.package-archive'}));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'civweave-device-host-' + verified.versionCode + '.apk';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // A download click isn't an install confirmation; do not report success.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    show('APK verified and handed to your browser for saving. Open the downloaded file to request installation from Android. Installation is not confirmed.');
  } catch (error) {
    show('Download not offered: ' + String(error?.message || error));
  } finally { busy(false); }
});
