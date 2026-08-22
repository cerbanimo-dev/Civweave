(()=>{
'use strict';
const VERSION='1.0.0-canonical-ai-portraits-bounded';
const NAV_ID='cw-themed-system-nav';
const PORTRAITS=Object.freeze({
  civweave:['/app/assets/ai/weaveling.png','W'],
  'living-school':['/app/assets/ai/moss.png','M'],
  cerbanimo:['/app/assets/ai/kamiya.png','K'],
  fellowfare:['/app/assets/ai/rook.png','R'],
  anarchadia:['/app/assets/ai/merlin.png','M']
});
let timers=[];

function ensureStyle(){
  if(document.getElementById('cw-universal-nav-media-stability-v1-style'))return;
  const style=document.createElement('style');
  style.id='cw-universal-nav-media-stability-v1-style';
  style.textContent=`
#${NAV_ID} .cw-themed-system-avatar{display:none!important}
#${NAV_ID} .cw-themed-system-fallback{display:block!important;z-index:3!important;opacity:1!important;visibility:visible!important;filter:none!important;object-fit:contain!important;object-position:center!important;background:transparent!important}
#${NAV_ID} .cw-nav-canonical-monogram{position:absolute;inset:2px;z-index:2;display:grid;place-items:center;border-radius:18px;color:#271c31;font:900 24px/1 system-ui,sans-serif;background:linear-gradient(145deg,#fff8,#ffffff22)}
#${NAV_ID} .cw-nav-canonical-monogram[hidden]{display:none!important}
`;
  (document.head||document.documentElement).append(style);
}
function repair(){
  const nav=document.getElementById(NAV_ID);if(!nav)return false;
  ensureStyle();let repaired=0;
  for(const link of nav.querySelectorAll('a[data-system]')){
    const system=String(link.dataset.system||''),spec=PORTRAITS[system];if(!spec)continue;
    const wrap=link.querySelector('.cw-themed-system-avatar-wrap');if(!wrap)continue;
    const sprite=wrap.querySelector('.cw-themed-system-avatar');if(sprite)sprite.style.setProperty('display','none','important');
    let fallback=wrap.querySelector('.cw-nav-canonical-monogram');
    if(!fallback){fallback=document.createElement('span');fallback.className='cw-nav-canonical-monogram';fallback.textContent=spec[1];fallback.setAttribute('aria-hidden','true');wrap.prepend(fallback)}
    let img=wrap.querySelector('img.cw-themed-system-fallback');
    if(!img){img=document.createElement('img');img.className='cw-themed-system-fallback';img.alt='';wrap.append(img)}
    const desired=new URL(spec[0],location.origin).href;
    if(img.src!==desired)img.src=desired;
    img.removeAttribute('srcset');img.removeAttribute('sizes');img.hidden=false;
    img.style.setProperty('display','block','important');img.style.setProperty('opacity','1','important');img.style.setProperty('visibility','visible','important');img.style.setProperty('z-index','3','important');img.style.setProperty('object-fit','contain','important');img.style.setProperty('object-position','center','important');
    const loaded=()=>{fallback.hidden=true;link.dataset.cwCanonicalPortrait='loaded'};
    const failed=()=>{img.hidden=true;fallback.hidden=false;link.dataset.cwCanonicalPortrait='fallback'};
    img.onload=loaded;img.onerror=failed;
    if(img.complete){if(img.naturalWidth>0)loaded();else failed()}
    repaired++;
  }
  if(repaired){nav.dataset.mediaRevision=VERSION;document.documentElement.dataset.civweaveUniversalNavMedia=VERSION}
  return repaired===Object.keys(PORTRAITS).length;
}
function schedule(){timers.forEach(clearTimeout);timers=[0,120,420,1000,2200].map(delay=>setTimeout(()=>{if(repair())timers.forEach(clearTimeout)},delay))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
addEventListener('pageshow',repair);addEventListener('focus',repair);
globalThis.CivweaveUniversalNavMediaStabilityV1=Object.freeze({version:VERSION,repair,portraits:PORTRAITS});
})();
