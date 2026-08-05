(()=>{
'use strict';
const VERSION='175.0-legacy-settings-delegation';
const SELECTORS=['[data-capability-form="commonweave.model-setup"]','[data-native-form="model"]','form[data-platform-ai-settings]'];
function controller(){return globalThis.CommonweaveModelSettingsControllerV173}
function open(){const api=controller();if(!api?.open)throw new Error('Commonweave AI settings are not ready.');return api.open()}
function replacement(form){
  if(!form||form.closest('[data-unified-ai-settings-v175]')||form.dataset.delegatedAiSettings==='true')return;
  form.dataset.delegatedAiSettings='true';
  const container=form.closest('.rc-panel,.native-panel,.card,section')||form.parentElement;if(!container)return;
  const platformFields=[...form.elements].filter(field=>/gateway|sharing|node|publish/i.test(`${field.name} ${field.labels?.[0]?.textContent||''}`));
  if(platformFields.length){
    const aiFields=[...form.elements].filter(field=>/provider|route|model|endpoint|apikey|api-key|token|consent|agentic/i.test(field.name||''));
    aiFields.forEach(field=>field.closest('label,section,.field,.form-row')?.remove());
    const submit=form.querySelector('button[type="submit"],input[type="submit"]');if(submit)submit.textContent='Save platform settings';
    if(!form.querySelector('[data-open-unified-ai-settings]'))form.insertAdjacentHTML('beforeend','<section class="cw-ai-fallback-contract"><b>AI configuration moved</b><span>Provider, API key, consent, and agentic settings now live in one Commonweave-wide settings surface.</span><button type="button" data-open-unified-ai-settings>Open Commonweave AI settings</button></section>');
    return;
  }
  form.replaceWith(Object.assign(document.createElement('div'),{className:'cw-ai-fallback-contract',innerHTML:'<b>AI configuration moved</b><span>This legacy form is retired. Every guide now uses one Commonweave AI settings surface.</span><button type="button" data-open-unified-ai-settings>Open Commonweave AI settings</button>'}));
}
function patch(root=document){for(const selector of SELECTORS)root.querySelectorAll?.(selector).forEach(replacement);root.querySelectorAll?.('[data-capability="commonweave.model-setup"]').forEach(button=>{button.dataset.opensUnifiedAiSettings='true';button.title='Open Commonweave AI settings'})}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-open-unified-ai-settings],[data-opens-unified-ai-settings]');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();open().catch(error=>console.error('[Commonweave settings delegation]',error));
},true);
const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1){replacement(node.matches?.(SELECTORS.join(','))?node:null);patch(node)}});
observer.observe(document.documentElement,{childList:true,subtree:true});
document.readyState==='loading'?addEventListener('DOMContentLoaded',()=>patch(),{once:true}):patch();
globalThis.CommonweaveSettingsDelegationV175=Object.freeze({version:VERSION,open,patch});
})();
