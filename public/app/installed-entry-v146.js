(()=>{
'use strict';
const params=new URLSearchParams(location.search);
const BOOT_KEY='commonweave.install-boundary.boot.v218';
const installedDisplay=()=>navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);
const legacyEntry=/^\/app\/installed-entry-v146(?:\.html)?$/.test(location.pathname);
const explicitInstalled=params.get('installed')==='1'||legacyEntry;
const localDeveloper=()=>['localhost','127.0.0.1','::1'].includes(location.hostname)&&params.get('developer')==='1';
if(explicitInstalled||installedDisplay())sessionStorage.setItem(BOOT_KEY,'1');
const bootGranted=()=>sessionStorage.getItem(BOOT_KEY)==='1';
if(!installedDisplay()&&!bootGranted()&&!localDeveloper()){const installer=new URL('/',location.origin);installer.searchParams.set('install','required');location.replace(installer.href);return}
const requested=params.get('system')||params.get('target')||'commonweave',aliases={hub:'commonweave',cabinet:'commonweave',cabinets:'commonweave',cabinetonly:'commonweave',lite:'commonweave'},system=aliases[requested]||requested;
const sites={commonweave:'/app/working-campus-v156.html','living-school':'/app/cabinets/living-school/index.html?cabinet=1',cerbanimo:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1',fellowfare:'/app/fellowfare-cabinet-v144.html?cabinet=1',anarchadia:'/app/anarchadia-console-v139.html?cabinet=1'};
const destination=new URL(sites[system]||sites.commonweave,location.origin);destination.searchParams.set('installed','1');if(localDeveloper())destination.searchParams.set('developer','1');location.replace(destination.href);
})();
