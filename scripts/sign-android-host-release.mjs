#!/usr/bin/env node
// Offline release metadata signer. This does not deploy artifacts or manage signing secrets.
import {readFile, writeFile, realpath, stat} from 'node:fs/promises';
import {resolve, dirname, basename, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash, createPrivateKey, createPublicKey, sign} from 'node:crypto';
import {
  canonicalReleaseBytes, validateRelease, HOST_PACKAGE, RELEASE_SCHEMA, RELEASE_ORIGIN, MAX_APK_BYTES,
} from '../public/app/device-host-updates.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function argsFrom(argv) {
  const args = {};
  for (let i=0; i<argv.length; i += 2) {
    if (!argv[i].startsWith('--') || !argv[i+1] || argv[i+1].startsWith('--'))
      throw Error('Expected --apk, --version-code, --version-name, --signing-key, --key-id and --out.');
    args[argv[i].slice(2)] = argv[i+1];
  }
  return args;
}

export async function signHostRelease(opts) {
  const keys = ['apk','version-code','version-name','signing-key','key-id','out'];
  if (keys.some(key => !opts[key])) throw Error('Missing required options: ' + keys.filter(key => !opts[key]).join(', '));
  const apkPath = await realpath(resolve(opts.apk));
  const signingPath = await realpath(resolve(opts['signing-key']));
  // Never accept a private signing key stored in this repository.
  if (signingPath === root || signingPath.startsWith(root + sep))
    throw Error('Move the release signing key outside the Civweave repository.');
  const filename = basename(apkPath);
  if (!/^[a-zA-Z0-9._-]+\.apk$/.test(filename)) throw Error('APK filename is unsuitable for release distribution.');
  const fileStat = await stat(apkPath);
  if (fileStat.size < 1 || fileStat.size > MAX_APK_BYTES) throw Error('APK size is outside supported release limits.');
  const apk = await readFile(apkPath);
  const privateKey = createPrivateKey(await readFile(signingPath));
  if (privateKey.asymmetricKeyType !== 'ed25519') throw Error('Release key must be Ed25519.');
  const keyId = opts['key-id'];
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(keyId)) throw Error('Invalid release signer key ID.');
  const payload = {
    schema: RELEASE_SCHEMA,
    packageName: HOST_PACKAGE,
    versionCode: Number(opts['version-code']),
    versionName: opts['version-name'],
    publishedAt: new Date().toISOString(),
    apk: {url: RELEASE_ORIGIN + '/downloads/device-host/' + filename,
      sha256: createHash('sha256').update(apk).digest('hex'), sizeBytes: apk.length},
  };
  validateRelease(payload);
  const envelope = {payload, signature: {keyId, algorithm:'Ed25519',
    value: sign(null, Buffer.from(canonicalReleaseBytes(payload)), privateKey).toString('base64url')}};
  const output = resolve(opts.out);
  if (output === apkPath || output === signingPath) throw Error('Refusing to overwrite an input.');
  await writeFile(output, JSON.stringify(envelope, null, 2) + '\n', {flag:'wx'});
  const publicSpki = createPublicKey(privateKey).export({format:'der',type:'spki'});
  return {manifestPath: output, keyId,
    publicKeyBase64Url: publicSpki.subarray(-32).toString('base64url'),
    apkName: filename, apkSha256: payload.apk.sha256};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  signHostRelease(argsFrom(process.argv.slice(2))).then(info => {
    process.stdout.write(JSON.stringify(info, null, 2) + '\n');
  }).catch(error => {process.stderr.write(String(error?.message || error) + '\n');process.exitCode = 1;});
}
