(()=>{
'use strict';
const FAMILY_PATH='/app/fullscreen-family-v104.html';
const DEFAULT_DESTINATION='/app/fullscreen-family-v104.html?system=commonweave';
const params=new URLSearchParams(location.search);
const installed=()=>navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);
const localDeveloper=()=>['localhost','127.0.0.1','::1'].includes(location.hostname)&&params.get('developer')==='1';
if(!installed()&&!localDeveloper()){
  const installer=new URL('/',location.origin);installer.searchParams.set('install','required');location.replace(installer.href);return;
}
const requested=params.get('system')||params.get('target')||'commonweave';
const aliases={hub:'commonweave',cabinet:'commonweave',cabinets:'commonweave',cabinetonly:'commonweave',lite:'commonweave'};
const system=aliases[requested]||requested;
const allowed=new Set(['commonweave','living-school','cerbanimo','fellowfare','anarchadia']);
const destination=new URL(DEFAULT_DESTINATION,location.origin);
destination.searchParams.set('system',allowed.has(system)?system:'commonweave');
destination.searchParams.set('installed','1');
if(localDeveloper())destination.searchParams.set('developer','1');
location.replace(destination.href);
})();
