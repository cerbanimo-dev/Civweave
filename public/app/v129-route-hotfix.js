(()=>{
'use strict';
const VERSION='1.0.29';
const BUILD='1.0.29-cabinet-interface-parity';
const replaceVisibleVersion=root=>{
  const walker=document.createTreeWalker(root||document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes)if(node.nodeValue?.includes('1.0.28'))node.nodeValue=node.nodeValue.replaceAll('1.0.28',VERSION);
  document.querySelectorAll('[aria-label*="1.0.28"]').forEach(node=>node.setAttribute('aria-label',node.getAttribute('aria-label').replaceAll('1.0.28',VERSION)));
};
const realmId=()=>{const parts=location.pathname.split('/').filter(Boolean);return parts[parts.indexOf('realm')+1]||''};
const currentRoom=id=>new URLSearchParams(location.search).get('room')||localStorage.getItem(`civweave.realm-room.${id}`)||'';
const workstationUrl=(system,room='')=>{const query=new URLSearchParams({system});if(room)query.set('room',room);return `/lite/?${query}`};
function releaseDialog(){
  let node=document.querySelector('#cw129-release-dialog');
  if(!node){node=document.createElement('dialog');node.id='cw129-release-dialog';node.className='cw127-dialog';node.innerHTML=`<section><header><div><small>RELEASE STATE</small><h2>Civweave v${VERSION}</h2></div><button class="cw127-close" data-close aria-label="Close">×</button></header><p>Build: <code>${BUILD}</code></p><p>The cabinet workstation renderer is active. Visual room surfaces open the matching Lite room inside its system cabinet.</p><menu><a href="/lite/?system=civweave">Open Civweave workstation</a><a href="/lite/version.json" target="_blank" rel="noopener">Live version record</a></menu></section>`;document.body.append(node);node.querySelector('[data-close]').onclick=()=>node.close();node.addEventListener('click',event=>{if(event.target===node)node.close()})}
  node.showModal?.();
}
document.documentElement.dataset.civweaveBuild=BUILD;
localStorage.setItem('civweave.host-build',BUILD);
replaceVisibleVersion(document.body);
new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)replaceVisibleVersion(node)}))).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',event=>{
  const control=event.target.closest?.('[data-action]');if(!control)return;
  const action=control.dataset.action;
  if(action==='version'){event.preventDefault();event.stopImmediatePropagation();releaseDialog();return}
  if(action==='room'&&location.pathname.includes('/loom/realm/')){const system=realmId();event.preventDefault();event.stopImmediatePropagation();location.assign(workstationUrl(system,currentRoom(system)));return}
  if(action==='lite'){event.preventDefault();event.stopImmediatePropagation();const system=realmId()||'civweave';location.assign(workstationUrl(system,currentRoom(system)));}
},true);
fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema:'civweave.boot-log.v1',time:new Date().toISOString(),version:VERSION,build:BUILD,kind:'v129-route-hotfix:ready',detail:{path:location.pathname}}),keepalive:true,cache:'no-store'}).catch(()=>{});
})();
