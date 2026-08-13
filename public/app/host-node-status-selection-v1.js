(()=>{
'use strict';
function sync(){
  const parts=(document.getElementById('cw-host-node-meta')?.textContent||'').split('·').map(value=>value.trim()).filter(Boolean);
  const origin=parts.find(value=>/^https:\/\//i.test(value))||'',nodeId=parts.length>1&&!/^https:\/\//i.test(parts[0])?parts[0]:'';
  if(!origin||!nodeId)return false;
  try{const url=new URL(location.href);if(url.searchParams.get('host')===origin&&url.searchParams.get('node')===nodeId)return false;url.searchParams.set('host',origin);url.searchParams.set('node',nodeId);history.replaceState(history.state,'',url);globalThis.CivweaveHostNodePaidJoinV1?.apply?.();return true;}catch{return false;}
}
const observer=new MutationObserver(sync);observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();
