import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const need=(ok,msg)=>{if(!ok){console.error(`::error title=Avatar expression regression::${msg}`);throw new Error(msg)}};
const D=read('public/app/avatar-expression-director-v343.js');
const F=read('public/app/shared-chat-face-icons-v255.js');
const M=JSON.parse(read('public/app/assets/ai/chat/expressions/rle-v315/manifest.json'));
const SW=read('public/service-worker-avatar-expression-v344.js');
const BUILD=read('scripts/build-service-worker-v211.mjs');
const QA=read('public/app/avatar-expression-qa-v344.html');

const expected={
  weaveling:['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','magical','hopeful'],
  moss:['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','encouraging'],
  kamiya:['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','helpful'],
  rook:['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','approving'],
  merlin:['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','magical']
};
const systemFor={weaveling:'civweave',moss:'living-school',kamiya:'cerbanimo',rook:'fellowfare',merlin:'anarchadia'};

need(M.schema==='civweave.avatar-rle-atlas.v2','atlas schema must be v2 with explicit labels');
need(M.width===160&&M.height===108&&M.cellWidth===32&&M.cellHeight===27&&M.columns===5&&M.rows===4,'atlas geometry drifted');
const visual=[];
for(const [character,labels] of Object.entries(expected)){
  const meta=M.characters?.[character];need(meta,`missing ${character} atlas metadata`);
  need(JSON.stringify(meta.expressions)===JSON.stringify(labels),`${character} expression ordering/labels drifted`);
  need(Array.isArray(meta.palette)&&meta.palette.length>1,`${character} palette missing`);
  need(Array.isArray(meta.parts)&&meta.parts.length===4,`${character} must have four atlas rows`);
  const cells=Array.from({length:20},()=>({opaque:0,minX:Infinity,minY:Infinity,maxX:-1,maxY:-1,touches:new Set()}));
  for(const part of meta.parts){
    const payload=JSON.parse(read(`public/app/assets/ai/chat/expressions/rle-v315/${part}`));
    const runs=payload.runs;need(Array.isArray(runs)&&runs.length%4===0,`${part} has malformed RLE tuples`);
    for(let i=0;i<runs.length;i+=4){
      const [pi,x,y,n]=runs.slice(i,i+4);need(Number.isInteger(pi)&&pi>=0&&pi<meta.palette.length,`${part} palette index out of range`);need(Number.isInteger(x)&&Number.isInteger(y)&&Number.isInteger(n)&&n>0,`${part} has non-integer RLE run`);need(x>=0&&y>=0&&y<M.height&&x+n<=M.width,`${part} has out-of-bounds RLE run`);
      const alpha=Number(meta.palette[pi]?.[3]??255);if(alpha<=0)continue;
      for(let dx=0;dx<n;dx++){
        const px=x+dx,cellX=Math.floor(px/M.cellWidth),cellY=Math.floor(y/M.cellHeight),index=cellY*M.columns+cellX;if(index<0||index>=cells.length)continue;
        const localX=px-cellX*M.cellWidth,localY=y-cellY*M.cellHeight,c=cells[index];c.opaque++;c.minX=Math.min(c.minX,localX);c.maxX=Math.max(c.maxX,localX);c.minY=Math.min(c.minY,localY);c.maxY=Math.max(c.maxY,localY);if(localX===0)c.touches.add('L');if(localX===M.cellWidth-1)c.touches.add('R');if(localY===0)c.touches.add('T');if(localY===M.cellHeight-1)c.touches.add('B');
      }
    }
  }
  cells.forEach((c,index)=>{const label=labels[index],density=c.opaque/(M.cellWidth*M.cellHeight);need(c.opaque>=8,`${character}/${label} is empty or nearly empty`);need(density<.97,`${character}/${label} lost transparency`);need(!(c.touches.size===4&&density>.55),`${character}/${label} looks clipped on all four cell edges`);visual.push({character,label,opaque:c.opaque,density:Number(density.toFixed(3)),bbox:[c.minX,c.minY,c.maxX,c.maxY],edgeTouches:[...c.touches].join('')||'-'});});
  const system=systemFor[character];for(const label of labels)need(D.includes(`'${label}'`),`director missing ${system}/${label}`);
}
need(visual.length===100,'visual atlas audit must cover exactly 100 guide expressions');

for(const marker of [
  "image/png","scale=4","losslessSprites:true","transparent-rle-v315-lossless-png","civweave:model-event","chat-model-crash","deterministic-sleepy","'thinking','generating'","fallback:'rules'","tinyFailures","tinyColdAvgMs","tinyWarmAvgMs","cheapPhoneIdleShutdownMs:8000","promptTokenBudget:256","maxNewTokens:4","img.animate","duration:220","★ HIGHLY RECOMMENDED","Independent cosmetic helper","installs separately","can never replace your selected chat model","chatSelectable:false","sidecarOnly:true"
])need(D.includes(marker),`director hardening marker missing: ${marker}`);
need(!D.includes("'image/webp'"),'lossy WebP sprite reconstruction must not return');
for(const marker of ['object-fit:contain','data-cw-expression-sprite="v343"','expressiveSprites:true'])need(F.includes(marker),`face layer marker missing: ${marker}`);
for(const marker of ['Desktop 1180px','Mobile 390px','api.materialize(system,expression)','lossless PNG','contain'])need(QA.includes(marker),`visual QA page marker missing: ${marker}`);
for(const marker of ['service-worker-avatar-expression-v344.js','avatar-expression-offline-v344'])need(BUILD.includes(marker),`service worker build missing ${marker}`);
for(const asset of ['/app/avatar-expression-director-v343.js','/app/shared-chat-face-icons-v255.js','/app/local-ai/worker-v266.js','/app/vendor/transformers/transformers.min.js','ort-wasm-simd-threaded.jsep.wasm','manifest.json','weaveling-row-0.json','merlin-row-3.json'])need(SW.includes(asset),`offline cache missing ${asset}`);
need(SW.includes('alreadyDownloadedTinyLMSurvivesOffline:true'),'offline TinyLM persistence contract missing');

const failures=[
  ['chat model crash',"phase==='failed'","'sleepy','chat-model-crash'"],
  ['deterministic without TinyLM',"deterministic&&!installed()","'sleepy','deterministic-sleepy'"],
  ['TinyLM unavailable rules fallback',"if(text&&installed()","'rules'"],
  ['recovery',"phase==='completed'","'recovered'"]
];
for(const [name,...markers] of failures)for(const marker of markers)need(D.includes(marker),`${name} contract missing ${marker}`);
console.log(JSON.stringify({ok:true,version:'v344',expressionsAudited:visual.length,characters:Object.keys(expected).length,failureContracts:failures.map(x=>x[0]),offlineAssets:'director + atlas + rules + worker + Transformers runtime',visualSummary:{clippingCandidates:visual.filter(v=>v.edgeTouches.length>=3),minimumOpaquePixels:Math.min(...visual.map(v=>v.opaque)),maximumDensity:Math.max(...visual.map(v=>v.density))}},null,2));
