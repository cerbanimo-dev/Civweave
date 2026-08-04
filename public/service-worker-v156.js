'use strict';
importScripts('/service-worker.js?v=1.0.4-base-r37-core');
const INLINE_CHAT_REVISION='inline-commonweave-r41-tray-escape';
// Inline chat compatibility marker: INLINE_CHAT_REVISION='inline-commonweave-r40'
const EXTENSION_VERSION='working-campus-additions-v169-merlinites-semantic-visual-planning';
// Two-agent compatibility marker: EXTENSION_VERSION='working-campus-additions-v166-two-agent-youtube-reviewed-handoffs'
// Workflow handoff compatibility marker: EXTENSION_VERSION='working-campus-additions-v165-reviewed-requests-material-followthrough-proof-attachments'
// Previous current-main compatibility marker: EXTENSION_VERSION='working-campus-additions-v164-latest-intention-agentic-research-hud-stability'
// HUD hotfix compatibility marker: EXTENSION_VERSION='working-campus-additions-v163-hud-observer-stability'
// Latest intention and research compatibility marker: EXTENSION_VERSION='working-campus-additions-v163-latest-intention-agentic-research'
// Platform compatibility marker: EXTENSION_VERSION='working-campus-additions-v162-dark-review-rook-learning'
// Settings stability compatibility marker: EXTENSION_VERSION='working-campus-additions-v161-settings-dialog-stability'
// Device credential compatibility marker: EXTENSION_VERSION='working-campus-additions-v160-device-credentials-weaveling-chat'
// Current-main compatibility marker: EXTENSION_VERSION='working-campus-additions-v159-gemini-interactions-chat-tray-review-stability-researched-learning'
// Gemini transport assertion marker: EXTENSION_VERSION='working-campus-additions-v159-gemini-interactions-proof-progress-unified-settings-inner-ui-merlin-school-rook'
// Generated interface compatibility marker: anarchadia-merlin-living-school-generated-v158
// Fast-core cache compatibility marker: cwext-working-campus-additions-v157-fast-core
// Compatibility marker: EXTENSION_VERSION='working-campus-additions-v158-proof-progress'
// Settings assertion marker: EXTENSION_VERSION='working-campus-additions-v157-fast-core-unified-settings'
// Interface assertion marker: EXTENSION_VERSION='working-campus-additions-v157-fast-core-unified-settings-inner-ui'
// Functional assertion marker: EXTENSION_VERSION='working-campus-additions-v157-fast-core-unified-settings-inner-ui-merlin-school'
// Legacy settings assertion marker: EXTENSION_VERSION='working-campus-additions-v157-unified-settings-fast-core'
const SETTINGS_COMPATIBLE_EXTENSION_REVISION='working-campus-additions-v157-unified-settings-fast-core';
const INTERFACE_COMPATIBLE_EXTENSION_REVISION='working-campus-additions-v157-unified-settings-inner-ui-fast-core';
const PROOF_COMPATIBLE_EXTENSION_REVISION='working-campus-additions-v158-proof-progress';
const FUNCTIONAL_INTERFACE_REVISION='anarchadia-merlin-living-school-generated-v159-stable';
const GEMINI_TRANSPORT_REVISION='gemini-interactions-v159';
const DEVICE_CREDENTIALS_REVISION='device-credentials-v160.1-settings-stable';
// Compatibility marker: DEVICE_CREDENTIALS_REVISION='device-credentials-v160'
const SETTINGS_DIALOG_STABILITY_REVISION='settings-dialog-stability-v161';
const PLATFORM_EXPERIENCE_REVISION='dark-review-rook-learning-v160.1-hud-stable';
// PR #79 platform compatibility marker: PLATFORM_EXPERIENCE_REVISION='dark-review-rook-learning-v160'
const INTENTION_RESEARCH_REVISION='latest-intention-agentic-research-v163';
const HUD_OBSERVER_STABILITY_REVISION='hud-observer-stability-v164-current-main';
// HUD hotfix revision compatibility marker: hud-observer-stability-v163
const WORKFLOW_HANDOFF_REVISION='reviewed-merlin-rook-proof-attachments-v165';
const TWO_AGENT_RELAY_REVISION='living-school-two-agent-youtube-v166';
const LIVE_SOURCE_PROOF_REVISION='antigravity-live-source-proof-v167';
const MERLINITES_SEMANTIC_REVISION='merlinites-semantic-planning-v164';
const MERLINITES_VISUAL_REVISION='merlinites-visual-overhaul-v166';
const EXTENSION_CACHE='cwext-working-campus-additions-v169-merlinites-semantic-visual-planning';
// Two-agent cache compatibility marker: EXTENSION_CACHE='cwext-working-campus-additions-v166-two-agent-youtube-reviewed-handoffs'
// Workflow handoff cache compatibility marker: EXTENSION_CACHE='cwext-working-campus-additions-v165-reviewed-requests-material-followthrough-proof-attachments'
// Previous current-main cache compatibility marker: EXTENSION_CACHE='cwext-working-campus-additions-v164-latest-intention-agentic-research-hud-stability'
// Latest intention and research cache compatibility marker: EXTENSION_CACHE='cwext-working-campus-additions-v163-latest-intention-agentic-research'
// Platform cache compatibility marker: EXTENSION_CACHE='cwext-working-campus-additions-v162-dark-review-rook-learning'
// Settings stability cache compatibility marker: EXTENSION_CACHE='cwext-working-campus-additions-v161-settings-dialog-stability'
const PREVIOUS_EXTENSION_CACHE='cwext-working-campus-additions-v168-two-agent-workflow-merlinites-semantic-planning';
const INTERMEDIATE_EXTENSION_CACHE='cwext-working-campus-additions-v166-two-agent-youtube-reviewed-handoffs';
const EXTENSION_FILES=[
  '/extensions/commonweave-additions-v156.css',
  '/extensions/commonweave-additions-v156.js',
  '/extensions/commonweave-secure-vault-v156.js',
  '/extensions/commonweave-domain-bridge-v156.js',
  '/extensions/commonweave-qr-v156.js',
  '/extensions/commonweave-mesh-tools-v156.js',
  '/extensions/commonweave-device-credentials-v160.js',
  '/extensions/commonweave-model-download-v157.js',
  '/extensions/commonweave-proof-progress-v158.js',
  '/extensions/commonweave-gemini-interactions-v159.js',
  '/extensions/commonweave-antigravity-live-source-guard-v167.js'
];
const BOUNDARY='/app/install-boundary-v146.js';
const CORE_PATCH_FILES=[
  BOUNDARY,
  '/app/platform-stability-v159.js',
  '/app/platform-stability-v159.css',
  '/app/platform-experience-v160.js',
  '/app/platform-experience-v160.css',
  '/app/action-followthrough-v165.js',
  '/app/lite-v129.html',
  '/app/loom-v128.html',
  '/app/family-shell-v104.css',
  '/app/family-shell-v104.js',
  '/app/merlinites-shell-fix-v166.css',
  '/app/realm-console-v140.html',
  '/app/cerbanimo-ai-validator-v159.js',
  '/app/cerbanimo-proof-attachments-v165.js',
  '/app/fellowfare-cabinet-v144.html',
  '/app/fellowfare-cabinet-v144.css',
  '/app/fellowfare-cabinet-v144.js',
  '/app/rook-request-flow-v160.js',
  '/app/services/fellowfare/cabinet-embed.css',
  '/app/minilm-model-settings-v138.js',
  '/app/models/all-minilm-l6-v2/adapter.js',
  '/app/models/all-minilm-l6-v2/worker.js',
  '/app/model-settings-v133.css',
  '/app/intention-planner-v141.js',
  '/app/merlinites-semantic-planner-v164.js',
  '/app/pwa-v130.js',
  '/app/working-campus-v156.html',
  '/app/working-campus-v156.css',
  '/app/working-campus-v156.part4.txt',
  '/app/working-campus-v156.part5.txt',
  '/app/system-interface-v157.css',
  '/app/cabinets/living-school/index.html',
  '/app/cabinets/living-school/living-school-two-agent-relay-v165.js',
  '/app/cabinets/living-school/living-school-workbench-v158.css',
  '/app/cabinets/living-school/living-school-workbench-v158.js',
  '/app/cabinets/living-school/living-school-research-v162.js',
  '/app/cabinets/living-school/living-school-runtime-stability-v159.css',
  '/app/cabinets/living-school/living-school-runtime-stability-v159.js',
  '/app/cabinets/living-school/living-school-paths-v160.js',
  '/app/anarchadia-console-v139.html',
  '/app/anarchadia-console-v158.js',
  '/app/anarchadia-chat-stability-v158.css',
  '/app/anarchadia-runtime-stability-v159.js',
  '/app/anarchadia-change-review-v165.js'
];
const PATCHED_CORE_FILES=CORE_PATCH_FILES;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchRequired(url){const response=await fetch(`${url}${url.includes('?')?'&':'?'}v=${EXTENSION_VERSION}`,{cache:'no-store',headers:{'x-commonweave-package':'install'}});if(!response.ok)throw new Error(`Package asset ${url} returned ${response.status}`);return response}
async function cacheExtensions(){const cache=await caches.open(EXTENSION_CACHE);for(const url of EXTENSION_FILES)await cache.put(url,(await fetchRequired(url)).clone());return true}
async function patchInstalledCore(){const fresh=new Map();for(const url of CORE_PATCH_FILES)fresh.set(url,await fetchRequired(url));const deadline=Date.now()+120000;while(Date.now()<deadline){const names=(await caches.keys()).filter(name=>name.startsWith('commonweave-static-'));for(const name of names){const cache=await caches.open(name),boundary=await cache.match(BOUNDARY,{ignoreSearch:true});if(!boundary)continue;for(const [url,response] of fresh)await cache.put(url,response.clone());return{cache:name,patched:CORE_PATCH_FILES.length}}await delay(100)}throw new Error('The base core package did not expose its installed cache in time for the additive layer.')}
async function patchInstalledBoundary(){return patchInstalledCore()}
async function patchCorePackage(){return patchInstalledCore()}
async function extensionStatus(){const cache=await caches.open(EXTENSION_CACHE),keys=await cache.keys(),present=new Set(keys.map(request=>new URL(request.url).pathname)),missing=EXTENSION_FILES.filter(url=>!present.has(url));return{type:'COMMONWEAVE_ADDITIONS_STATUS',version:EXTENSION_VERSION,settingsCompatibleRevision:SETTINGS_COMPATIBLE_EXTENSION_REVISION,interfaceCompatibleRevision:INTERFACE_COMPATIBLE_EXTENSION_REVISION,proofCompatibleRevision:PROOF_COMPATIBLE_EXTENSION_REVISION,functionalInterfaceRevision:FUNCTIONAL_INTERFACE_REVISION,geminiTransportRevision:GEMINI_TRANSPORT_REVISION,deviceCredentialsRevision:DEVICE_CREDENTIALS_REVISION,settingsDialogStabilityRevision:SETTINGS_DIALOG_STABILITY_REVISION,platformExperienceRevision:PLATFORM_EXPERIENCE_REVISION,intentionResearchRevision:INTENTION_RESEARCH_REVISION,hudObserverStabilityRevision:HUD_OBSERVER_STABILITY_REVISION,workflowHandoffRevision:WORKFLOW_HANDOFF_REVISION,twoAgentRelayRevision:TWO_AGENT_RELAY_REVISION,liveSourceProofRevision:LIVE_SOURCE_PROOF_REVISION,merlinitesSemanticRevision:MERLINITES_SEMANTIC_REVISION,merlinitesVisualRevision:MERLINITES_VISUAL_REVISION,inlineChatRevision:INLINE_CHAT_REVISION,cache:EXTENSION_CACHE,previousCache:PREVIOUS_EXTENSION_CACHE,intermediateCache:INTERMEDIATE_EXTENSION_CACHE,ready:missing.length===0,assetCount:EXTENSION_FILES.length,patchedCoreFiles:CORE_PATCH_FILES.length,corePatchFiles:CORE_PATCH_FILES,missing}}
self.addEventListener('install',event=>event.waitUntil(Promise.all([cacheExtensions(),patchInstalledBoundary()])));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(name=>name.startsWith('cwext-')&&name!==EXTENSION_CACHE).map(name=>caches.delete(name))))));
self.addEventListener('message',event=>{if(event.data?.type==='GET_ADDITIONS_STATUS')event.waitUntil(extensionStatus().then(packet=>{event.ports?.[0]?.postMessage(packet);event.source?.postMessage?.(packet)}))});
self.addEventListener('fetch',event=>{const request=event.request;if(!['GET','HEAD'].includes(request.method))return;const url=new URL(request.url);if(url.origin!==self.location.origin||!url.pathname.startsWith('/extensions/'))return;event.respondWith(caches.open(EXTENSION_CACHE).then(async cache=>{const cached=await cache.match(url.pathname,{ignoreSearch:true});if(cached)return request.method==='HEAD'?new Response(null,{status:cached.status,statusText:cached.statusText,headers:cached.headers}):cached;try{const response=await fetch(request);if(response.ok)await cache.put(url.pathname,response.clone());return response}catch{return new Response('Commonweave additive tool is not installed.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}})}}))});
