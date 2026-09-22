(()=>{
'use strict';
const VERSION='knowledge-library-launcher-v1.1-living-school-compat';
if(globalThis.CivweaveKnowledgeLibraryLaunchV1?.version===VERSION)return;
function libraryUrl(){const target=new URL('/app/cabinets/living-school/index.html',location.origin),current=new URLSearchParams(location.search);for(const key of ['host','hostNode','node','nodeId','node_id','finder','federationFinder']){const value=String(current.get(key)||'').trim();if(value)target.searchParams.set(key,value)}target.searchParams.set('livingLibrary','1');target.searchParams.set('source','library-compat');return target.href}
function openLibrary(){location.assign(libraryUrl());return true}
function removeLegacyControls(){document.getElementById('cw-working-campus-library-v1')?.remove();for(const node of document.querySelectorAll('[data-cw-home-action="library"],[data-cw-civweave-nav="library"]'))node.remove()}
removeLegacyControls();
addEventListener('pageshow',removeLegacyControls);
globalThis.CivweaveKnowledgeLibraryLaunchV1=Object.freeze({version:VERSION,open:openLibrary,url:libraryUrl,owner:'living-school'});
})();
