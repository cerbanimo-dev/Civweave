(()=>{'use strict';
 const path=location.pathname;const system=path.includes('/cerbanimo/')?'cerbanimo':path.includes('/anarchadia/')?'anarchadia':path.includes('/living-school/')?'living':path.includes('/fellowfare/')?'fellowfare':'';
 if(!system)return;const params=new URLSearchParams(location.search);if(params.get('classic')==='1')return;
 document.documentElement.classList.add('cw-lean-visual-shell',`cw-system-${system}`);
 const assets={cerbanimo:['assets/cerbanimo-logo.png','../../assets/ai/kamiya.png'],anarchadia:['assets/icon-192.png','../../assets/ai/rook.png'],living:['../../logos/living-school.webp','../../assets/ai/moss.png'],fellowfare:['../../logos/fellowfare.png','../../assets/ai/rook.png']}[system];
 function decorate(){const selectors={cerbanimo:'.visual-scene-frame',anarchadia:'.visual-stage-canvas',living:'.ls-visual-frame',fellowfare:'.mall-scene'};for(const host of document.querySelectorAll(selectors[system])){if(host.dataset.cwDecorated)continue;host.dataset.cwDecorated='1';const logo=document.createElement('img');logo.className='cw-scene-decoration logo';logo.src=assets[0];logo.alt='';host.append(logo);if(system!=='fellowfare'){const guide=document.createElement('img');guide.className='cw-scene-decoration guide';guide.src=assets[1];guide.alt='';host.append(guide)}}}
 new MutationObserver(()=>requestAnimationFrame(decorate)).observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate,{once:true});else decorate();
})();
