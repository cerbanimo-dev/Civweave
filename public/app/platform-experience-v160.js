(()=>{
'use strict';
const VERSION='1.0.4-platform-experience-v160.2-owner-clean';
if(globalThis.CivweavePlatformExperienceV160?.version===VERSION)return;
const THEME_KEY='civweave.appearance.v160';
const ACTION_KEY='civweave.realm-actions.v141';
const INTENTION_KEY='civweave.intentions.v127';
const THEMES=['system','dark','light'];
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const list=key=>{const value=parse(localStorage.getItem(key),[]);return Array.isArray(value)?value:[]};
const diagnostics={observerCallbacks:0,patchRuns:0,domWrites:0};
let observer=null,patchQueued=false,patching=false,refreshTimer=0,booted=false;
function theme(){const value=localStorage.getItem(THEME_KEY);return THEMES.includes(value)?value:'system'}
function resolved(value=theme()){if(value!=='system')return value;return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
function writeText(node,value){if(!node)return false;const next=String(value??'');if(node.textContent===next)return false;node.textContent=next;diagnostics.domWrites+=1;return true}
function writeTitle(node,value){if(!node)return false;const next=String(value??'');if(node.title===next)return false;node.title=next;diagnostics.domWrites+=1;return true}
function writeHidden(node,value){if(!node)return false;const next=Boolean(value);if(node.hidden===next)return false;node.hidden=next;diagnostics.domWrites+=1;return true}
function writeClass(node,name,enabled){if(!node?.classList)return false;const has=node.classList.contains(name);if(has===Boolean(enabled))return false;node.classList.toggle(name,Boolean(enabled));diagnostics.domWrites+=1;return true}
function syncFrame(frame){
  try{
    const doc=frame.contentDocument;if(!doc?.documentElement)return;
    const selected=theme(),mode=resolved(selected);
    if(doc.documentElement.dataset.civweaveTheme!==selected){doc.documentElement.dataset.civweaveTheme=selected;diagnostics.domWrites+=1}
    if(doc.documentElement.dataset.civweaveResolvedTheme!==mode){doc.documentElement.dataset.civweaveResolvedTheme=mode;diagnostics.domWrites+=1}
    if(doc.documentElement.style.colorScheme!==mode){doc.documentElement.style.colorScheme=mode;diagnostics.domWrites+=1}
    if(!doc.querySelector('link[data-cw160-frame-theme]')){const link=doc.createElement('link');link.rel='stylesheet';link.href='/app/platform-experience-v160.css?v=1.0.107-go-live-v300';link.dataset.cw160FrameTheme='';doc.head?.append(link);diagnostics.domWrites+=1}
  }catch{}
}
function bindFrame(frame){if(!frame)return;if(frame.dataset.cw160ThemeBound!=='true'){frame.dataset.cw160ThemeBound='true';frame.addEventListener('load',()=>syncFrame(frame))}syncFrame(frame)}
function syncFrames(root=document){if(root?.matches?.('iframe'))bindFrame(root);root?.querySelectorAll?.('iframe')?.forEach(bindFrame)}
function applyTheme(value=theme(),persist=false){
  const selected=THEMES.includes(value)?value:'system';
  if(persist&&localStorage.getItem(THEME_KEY)!==selected)localStorage.setItem(THEME_KEY,selected);
  const mode=resolved(selected),root=document.documentElement;
  if(root.dataset.civweaveTheme!==selected){root.dataset.civweaveTheme=selected;diagnostics.domWrites+=1}
  if(root.dataset.civweaveResolvedTheme!==mode){root.dataset.civweaveResolvedTheme=mode;diagnostics.domWrites+=1}
  if(root.style.colorScheme!==mode){root.style.colorScheme=mode;diagnostics.domWrites+=1}
  const meta=document.querySelector('meta[name="theme-color"]'),color=mode==='dark'?'#071018':'#f3efe6';
  if(meta&&meta.content!==color){meta.content=color;diagnostics.domWrites+=1}
  refreshControls();syncFrames();
  try{dispatchEvent(new CustomEvent('civweave:appearance-changed',{detail:{theme:selected,resolved:mode}}))}catch{}
  return selected;
}
function cycleTheme(){const current=theme(),next=THEMES[(THEMES.indexOf(current)+1)%THEMES.length];return applyTheme(next,true)}
function pending(){
  const actions=list(ACTION_KEY).filter(item=>['draft','clarifying','review','funding'].includes(item?.state));
  const intentions=list(INTENTION_KEY).filter(item=>item?.kind==='weave-plan'&&(item.state==='review'||item.plan?.state==='review'));
  return[...actions.map(item=>({type:'action',id:item.id,title:item.title,at:item.updatedAt||item.createdAt,state:item.state,system:item.system})),...intentions.map(item=>({type:'intention',id:item.id,title:item.title||item.plan?.title||'Review weave',at:item.updatedAt||item.createdAt,state:'review',system:'civweave'}))].sort((a,b)=>(Date.parse(b.at||0)||0)-(Date.parse(a.at||0)||0));
}
async function openLatest(){const item=pending()[0];if(!item)return;await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();if(item.type==='action')globalThis.CivweaveActionUI?.open?.(item.id);else globalThis.CivweaveIntentionUI?.open?.(item.id)}
function controlHost(){return document.getElementById?.('cwf104-head')||document.querySelector?.('.top')||null}
function makeControl(kind){
  const button=document.createElement('button');button.type='button';
  if(kind==='review'){
    button.dataset.cw160Review='';const label=document.createElement('span'),count=document.createElement('b'),title=document.createElement('small');label.dataset.cw160ReviewLabel='';count.dataset.cw160ReviewCount='';title.dataset.cw160ReviewTitle='';button.append(label,count,title);button.addEventListener('click',()=>openLatest().catch(()=>{}));
  }else{button.dataset.cw160Theme='';button.addEventListener('click',cycleTheme)}
  return button;
}
function ensureControls(){const head=controlHost();if(!head)return false;let changed=false;if(!head.querySelector('[data-cw160-review]')){head.append(makeControl('review'));diagnostics.domWrites+=1;changed=true}if(!head.querySelector('[data-cw160-theme]')){head.append(makeControl('theme'));diagnostics.domWrites+=1;changed=true}refreshControls(head);return changed}
function refreshControls(host=controlHost()){
  if(!host)return;const items=pending(),review=host.querySelector('[data-cw160-review]'),appearance=host.querySelector('[data-cw160-theme]');
  if(review){const label=review.querySelector('[data-cw160-review-label]'),count=review.querySelector('[data-cw160-review-count]'),title=review.querySelector('[data-cw160-review-title]');writeText(label,'Review');writeText(count,items.length?String(items.length):'');writeText(title,items[0]?.title||'');writeHidden(review,!items.length);writeClass(review,'is-attention',Boolean(items.length));writeTitle(review,items[0]?.title||'')}
  if(appearance){const value=theme(),label=`Theme: ${value[0].toUpperCase()+value.slice(1)}`;writeText(appearance,label);const aria=`Appearance is ${value}. Activate to switch theme.`;if(appearance.getAttribute?.('aria-label')!==aria){appearance.setAttribute?.('aria-label',aria);diagnostics.domWrites+=1}}
}
function relevantMutation(records){const needsHost=!controlHost();return records.some(record=>[...(record.addedNodes||[])].some(node=>{if(node?.nodeType!==1)return false;if(node.matches?.('iframe')||node.querySelector?.('iframe'))return true;if(needsHost&&(node.matches?.('#cwf104-head,.top')||node.querySelector?.('#cwf104-head,.top')))return true;return false}))}
function observe(){if(!document.documentElement)return;if(!observer)observer=new MutationObserver(records=>{diagnostics.observerCallbacks+=1;if(relevantMutation(records))queuePatch()});observer.observe(document.documentElement,{childList:true,subtree:true})}
function patchDom(){patchQueued=false;if(patching)return;patching=true;diagnostics.patchRuns+=1;observer?.disconnect?.();try{ensureControls();syncFrames()}finally{patching=false;observe()}}
function queuePatch(){if(patchQueued||patching)return;patchQueued=true;queueMicrotask(patchDom)}
function boot(){
  if(!booted){
    booted=true;
    addEventListener('storage',event=>{if(![THEME_KEY,ACTION_KEY,INTENTION_KEY].includes(event.key))return;if(event.key===THEME_KEY)applyTheme();else refreshControls()});
    addEventListener('civweave:actions-changed',()=>refreshControls());
    addEventListener('civweave:intentions-changed',()=>refreshControls());
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(theme()==='system')applyTheme()});
    clearInterval(refreshTimer);refreshTimer=setInterval(()=>refreshControls(),15000);
  }
  applyTheme();patchDom();
}
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
globalThis.CivweavePlatformExperienceV160={version:VERSION,theme,applyTheme,cycleTheme,pending,openLatest,refreshControls,diagnostics,ownership:'appearance-and-review-hud-only',assistantPatching:false,contractPatching:false};
})();