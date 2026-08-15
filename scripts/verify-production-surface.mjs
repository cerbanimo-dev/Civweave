import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=path.join(root,'public','app');
const requiredApp=new Set([
  'routes.js','common.css','campus.html','campus.css','campus.js','chat.html','chat.css','chat.js','settings.html','settings.css','settings.js','downloads.html','downloads.css','downloads.js','realm.css','realm.js','living-school.html','cerbanimo.html','fellowfare.html','anarchadia.html','customization-loader.js','merlin-customization.js','semantic-router.js','manifest.webmanifest','recovery/index.html','recovery/recovery.css','recovery/recovery.js','shared/civweave-model-runtime.js','shared/civweave-node-ai-routing-v1.mjs','models/all-minilm-l6-v2/worker.js','models/all-minilm-l6-v2/reflex-index.json','assets/ai/weaveling.png','assets/ai/moss.png','assets/ai/kamiya.png','assets/ai/rook.png','assets/ai/merlin.png','logos/civweave-app-icon.png','logos/civweave-day-logo.jpg','logos/civweave-night-logo.jpg','logos/icon-192.png','logos/icon-512.png','logos/icon-maskable-512.png'
]);
const generatedPrefixes=['vendor/onnxruntime/','models/all-minilm-l6-v2/onnx/'];
const generatedFiles=new Set(['models/all-minilm-l6-v2/config.json','models/all-minilm-l6-v2/tokenizer_config.json','models/all-minilm-l6-v2/vocab.txt']);
const screenIds=['home','weave','progress','library','living-school','cerbanimo','fellowfare','anarchadia','settings','downloads','chat-weaveling','chat-moss','chat-kamiya','chat-rook','chat-merlin','recovery'];
const forbiddenNames=/(repair|fix(?:es)?|hardening|regression|orchestrator|return-guard|fullscreen|installed-entry|working-campus|family-shell|shared-guide|guide-workspace|saved-chat|local-chat|platform-stability|runtime-stability).*[-_.]v\d+/i;
const forbiddenRuntimeTokens=['MutationObserver','visualViewport','networkRepair(','source.replace(','materialize-canonical-release','releases/{VERSION}','civweave-pocket-campus.cwseed','Civweave-Mobile-Install-Kit.zip'];
const modelWarmDependency=/semantic-router(?:\.js)?|\bprewarm\s*(?:\(|=)|\.warm\s*\(/i;
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
async function walk(dir,prefix=''){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const rel=prefix?`${prefix}/${entry.name}`:entry.name,full=path.join(dir,entry.name);if(entry.isDirectory())out.push(...await walk(full,rel));else out.push(rel)}return out.sort()}
async function text(relative){return readFile(path.join(root,relative),'utf8')}

const publicFiles=await walk(path.join(root,'public'));
for(const relative of publicFiles){if(relative==='index.html'||relative==='service-worker.js'||relative.startsWith('app/'))continue;throw new Error(`Non-canonical public production file survived cleanup: public/${relative}`)}
const appFiles=await walk(app);
for(const file of requiredApp)assert(appFiles.includes(file),`Canonical app file missing: public/app/${file}`);
for(const file of appFiles){if(requiredApp.has(file)||generatedFiles.has(file)||generatedPrefixes.some(prefix=>file.startsWith(prefix)))continue;throw new Error(`Dead or unclassified app file survived cleanup: public/app/${file}`)}
for(const file of appFiles)assert(!forbiddenNames.test(file),`Versioned fixer/injector filename survived: public/app/${file}`);

const routes=await text('public/app/routes.js');
for(const id of screenIds)assert(routes.includes(`id: '${id}'`),`Canonical screen '${id}' missing from routes.js`);
assert((routes.match(/id: '/g)||[]).length===16,`Expected exactly 16 canonical screen records; found ${(routes.match(/id: '/g)||[]).length}`);

const canonicalSource=['public/app/campus.html','public/app/campus.js','public/app/chat.html','public/app/chat.js','public/app/settings.html','public/app/settings.js','public/app/downloads.html','public/app/downloads.js','public/app/realm.js','public/app/customization-loader.js','public/app/merlin-customization.js','public/app/semantic-router.js','public/app/recovery/index.html','public/app/recovery/recovery.js','public/service-worker.js','server/runtime.mjs'];
for(const file of canonicalSource){const source=await text(file);for(const token of forbiddenRuntimeTokens)assert(!source.includes(token),`${file} contains forbidden production-rewrite token: ${token}`)}

const chat=(await text('public/app/chat.html'))+(await text('public/app/chat.js'));
const settings=(await text('public/app/settings.html'))+(await text('public/app/settings.js'));
for(const [name,source] of [['Chat',chat],['Settings',settings]]){
  assert(!modelWarmDependency.test(source),`${name} regained a model warm/prewarm dependency`);
  assert(!/createElement\(['"]script|appendChild\(.*script|document\.head\.append\(.*script/i.test(source),`${name} dynamically injects scripts`);
}
assert((await text('public/app/campus.html')).includes('/app/semantic-router.js'),'Campus no longer owns independent MiniLM idle warm-up');
assert((await text('public/app/semantic-router.js')).includes('independent of Chat and Settings'),'MiniLM independence contract missing');

const customization=await text('public/app/customization-loader.js');
const recovery=(await text('public/app/recovery/index.html'))+(await text('public/app/recovery/recovery.js'));
assert(customization.includes('LAST_GOOD_KEY')&&customization.includes('previous-boot-did-not-stabilize'),'Merlin customization lost one-step crash rollback');
assert(!recovery.includes('customization-loader.js')&&!recovery.includes('civweave-model-runtime.js'),'Recovery Merlin is not isolated from the main app runtime');
assert(recovery.includes('Production Civweave source is deliberately unavailable'),'Recovery boundary language missing');

const sw=await text('public/service-worker.js');
assert(sw.includes("APP_CACHE='civweave-app-current'"),'Service worker is not using the single current cache');
assert(!/release|seed|cwseed|\.zip|repair|self.?heal/i.test(sw),'Service worker contains release/archive/repair machinery');
const server=await text('server/runtime.mjs');
assert(!/releases[/\\]|runtimePath|sourcePath|source\.replace|\.civweave-[^'"`\s]+\.mjs/i.test(server),'Server still performs runtime source materialization or historical release selection');

const pkg=JSON.parse(await text('package.json'));
assert(pkg.scripts?.start==='node server/runtime.mjs','npm start does not execute the direct stable server');
for(const command of Object.values(pkg.scripts||{}))assert(!/materialize|release-coherence|release:materialize|build-install-artifacts|working-campus|chat-fullscreen/i.test(command),'package.json still invokes a retired source/release/fixer workflow');
assert(Object.keys(pkg.dependencies||{}).length===1&&pkg.dependencies['onnxruntime-web']==='1.27.0','Production dependency set is not the pinned single ONNX runtime dependency');

const agents=await text('AGENTS.md');
const vow='I will NEVER AGAIN write a realtime code hotswapping system to bugfix.';
assert(agents.split(vow).length-1===5,'AGENTS.md must contain the anti-hotswap vow exactly five times');
assert(!await stat(path.join(root,'releases')).then(()=>true).catch(()=>false),'Tracked releases/ source shadow directory still exists');
const wholeRepo=await walk(root);
for(const file of wholeRepo){if(file.startsWith('.git/')||file.startsWith('node_modules/'))continue;assert(!/\.(cwseed|seed|zip)$/i.test(file),`Tracked code/archive artifact is forbidden: ${file}`)}

console.log(JSON.stringify({ok:true,canonicalScreens:16,trackedPublicFiles:publicFiles.length,trackedAppFiles:appFiles.length,miniLM:'campus-idle-only',chatGenerativeStartup:'submit-only',settingsGenerativeStartup:'explicit-test-only',peerAiRouting:true,merlinCustomization:'isolated-user-layer-with-one-step-rollback',historicalRuntimeSelection:false,realtimeBugfixHotSwap:false},null,2));
