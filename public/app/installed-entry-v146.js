(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const installed=()=>navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);
const localDeveloper=()=>['localhost','127.0.0.1','::1'].includes(location.hostname)&&params.get('developer')==='1';
if(!installed()&&!localDeveloper()){
  const installer=new URL('/',location.origin);installer.searchParams.set('install','required');location.replace(installer.href);return;
}
const target=params.get('target')||'hub';
const routes={
  hub:'/loom/?installed=1',
  cabinets:'/app/cabinet-mode-v142.html?system=commonweave&installed=1',
  cabinet:'/app/cabinet-mode-v142.html?system=commonweave&installed=1',
  cabinetonly:'/app/cabinet-only-v144.html?system=commonweave&installed=1',
  lite:'/lite/?system=commonweave&installed=1'
};
const destination=new URL(routes[target]||routes.hub,location.origin);
if(localDeveloper())destination.searchParams.set('developer','1');
location.replace(destination.href);
})();
