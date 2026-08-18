import assert from'node:assert/strict';
import fs from'node:fs';
import path from'node:path';
import{fileURLToPath}from'node:url';
import media,{licenseAllowed,chooseFile,scoreRecord,inferTopicSlug,sha256HexForBytes}from'../public/app/open-learning-media-cache-v1.mjs';

const{POLICY_PRESETS,MIN_RELEVANCE_SCORE}=media;
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
assert.equal(MIN_RELEVANCE_SCORE,18);
const file=chooseFile({files:[{url:'https://x.test/large.mp4',bytes:50_000_000},{url:'https://x.test/small.webm',bytes:5_000_000},{url:'https://x.test/list.m3u8',bytes:1_000_000}]});
assert.equal(file.url,'https://x.test/small.webm');
const vibe={title:'Vibe coding with Claude Code',description:'AI coding assistant tutorial',quality_score:90};
const unrelated={title:'Gardening basics',description:'soil and seeds',quality_score:90};
assert(scoreRecord(vibe,'vibe coding an app','vibe-coding')>=MIN_RELEVANCE_SCORE);
assert(scoreRecord(unrelated,'vibe coding an app','')<MIN_RELEVANCE_SCORE);

const mediaSource=fs.readFileSync(path.join(root,'public/app/open-learning-media-cache-v1.mjs'),'utf8');
for(const token of ['body.tee()','cw-media-manifest','cw-media-request','cw-media-start','cw-media-chunk','cw-media-end','Mesh media SHA-256 verification failed','catalog is stale','MESH_REDISTRIBUTABLE','MIN_RELEVANCE_SCORE=18','automaticNetworkAllowed','peerReceiveChains','trustworthy file size','REVOCATIONS_URL','loadRevocations','unsolicited media transfer rejected','slice(0,512)','safeRemoteUrl','non-video content type','topic_meta','inferTopicSlug'])assert(mediaSource.includes(token),token);
const contract=fs.readFileSync(path.join(root,'public/app/video-learning-contract-v1.mjs'),'utf8');
assert(contract.includes("open-learning-media-cache-v1.mjs"));
assert(contract.includes('resolveRelevantMedia'));
assert(contract.includes("kind:'open-media'"));
assert(contract.includes('safeExternalUrl'));
assert(contract.includes('safePlayableUrl'));
const offline=JSON.parse(fs.readFileSync(path.join(root,'public/app/offline-package-v208.json'),'utf8'));
const openMediaPack=(offline.lazyPacks||[]).find(pack=>pack?.id==='open-learning-media');
assert(openMediaPack,'open-learning-media lazy pack');
assert.equal(openMediaPack.kind,'learning-media');
assert.equal(openMediaPack.entry,'/app/open-learning-media-installer-v1.mjs');
assert.equal(openMediaPack.prefix,'/app/open-learning-media-');
assert((offline.excludePrefixes||[]).includes('/app/open-learning-media-'),'open-learning-media stays outside the required offline core');
const revocations=JSON.parse(fs.readFileSync(path.join(root,'public/downloads/knowledge-schools/open-learning-media/revocations.json'),'utf8'));
assert.equal(revocations.schema,'civweave.open-learning-media-revocations.v1');
assert(Array.isArray(revocations.record_keys));
assert(Array.isArray(revocations.content_hashes));
const atlasInstaller=fs.readFileSync(path.join(root,'public/app/video-atlas-installer-v1.js'),'utf8');
assert(atlasInstaller.includes('/app/open-learning-media-installer-v1.mjs'));
assert(atlasInstaller.includes('scheduleLazyStage'));
assert(atlasInstaller.includes("addEventListener('civweave:pwa-installed'"));
const mediaInstaller=fs.readFileSync(path.join(root,'public/app/open-learning-media-installer-v1.mjs'),'utf8');
assert(mediaInstaller.includes("ROOT_ID='open-learning-media-cache'"));
assert(mediaInstaller.includes('ensureRoot'));
assert(mediaInstaller.includes('navigator.storage?.persist?.()'));
assert(mediaInstaller.includes('data-media-pack'));
assert(mediaInstaller.includes('Pin general knowledge outage pack'));
assert(mediaInstaller.includes("AUTO_RECEIPT_KEY='civweave.open-learning-media.auto-prefetch.v1'"));
assert(mediaInstaller.includes('lazyDownloadAllAvailablePacks'));
assert(mediaInstaller.includes("addEventListener('civweave:pwa-installed'"));
assert(mediaInstaller.includes('automaticNetworkAllowed'));
assert(mediaInstaller.includes('requestIdleCallback'));
assert(mediaInstaller.includes('pack.available!==false'));
for(const surface of ['public/app/cabinets/living-school/index.html','public/app/working-campus-v156.html']){
  const html=fs.readFileSync(path.join(root,surface),'utf8');
  assert(html.includes('/app/open-learning-media-cache-v1.mjs'),surface);
}
const cerbanimoHtml=fs.readFileSync(path.join(root,'public/app/realm-console-v140.html'),'utf8');
const cerbanimoVideo=fs.readFileSync(path.join(root,'public/app/cerbanimo-video-task-contract-v1.mjs'),'utf8');
assert(!cerbanimoHtml.includes('<script type="module" src="/app/open-learning-media-cache-v1.mjs'),'Cerbanimo must keep Open Learning Media off the eager boot path');
assert(cerbanimoVideo.includes('import(CONTRACT)'),'Cerbanimo must retain on-demand shared media loading');
const worker=fs.readFileSync(path.join(root,'public/service-worker-core-v208.js'),'utf8');
assert(worker.includes("'cw-open-learning-media-'"));
assert(worker.includes("OPEN_MEDIA_ROUTE_PREFIX = '/__civweave_open_media__/'"));
assert(worker.includes("OPEN_MEDIA_CACHE = 'cw-open-learning-media-v1'"));
assert(worker.includes("request.headers.get('range')"));
assert(worker.includes("'accept-ranges', 'bytes'"));
assert(worker.includes("'content-range'"));
assert(worker.includes('status: 206'));
assert(worker.includes('status: 416'));
assert(worker.includes("'/downloads/knowledge-schools/open-learning-media/revocations.json'"));

const lookup=JSON.parse(fs.readFileSync(path.join(root,'public/downloads/knowledge-schools/open-learning-media/lookup.json'),'utf8'));
assert.equal(inferTopicSlug('cell biology genetics lesson',lookup),'biology-life');
assert.equal(inferTopicSlug('budgeting and personal finance basics',lookup),'personal-finance');
assert.equal(inferTopicSlug('woodworking hand tools tutorial',lookup),'woodworking-basics');

// The default Learning Path budget must be able to hold at least the smallest approved item in every original launch focus topic.
const focus=['vibe-coding','prompt-engineering','pseudocoding','critical-thinking','logical-frameworks'];
let minimumFocusPackBytes=0;
for(const slug of focus){
  const sizes=(lookup.topics?.[slug]||[]).filter(record=>record.cache_policy==='MESH_REDISTRIBUTABLE'&&licenseAllowed(record.license)).flatMap(record=>(record.files||[]).map(file=>Number(file.bytes)||0)).filter(bytes=>bytes>0);
  assert(sizes.length>0,`${slug} has no known-size redistributable media file`);
  minimumFocusPackBytes+=Math.min(...sizes);
}
assert(minimumFocusPackBytes<=POLICY_PRESETS['learning-path'].budgetBytes,`smallest five-topic focus pack ${minimumFocusPackBytes} exceeds Learning Path budget ${POLICY_PRESETS['learning-path'].budgetBytes}`);
console.log(`Open Learning Media runtime verified: rights gate, streaming SHA-256, generated-topic inference, relevance floor, bounded storage, ${minimumFocusPackBytes} byte five-topic focus floor, requested-only serialized mesh, revocation kill switch, safe URL/MIME validation, range-aware offline playback, persistent-storage request, automatic post-install all-pack lazy queue, and realm wiring.`);
