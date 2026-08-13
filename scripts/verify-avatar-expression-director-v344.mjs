import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),read=p=>fs.readFileSync(path.join(root,p),'utf8'),fail=[];
const need=(ok,msg)=>{if(!ok)fail.push(msg)};
const D=read('public/app/avatar-expression-director-v343.js'),F=read('public/app/shared-chat-face-icons-v255.js'),M=JSON.parse(read('public/app/assets/ai/chat/expressions/rle-v315/manifest.json')),SW=read('public/service-worker-avatar-expression-v344.js'),BUILD=read('scripts/build-service-worker-v211.mjs'),QA=read('public/app/avatar-expression-qa-v344.html'),N=read('public/app/avatar-rle-row-normalizer-v344.js');
const expected={weaveling:['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','magical','hopeful'],moss:['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','encouraging'],kamiya:['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','helpful'],rook:['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','approving'],merlin:['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','magical']};
need(M.schema==='civweave.avatar-rle-atlas.v2','atlas schema is not v2');
need(M.width===160&&M.height===108&&M.cellWidth===32&&M.cellHeight===27&&M.columns===5&&M.rows===4,'atlas geometry drifted');
const visual=[];
for(const [character,labels] of Object.entries(expected)){
  const meta=M.characters?.[character];need(meta,`missing ${character}`);if(!meta)continue;
  need(JSON.stringify(meta.expressions)===JSON.stringify(labels),`${character} pose labels/order drifted`);need(meta.parts?.length===4,`${character} must have four row files`);
  const cells=Array.from({length:20},()=>({opaque:0,minX:99,minY:99,maxX:-1,maxY:-1,edges:new Set()}));
  for(let partIndex=0;partIndex<meta.parts.length;partIndex++){
    const part=meta.parts[partIndex],p=JSON.parse(read(`public/app/assets/ai/chat/expressions/rle-v315/${part}`)),row=Number.isInteger(p.row)?p.row:partIndex,r=p.runs||[];
    need(row===partIndex,`${part} row label ${row} != ${partIndex}`);need(r.length%4===0,`${part} malformed tuple count`);
    for(let i=0;i+3<r.length;i+=4){const [pi,x,y,n]=r.slice(i,i+4),gy=y+row*M.cellHeight;need(Number.isInteger(pi)&&pi>=0&&pi<meta.palette.length,`${part} palette index out of range`);need(Number.isInteger(x)&&Number.isInteger(y)&&Number.isInteger(n)&&n>0,`${part} non-integer run`);need(x>=0&&x+n<=M.width&&y>=0&&y<M.cellHeight&&gy<M.height,`${part} row-local run out of bounds`);if((meta.palette[pi]?.[3]??255)<=0)continue;for(let dx=0;dx<n;dx++){const px=x+dx,cx=Math.floor(px/M.cellWidth),cy=Math.floor(gy/M.cellHeight),idx=cy*M.columns+cx;if(idx<0||idx>=20)continue;const lx=px-cx*M.cellWidth,ly=gy-cy*M.cellHeight,c=cells[idx];c.opaque++;c.minX=Math.min(c.minX,lx);c.maxX=Math.max(c.maxX,lx);c.minY=Math.min(c.minY,ly);c.maxY=Math.max(c.maxY,ly);if(lx===0)c.edges.add('L');if(lx===M.cellWidth-1)c.edges.add('R');if(ly===0)c.edges.add('T');if(ly===M.cellHeight-1)c.edges.add('B')}}
  }
  cells.forEach((c,i)=>{const density=c.opaque/(M.cellWidth*M.cellHeight),label=labels[i];need(c.opaque>=8,`${character}/${label} empty after row reconstruction`);need(density<.97,`${character}/${label} transparency lost`);need(!(c.edges.size===4&&density>.55),`${character}/${label} likely clipped`);visual.push({character,label,opaque:c.opaque,density:+density.toFixed(3),edges:[...c.edges].join('')||'-'})});
}
need(visual.length===100,'expected exactly 100 source expressions');
for(const m of ["image/png","scale=4","losslessSprites:true","transparent-rle-v315-lossless-png","civweave:model-event","chat-model-crash","deterministic-sleepy","'thinking','generating'","fallback:'rules'","tinyColdAvgMs","tinyWarmAvgMs","cheapPhoneIdleShutdownMs:8000","promptTokenBudget:256","maxNewTokens:4","★ HIGHLY RECOMMENDED","Independent cosmetic helper","installs separately","can never replace your selected chat model","chatSelectable:false","sidecarOnly:true"])need(D.includes(m),`director missing ${m}`);
need(!D.includes("'image/webp'"),'lossy WebP reconstruction returned');
for(const m of ['object-fit:contain','data-cw-expression-sprite="v343"','expressiveSprites:true'])need(F.includes(m),`face layer missing ${m}`);
for(const m of ['Desktop 1180px','Mobile 390px','api.materialize(system,expression)','lossless PNG','Failure states'])need(QA.includes(m),`QA page missing ${m}`);
for(const m of ["rowHeight:27","runs[i+2]+=dy","sourceCoordinateSpace:'row-local'","outputCoordinateSpace:'atlas-global-v344'"])need(N.includes(m),`row normalizer missing ${m}`);
for(const m of ["payload.row*27","runs[i+2]+=dy","rleCoordinateSpace:'atlas-global-v344'","alreadyDownloadedTinyLMSurvivesOffline:true","/app/avatar-rle-row-normalizer-v344.js"])need(SW.includes(m),`offline cache missing ${m}`);
need(BUILD.includes('service-worker-avatar-expression-v344.js'),'service-worker build does not import avatar offline layer');
for(const [name,...markers] of [['chat crash',"phase==='failed'","'sleepy','chat-model-crash'"],['deterministic sleepy',"deterministic&&!installed()","'sleepy','deterministic-sleepy'"],['rules fallback',"if(text&&installed())","'rules'"],['recovery',"phase==='completed'","'recovered'"]])for(const m of markers)need(D.includes(m),`${name} missing ${m}`);
const result={ok:fail.length===0,version:'v344',characters:5,expressionsAudited:visual.length,sourceCoordinateSpace:'row-local',runtimeCoordinateSpace:'atlas-global-v344',failures:fail,clippingCandidates:visual.filter(x=>x.edges.length>=3),minimumOpaquePixels:Math.min(...visual.map(x=>x.opaque)),maximumDensity:Math.max(...visual.map(x=>x.density))};
fs.writeFileSync(path.join(root,'avatar-expression-audit.json'),JSON.stringify(result,null,2));
if(fail.length){for(const msg of fail)console.error(`::error title=Avatar expression regression::${msg}`);console.error(JSON.stringify(result,null,2));process.exit(1)}
console.log(JSON.stringify(result,null,2));
