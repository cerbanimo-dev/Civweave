'use strict';
importScripts('/service-worker.js?v=1.0.4-base-r38-deterministic');
const INLINE_CHAT_REVISION='inline-commonweave-r43-deterministic-default';
const EXTENSION_VERSION='working-campus-additions-v176-system-nav-buttons';
const SETTINGS_CONTROLLER_REVISION='deterministic-single-authority-v175';
const SETTINGS_RUNTIME_REVISION='unified-ai-settings-v175';
const DETERMINISTIC_RUNTIME_REVISION='deterministic-default-v175';
const GEMINI_TRANSPORT_REVISION='gemini-interactions-v159';
const DEVICE_CREDENTIALS_REVISION='device-credentials-v160.1-settings-stable';
const PROOF_COMPATIBLE_EXTENSION_REVISION='working-campus-additions-v158-proof-progress';
const LIVE_SOURCE_PROOF_REVISION='antigravity-live-source-proof-v167';
const EXTENSION_CACHE='cwext-working-campus-additions-v176-system-nav-buttons';
const TOOL_FILES=[
  '/extensions/commonweave-additions-v156.css',
  '/extensions/commonweave-additions-v156.js',
  '/extensions/commonweave-secure-vault-v156.js',
  '/extensions/commonweave-domain-bridge-v156.js',
  '/extensions/commonweave-qr-v156.js',
  '/extensions/commonweave-mesh-tools-v156.js',
  '/extensions/commonweave-device-credentials-v160.js',
  '/extensions/commonweave-proof-progress-v158.js',
  '/extensions/commonweave-gemini-interactions-v159.js',
  '/extensions/commonweave-antigravity-live-source-guard-v167.js'
];
const APP_FILES=[
  '/app/platform-stability-v159.js','/app/platform-stability-v159.css',
  '/app/platform-experience-v160.js','/app/platform-experience-v160.css',
  '/app/action-followthrough-v165.js','/app/merlinites-shell-fix-v166.css',
  '/app/mobile-regression-v170.css','/app/mobile-regression-v170.js','/app/local-rails-validator-v170.js',
  '/app/cerbanimo-ai-validator-v159.js','/app/cerbanimo-proof-attachments-v165.js',
  '/app/rook-request-flow-v160.js','/app/merlinites-semantic-planner-v164.js','/app/pwa-v130.js','/app/system-interface-v157.css',
  '/app/cabinets/living-school/living-school-two-agent-relay-v165.js',
  '/app/cabinets/living-school/living-school-workbench-v158.css','/app/cabinets/living-school/living-school-workbench-v158.js',
  '/app/cabinets/living-school/living-school-research-v162.js',
  '/app/cabinets/living-school/living-school-runtime-stability-v159.css','/app/cabinets/living-school/living-school-runtime-stability-v159.js',
  '/app/cabinets/living-school/living-school-paths-v160.js',
  '/app/anarchadia-console-v158.js','/app/anarchadia-chat-stability-v158.css','/app/anarchadia-runtime-stability-v159.js','/app/anarchadia-change-review-v165.js','/app/anarchadia-live-layout-v167.js',
  '/app/assets/navigation/system-buttons/anarchadia-ai.png',
  '/app/assets/navigation/system-buttons/commonweave-cw.png',
  '/app/assets/navigation/system-buttons/living-school-ls.png',
  '/app/assets/navigation/system-buttons/cerbanimo-co.png',
  '/app/assets/navigation/system-buttons/fellowfare-ff.png'
];
const EXTENSION_FILES=[...TOOL_FILES,...APP_FILES];
async function fetchRequired(url){const response=await fetch(`${url}${url.includes('?')?'&':'?'}v=${EXTENSION_VERSION}`,{cache:'no-store',headers:{'x-commonweave-package':'install'}});if(!response.ok)throw new Error(`Package asset ${url} returned ${response.status}`);return response}
async function cacheExtensions(){const cache=await caches.open(EXTENSION_CACHE);for(const url of EXTENSION_FILES)await cache.put(url,(await fetchRequired(url)).clone());return true}
async function extensionStatus(){const cache=await caches.open(EXTENSION_CACHE),keys=await cache.keys(),present=new Set(keys.map(request=>new URL(request.url).pathname)),missing=EXTENSION_FILES.filter(url=>!present.has(url));return{type:'COMMONWEAVE_ADDITIONS_STATUS',version:EXTENSION_VERSION,settingsControllerRevision:SETTINGS_CONTROLLER_REVISION,settingsRuntimeRevision:SETTINGS_RUNTIME_REVISION,deterministicRuntimeRevision:DETERMINISTIC_RUNTIME_REVISION,geminiTransportRevision:GEMINI_TRANSPORT_REVISION,deviceCredentialsRevision:DEVICE_CREDENTIALS_REVISION,proofCompatibleRevision:PROOF_COMPATIBLE_EXTENSION_REVISION,liveSourceProofRevision:LIVE_SOURCE_PROOF_REVISION,inlineChatRevision:INLINE_CHAT_REVISION,defaultProvider:'deterministic',transformerActive:false,cache:EXTENSION_CACHE,ready:missing.length===0,assetCount:EXTENSION_FILES.length,presentCount:EXTENSION_FILES.length-missing.length,toolFiles:TOOL_FILES.length,applicationFiles:APP_FILES.length,missing}}
self.addEventListener('install',event=>event.waitUntil(cacheExtensions()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(name=>name.startsWith('cwext-')&&name!==EXTENSION_CACHE).map(name=>caches.delete(name))))));
self.addEventListener('message',event=>{if(event.data?.type==='GET_ADDITIONS_STATUS')event.waitUntil(extensionStatus().then(packet=>{event.ports?.[0]?.postMessage(packet);event.source?.postMessage?.(packet)}))});
self.addEventListener('fetch',event=>{const request=event.request;if(!['GET','HEAD'].includes(request.method))return;const url=new URL(request.url);if(url.origin!==self.location.origin||!url.pathname.startsWith('/extensions/'))return;event.respondWith(caches.open(EXTENSION_CACHE).then(async cache=>{const cached=await cache.match(url.pathname,{ignoreSearch:true});if(cached)return request.method==='HEAD'?new Response(null,{status:cached.status,statusText:cached.statusText,headers:cached.headers}):cached;try{const response=await fetch(request);if(response.ok)await cache.put(url.pathname,response.clone());return response}catch{return new Response('Commonweave additive tool is not installed.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}})}}))});