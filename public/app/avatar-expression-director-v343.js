(()=>{'use strict';
const V='1.2.0-avatar-expression-director-v344-hardening';
const SEM='/app/minilm-context-router-v344.js?v=1.1.0-avatar-hardening';
const ATLAS='/app/assets/ai/chat/expressions/atlas-v344';
const ROOT='cw-persistent-guide-chat-v215',SHARED='cw-shared-guide-surface-v236',PANEL='cw-local-ai-v266',ROW='cw-avatar-minilm-v344';
if(globalThis.CivweaveAvatarExpressionDirectorV343?.version===V)return;
const SYS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const GUIDE={civweave:'Weaveling','living-school':'Moss',cerbanimo:'Kamiya',fellowfare:'Rook',anarchadia:'Merlin'};
const CHAR={civweave:'weaveling','living-school':'moss',cerbanimo:'kamiya',fellowfare:'rook',anarchadia:'merlin'};
const EX={
  civweave:['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','magical','hopeful'],
  'living-school':['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','encouraging'],
  cerbanimo:['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','helpful'],
  fellowfare:['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','approving'],
  anarchadia:['neutral','happy','excited','laughing','curious','thinking','confused','surprised','worried','sad','crying','shy','determined','proud','mischievous','sleepy','cheering','waving','pointing','magical']
};
Object.values(EX).forEach(Object.freeze);Object.freeze(EX);
const state=new Map(SYS.map(s=>[s,{expression:'neutral',source:'default',text:'',holdUntil:0,context:null,failed:false}]));
const atlases=new Map(),spriteP=new Map(),sprites=new Map(),pending=new Map(),timers=new Map();
const perf={bootAt:performance.now(),readyAt:0,spriteMs:[],ruleMs:[],semanticMs:[],coldWarmMs:[],semanticAttempts:0,semanticHits:0,semanticFallbacks:0,modelFailures:0,recoveries:0,lastMemory:null,lastProfile:null};
let manP=null,obs=null,semanticP=null,miniLMAvailable=null,statusFlight=null;
const clean=(x,n=4000)=>String(x??'').replace(/\s+/g,' ').trim().slice(0,n);
const sys=x=>SYS.includes(String(x||''))?String(x):'civweave';
const now=()=>performance.now();
const cheapPhone=()=>Boolean((Number(navigator.deviceMemory||0)&&navigator.deviceMemory<=4)||(Number(navigator.hardwareConcurrency||0)&&navigator.hardwareConcurrency<=4));
function memorySample(){const m=performance?.memory;perf.lastMemory=m?{usedJSHeapSize:Number(m.usedJSHeapSize||0),totalJSHeapSize:Number(m.totalJSHeapSize||0),jsHeapSizeLimit:Number(m.jsHeapSizeLimit||0)}:null;return perf.lastMemory}
function semantic(){
  if(globalThis.CivweaveContextRouterV344)return Promise.resolve(globalThis.CivweaveContextRouterV344);
  if(semanticP)return semanticP;
  semanticP=new Promise(resolve=>{
    const existing=[...document.scripts].find(s=>String(s.src||'').includes('/app/minilm-context-router-v344.js'));
    if(existing){
      if(globalThis.CivweaveContextRouterV344)return resolve(globalThis.CivweaveContextRouterV344);
      existing.addEventListener('load',()=>resolve(globalThis.CivweaveContextRouterV344||null),{once:true});
      existing.addEventListener('error',()=>resolve(null),{once:true});return;
    }
    const s=document.createElement('script');s.src=SEM;s.async=true;s.dataset.cwMinilmContext='v344';
    s.onload=()=>resolve(globalThis.CivweaveContextRouterV344||null);s.onerror=()=>resolve(null);document.head?.append(s);
  });
  return semanticP
}
function norm(s,x){
  s=sys(s);x=clean(x,60).toLowerCase().replace(/[^a-z-]/g,'');
  if(EX[s].includes(x))return x;
  const a={
    joy:'happy',joyful:'happy',enthusiastic:'excited',celebrating:'cheering',surprise:'surprised',concerned:'worried',
    pensive:'thinking',thoughtful:'thinking',questioning:'curious',uncertain:'confused',confident:'proud',playful:'mischievous',
    supportive:s==='living-school'?'encouraging':s==='cerbanimo'?'helpful':s==='fellowfare'?'approving':'happy',
    approval:'approving',wonder:s==='anarchadia'||s==='civweave'?'magical':'happy'
  }[x];
  if(a&&EX[s].includes(a))return a;
  if(x==='crying')return EX[s].includes('crying')?'crying':'sad';
  if(x==='hopeful')return EX[s].includes('hopeful')?'hopeful':'happy';
  if(x==='magical')return EX[s].includes('magical')?'magical':'excited';
  return'neutral'
}
const key=(s,e)=>`${sys(s)}:${norm(s,e)}`,assetFor=(s,e='neutral')=>sprites.get(key(s,e))||'';
async function manifest(){
  if(!manP)manP=fetch(`${ATLAS}/manifest.json`,{cache:'force-cache'}).then(r=>{
    if(!r.ok)throw Error(`avatar atlas manifest HTTP ${r.status}`);return r.json()
  }).catch(e=>{manP=null;throw e});
  return manP
}
function bytes(b64){const raw=atob(String(b64||'')),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
function decodeRow(payload,palette,width,rowHeight){
  if(payload?.encoding!=='uvarint-run-index-b64-v1')throw Error('unsupported avatar row encoding');
  const data=bytes(payload.data),out=new Uint8ClampedArray(width*rowHeight*4);let p=0,pixel=0;
  while(p<data.length&&pixel<width*rowHeight){
    let shift=0,len=0,b=0;do{if(p>=data.length)throw Error('truncated avatar row varint');b=data[p++];len|=(b&127)<<shift;shift+=7}while(b&128);
    if(p>=data.length)throw Error('truncated avatar row palette index');const index=data[p++],c=palette[index];if(!c)throw Error(`avatar palette index ${index} missing`);
    if(len<1||pixel+len>width*rowHeight)throw Error('avatar row run out of bounds');
    for(let i=0;i<len;i++,pixel++){const a=pixel*4;out[a]=c[0]||0;out[a+1]=c[1]||0;out[a+2]=c[2]||0;out[a+3]=c[3]??255}
  }
  if(pixel!==width*rowHeight)throw Error(`avatar row decoded ${pixel}/${width*rowHeight} pixels`);
  return out
}
async function atlas(s){
  s=sys(s);if(atlases.has(s))return atlases.get(s);
  const p=(async()=>{
    const m=await manifest(),meta=m.characters?.[CHAR[s]];if(!meta?.parts?.length)throw Error(`missing avatar atlas ${s}`);
    const W=+m.width||320,H=+m.height||216,rh=+m.cellHeight||54,c=document.createElement('canvas');c.width=W;c.height=H;
    const x=c.getContext('2d',{alpha:true});if(!x)throw Error('avatar canvas unavailable');const image=x.createImageData(W,H);
    for(let row=0;row<meta.parts.length;row++){
      const response=await fetch(`${ATLAS}/${meta.parts[row]}`,{cache:'force-cache'});if(!response.ok)throw Error(`avatar atlas part HTTP ${response.status}`);
      const payload=await response.json();if(payload.row!==row)throw Error(`avatar row label mismatch ${payload.row}/${row}`);
      const rgba=decodeRow(payload,meta.palette||[],W,rh);image.data.set(rgba,row*W*rh*4)
    }
    x.putImageData(image,0,0);return{m,meta,image:c}
  })().catch(e=>{atlases.delete(s);throw e});atlases.set(s,p);return p
}
async function sprite(s,e='neutral'){
  s=sys(s);e=norm(s,e);const K=key(s,e);
  if(sprites.has(K))return sprites.get(K);if(spriteP.has(K))return spriteP.get(K);
  const started=now();
  const p=(async()=>{
    const{m,image}=await atlas(s),i=Math.max(0,EX[s].indexOf(e)),cw=+m.cellWidth||64,ch=+m.cellHeight||54,cols=+m.columns||5,scale=2;
    const c=document.createElement('canvas');c.width=cw*scale;c.height=ch*scale;
    const x=c.getContext('2d',{alpha:true});if(!x)throw Error('avatar sprite canvas unavailable');
    x.clearRect(0,0,c.width,c.height);x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';
    x.drawImage(image,(i%cols)*cw,Math.floor(i/cols)*ch,cw,ch,0,0,c.width,c.height);
    const u=await new Promise(resolve=>c.toBlob?c.toBlob(b=>resolve(b?URL.createObjectURL(b):c.toDataURL('image/png')),'image/png'):resolve(c.toDataURL('image/png')));
    sprites.set(K,u);return u
  })().finally(()=>{
    spriteP.delete(K);const ms=now()-started;perf.spriteMs.push(ms);if(perf.spriteMs.length>120)perf.spriteMs.shift();memorySample()
  });
  spriteP.set(K,p);return p
}
function release(){
  for(const u of sprites.values())if(/^blob:/.test(u))try{URL.revokeObjectURL(u)}catch{}
  sprites.clear();spriteP.clear();atlases.clear();manP=null
}
function emit(d){
  dispatchEvent(new CustomEvent('civweave:emotion-context',{detail:d.context||d}));
  dispatchEvent(new CustomEvent('civweave:avatar-expression',{detail:d}));
  return d
}
function publish(s,e,source,text='',context=null,{force=false,holdMs=null}={}){
  s=sys(s);e=norm(s,e);const old=state.get(s)||{},stamp=Date.now(),urgent=['worried','sad','crying','confused','sleepy'].includes(e);
  if(!force&&e!==old.expression&&stamp<Number(old.holdUntil||0)&&!urgent)return null;
  const hold=Number.isFinite(holdMs)?holdMs:(source==='thinking'?1050:source==='minilm'?1600:1250);
  const failed=source==='chat-model-crash'||source==='deterministic-sleepy';
  const next={expression:e,source,text,context,holdUntil:stamp+hold,failed};state.set(s,next);
  const d={version:V,system:s,character:GUIDE[s],expression:e,source,modelId:source==='minilm'?'Xenova/all-MiniLM-L6-v2':null,asset:assetFor(s,e),assetEncoding:'transparent-indexed-rle-v344-high-fidelity',context,updatedAt:stamp,minimumHoldMs:hold};
  if(old.expression!==e||old.source!==source||old.text!==text||force)emit(d);
  if(!d.asset)void sprite(s,e).then(asset=>{
    const cur=state.get(s);if(cur?.expression!==e||cur?.source!==source||cur?.text!==text)return;
    emit({...d,asset,assetMaterialized:true,updatedAt:Date.now()})
  }).catch(error=>dispatchEvent(new CustomEvent('civweave:avatar-expression-asset-fallback',{detail:{version:V,system:s,expression:e,message:String(error?.message||error)}})));
  return d
}
function localRule(text,s){
  s=sys(s);const t=clean(text).toLowerCase(),hit=re=>re.test(t);let e='neutral';if(!t)return e;
  if(hit(/\b(cry|crying|tears|heartbreak|grief|mourning)\b/))e='crying';
  else if(hit(/\b(sad|sorry|unfortunately|disappoint|regret|loss)\b/))e='sad';
  else if(hit(/\b(warn|careful|risk|danger|unsafe|concern|worry|problem|issue|failure|crash|broken)\b/))e='worried';
  else if(hit(/\b(confus|unclear|ambiguous|not sure|uncertain|cannot tell)\b/))e='confused';
  else if(hit(/\b(surpris|unexpected|suddenly|wow)\b/)||/!{2,}/.test(t))e='surprised';
  else if(hit(/\b(lol|haha|funny|hilarious|laugh)\b/))e='laughing';
  else if(hit(/\b(celebrat|victory|we did it|nailed it|hooray)\b/))e='cheering';
  else if(hit(/\b(excited|amazing|fantastic|excellent|awesome|love this|brilliant)\b/))e='excited';
  else if(hit(/\b(consider|think|reason|evaluate|compare|tradeoff|inspect|analyz|weigh)\b/))e='thinking';
  else if(hit(/\b(curious|wonder|what if|how might)\b/)||/\?$/.test(t))e='curious';
  else if(hit(/\b(determined|next step|build|ship it|fix this|make it happen)\b/))e='determined';
  else if(hit(/\b(proud|well done|great work|achievement)\b/))e='proud';
  else if(hit(/\b(playful|wink|clever little|teasing)\b/))e='mischievous';
  else if(hit(/\b(shy|bashful|embarrass|blush)\b/))e='shy';
  else if(hit(/\b(sleep|sleepy|rest|tired|nap)\b/))e='sleepy';
  else if(hit(/\b(wave|hello|welcome back|greetings)\b/))e='waving';
  else if(hit(/\b(point|look here|this way|open the|tap the|choose the)\b/))e='pointing';
  else if(hit(/\b(magic|magical|wizard|spell|sparkle|conjure|alchemy)\b/))e='magical';
  else if(hit(/\b(hope|possible|imagine|transform|spark)\b/))e=s==='civweave'?'hopeful':'happy';
  else if(hit(/\b(happy|glad|great|good news|nice|success)\b/))e='happy';
  if(s==='living-school'&&hit(/\b(keep going|practice|try again|you can|encourag)\b/))e='encouraging';
  if(s==='cerbanimo'&&hit(/\b(help|here's how|tool|build step|implementation)\b/))e='helpful';
  if(s==='fellowfare'&&hit(/\b(fair|good deal|approved|solid offer|value)\b/))e='approving';
  if(s==='anarchadia'&&hit(/\b(spell|wizard|ritual|alchemy|conjure)\b/))e='magical';
  return norm(s,e)
}
function ruleExpression(text,s){
  const started=now(),api=globalThis.CivweaveContextRouterV344,ctx=api?.fallbackEmotion?.(text,s),value=norm(s,ctx?.expression||ctx?.primary||localRule(text,s));
  perf.ruleMs.push(now()-started);if(perf.ruleMs.length>120)perf.ruleMs.shift();return value
}
async function refreshMiniLMStatus(){
  if(statusFlight)return statusFlight;
  statusFlight=(async()=>{
    const api=await semantic();if(!api?.packageStatus){miniLMAvailable=false;return false}
    try{const status=await api.packageStatus();miniLMAvailable=Boolean(status?.available);return miniLMAvailable}catch{miniLMAvailable=false;return false}
  })().finally(()=>{statusFlight=null});
  return statusFlight
}
async function refine(s,text,userText,stamp){
  const api=await semantic();if(!api?.emotion)return;
  perf.semanticAttempts+=1;
  const available=miniLMAvailable===true||await refreshMiniLMStatus();
  if(!available){perf.semanticFallbacks+=1;return}
  const before=api.status?.()||{},cold=!before.ready;
  if(cold&&api.warm){
    const start=now();const ok=await api.warm();perf.coldWarmMs.push(now()-start);if(!ok){perf.semanticFallbacks+=1;return}
  }
  const start=now(),context=await api.emotion(text,{system:s,userText});const elapsed=now()-start;
  perf.semanticMs.push(elapsed);if(perf.semanticMs.length>120)perf.semanticMs.shift();
  if(pending.get(s)!==stamp||!context)return;
  const current=state.get(s);if(current?.text!==text||current?.failed)return;
  const e=norm(s,context.expression||context.primary);
  if(context.source==='minilm'&&Number(context.confidence||0)>=.52){perf.semanticHits+=1;publish(s,e,'minilm',text,context)}
  else perf.semanticFallbacks+=1;
  memorySample()
}
function classify(text,{system='civweave',userText='',phase='response',useSemantic=true}={}){
  system=sys(system);text=clean(text);
  if(phase==='thinking')return publish(system,'thinking','thinking',text,{schema:'civweave.emotion-context.v1',system,primary:'thinking',expression:'thinking',source:'lifecycle',confidence:1,updatedAt:Date.now()},{force:true});
  const stamp=`${system}:${Date.now()}:${text}`;pending.set(system,stamp);
  const d=publish(system,ruleExpression(text,system),'rules',text,null);
  if(text&&useSemantic)void refine(system,text,clean(userText,700),stamp);
  return d
}
function deterministic(){try{return globalThis.CivweaveDeterministicModeV175?.currentProvider?.()==='deterministic'}catch{return false}}
function lifecycle(detail={}){
  const s=sys(detail.system||detail.systemId||pageSystem()),phase=clean(detail.phase||detail.status,40).toLowerCase(),text=clean(detail.text||detail.response||detail.output||''),isDet=detail.deterministic??deterministic(),available=detail.semanticAvailable??miniLMAvailable;
  if(['failed','error','crashed','crash'].includes(phase)){perf.modelFailures+=1;return publish(s,'sleepy','chat-model-crash','',{schema:'civweave.emotion-context.v1',system:s,primary:'sleepy',expression:'sleepy',source:'chat-model-crash',confidence:1,updatedAt:Date.now()},{force:true,holdMs:1400})}
  if(['connecting','generating','partial','background','streaming'].includes(phase)){
    if(isDet&&available===false)return publish(s,'sleepy','deterministic-sleepy','',{schema:'civweave.emotion-context.v1',system:s,primary:'sleepy',expression:'sleepy',source:'deterministic-sleepy',confidence:1,updatedAt:Date.now()},{force:true,holdMs:1200});
    return publish(s,'thinking','thinking','',{schema:'civweave.emotion-context.v1',system:s,primary:'thinking',expression:'thinking',source:'lifecycle',confidence:1,updatedAt:Date.now()},{force:true,holdMs:1050})
  }
  if(['completed','complete','done','success','recovered'].includes(phase)){
    perf.recoveries+=1;
    if(text)return classify(text,{system:s,userText:detail.userText||'',useSemantic:true});
    return publish(s,'neutral','recovered','',{schema:'civweave.emotion-context.v1',system:s,primary:'neutral',expression:'neutral',source:'recovered',confidence:1,updatedAt:Date.now()},{force:true,holdMs:900})
  }
  return null
}
function pageSystem(){const a=document.getElementById(ROOT),b=document.getElementById(SHARED);return sys(a?.dataset.guide||b?.dataset.system||a?.dataset.pageSystem||document.documentElement.dataset.civweaveSystemRoute)}
function read(root){
  const rows=Array.from(root?.querySelectorAll?.('[data-log] article,[data-cwsg-log] article')||[]).slice(-14);let a='',u='',thinking=false;
  for(const r of rows){const role=String(r.dataset.role||r.dataset.messageRole||'').toLowerCase(),t=clean(r.querySelector('p')?.textContent||r.textContent);if(!t)continue;if(r.classList.contains('cw-ai-pending')||r.dataset.pending==='true')thinking=true;if(role==='user'||/^you\b/i.test(clean(r.querySelector('b')?.textContent,40)))u=t;else a=t}
  return{a,u,thinking}
}
function scanRoot(root){
  if(!root)return;const s=sys(root.id===SHARED?root.dataset.system:root.dataset.guide||root.dataset.pageSystem||pageSystem()),q=read(root);
  if(q.thinking){lifecycle({system:s,phase:'generating'});return}
  if(!q.a)return;
  const K=`${s}:${q.a}`;if(pending.get(s)===K&&state.get(s)?.text===q.a)return;
  pending.set(s,K);clearTimeout(timers.get(s));timers.set(s,setTimeout(()=>{if(pending.get(s)===K)classify(q.a,{system:s,userText:q.u})},650))
}
function scan(){scanRoot(document.getElementById(SHARED));scanRoot(document.getElementById(ROOT))}
function ensureInstallRow(){
  const panel=document.getElementById(PANEL);if(!panel)return false;
  let row=document.getElementById(ROW);
  if(!row){
    row=document.createElement('section');row.id=ROW;row.dataset.cwAvatarMiniLM='v344';
    row.style.cssText='margin:12px 0;padding:12px;border:1px solid #ffffff26;border-radius:12px;background:#ffffff08;display:grid;gap:7px';
    const title=document.createElement('strong');title.textContent='★ HIGHLY RECOMMENDED · MiniLM Guide Expressions';
    const copy=document.createElement('p');copy.textContent='Powers expressive Weaveling, Moss, Kamiya, Rook, and Merlin avatars and the central context router. Installs independently from chat models, is never chat-selectable, and can never replace your selected chat model.';
    copy.style.cssText='margin:0;line-height:1.4';
    const status=document.createElement('small');status.dataset.cwAvatarMiniLMStatus='1';status.textContent='Checking independent helper…';
    const button=document.createElement('button');button.type='button';button.textContent='Install MiniLM helper independently';button.dataset.cwAvatarMiniLMInstall='1';
    button.addEventListener('click',async()=>{
      button.disabled=true;status.textContent='Installing MiniLM helper…';
      try{
        const api=await semantic();if(!api?.install)throw Error('MiniLM installer is unavailable.');
        await api.install({onProgress:p=>{status.textContent=`Installing MiniLM helper… ${p?.completed??0}/${p?.total??''}`}});
        miniLMAvailable=true;status.textContent='Installed independently · expressive avatars enabled';button.textContent='MiniLM helper installed'
      }catch(error){status.textContent=`Install failed: ${clean(error?.message||error,180)}`;button.disabled=false}
    });
    row.append(title,copy,status,button);
    const first=panel.querySelector('[data-model-id],section,article');first?.before(row)||panel.append(row)
  }
  void refreshMiniLMStatus().then(ok=>{
    const status=row.querySelector('[data-cw-avatar-minilm-status]'),button=row.querySelector('[data-cw-avatar-minilm-install]');
    if(status)status.textContent=ok?'Installed independently · expressive avatars enabled':'Not installed · deterministic expression rules remain available';
    if(button){button.disabled=ok;button.textContent=ok?'MiniLM helper installed':'Install MiniLM helper independently'}
  });
  return true
}
function perfSnapshot(){
  const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10:null;
  return{version:V,cheapPhone:cheapPhone(),startupMs:perf.readyAt?Math.round((perf.readyAt-perf.bootAt)*10)/10:null,spriteReconstructionAvgMs:avg(perf.spriteMs),rulesAvgMs:avg(perf.ruleMs),miniLMColdWarmAvgMs:avg(perf.coldWarmMs),miniLMWarmClassificationAvgMs:avg(perf.semanticMs),semanticAttempts:perf.semanticAttempts,semanticHits:perf.semanticHits,semanticFallbacks:perf.semanticFallbacks,modelFailures:perf.modelFailures,recoveries:perf.recoveries,atlasTransportBytesExpected:470465,sourceCell:'64x54',materializedSprite:'128x108',highFidelitySprites:true,memory:memorySample(),semanticWorkerBudget:globalThis.CivweaveContextRouterV344?.performance?.()?.workerIdleBudgetMs||null,batteryProxy:'classifier duty cycle + worker idle budget; no Battery Status API dependency'}
}
async function profile({iterations=4}={}){
  const before=memorySample(),spriteStart=now();for(const s of SYS)await sprite(s,'neutral');const spriteBatchMs=now()-spriteStart;
  const api=await semantic(),available=await refreshMiniLMStatus();let coldMs=null,warm=[];
  if(available&&api?.warm&&api?.emotion){
    const status=api.status?.()||{};if(!status.ready){const t=now();await api.warm();coldMs=now()-t}
    for(let i=0;i<Math.max(1,Math.min(8,iterations));i++){const t=now();await api.emotion('Great, the fix is working and the next step is clear.',{system:'civweave',userText:'test'});warm.push(now()-t)}
  }
  const after=memorySample(),result={...perfSnapshot(),spriteBatchMs:Math.round(spriteBatchMs*10)/10,coldStartMs:coldMs==null?null:Math.round(coldMs*10)/10,warmSamplesMs:warm.map(x=>Math.round(x*10)/10),memoryBefore:before,memoryAfter:after};
  perf.lastProfile=result;return result
}
function start(){
  void semantic();void refreshMiniLMStatus();obs=new MutationObserver(()=>{queueMicrotask(scan);queueMicrotask(ensureInstallRow)});obs.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  ['civweave:guide-workspace-state','civweave:realm-guide-thread-changed','civweave:chat-single-owner-ready','civweave:model-settings-opened'].forEach(n=>addEventListener(n,()=>{queueMicrotask(scan);queueMicrotask(ensureInstallRow)}));
  addEventListener('civweave:avatar-direct-text',e=>classify(e.detail?.text||'',{system:e.detail?.system||pageSystem(),userText:e.detail?.userText||'',phase:e.detail?.phase||'response'}));
  addEventListener('civweave:chat-model-failed',e=>lifecycle({...e.detail,phase:'failed'}));
  addEventListener('civweave:model-event',e=>lifecycle(e.detail||{}));
  addEventListener('civweave:local-model-downloaded',()=>void refreshMiniLMStatus());
  addEventListener('civweave:local-model-removed',()=>void refreshMiniLMStatus());
  addEventListener('pagehide',()=>{release();obs?.disconnect()},{once:true});
  queueMicrotask(scan);queueMicrotask(ensureInstallRow);perf.readyAt=now();
  globalThis.CivweaveAvatarExpressionDirectorV343=Object.freeze({
    version:V,modelId:null,classifierModel:'Xenova/all-MiniLM-L6-v2',expressions:EX,assetFor,materialize:sprite,classifyRules:ruleExpression,classify,lifecycle,profile,
    status:()=>({version:V,classifier:'minilm',semanticAvailable:miniLMAvailable,semanticReady:Boolean(globalThis.CivweaveContextRouterV344?.status?.().ready),smollm2ImagePicker:false}),
    performance:perfSnapshot,highFidelityIndexedRle:true,coordinateRunRleRetired:true,contextContract:'civweave.emotion-context.v1',minimumHoldMs:1250,chatModelIsolation:true
  });
  dispatchEvent(new CustomEvent('civweave:avatar-expression-director-ready',{detail:{version:V,classifier:'minilm',smollm2ImagePicker:false,coordinateRunRleRetired:true}}))
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();