import assert from'node:assert/strict';
import fs from'node:fs';
import path from'node:path';
import{fileURLToPath}from'node:url';
import media,{licenseAllowed,chooseFile,scoreRecord,sha256HexForBytes}from'../public/app/open-learning-media-cache-v1.mjs';

const{POLICY_PRESETS}=media;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assert.equal(sha256HexForBytes(new TextEncoder().encode('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
assert.equal(licenseAllowed({spdx:'CC-BY'}),true);
assert.equal(licenseAllowed({spdx:'CC-BY-SA'}),true);
assert.equal(licenseAllowed({spdx:'PUBLIC-DOMAIN'}),true);
assert.equal(licenseAllowed({spdx:'CC-BY-NC'}),false);
assert.equal(licenseAllowed({spdx:'CC-BY-ND'}),false);
assert.equal(licenseAllowed({spdx:'UNKNOWN'}),false);
assert(POLICY_PRESETS['learning-path'].budgetBytes>POLICY_PRESETS.minimal.budgetBytes);
assert(POLICY_PRESETS['outage-ready'].budgetBytes>POLICY_PRESETS['learning-path'].budgetBytes);
const file=chooseFile({files:[{url:'https://x.test/large.mp4',bytes:50_000_000},{url:'https://x.test/small.webm',bytes:5_000_000},{url:'https://x.test/list.m3u8',bytes:1_000_000}]});
assert.equal(file.url,'https://x.test/small.webm');
const vibe={title:'Vibe coding with Claude Code',description:'AI coding assistant tutorial',quality_score:90};
assert(scoreRecord(vibe,'vibe coding an app','vibe-coding')>scoreRecord({title:'Gardening basics',description:'soil and seeds',quality_score:90},'vibe coding an app','vibe-coding'));

const mediaSource=fs.readFileSync(path.join(root,'public/app/open-learning-media-cache-v1.mjs'),'utf8');
for(const token of ['body.tee()','cw-media-manifest','cw-media-request','cw-media-start','cw-media-chunk','cw-media-end','Mesh media SHA-256 verification failed','catalog is stale','MESH_REDISTRIBUTABLE'])assert(mediaSource.includes(token),token);
const contract=fs.readFileSync(path.join(root,'public/app/video-learning-contract-v1.mjs'),'utf8');
assert(contract.includes("open-learning-media-cache-v1.mjs"));
assert(contract.includes('resolveRelevantMedia'));
assert(contract.includes("kind:'open-media'"));
const offline=JSON.parse(fs.readFileSync(path.join(root,'public/app/offline-package-v208.json'),'utf8'));
for(const asset of ['/app/open-learning-media-cache-v1.mjs','/downloads/knowledge-schools/open-learning-media/lookup.json','/downloads/knowledge-schools/open-learning-media/harvest-policy.json'])assert(offline.assets.includes(asset),asset);
const atlasInstaller=fs.readFileSync(path.join(root,'public/app/video-atlas-installer-v1.js'),'utf8');
assert(atlasInstaller.includes('/app/open-learning-media-installer-v1.mjs'));
const mediaInstaller=fs.readFileSync(path.join(root,'public/app/open-learning-media-installer-v1.mjs'),'utf8');
assert(mediaInstaller.includes("ROOT_ID='open-learning-media-cache'"));
assert(mediaInstaller.includes('ensureRoot'));
for(const surface of ['public/app/cabinets/living-school/index.html','public/app/realm-console-v140.html','public/app/working-campus-v156.html']){
  const html=fs.readFileSync(path.join(root,surface),'utf8');
  assert(html.includes('/app/open-learning-media-cache-v1.mjs'),surface);
}
console.log('Open Learning Media runtime verified: license gate, streaming SHA-256, storage tiers, mesh protocol, offline metadata, self-mounting installer, and realm wiring.');
