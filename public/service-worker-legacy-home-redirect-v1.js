'use strict';
(()=>{
const VERSION='legacy-home-redirect-v1-v156-to-v440';
const LEGACY='/app/working-campus-v156.html';
const CANONICAL='/app/working-campus-v440.html';
const PRESERVE=Object.freeze(['installed','system','context','weave','feature','developer','lang','locale','version']);
function targetFor(url){
  const target=new URL(CANONICAL,self.location.origin);
  for(const key of PRESERVE)if(url.searchParams.has(key))target.searchParams.set(key,url.searchParams.get(key));
  target.searchParams.set('source','legacy-v156-canonical-home-redirect');
  target.searchParams.set('navigation','five-system-route-contract-v229-v440-home');
  return target;
}
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET'||request.mode!=='navigate')return;
  let url;try{url=new URL(request.url)}catch{return}
  if(url.origin!==self.location.origin||url.pathname!==LEGACY)return;
  event.stopImmediatePropagation();event.respondWith(Promise.resolve(Response.redirect(targetFor(url).href,302)));
});
self.CivweaveLegacyHomeRedirectV1=Object.freeze({version:VERSION,legacyPath:LEGACY,canonicalPath:CANONICAL,preserve:[...PRESERVE],policy:'explicit-legacy-navigation-redirect-only-no-client-reload'});
})();