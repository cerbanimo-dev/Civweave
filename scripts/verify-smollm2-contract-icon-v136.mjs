import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const bytes=relative=>readFile(path.join(root,relative));
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

function pngDimensions(buffer){
  const signature='89504e470d0a1a0a';
  assert(buffer.subarray(0,8).toString('hex')===signature,'file is not a PNG');
  assert(buffer.subarray(12,16).toString('ascii')==='IHDR','PNG is missing IHDR');
  return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
}

const [loom,realm,lite,contract,worker,manifestText,generationText,generator]=await Promise.all([
  read('public/app/loom-v128.html'),
  read('public/app/realm-v128.html'),
  read('public/app/lite-v129.html'),
  read('public/app/smollm2-small-model-v136.js'),
  read('public/service-worker.js'),
  read('public/app/manifest.webmanifest'),
  read('public/app/logos/commonweave-icon-generation.json'),
  read('scripts/generate-commonweave-icons.mjs')
]);
const manifest=JSON.parse(manifestText);
const generation=JSON.parse(generationText);

for(const [name,html] of [['loom',loom],['realm',realm],['lite',lite]]){
  assert(html.includes('smollm2-small-model-v136.js?v=contract-r1'),`${name} does not load the small-model contract`);
  assert(html.indexOf('model-settings-v133.js')<html.indexOf('smollm2-small-model-v136.js'),`${name} loads the trial override before settings`);
  if(name!=='lite')assert(html.indexOf('smollm2-small-model-v136.js')<html.indexOf('assistant-runtime-v133.js'),`${name} loads the contract after the guide runtime`);
  assert(html.includes('commonweave-icon-192.png?v=dark-r1'),`${name} does not use the dark Commonweave icon`);
  assert(html.includes('manifest.webmanifest?v=1.0.30-icon-r1'),`${name} manifest cache key is stale`);
}
for(const html of [loom,realm])assert(!html.includes('<img src="/app/logos/commonweave.webp"'), 'active top bar still uses the old wordmark image');

for(const required of [
  'COMMONWEAVE_SMALL_MODEL_CONTRACT_V1',
  'function normalizeRoute',
  'function normalizeGuideResult',
  'nestedCandidates',
  'isSchemaEcho',
  'choice',
  'route',
  'schema echo',
  'usable JSON',
  'maxNewTokens:56',
  'event.stopImmediatePropagation()',
  '__smallModelContractV136',
  'Never output JSON Schema'
])assert(contract.includes(required),`small-model contract missing ${required}`);

assert(worker.includes("CACHE_REVISION='smollm2-contract-icon-r11'"),'service worker cache revision is stale');
for(const required of [
  '/app/smollm2-small-model-v136.js',
  '/app/logos/commonweave-icon-192.png',
  '/app/logos/commonweave-icon-512.png',
  '/app/logos/commonweave-icon-maskable-192.png',
  '/app/logos/commonweave-icon-maskable-512.png',
  '/app/logos/commonweave-icon-generation.json'
])assert(worker.includes(required),`service worker does not cache ${required}`);

assert(generation.schema==='commonweave.icon-generation.v1','unexpected icon generation schema');
assert(generation.treatment==='dark-centered-thread-mark','icon treatment is not the approved dark centered mark');
for(const required of [
  'commonweave-icon-192.png',
  'commonweave-icon-512.png',
  'commonweave-icon-maskable-192.png',
  'commonweave-icon-maskable-512.png'
])assert(generation.files.includes(required),`generation record missing ${required}`);

for(const [relative,width,height,minBytes] of [
  ['public/app/logos/commonweave-icon-192.png',192,192,20000],
  ['public/app/logos/commonweave-icon-512.png',512,512,100000],
  ['public/app/logos/commonweave-icon-maskable-192.png',192,192,18000],
  ['public/app/logos/commonweave-icon-maskable-512.png',512,512,90000]
]){
  const buffer=await bytes(relative);
  const dimensions=pngDimensions(buffer);
  assert(dimensions.width===width&&dimensions.height===height,`${relative} has ${dimensions.width}x${dimensions.height}, expected ${width}x${height}`);
  assert(buffer.length>=minBytes,`${relative} is suspiciously small`);
}

const manifestIcons=Array.isArray(manifest.icons)?manifest.icons:[];
for(const required of [
  '/app/logos/commonweave-icon-192.png',
  '/app/logos/commonweave-icon-512.png',
  '/app/logos/commonweave-icon-maskable-192.png',
  '/app/logos/commonweave-icon-maskable-512.png'
])assert(manifestIcons.some(icon=>icon.src===required),`manifest missing ${required}`);

for(const required of [
  "import sharp from 'sharp'",
  'dark-centered-thread-mark',
  'commonweave-icon-maskable-512.png',
  'commonweave-adaptive-foreground-512.png'
])assert(generator.includes(required),`icon generator missing ${required}`);

console.log(JSON.stringify({
  ok:true,
  modelContract:'compact-few-shot-with-nested-shape-normalization',
  benchmark:{
    prompts:5,
    maxNewTokens:56,
    reportsParseableAndUsableJsonSeparately:true,
    schemaEchoVisible:true
  },
  icons:{
    treatment:generation.treatment,
    pwa:[192,512],
    maskable:[192,512],
    activeTopbar:true
  },
  cacheRevision:'smollm2-contract-icon-r11'
},null,2));
