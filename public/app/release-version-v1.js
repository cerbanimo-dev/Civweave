(()=>{
'use strict';
const API_VERSION='release-version-v1';
function versionFromManifest(manifest){
  const name=String(manifest?.name||'');
  const named=name.match(/\bv(\d+\.\d+\.\d+)\b/i)?.[1];
  if(named)return named;
  try{return new URL(manifest?.start_url||'',location.origin).searchParams.get('version')||''}catch{return''}
}
function canonicalRealm(){
  const root=document.documentElement;
  const system=String(root?.dataset?.civweaveSystemRoute||root?.dataset?.civweaveSystem||'').trim();
  return Boolean(system&&system!=='civweave');
}
function apply(version){
  if(!/^\d+\.\d+\.\d+$/.test(version))return false;
  const root=document.documentElement;
  root.dataset.civweaveVersion=version;
  for(const node of document.querySelectorAll('.version,.version-chip,[data-civweave-version]')){
    if(node===root)continue;
    node.textContent=`v${version}`;
  }
  if(/\bv\d+\.\d+\.\d+\b/.test(document.title))document.title=document.title.replace(/\bv\d+\.\d+\.\d+\b/g,`v${version}`);
  globalThis.CivweaveReleaseVersionV1=Object.freeze({apiVersion:API_VERSION,version,apply,realmMutation:false});
  dispatchEvent(new CustomEvent('civweave:release-version',{detail:{version,apiVersion:API_VERSION}}));
  return true;
}
async function sync(){
  if(canonicalRealm()){
    globalThis.CivweaveReleaseVersionV1=Object.freeze({apiVersion:API_VERSION,version:'',apply,realmMutation:false,skipped:'canonical-realm'});
    return;
  }
  try{
    const response=await fetch('/app/manifest.webmanifest',{cache:'no-store'});
    if(!response.ok)throw new Error(`manifest ${response.status}`);
    const version=versionFromManifest(await response.json());
    if(!apply(version))throw new Error('manifest version missing');
  }catch(error){
    console.warn('[Civweave] Visible release version could not be synchronized.',error?.message||error);
  }
}
sync();
})();
