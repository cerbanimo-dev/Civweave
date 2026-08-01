(()=>{'use strict';
 const path=location.pathname;
 const system=path.includes('/cerbanimo/')?'cerbanimo':path.includes('/anarchadia/')?'anarchadia':path.includes('/living-school/')?'living':path.includes('/fellowfare/')?'fellowfare':'';
 if(!system)return;
 const params=new URLSearchParams(location.search);if(params.get('classic')==='1')return;
 document.documentElement.classList.add('cw-lean-visual-shell',`cw-system-${system}`);

 /* A district is never its own installable app. Commonweave owns updates and installation. */
 try{
  document.querySelectorAll('link[rel="manifest"]').forEach(link=>link.href=new URL('../../manifest.webmanifest',location.href).href);
  document.querySelectorAll('meta[name="apple-mobile-web-app-title"]').forEach(meta=>meta.content='Commonweave');
  document.title=`Commonweave Pocket Campus · ${{cerbanimo:'Cerbanimo',anarchadia:'Anarchadia',living:'Living School',fellowfare:'FellowFare'}[system]}`;
 }catch{}

 const assets={
  cerbanimo:['assets/cerbanimo-logo.png','../../assets/ai/kamiya.png'],
  anarchadia:['../../logos/anarchadia.webp','../../assets/ai/merlin.png'],
  living:['../../logos/living-school.webp','../../assets/ai/moss.png'],
  fellowfare:['../../logos/fellowfare.png','../../assets/ai/rook.png']
 }[system];
 const selectors={cerbanimo:'.visual-scene-frame',anarchadia:'.visual-stage-canvas',living:'.ls-visual-frame',fellowfare:'.mall-scene'};
 const guideNames={cerbanimo:'Kamiya · Questwright',anarchadia:'Merlin · Boundaries',living:'Moss · Learning',fellowfare:'Rook · Exchange'};

 function removeLegacy(){
  document.querySelectorAll('.legacy-toolbar,.legacy-bottom-nav,.legacy-hud,.rook-commons-local,[data-legacy-shell],[data-app-update-banner],.app-update-banner').forEach(node=>node.remove());
  if(system==='anarchadia')document.querySelectorAll('.debug-region,.hotspot-debug,[data-debug-box]').forEach(node=>node.remove());
 }

 function decorate(){
  removeLegacy();
  for(const host of document.querySelectorAll(selectors[system])){
   if(host.dataset.cwDecorated)continue;
   host.dataset.cwDecorated='1';
   const logo=document.createElement('img');logo.className='cw-scene-decoration logo';logo.src=assets[0];logo.alt='';host.append(logo);
   const guide=document.createElement('img');guide.className=`cw-scene-decoration guide cw-guide-${system}`;guide.src=assets[1];guide.alt=guideNames[system];guide.title=`${guideNames[system]} · available through Weaveling's Compass`;host.append(guide);
  }
 }

 /* Service workers may report updates, but only the Commonweave shell presents the action. */
 navigator.serviceWorker?.addEventListener?.('message',event=>{
  if(event.data?.type==='UPDATE_AVAILABLE'){
   try{localStorage.setItem('commonweave.update-available',JSON.stringify({at:Date.now(),source:system}));}catch{}
  }
 });

 new MutationObserver(()=>requestAnimationFrame(decorate)).observe(document.documentElement,{childList:true,subtree:true});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate,{once:true});else decorate();
})();
