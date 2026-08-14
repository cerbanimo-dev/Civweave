(()=>{
'use strict';
const MANIFEST_URL='/legal/civweave-legal-release-v1.json';
const RECORD_KEY='civweave.legal.terms.acceptance.v1';
const SCHEMA='civweave.legal-consent.v1';
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
function readRecord(){try{return JSON.parse(localStorage.getItem(RECORD_KEY)||'null')}catch{return null}}
function writeRecord(record){localStorage.setItem(RECORD_KEY,JSON.stringify(record))}
async function manifest(){
  const response=await fetch(`${MANIFEST_URL}?legal=${Date.now()}`,{cache:'no-store'});
  if(!response.ok)throw new Error(`Legal release manifest returned HTTP ${response.status}.`);
  const value=await response.json();
  if(value?.schema!=='civweave.legal-release.v1')throw new Error('Legal release manifest is invalid.');
  return value;
}
function acceptedFor(value){const record=readRecord();return record?.schema===SCHEMA&&record?.method==='clickwrap'&&record?.termsVersion===value.termsVersion&&record?.termsUrl===value.termsUrl&&Boolean(record?.acceptedAt)}
function modal(value){
  return new Promise((resolve,reject)=>{
    const root=document.createElement('div');
    root.id='civweave-legal-consent-v1';
    root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','cw-legal-title');
    root.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:max(20px,env(safe-area-inset-top)) 18px max(20px,env(safe-area-inset-bottom));background:#041018f7;color:#f5fbff;font:16px/1.45 system-ui,sans-serif';
    const card=document.createElement('section');card.style.cssText='width:min(100%,540px);max-height:calc(100dvh - 40px);overflow:auto;padding:22px;border:1px solid #8de5ef55;border-radius:20px;background:#0b1b25;box-shadow:0 24px 80px #000b';
    const terms=new URL(value.termsUrl,location.origin).href;
    const privacy=value.privacyUrl?new URL(value.privacyUrl,location.origin).href:'';
    const standards=value.communityStandardsUrl?new URL(value.communityStandardsUrl,location.origin).href:'';
    card.innerHTML=`<h1 id="cw-legal-title" style="margin:0 0 10px;font-size:1.4rem">Before entering Civweave</h1><p style="color:#bed0da">Please review the current Terms${privacy?' and Privacy Policy':''}. Acceptance is required for this release and is stored on this device for offline launches.</p><p><a href="${terms}" target="_blank" rel="noopener" style="color:#8de5ef;font-weight:800">Read Terms of Service</a>${privacy?` · <a href="${privacy}" target="_blank" rel="noopener" style="color:#8de5ef">Privacy Policy</a>`:''}${standards?` · <a href="${standards}" target="_blank" rel="noopener" style="color:#8de5ef">Community Standards</a>`:''}</p><label style="display:flex;gap:12px;align-items:flex-start;padding:14px 0"><input id="cw-legal-check" type="checkbox" style="width:22px;height:22px;margin-top:2px"><span>I have reviewed and agree to the Terms of Service, version <strong>${clean(value.termsVersion,80)}</strong>.</span></label><button id="cw-legal-continue" type="button" disabled style="width:100%;min-height:48px;border:0;border-radius:14px;background:#8de5ef;color:#061019;font:inherit;font-weight:900;cursor:pointer;opacity:.55">Agree and continue</button><p id="cw-legal-error" hidden style="color:#ffb2a8;margin-bottom:0"></p>`;
    root.append(card);document.body.append(root);
    const checkbox=card.querySelector('#cw-legal-check'),button=card.querySelector('#cw-legal-continue'),error=card.querySelector('#cw-legal-error');
    checkbox.addEventListener('change',()=>{button.disabled=!checkbox.checked;button.style.opacity=checkbox.checked?'1':'.55'});
    button.addEventListener('click',()=>{
      if(!checkbox.checked)return;
      const record=Object.freeze({schema:SCHEMA,method:'clickwrap',acceptedAt:new Date().toISOString(),termsVersion:value.termsVersion,termsUrl:value.termsUrl,platform:navigator.userAgentData?.platform||navigator.platform||'web'});
      try{writeRecord(record);if(!acceptedFor(value))throw new Error('Acceptance could not be persisted on this device.');root.remove();resolve(record)}catch(cause){error.hidden=false;error.textContent='Civweave could not save the required acceptance on this device. Storage must be available before continuing.';reject(cause)}
    });
    checkbox.focus();
  });
}
async function ensureConsent(){
  let value;
  try{value=await manifest()}catch(error){
    const cached=readRecord();
    if(cached?.schema===SCHEMA&&cached?.acceptedAt&&cached?.termsVersion&&cached?.termsUrl)return Object.freeze({required:true,offline:true,record:cached});
    throw error;
  }
  if(value.status!=='final'||value.enforcement!=='required')return Object.freeze({required:false,status:value.status||'unknown',enforcement:value.enforcement||'disabled'});
  if(!clean(value.termsVersion,80)||!clean(value.termsUrl,1000))throw new Error('Final legal enforcement is missing a Terms version or URL.');
  if(acceptedFor(value))return Object.freeze({required:true,accepted:true,record:readRecord()});
  return Object.freeze({required:true,accepted:true,record:await modal(value)});
}
globalThis.CivweaveLegalConsentV1=Object.freeze({schema:SCHEMA,manifestUrl:MANIFEST_URL,recordKey:RECORD_KEY,readRecord,ensureConsent});
})();
