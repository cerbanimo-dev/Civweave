const ACTIVE_KEY='civweave.customization.active';
const LAST_GOOD_KEY='civweave.customization.last-good';
const CANDIDATE_KEY='civweave.customization.candidate';
const BOOT_KEY='civweave.customization.boot';
const clean=(value,max=500000)=>String(value??'').slice(0,max);
const parse=(value,fallback=null)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const read=key=>parse(localStorage.getItem(key),null);
const write=(key,value)=>value==null?localStorage.removeItem(key):localStorage.setItem(key,JSON.stringify(value));
const now=()=>new Date().toISOString();
const uid=()=>`custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

function validateJavaScript(source){if(!clean(source).trim())return{ok:true};try{Function('CivweaveCustomization','"use strict";\n'+source);return{ok:true}}catch(error){return{ok:false,error:String(error?.message||error)}}}
function candidateFrom(form){const data=new FormData(form),js=clean(data.get('js')),check=validateJavaScript(js);if(!check.ok)throw new Error(`JavaScript syntax error: ${check.error}`);return{id:uid(),name:clean(data.get('name'),120)||'Merlin customization',css:clean(data.get('css')),js,createdAt:now(),health:'candidate'}}
function activate(candidate){if(!candidate)return false;const current=read(ACTIVE_KEY);if(current?.health==='stable'||current?.health==='rollback')write(LAST_GOOD_KEY,current);write(ACTIVE_KEY,{...candidate,activatedAt:now(),health:'starting'});write(BOOT_KEY,{state:'pending',id:candidate.id,at:now()});write(CANDIDATE_KEY,null);location.reload();return true}
function stateText(){const active=read(ACTIVE_KEY),candidate=read(CANDIDATE_KEY),last=read(LAST_GOOD_KEY),boot=read(BOOT_KEY);return [`Active: ${active?.name||'none'}${active?.health?` (${active.health})`:''}`,`Candidate: ${candidate?.name||'none'}`,`Last known good: ${last?.name||'none'}`,`Last health state: ${boot?.state||'none'}`].join('\n')}
function refresh(){const node=document.querySelector('#merlin-customization-state');if(node)node.textContent=stateText();const status=document.querySelector('#merlin-customization-status'),candidate=read(CANDIDATE_KEY);if(status&&candidate)status.innerHTML=`Candidate <b>${candidate.name.replace(/[&<>]/g,'')}</b> is staged but not executing. <button type="button" data-merlin-activate>Activate candidate</button> <button type="button" data-merlin-discard>Discard</button>`}
function bind(){
 const form=document.querySelector('#merlin-customization-form');if(form&&!form.dataset.bound){form.dataset.bound='true';form.addEventListener('submit',event=>{event.preventDefault();const status=document.querySelector('#merlin-customization-status');try{const candidate=candidateFrom(form);write(CANDIDATE_KEY,candidate);if(status)status.textContent='Candidate staged. It is not running. Review and activate it when ready.';refresh()}catch(error){if(status)status.textContent=String(error?.message||error)}})}
 refresh();
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-merlin-activate],[data-merlin-discard]');if(!button)return;if(button.hasAttribute('data-merlin-activate'))activate(read(CANDIDATE_KEY));else{write(CANDIDATE_KEY,null);refresh()}});
addEventListener('civweave:realm-rendered',event=>{if(event.detail?.system==='anarchadia'&&event.detail?.tab==='customize')bind()});
bind();
export const MerlinCustomization=Object.freeze({stage:value=>{const check=validateJavaScript(value?.js||'');if(!check.ok)throw new Error(check.error);const candidate={id:uid(),name:clean(value?.name,120)||'Merlin customization',css:clean(value?.css),js:clean(value?.js),createdAt:now(),health:'candidate'};write(CANDIDATE_KEY,candidate);refresh();return candidate},activate,active:()=>read(ACTIVE_KEY),candidate:()=>read(CANDIDATE_KEY),lastGood:()=>read(LAST_GOOD_KEY)});
