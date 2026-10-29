(()=>{
'use strict';
if(globalThis.CivweaveGuideOutcomeSceneV1)return;
const VERSION='1.2.0-new-guide-atlases';
const SIX_POSE_ATLAS=Object.freeze({grid:'300% 200%',ratio:'1',neutral:'0% 0%',brace:'50% 0%',cast:'100% 0%',dash:'0% 100%',success:'50% 100%',revision:'100% 100%'});
const GUIDES=Object.freeze({
  civweave:{name:'Weaveling',sheet:'/app/assets/ai/weaveling-review-sprites-v1.png',accent:'#8af5d2'},
  'living-school':{name:'Moss',sheet:'/app/assets/ai/moss-review-sprites-v1.png',accent:'#aeea57'},
  cerbanimo:{name:'Kamiya',sheet:'/app/assets/ai/kamiya-review-sprites-v1.png',accent:'#e85dff'},
  fellowfare:{name:'Rook',sheet:'/app/assets/ai/rook-review-sprites-v1.png',accent:'#efb452'},
  anarchadia:{name:'Merlin',sheet:'/app/assets/ai/merlin-review-sprites-v1.png',accent:'#ff3d96'}
});
const LARI='/app/assets/ai/lari-review-sprites-v1.png';
const fresh=new Set(),bound=new WeakSet();
const clean=(value,max=2000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
const ludEnabled=()=>globalThis.CivweaveLudModeV1?.isEnabled?.()===true||document.documentElement?.dataset.civweaveOperatingMode==='lud';
function markFresh(id){id=clean(id,240);if(!id)return;fresh.add(id);while(fresh.size>64)fresh.delete(fresh.values().next().value)}
function guideFor(id){if(typeof id!=='string'||!Object.hasOwn(GUIDES,id))return null;return{...SIX_POSE_ATLAS,...GUIDES[id]}}
function particles(outcome){return`<span class="cw-scene-particles" data-scene-particles="${outcome}" aria-hidden="true">${Array.from({length:12},(_,index)=>{const angle=index*Math.PI/6;return`<i style="--particle-x:${Math.round(Math.cos(angle)*72)}px;--particle-y:${Math.round(Math.sin(angle)*52)}px;--particle-delay:${(index%3)*.045}s;--particle-rotation:${index*37}deg"></i>`}).join('')}</span>`}
function render(spec={}){
  const guide=guideFor(spec.guide),receiptId=clean(spec.receiptId,240),outcome=spec.outcome;
  if(!guide||!receiptId||!['accepted','revision'].includes(outcome))return'';
  const accepted=outcome==='accepted',art=spec.art!==false&&!ludEnabled(),reduced=reducedMotion();
  const playing=art&&!reduced&&(spec.fresh===true||fresh.has(receiptId));fresh.delete(receiptId);
  const label=clean(spec.label,120)||(accepted?'Review accepted':'Another pass requested');
  const scope=clean(spec.scope,160)||'Recorded review';
  return`<section class="cw-outcome-scene" data-guide-outcome="${outcome}" data-guide="${spec.guide}" data-receipt-id="${esc(receiptId)}" data-scope="${esc(scope)}" data-playing="${playing}" data-art="${art}" style="--scene-accent:${guide.accent}" aria-label="Recorded ${guide.name} outcome"><div class="cw-outcome-copy" role="status" aria-live="polite"><small>${esc(scope)}</small><h3>${esc(label)}</h3>${spec.title?`<p class="cw-outcome-title">${esc(clean(spec.title,320))}</p>`:''}${spec.progressText?`<p>${esc(clean(spec.progressText,1200))}</p>`:''}${spec.note?`<details><summary>Review notes</summary><p class="cw-outcome-notes">${esc(clean(spec.note,2000))}</p></details>`:''}${spec.rewardText?`<strong class="cw-outcome-reward">${esc(clean(spec.rewardText,200))}</strong>`:''}</div>${art?`<div class="cw-outcome-battle" aria-hidden="true"><span class="cw-scene-name cw-friend-name">${guide.name}</span><span class="cw-guide-sprite" data-guide-sprite style="--guide-sheet:url('${guide.sheet}');--guide-grid:${guide.grid};--guide-ratio:${guide.ratio};--guide-neutral:${guide.neutral};--guide-brace:${guide.brace};--guide-cast:${guide.cast};--guide-dash:${guide.dash};--guide-result:${accepted?guide.success:guide.revision}"></span><span class="cw-evidence-shield"></span><span class="cw-spell">♡</span><span class="cw-proof-spark">${accepted?'✦':'↻'}</span>${particles(outcome)}<span class="cw-lari-sprite" data-lari-sprite style="--lari-sheet:url('${LARI}')"></span><span class="cw-scene-name cw-lari-name">Lari the Lyrebird</span><span class="cw-battle-caption">${accepted?'Evidence breaks the charm':'Strengthen the evidence. Try again.'}</span><span data-scene-clock></span></div><div class="cw-scene-controls"><button type="button" data-guide-scene-action="replay">Replay scene</button><button type="button" data-guide-scene-action="stop">Stop motion</button><button type="button" data-guide-scene-action="sound" aria-pressed="${soundEnabled}">Sound ${soundEnabled?'on':'off'}</button><small>Recorded outcome · sound is optional · animation changes no work state.</small></div>`:''}</section>`;
}
function scenes(host){if(!host)return[];return[...(host.matches?.('[data-guide-outcome]')?[host]:[]),...(host.querySelectorAll?.('[data-guide-outcome]')||[])]}
function key(node){return JSON.stringify([node.dataset.guide,node.dataset.receiptId,node.dataset.guideOutcome,node.dataset.art,node.dataset.scope])}
function preserve(previousRoot,nextRoot){const previous=new Map(scenes(previousRoot).map(node=>[key(node),node]));for(const next of scenes(nextRoot)){const prior=previous.get(key(next));if(!prior)continue;const oldCopy=prior.querySelector('.cw-outcome-copy'),newCopy=next.querySelector('.cw-outcome-copy');if(oldCopy&&newCopy&&oldCopy.innerHTML!==newCopy.innerHTML)oldCopy.replaceWith(newCopy);next.replaceWith(prior)}return nextRoot}
let soundEnabled=false,audioContext=null;
const cuePlayed=new WeakSet(),activeNotes=new Set();
function updateSoundControls(){for(const button of document.querySelectorAll('[data-guide-scene-action="sound"]')){button.setAttribute('aria-pressed',String(soundEnabled));button.textContent=`Sound ${soundEnabled?'on':'off'}`}}
function stopSound(scene){for(const record of [...activeNotes]){if(scene&&record.scene!==scene)continue;activeNotes.delete(record);try{record.oscillator.stop()}catch{}try{record.oscillator.disconnect();record.gain.disconnect()}catch{}}}
function ensureAudio(){if(audioContext)return audioContext;const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return null;try{audioContext=new Context();return audioContext}catch{return null}}
function playCue(scene){
  if(!soundEnabled||reducedMotion()||ludEnabled()||scene.dataset.art!=='true')return;
  const context=ensureAudio();if(!context)return;
  stopSound();try{context.resume?.()?.catch?.(()=>{});const accepted=scene.dataset.guideOutcome==='accepted',notes=accepted?[523.25,659.25,783.99]:[392,329.63];
    notes.forEach((frequency,index)=>{const oscillator=context.createOscillator(),gain=context.createGain(),start=context.currentTime+index*.105,duration=accepted ? .19 : .24;oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(.035,start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);oscillator.connect(gain);gain.connect(context.destination);const record={scene,oscillator,gain};activeNotes.add(record);oscillator.onended=()=>{activeNotes.delete(record);try{oscillator.disconnect();gain.disconnect()}catch{}};oscillator.start(start);oscillator.stop(start+duration+.01)});
  }catch{stopSound();soundEnabled=false;updateSoundControls()}
}
function bind(host){
  if(!host?.addEventListener)return;
  for(const scene of scenes(host)){if(scene.dataset.playing==='true'&&!cuePlayed.has(scene)){cuePlayed.add(scene);playCue(scene)}}
  if(bound.has(host))return;bound.add(host);
  host.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-guide-scene-action]');if(!button||!host.contains(button))return;const scene=button.closest('[data-guide-outcome]');if(!scene)return;
    const action=button.dataset.guideSceneAction;
    if(action==='sound'){
      if(soundEnabled){soundEnabled=false;stopSound()}else if(!reducedMotion()&&!ludEnabled()&&scene.dataset.art==='true'){soundEnabled=Boolean(ensureAudio());try{audioContext?.resume?.()?.catch?.(()=>{})}catch{soundEnabled=false}}
      updateSoundControls();
    }else if(action==='stop'||action==='replay'){
      scene.dataset.playing='false';stopSound(scene);
      if(action==='replay'&&!reducedMotion()&&!ludEnabled()&&scene.dataset.art==='true'){void scene.offsetWidth;scene.dataset.playing='true';cuePlayed.add(scene);playCue(scene)}
    }
    event.stopPropagation();
  });
  host.addEventListener('animationend',event=>{if(event.animationName!=='cw-scene-clock')return;const scene=event.target.closest?.('[data-guide-outcome]');if(scene&&host.contains(scene)){scene.dataset.playing='false';stopSound(scene)}});
}
globalThis.addEventListener?.('pagehide',()=>{stopSound();soundEnabled=false;updateSoundControls();if(audioContext){try{audioContext.close?.()?.catch?.(()=>{})}catch{}audioContext=null}});
const rewardSeen=new Set(),assetLabels=Object.freeze({'skill-xp':'Skill XP',acorn:'Acorns',button:'Buttons'});
let rewardTimer=0,rewardGroup=null;
function currentAccount(){return document.documentElement?.dataset.passportAccountId||document.body?.dataset.passportAccountId||'passport:local'}
function rewardDisplay(value,checkAccount=true){
  if(!value||typeof value!=='object')return null;
  const receiptId=clean(value.receiptId,240),accountId=clean(value.accountId,180),amount=Number(value.amount);
  if(!receiptId||!accountId||(checkAccount&&accountId!==currentAccount())||!Object.hasOwn(assetLabels,value.assetType)||!Number.isFinite(amount)||amount<=0)return null;
  return{receiptId,accountId,amount,assetType:value.assetType,sourceSystem:typeof value.sourceSystem==='string'&&Object.hasOwn(GUIDES,value.sourceSystem)?value.sourceSystem:'civweave'};
}
function dismissReward(){if(rewardTimer)clearTimeout(rewardTimer);rewardGroup?.toast.remove();rewardTimer=0;rewardGroup=null}
function showReward(value){
  const reward=rewardDisplay(value);if(!reward||rewardSeen.has(reward.receiptId)||!document.body)return false;
  rewardSeen.add(reward.receiptId);while(rewardSeen.size>128)rewardSeen.delete(rewardSeen.values().next().value);
  if(rewardTimer)clearTimeout(rewardTimer);
  if(!rewardGroup||rewardGroup.accountId!==reward.accountId||!rewardGroup.toast.isConnected){
    dismissReward();const toast=document.createElement('aside');toast.className='cw-guide-reward';toast.dataset.guideReward=reward.receiptId;toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.style.setProperty('--scene-accent',GUIDES[reward.sourceSystem].accent);
    const lud=globalThis.CivweaveLudModeV1?.isEnabled?.()===true||document.documentElement.dataset.civweaveOperatingMode==='lud';
    toast.innerHTML=`${lud?'':`<span class="cw-reward-emblem" aria-hidden="true">✦</span>`}<div><strong></strong><small>Saved to your local ledger</small></div><button type="button" aria-label="Dismiss reward">×</button>`;
    toast.querySelector('button').addEventListener('click',dismissReward);document.body.append(toast);rewardGroup={toast,accountId:reward.accountId,totals:Object.create(null)};
  }
  const totals=rewardGroup.totals;totals[reward.assetType]=(totals[reward.assetType]||0)+reward.amount;
  rewardGroup.toast.querySelector('strong').textContent=Object.keys(assetLabels).filter(asset=>totals[asset]).map(asset=>`+${new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(totals[asset])} ${assetLabels[asset]}`).join(' · ');
  rewardTimer=setTimeout(dismissReward,10000);return true;
}
function onReward(event){
  const detail=event.detail;if(detail?.reason!=='append'||detail.persisted!==true)return;
  const value=rewardDisplay(detail.grantDelta,false);if(!value)return;
  try{const host=globalThis.parent;if(host!==globalThis&&host.location.origin===globalThis.location.origin&&host.CivweavePersistentSystemShellV1&&host.document.getElementById('cw-persistent-system-stage')?.contentWindow===globalThis&&host.CivweaveGuideOutcomeSceneV1){host.CivweaveGuideOutcomeSceneV1.showReward(value);return}}catch{}
  showReward(value);
}
globalThis.addEventListener?.('civweave:canonical-rewards-changed',onReward);
globalThis.CivweaveGuideOutcomeSceneV1=Object.freeze({version:VERSION,render,bind,preserve,markFresh,guideFor,showReward});
})();
