(()=>{
'use strict';
const VERSION='177.0-final-legacy-ai-retirement';
const PLATFORM_KEY='commonweave.platform-settings.v143';
const AI_KEY='commonweave.universal-ai.v127';
const PROFILES_KEY='commonweave-model-profiles-v1';
const DEFAULT_RELEASE_GATEWAY='https://commonweave-host-node.onrender.com';
const LEGACY_LOCAL=new Set(['','bundled','packaged','reflex','minilm','local-reflex','smollm2','browser']);
const SELECTORS=['[data-capability-form="commonweave.model-setup"]','[data-native-form="model"]','form[data-platform-ai-settings]','form[data-cw143-settings]'];
const parse=(value,fallback)=>{try{const out=JSON.parse(value);return out==null?fallback:out}catch{return fallback}};
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
function controller(){return globalThis.CommonweaveModelSettingsControllerV173}
function open(){const api=controller();if(!api?.open)throw new Error('Commonweave AI settings are not ready.');return api.open()}
function migrateLegacyAI(){
  const legacy=parse(localStorage.getItem(AI_KEY),{}),raw=String(legacy.provider||legacy.route||'').toLowerCase();
  if(!legacy.route||LEGACY_LOCAL.has(raw))localStorage.setItem(AI_KEY,JSON.stringify({route:'deterministic',provider:'deterministic',model:'commonweave-deterministic-v175',endpoint:'',consent:false,externalConsent:false,agenticEnabled:false}));
  const profiles=parse(localStorage.getItem(PROFILES_KEY),{}),interactive=profiles.interactive,profileRaw=String(interactive?.provider||interactive?.route||'').toLowerCase();
  if(!interactive||LEGACY_LOCAL.has(profileRaw)){profiles.interactive={route:'deterministic',provider:'deterministic',model:'commonweave-deterministic-v175',endpoint:'',externalConsent:false};profiles.agentic=null;profiles.agenticEnabled=false;localStorage.setItem(PROFILES_KEY,JSON.stringify(profiles))}
}
function savePlatform(form){
  const prior=parse(localStorage.getItem(PLATFORM_KEY),{}),releaseGateway=clean(form.elements.namedItem('releaseGateway')?.value)||prior.releaseGateway||DEFAULT_RELEASE_GATEWAY,sharedNode=clean(form.elements.namedItem('sharedNode')?.value)||prior.sharedNode||location.origin,shareLearningLibrary=Boolean(form.elements.namedItem('shareLearningLibrary')?.checked);
  localStorage.setItem(PLATFORM_KEY,JSON.stringify({releaseGateway,sharedNode,shareLearningLibrary}));
  const status=form.querySelector('[data-cw143-status]')||form.closest('section')?.querySelector('[data-cw143-status]');if(status)status.textContent='Platform settings saved on this device.';
}
function retitlePlatform(container){
  const kicker=container.querySelector('.cw143-kicker');if(kicker&&/AI CONFIGURATION/i.test(kicker.textContent))kicker.textContent='PLATFORM CONFIGURATION';
  const intro=container.querySelector('header p');if(intro&&/model route/i.test(intro.textContent))intro.textContent='Configure the release gateway, sharing node, and explicit publication boundary for this installed device.';
}
function replacement(form){
  if(!form||form.closest('[data-unified-ai-settings-v175]')||form.dataset.delegatedAiSettings==='true')return;
  form.dataset.delegatedAiSettings='true';
  const container=form.closest('.rc-panel,.native-panel,.card,.cw143-surface,section')||form.parentElement;if(!container)return;
  const platformFields=[...form.elements].filter(field=>/gateway|sharing|node|publish/i.test(`${field.name} ${field.labels?.[0]?.textContent||''}`));
  if(platformFields.length){
    retitlePlatform(container);
    form.querySelectorAll('.cw143-panel,.native-panel,section').forEach(panel=>{if(/^AI route$/i.test(panel.querySelector('h3')?.textContent?.trim()||''))panel.remove()});
    const aiFields=[...form.elements].filter(field=>/provider|route|model|endpoint|apikey|api-key|token|consent|agentic/i.test(field.name||''));
    aiFields.forEach(field=>field.closest('label,section,.field,.form-row,.cw143-panel')?.remove());
    const submit=form.querySelector('button[type="submit"],input[type="submit"]');if(submit)submit.textContent='Save platform settings';
    if(!form.querySelector('[data-open-unified-ai-settings]'))form.insertAdjacentHTML('beforeend','<section class="cw-ai-fallback-contract"><b>AI configuration</b><span>Provider, API key, consent, and agentic settings live in the single Commonweave AI settings surface. Deterministic local mode is the default.</span><button type="button" data-open-unified-ai-settings>Open Commonweave AI settings</button></section>');
    return;
  }
  form.replaceWith(Object.assign(document.createElement('div'),{className:'cw-ai-fallback-contract',innerHTML:'<b>AI configuration moved</b><span>This legacy form is retired. Every guide uses the single Commonweave AI settings surface.</span><button type="button" data-open-unified-ai-settings>Open Commonweave AI settings</button>'}));
}
function patch(root=document){for(const selector of SELECTORS)root.querySelectorAll?.(selector).forEach(replacement);root.querySelectorAll?.('[data-capability="commonweave.model-setup"]').forEach(button=>{button.dataset.opensUnifiedAiSettings='true';button.title='Open Commonweave AI settings'})}
document.addEventListener('submit',event=>{const form=event.target.closest?.('form[data-cw143-settings]');if(!form)return;event.preventDefault();event.stopImmediatePropagation();savePlatform(form)},true);
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-open-unified-ai-settings],[data-opens-unified-ai-settings]');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();open().catch(error=>console.error('[Commonweave settings delegation]',error));
},true);
const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1){replacement(node.matches?.(SELECTORS.join(','))?node:null);patch(node)}});
observer.observe(document.documentElement,{childList:true,subtree:true});
migrateLegacyAI();
document.readyState==='loading'?addEventListener('DOMContentLoaded',()=>patch(),{once:true}):patch();
globalThis.CommonweaveSettingsDelegationV175=Object.freeze({version:VERSION,open,patch,migrateLegacyAI,savePlatform});
})();
