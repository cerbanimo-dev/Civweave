(() => {
'use strict';

const REVISION='installer-package-repair-v266';
const stateNode=document.getElementById('package-state');
const installButton=document.getElementById('install-app');
const updateButton=document.getElementById('check-update');
const helpNode=document.getElementById('install-help');

function failed(){return String(stateNode?.textContent||'').trim().toLowerCase()==='failed'}
function apply(){
  document.getElementById('open-online-campus-v225')?.remove();
  if(!failed())return;
  if(installButton){
    installButton.disabled=true;
    installButton.textContent='Repair package before opening';
    installButton.dataset.civweavePackageRepair=REVISION;
    delete installButton.dataset.civweaveOnlineFallback;
  }
  if(updateButton)updateButton.textContent='Repair shell';
  if(helpNode){
    helpNode.dataset.civweavePackageRepair=REVISION;
    helpNode.textContent='The local device package is incomplete. Repair the shell and required campus here. Civweave will not fall back to the hosted website.';
  }
}

document.addEventListener('click',event=>{
  const target=event.target instanceof Element?event.target.closest('#install-app'):null;
  if(!target||!failed())return;
  event.preventDefault();event.stopImmediatePropagation();apply();
},true);
const observer=new MutationObserver(apply);
if(stateNode)observer.observe(stateNode,{childList:true,characterData:true,subtree:true});
addEventListener('pagehide',()=>observer.disconnect(),{once:true});
apply();

globalThis.CivweaveInstallerOnlineFallbackV225=Object.freeze({revision:REVISION,onlineFallback:false,policy:'repair-downloaded-package-never-open-live-campus'});
})();
