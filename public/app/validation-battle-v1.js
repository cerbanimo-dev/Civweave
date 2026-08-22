(()=>{
'use strict';

const VERSION='1.0.0-validation-battle-v1';
if(globalThis.CivweaveValidationBattleV1?.version===VERSION)return;

const SEEN_KEY='civweave.validation-battle.seen.v1';
const ENABLED_KEY='civweave.validation-battle.enabled.v1';
const VALIDATION_LEDGER_KEY='civweave.validation-ledger.v1.1';
const STYLE_ID='civweave-validation-battle-v1-style';
const LOCAL_PROVIDERS=new Set(['bundled','browser','ollama','local-api','local-reflex','smollm2','packaged','reflex','minilm']);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clean=(value,max=240)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value,120).toLowerCase();
const clone=value=>{try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value))}};
const reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;

const DEFAULTS=Object.freeze({
  weaveling:Object.freeze({
    id:'weaveling',name:'Weaveling',realm:'Civweave Commons',sheet:'/Civweave-weaveling-sprites.png',grid:[5,4],cellAspect:1.2,
    animations:Object.freeze({idle:['R1C1','R1C2','R1C1'],attack:['R3C2','R3C3','R4C4','R4C5'],react:['R2C3','R2C4','R2C2'],celebrate:['R4C1','R1C3','R4C2']}),
    move:Object.freeze({id:'thread-bind',name:'Thread Bind',effect:'thread',caption:'Weaveling knots the party’s gifts into one clean line.'})
  }),
  kamiya:Object.freeze({
    id:'kamiya',name:'Kamiya',realm:'Cerbanimo',sheet:'/Cerbanimo-kamiya-sprites.png',grid:[5,4],cellAspect:1.2,
    animations:Object.freeze({idle:['R1C1','R1C2','R1C1'],attack:['R4C4','R3C3','R4C2','R3C4'],react:['R2C3','R2C4','R2C5'],celebrate:['R1C3','R3C4','R4C3']}),
    move:Object.freeze({id:'gift-delivery',name:'Gift Delivery',effect:'present',caption:'Kamiya ships the proof as a gift that lands exactly where it should.'})
  }),
  rook:Object.freeze({
    id:'rook',name:'Rook',realm:'FellowFare',sheet:'/FellowFare-rook-sprites.png',grid:[5,4],cellAspect:1.2,
    animations:Object.freeze({idle:['R1C1','R1C2','R1C5'],attack:['R4C4','R3C3','R1C3','R3C4'],react:['R2C3','R2C4','R2C5'],celebrate:['R4C2','R1C4','R4C3']}),
    move:Object.freeze({id:'fair-trade-toss',name:'Fair Trade Toss',effect:'token',caption:'Rook turns fair exchange into a bright little counterweight.'})
  }),
  moss:Object.freeze({
    id:'moss',name:'Moss',realm:'Living School',sheet:'/Living-School-moss-sprites.png',grid:[5,4],cellAspect:1.2,
    animations:Object.freeze({idle:['R1C1','R1C2','R3C2'],attack:['R3C3','R3C4','R3C5','R4C2'],react:['R2C3','R2C4','R2C5'],celebrate:['R1C3','R4C2','R4C3']}),
    move:Object.freeze({id:'acorn-ward',name:'Acorn Ward',effect:'acorn',caption:'Moss grows the lesson into a ward sturdy enough to hold.'})
  }),
  merlin:Object.freeze({
    id:'merlin',name:'Merlin',realm:'Anarchadia',sheet:'/Anarchadia-merlin-sprites.png',grid:[5,4],cellAspect:1.2,
    animations:Object.freeze({idle:['R1C1','R1C5','R2C1'],attack:['R1C5','R3C3','R3C5','R4C5','R3C4'],react:['R2C3','R2C4','R2C5'],celebrate:['R1C4','R4C2','R1C2']}),
    move:Object.freeze({id:'star-compass-beam',name:'Star Compass',effect:'beam',caption:'Merlin sights the opening and draws a star-line straight through the bluff.'})
  }),
  lari:Object.freeze({
    id:'lari',name:'Lari',aliases:['lira'],realm:'The Warlock’s Office',sheet:'/app/assets/sprites/lari-battle-atlas-v1.svg',grid:[5,4],cellAspect:1.0666667,
    animations:Object.freeze({idle:['R1C1','R1C5','R4C5'],attack:['R1C2','R1C3','R1C4','R2C3','R2C4','R4C2'],react:['R3C1','R3C2','R3C4','R3C3'],celebrate:['R4C4','R4C5','R1C5']}),
    move:Object.freeze({id:'charm-person',name:'Charm Person',effect:'charm',caption:'Lari does the one thing he actually knows how to do.'})
  })
});

const registry=new Map(Object.entries(DEFAULTS).map(([id,spec])=>[id,clone(spec)]));
let activeBattle=null;

function enabled(){
  try{return localStorage.getItem(ENABLED_KEY)!=='false'}catch{return true}
}
function setEnabled(value){try{localStorage.setItem(ENABLED_KEY,value===false?'false':'true')}catch{}return enabled()}

function registerCharacter(id,spec={}){
  const key=lower(id||spec.id);
  if(!key)throw new TypeError('Character id is required.');
  const prior=registry.get(key)||{};
  const next={...prior,...clone(spec),id:key,animations:{...(prior.animations||{}),...(spec.animations||{})},move:{...(prior.move||{}),...(spec.move||{})}};
  if(!next.sheet||!Array.isArray(next.grid)||next.grid.length!==2)throw new TypeError('Character requires sheet and [columns, rows] grid.');
  registry.set(key,next);
  return clone(next);
}

function character(id){
  const key=lower(id);
  if(registry.has(key))return registry.get(key);
  for(const spec of registry.values())if((spec.aliases||[]).map(lower).includes(key))return spec;
  return null;
}

function parseCell(value){
  const match=/^R(\d+)C(\d+)$/i.exec(String(value||''));
  return match?{row:Number(match[1]),col:Number(match[2])}:{row:1,col:1};
}
function cellPosition(spec,cell){
  const {row,col}=parseCell(cell),[cols,rows]=spec.grid;
  return{x:cols<=1?0:((col-1)/(cols-1))*100,y:rows<=1?0:((row-1)/(rows-1))*100};
}
function setFrame(actor,frame){
  const spec=actor.__cwSpec;if(!spec)return;
  const pos=cellPosition(spec,frame),node=actor.querySelector('.cw-vb-frame');if(!node)return;
  node.style.backgroundPosition=`${pos.x}% ${pos.y}%`;
  actor.dataset.frame=frame;
}
function stopActor(actor){
  if(actor?.__cwTimer){clearInterval(actor.__cwTimer);actor.__cwTimer=null}
}
function animateActor(actor,name,{loops=1,frameMs=150,hold=true}={}){
  if(!actor)return Promise.resolve();
  stopActor(actor);
  const spec=actor.__cwSpec,frames=spec?.animations?.[name]||spec?.animations?.idle||['R1C1'];
  if(reducedMotion()){setFrame(actor,frames.at(-1)||frames[0]);return Promise.resolve()}
  let index=0,cycles=0;setFrame(actor,frames[0]);
  return new Promise(resolve=>{
    actor.__cwTimer=setInterval(()=>{
      index+=1;
      if(index>=frames.length){index=0;cycles+=1;if(cycles>=loops){stopActor(actor);if(hold)setFrame(actor,frames.at(-1));resolve();return}}
      setFrame(actor,frames[index]);
    },Math.max(80,frameMs));
  });
}

function injectStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
  .cw-vb-root{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:2147482600;width:min(440px,calc(100vw - 24px));font-family:Inter,ui-rounded,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;pointer-events:none;filter:drop-shadow(0 18px 30px #0008)}
  .cw-vb-card{position:relative;overflow:hidden;border:1px solid #f7d97855;border-radius:18px;background:linear-gradient(180deg,#111a2ef5,#071018f7);box-shadow:inset 0 1px #fff2,0 0 0 1px #0008;pointer-events:auto}
  .cw-vb-stage{position:relative;height:230px;overflow:hidden;background:radial-gradient(circle at 28% 62%,#20594366,transparent 25%),radial-gradient(circle at 76% 54%,#6b274f66,transparent 26%),linear-gradient(180deg,#263755 0 45%,#172536 46% 61%,#0c151d 62%);isolation:isolate}
  .cw-vb-stage:before{content:"";position:absolute;inset:45% 0 0;background:repeating-linear-gradient(90deg,#61747718 0 2px,transparent 2px 34px),linear-gradient(#61747722,#102027bb);clip-path:polygon(0 36%,12% 29%,20% 36%,31% 20%,43% 34%,56% 18%,67% 34%,80% 22%,100% 36%,100% 100%,0 100%);z-index:-1}
  .cw-vb-head{position:absolute;left:10px;right:10px;top:9px;display:flex;justify-content:space-between;gap:8px;z-index:6;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#cfe7ff;text-shadow:0 1px 2px #000}
  .cw-vb-head span:last-child{color:#ffc3df}
  .cw-vb-actor{position:absolute;bottom:28px;width:120px;transform-origin:50% 100%;transition:filter .15s ease,opacity .2s ease;will-change:transform}
  .cw-vb-frame{width:100%;aspect-ratio:var(--cw-cell-aspect,1.2);background-image:var(--cw-sheet);background-size:calc(var(--cw-cols)*100%) calc(var(--cw-rows)*100%);background-repeat:no-repeat;background-position:0 0;filter:drop-shadow(0 5px 5px #0009)}
  .cw-vb-actor[data-id="lari"] .cw-vb-frame{border-radius:16px;box-shadow:inset 0 0 28px #03060ad9}
  .cw-vb-name{position:absolute;left:50%;bottom:-2px;transform:translateX(-50%);max-width:110px;padding:2px 7px;border-radius:999px;background:#06101ee8;border:1px solid #9bcfff44;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cw-vb-enemy .cw-vb-name{border-color:#ff76b955}
  .cw-vb-caption{min-height:58px;padding:10px 38px 10px 12px;border-top:1px solid #9bcfff33;background:linear-gradient(180deg,#08111ce8,#050a12f8);font-size:13px;line-height:1.35;color:#eaf7ff}
  .cw-vb-caption strong{color:#ffe499}
  .cw-vb-skip{position:absolute;right:8px;bottom:9px;width:26px;height:26px;padding:0;border:1px solid #fff3;border-radius:8px;background:#ffffff12;color:#fff;font:800 14px/1 system-ui;cursor:pointer}
  .cw-vb-fx{position:absolute;z-index:8;width:36px;height:36px;display:grid;place-items:center;pointer-events:none;filter:drop-shadow(0 0 8px #fff6)}
  .cw-vb-fx svg{width:100%;height:100%;overflow:visible}
  .cw-vb-hit{animation:cw-vb-hit .36s ease}
  .cw-vb-cast{animation:cw-vb-cast .42s ease}
  .cw-vb-enter{animation:cw-vb-enter .42s cubic-bezier(.2,.8,.2,1) both}
  .cw-vb-enemy.cw-vb-enter{animation-name:cw-vb-enter-enemy}
  .cw-vb-result-success{box-shadow:inset 0 0 60px #63e5a314}
  .cw-vb-result-revision,.cw-vb-result-denial{box-shadow:inset 0 0 60px #ff4d9a14}
  @keyframes cw-vb-hit{0%,100%{transform:translateX(0) rotate(0)}25%{transform:translateX(-8px) rotate(-3deg)}55%{transform:translateX(7px) rotate(3deg)}80%{transform:translateX(-3px)}}
  @keyframes cw-vb-cast{0%,100%{filter:brightness(1)}45%{filter:brightness(1.55) drop-shadow(0 0 12px #fff8)}}
  @keyframes cw-vb-enter{from{opacity:0;transform:translateX(-24px) scale(.92)}to{opacity:1;transform:translateX(0) scale(1)}}
  @keyframes cw-vb-enter-enemy{from{opacity:0;transform:translateX(24px) scale(.92)}to{opacity:1;transform:translateX(0) scale(1)}}
  @media(max-width:520px){.cw-vb-stage{height:205px}.cw-vb-actor{width:104px}.cw-vb-caption{font-size:12px}.cw-vb-root{right:8px;bottom:8px;width:calc(100vw - 16px)}}
  @media(prefers-reduced-motion:reduce){.cw-vb-root *{animation:none!important;transition:none!important}.cw-vb-fx{display:none!important}}
  `;document.head.append(style);
}

function actorNode(id,slot,total,{enemy=false}={}){
  const spec=character(id);if(!spec)throw new Error(`Unknown battle character: ${id}`);
  const actor=document.createElement('div');actor.className=`cw-vb-actor ${enemy?'cw-vb-enemy':'cw-vb-ally'} cw-vb-enter`;actor.dataset.id=spec.id;actor.__cwSpec=spec;
  actor.style.setProperty('--cw-sheet',`url("${spec.sheet}")`);actor.style.setProperty('--cw-cols',spec.grid[0]);actor.style.setProperty('--cw-rows',spec.grid[1]);actor.style.setProperty('--cw-cell-aspect',String(spec.cellAspect||1.2));
  if(enemy){actor.style.right='4%'}else{const positions=total===1?[19]:total===2?[7,29]:[2,20,38];actor.style.left=`${positions[Math.min(slot,positions.length-1)]}%`;actor.style.zIndex=String(4+slot)}
  actor.innerHTML='<div class="cw-vb-frame" aria-hidden="true"></div><div class="cw-vb-name"></div>';actor.querySelector('.cw-vb-name').textContent=spec.name;setFrame(actor,spec.animations.idle?.[0]||'R1C1');return actor;
}

function effectSvg(type){
  if(type==='present')return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="13" width="26" height="21" rx="3" fill="#2ea7d7" stroke="#ffe38c" stroke-width="2"/><path d="M20 13v21M7 21h26" stroke="#ffe38c" stroke-width="3"/><path d="M20 13c-8-1-9-7-5-8 4-1 6 4 5 8Zm0 0c8-1 9-7 5-8-4-1-6 4-5 8Z" fill="#f6c74f" stroke="#fff0ae"/></svg>`;
  if(type==='token')return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="#e7a934" stroke="#ffe7a3" stroke-width="3"/><circle cx="16" cy="15" r="2" fill="#6b4522"/><circle cx="25" cy="18" r="2" fill="#6b4522"/><circle cx="19" cy="26" r="2" fill="#6b4522"/><path d="M11 20c5-2 13-3 18 0" fill="none" stroke="#8b5d24" stroke-width="2"/></svg>`;
  if(type==='acorn')return `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M12 18c0-8 16-8 16 0-1 10-5 16-8 16s-7-6-8-16Z" fill="#b87932" stroke="#ffe1a1" stroke-width="2"/><path d="M10 18c1-7 19-7 20 0-5 3-15 3-20 0Z" fill="#5d8a3d" stroke="#bce48d" stroke-width="2"/><path d="M21 10c0-4 3-6 6-7" fill="none" stroke="#8ecb65" stroke-width="2"/></svg>`;
  if(type==='beam')return `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="m20 2 5 12 13 6-13 5-5 13-5-13-13-5 13-6Z" fill="#7eeaff" stroke="#ffe990" stroke-width="2"/><circle cx="20" cy="20" r="5" fill="#6b5cff"/></svg>`;
  if(type==='thread')return `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M4 28C11 8 26 34 36 10M4 13c10 22 21-7 32 17" fill="none" stroke="#f0a5ff" stroke-width="4" stroke-linecap="round"/><circle cx="20" cy="20" r="5" fill="#ffd86f"/></svg>`;
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 34S5 25 5 14C5 5 16 4 20 11 24 4 35 5 35 14c0 11-15 20-15 20Z" fill="#ff4da6" stroke="#ffd2e9" stroke-width="2"/></svg>`;
}

function pointInStage(stage,node){
  const s=stage.getBoundingClientRect(),r=node.getBoundingClientRect();return{x:r.left-s.left+r.width/2,y:r.top-s.top+r.height*.45};
}
async function projectile(stage,from,to,type,{duration=520,arc=34,scale=1}={}){
  if(reducedMotion())return;
  const start=pointInStage(stage,from),end=pointInStage(stage,to),fx=document.createElement('div');fx.className='cw-vb-fx';fx.innerHTML=effectSvg(type);fx.style.left=`${start.x-18}px`;fx.style.top=`${start.y-18}px`;fx.style.transform=`scale(${scale})`;stage.append(fx);
  if(fx.animate){const dx=end.x-start.x,dy=end.y-start.y;const anim=fx.animate([{transform:`translate(0,0) scale(${scale})`,opacity:0},{transform:`translate(${dx*.45}px,${dy*.45-arc}px) scale(${scale*1.12})`,opacity:1,offset:.48},{transform:`translate(${dx}px,${dy}px) scale(${scale*.8})`,opacity:1}],{duration,easing:'cubic-bezier(.22,.75,.25,1)',fill:'forwards'});await anim.finished.catch(()=>{});}else{fx.style.transition=`transform ${duration}ms ease`;requestAnimationFrame(()=>fx.style.transform=`translate(${end.x-start.x}px,${end.y-start.y}px) scale(${scale})`);await wait(duration)}
  fx.remove();to.classList.remove('cw-vb-hit');void to.offsetWidth;to.classList.add('cw-vb-hit');
}
async function charmVolley(stage,lari,target){
  const shots=reducedMotion()?0:3;
  await animateActor(lari,'attack',{loops:1,frameMs:115});
  lari.classList.add('cw-vb-cast');
  for(let i=0;i<shots;i++){projectile(stage,lari,target,'charm',{duration:460+i*35,arc:24+i*8,scale:.8+i*.1});await wait(125)}
  await wait(reducedMotion()?80:520);target.classList.remove('cw-vb-hit');void target.offsetWidth;target.classList.add('cw-vb-hit');await animateActor(target,'react',{loops:1,frameMs:145});lari.classList.remove('cw-vb-cast');
}

function hashSeed(value){let h=2166136261;for(const ch of String(value||'validation')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){
  let s=hashSeed(seed)||1;
  return()=>{
    s=(s+0x6D2B79F5)>>>0;
    let t=s;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return((t^(t>>>14))>>>0)/4294967296;
  };
}
function pickParty(seed,count=3){
  const ids=['weaveling','kamiya','rook','moss','merlin'],random=rng(seed),rest=ids.filter(id=>id!=='kamiya').sort(()=>random()-.5),n=Math.max(1,Math.min(3,count));
  return ['kamiya',...rest].slice(0,n);
}

function outcomeFrom(detail={}){
  const verdict=lower(detail.outcome||detail.decision||detail.verdict||detail.status);
  if(['verified-pass','pass','passed','accepted','approve','approved','success'].includes(verdict))return'success';
  if(['verified-fail','denied','deny','rejected','rejection','blocked'].includes(verdict))return'denial';
  if(['fail','failed','revision','revise','revision-request','changes-requested','provisional-fail'].includes(verdict))return'revision';
  return null;
}
function isExternal(detail={}){
  if(detail.external===true||detail.crossDeviceSatisfied===true)return true;
  const provider=lower(detail.provider),type=lower(detail.validatorType||detail.validator_type),relationship=lower(detail.relationship),provenance=lower(detail.provenance);
  if(provider&&LOCAL_PROVIDERS.has(provider))return false;
  if(relationship==='independent'||/cloud|human|peer|remote|external/.test(`${provider} ${type} ${provenance}`))return true;
  const rows=[...(Array.isArray(detail.contributions)?detail.contributions:[]),...(Array.isArray(detail.receipts)?detail.receipts:[])];
  return rows.some(row=>isExternal(row));
}
function readValidationLedger(){
  try{return JSON.parse(localStorage.getItem(VALIDATION_LEDGER_KEY)||'{}')||{}}catch{return{}}
}
function latestExternalThreshold(){
  const ledger=readValidationLedger(),rows=Array.isArray(ledger.thresholdReceipts)?ledger.thresholdReceipts:[];
  return rows
    .filter(row=>outcomeFrom(row)&&isExternal(row))
    .sort((a,b)=>Date.parse(b?.createdAt||0)-Date.parse(a?.createdAt||0))[0]||null;
}
async function playLatestThreshold(){
  const row=latestExternalThreshold();
  if(!row)return{played:false,reason:'no-external-threshold'};
  return playFromValidation({...row,thresholdId:row.id,external:true});
}
function seenKey(detail,outcome){return clean(detail.receiptId||detail.validationId||detail.thresholdId||detail.id||`${detail.packetId||detail.submissionId||'validation'}:${outcome}`,360)}
function hasSeen(key){try{return JSON.parse(sessionStorage.getItem(SEEN_KEY)||'[]').includes(key)}catch{return false}}
function markSeen(key){try{const prior=JSON.parse(sessionStorage.getItem(SEEN_KEY)||'[]').filter(Boolean);sessionStorage.setItem(SEEN_KEY,JSON.stringify([key,...prior.filter(row=>row!==key)].slice(0,80)))}catch{}}

function buildBattle(detail,outcome,partyIds){
  injectStyle();
  activeBattle?.remove?.();
  const root=document.createElement('aside');root.className='cw-vb-root';root.setAttribute('role','status');root.setAttribute('aria-live','polite');root.dataset.outcome=outcome;
  root.innerHTML=`<div class="cw-vb-card cw-vb-result-${outcome}"><div class="cw-vb-stage"><div class="cw-vb-head"><span>Town party · external validation</span><span>Lari · charm office</span></div></div><div class="cw-vb-caption">The verdict reaches town…</div><button class="cw-vb-skip" type="button" aria-label="Skip battle clip">×</button></div>`;
  const stage=root.querySelector('.cw-vb-stage'),caption=root.querySelector('.cw-vb-caption');
  const allies=partyIds.map((id,index)=>{const actor=actorNode(id,index,partyIds.length);stage.append(actor);return actor});
  const lari=actorNode('lari',0,1,{enemy:true});stage.append(lari);
  const destroy=()=>{allies.forEach(stopActor);stopActor(lari);root.querySelectorAll('.cw-vb-fx').forEach(node=>node.remove());root.remove();if(activeBattle===root)activeBattle=null};
  root.querySelector('.cw-vb-skip').addEventListener('click',destroy);
  document.body.append(root);activeBattle=root;
  return{root,stage,caption,allies,lari,detail,destroy};
}

async function successSequence(ctx){
  const {stage,caption,allies,lari}=ctx;
  caption.innerHTML='<strong>The beat holds.</strong> The town spots the opening in Lari’s act.';
  await Promise.all(allies.map(actor=>animateActor(actor,'idle',{loops:1,frameMs:125})));await wait(reducedMotion()?80:170);
  for(const [index,actor] of allies.entries()){
    const spec=actor.__cwSpec;caption.innerHTML=`<strong>${spec.name}:</strong> ${spec.move?.caption||'The party presses the advantage.'}`;
    const anim=animateActor(actor,'attack',{loops:1,frameMs:110});await wait(reducedMotion()?10:160);
    await projectile(stage,actor,lari,spec.move?.effect||'beam',{duration:500+index*35,arc:28+index*6,scale:index===0?1.08:.92});await anim;
    await animateActor(lari,'react',{loops:1,frameMs:95});await wait(reducedMotion()?40:100);
  }
  caption.innerHTML='<strong>External validation succeeded.</strong> Lari’s charm breaks long enough for the Quest to advance.';
  await Promise.all(allies.map(actor=>animateActor(actor,'celebrate',{loops:1,frameMs:125})));setFrame(lari,'R3C4');
}
async function revisionSequence(ctx,denial=false){
  const {stage,caption,allies,lari}=ctx,target=allies[Math.floor(rng(seenKey(ctx.detail,denial?'denial':'revision'))()*allies.length)]||allies[0];
  caption.innerHTML=denial?'<strong>The gate refuses the beat.</strong> Lari senses the hesitation.':'<strong>A revision comes back.</strong> Lari sees exactly one opening.';
  await wait(reducedMotion()?80:220);
  caption.innerHTML='<strong>Lari uses Charm Person.</strong> Of course he does.';
  await charmVolley(stage,lari,target);
  caption.innerHTML=denial?'<strong>Denied for now.</strong> The party regroups; the Quest needs a materially different move.':'<strong>Revision requested.</strong> The party shakes off the charm and marks what needs another pass.';
  await Promise.all(allies.filter(actor=>actor!==target).map(actor=>animateActor(actor,'react',{loops:1,frameMs:145})));
  await animateActor(lari,'celebrate',{loops:1,frameMs:135});
}

async function play(input={}){
  if(!enabled()||!globalThis.document?.body)return{played:false,reason:'disabled-or-no-dom'};
  const outcome=outcomeFrom(input);if(!outcome)return{played:false,reason:'no-terminal-outcome'};
  const key=seenKey(input,outcome);if(input.force!==true&&hasSeen(key))return{played:false,reason:'already-seen',key};markSeen(key);
  const partyRandom=rng(`${input.seed||key}:party`),autoPartySize=partyRandom()>.55?2:3;
  const ids=(Array.isArray(input.allies)?input.allies:pickParty(input.seed||key,input.partySize||autoPartySize)).map(id=>character(id)?.id).filter(Boolean).filter(id=>id!=='lari').slice(0,3);
  const partyIds=ids.length?ids:['kamiya'];
  const ctx=buildBattle(input,outcome,partyIds);
  try{
    if(outcome==='success')await successSequence(ctx);else await revisionSequence(ctx,outcome==='denial');
    dispatchEvent(new CustomEvent('civweave:validation-battle-played',{detail:{version:VERSION,outcome,receiptId:clean(input.receiptId),packetId:clean(input.packetId),submissionId:clean(input.submissionId),allies:partyIds}}));
    await wait(reducedMotion()?900:1800);ctx.destroy();
    return{played:true,outcome,allies:partyIds,key};
  }catch(error){ctx.destroy();throw error}
}

async function playFromValidation(detail={}){
  const outcome=outcomeFrom(detail);if(!outcome)return{played:false,reason:'not-terminal'};
  if(detail.external!==true&&!isExternal(detail))return{played:false,reason:'not-external'};
  return play({...detail,outcome,seed:detail.receiptId||detail.packetId||detail.submissionId||detail.requestId});
}

function eventHandler(event){playFromValidation(event?.detail||{}).catch(error=>console.warn('[Civweave validation battle]',error))}
addEventListener('civweave:validation-receipt-recorded',eventHandler);
addEventListener('civweave:validation-battle-request',eventHandler);
addEventListener('civweave:quest-veil-ledger-changed',()=>playLatestThreshold().catch(error=>console.warn('[Civweave validation battle threshold]',error)));
addEventListener('storage',event=>{if(event.key===VALIDATION_LEDGER_KEY)playLatestThreshold().catch(error=>console.warn('[Civweave validation battle threshold]',error))});

const api=Object.freeze({version:VERSION,enabled,setEnabled,registerCharacter,character,characters:()=>[...registry.values()].map(clone),play,playFromValidation,playLatestThreshold,outcomeFrom,isExternal,cellPosition});
globalThis.CivweaveValidationBattleV1=api;
dispatchEvent(new CustomEvent('civweave:validation-battle-ready',{detail:{version:VERSION,characters:[...registry.keys()]}}));
})();
