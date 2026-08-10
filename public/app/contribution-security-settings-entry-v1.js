(()=>{
'use strict';
const VERSION='1.0.0';
const PAGE='/app/contribution-security-v1.html';
const ID='cw-contribution-security-settings-entry-v1';
function inject(){
  const form=document.querySelector?.('[data-cw-cleanroom-form]');
  if(!form||form.querySelector(`#${ID}`))return Boolean(form);
  const box=document.createElement('section');
  box.id=ID;
  box.style.cssText='margin:12px 0;padding:12px;border:1px solid rgba(120,180,220,.3);border-radius:12px;background:rgba(8,25,38,.55)';
  const title=document.createElement('strong');
  title.textContent='Wallet & contribution security';
  const note=document.createElement('p');
  note.textContent='Guardian recovery, federation finality, validator enrollment, launch readiness, and emergency wallet containment.';
  note.style.cssText='margin:6px 0 9px;font-size:.82em;opacity:.78;line-height:1.35';
  const button=document.createElement('button');
  button.type='button';
  button.textContent='Open wallet security';
  button.dataset.openContributionSecurity='1';
  button.addEventListener('click',()=>location.assign(PAGE));
  box.append(title,note,button);
  const footer=form.querySelector('footer');
  if(footer)form.insertBefore(box,footer);else form.append(box);
  return true;
}
function schedule(){queueMicrotask(inject)}
addEventListener('civweave:model-settings-opened',schedule);
addEventListener('civweave:ai-settings-entry-opened',schedule);
addEventListener('civweave:phone-ledger',event=>{if(event.detail?.type==='ready')schedule()});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
globalThis.CivweaveContributionSecuritySettingsV1=Object.freeze({version:VERSION,page:PAGE,inject,open:()=>location.assign(PAGE)});
})();