(()=>{
'use strict';

const VERSION='civweave.guild-rally-point-setup.v1';
const LOCATION_KEY='civweave.hub-location-claim.v1';
const LOCATION_STATE_KEY='civweave.hub-location-sync.v1';
const RALLY_STATE_KEY='civweave.guild-rally-point.v1';
const MOBILE_GUILD_STATE_KEY='civweave.mobile-guild.v1';
let target=null;

const clean=(value,max=600)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback=null)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const load=(key,fallback=null)=>{try{return parse(localStorage.getItem(key),fallback)}catch{return fallback}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};

function mobileGuildState(){
  const state=load(MOBILE_GUILD_STATE_KEY,null);
  return state?.guildId?state:null;
}
function mobileGuildNodeIds(state){
  return Array.isArray(state?.cloudFabric?.starterNodes)?state.cloudFabric.starterNodes.map(node=>clean(node?.nodeId,180)).filter(Boolean):[];
}
function mirrorMobileGuildLocation(state){
  const location=state?.location;
  if(!state?.guildId||location?.schema!=='civweave.hub-location.v1'||!location?.syncedAt)return null;
  const nodeIds=mobileGuildNodeIds(state);
  const mirrored={
    ...location,
    schema:'civweave.hub-location-sync.v1',
    guildId:state.guildId,
    nodeCount:nodeIds.length,
    nodeIds,
    workerOrigin:state.primaryOrigin||null,
    authRoute:'guild-membership',
    updatedAt:state.updatedAt||location.syncedAt,
  };
  save(LOCATION_STATE_KEY,mirrored);
  return mirrored;
}
function renderMobileGuildLocation(state=mobileGuildState()){
  const mirrored=mirrorMobileGuildLocation(state);if(!mirrored)return false;
  const card=document.getElementById('location-card'),status=document.getElementById('location-status'),button=document.getElementById('sync-location'),open=document.getElementById('open-civweave'),nodeCount=document.getElementById('location-node-count');
  card?.classList.add('synced');
  if(open){open.setAttribute('aria-disabled','false');open.dataset.locationReady='1'}
  if(button){button.disabled=false;button.textContent='Update this Guild location'}
  const precise=Number(mirrored.coordinateDecimals||3)>=5;
  if(status)status.textContent=`This Guild was created on this device and already has ${precise?'a precise':'an approximately'} ±${mirrored.precisionMeters||100} m location. Updates from this device use the Guildkeeper credential created with the Guild.`;
  if(nodeCount)nodeCount.textContent=state?.cloudAttached?`${mirrored.nodeIds.length||3} Guild nodes`:'Pocket Guild · this device';
  return true;
}
async function syncMobileGuildLocation(event){
  const state=mobileGuildState();if(!state?.guildId)return;
  event?.preventDefault?.();event?.stopImmediatePropagation?.();
  const button=document.getElementById('sync-location'),status=document.getElementById('location-status'),precise=document.getElementById('publish-precise-location')?.checked===true;
  if(button)button.disabled=true;
  try{
    if(status)status.textContent='Updating this Guild with its founding Guildkeeper credential…';
    const module=await import('/app/mobile-guild-create-v1.mjs?v=1.0.0-guildkeeper-location-auth');
    if(typeof module.updateMobileGuildLocation!=='function')throw new Error('The mobile Guild location updater is unavailable.');
    const updated=await module.updateMobileGuildLocation({precise});
    if(!updated?.location?.syncedAt)throw new Error('The Guild location update did not return a synced location.');
    mirrorMobileGuildLocation(updated);
    renderMobileGuildLocation(updated);
  }catch(error){if(status)status.textContent=error?.message||String(error)}
  finally{if(button)button.disabled=false}
}
function installMobileGuildLocationBridge(){
  const state=mobileGuildState();if(!state?.guildId)return;
  renderMobileGuildLocation(state);
  const button=document.getElementById('sync-location');
  if(button&&!button.dataset.mobileGuildAuthBridge){button.dataset.mobileGuildAuthBridge='1';button.addEventListener('click',syncMobileGuildLocation,{capture:true})}
  addEventListener('civweave:mobile-guild-created',event=>renderMobileGuildLocation(event?.detail||mobileGuildState()));
  addEventListener('civweave:mobile-guild-location-updated',event=>renderMobileGuildLocation(event?.detail||mobileGuildState()));
}

function installStyles(){
  if(document.getElementById('guild-rally-point-style-v1'))return;
  const style=document.createElement('style');style.id='guild-rally-point-style-v1';style.textContent=`
    .rally-card{border-color:#f0cb6b77;background:linear-gradient(145deg,#2a210de8,#071c27e8)}
    .rally-card.synced{border-color:#65dfaa}
    .rally-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}
    .rally-field{display:grid;gap:6px;color:var(--muted)}
    .rally-field strong{color:var(--paper)}
    .rally-field input,.rally-field textarea{width:100%;min-height:44px;padding:10px 12px;border:1px solid #71d9e455;border-radius:12px;background:#061720;color:var(--paper);font:inherit}
    .rally-field textarea{min-height:88px;resize:vertical}
    .rally-confirm{display:flex;align-items:flex-start;gap:12px;margin-top:14px;padding:14px 15px;border-radius:14px;background:#2a210d99;border:1px solid #e8c96b55;cursor:pointer}
    .rally-confirm input{width:20px;height:20px;margin-top:2px;accent-color:#e8c96b;flex:0 0 auto}
    .rally-confirm strong{display:block;color:var(--paper)}
    .rally-confirm span span{display:block;margin-top:3px;color:var(--muted);font-size:.92rem}
    @media(max-width:720px){.rally-fields{grid-template-columns:1fr}}
  `;document.head.append(style);
}

function savedLocation(){return load(LOCATION_STATE_KEY,null)}
function savedRally(){return load(RALLY_STATE_KEY,null)}
function claimKey(){try{return localStorage.getItem(LOCATION_KEY)||''}catch{return''}}

function render(){
  const card=document.getElementById('rally-card'),status=document.getElementById('rally-status'),button=document.getElementById('sync-rally-point');
  const name=document.getElementById('rally-name'),directions=document.getElementById('rally-directions'),saved=savedRally();
  if(saved?.rallyPoint?.schema==='civweave.guild-rally-point.v1'){
    card?.classList.add('synced');
    if(name&&!name.value)name.value=saved.rallyPoint.name||'';
    if(directions&&!directions.value)directions.value=saved.rallyPoint.directions||'';
    if(status)status.textContent=`Rally Point saved: ${saved.rallyPoint.name}. Its public coordinates are cached with this Guild for offline reconnection.`;
  }else if(status){
    status.textContent=savedLocation()?.syncedAt?'Guild placement is ready. Stand at the public Rally Point and save it here.':'Place this Guild on the Guild Map first, then choose its public Rally Point.';
  }
  if(button)button.disabled=!target;
}

function bestCurrentPosition(){
  return new Promise((resolve,reject)=>{
    if(!isSecureContext)return reject(new Error('Rally Point setup requires this HTTPS Guild page.'));
    if(!navigator.geolocation)return reject(new Error('This browser does not provide location access.'));
    const status=document.getElementById('rally-status');let best=null,finished=false,watchId=null;
    const finish=(error=null)=>{if(finished)return;finished=true;if(watchId!==null)navigator.geolocation.clearWatch(watchId);clearTimeout(timer);if(best)return resolve(best);reject(error||new Error('No Rally Point location reading was available.'))};
    const timer=setTimeout(()=>finish(new Error('Rally Point location did not settle. Move outdoors or near a window and try again.')),15000);
    watchId=navigator.geolocation.watchPosition(position=>{
      if(!best||position.coords.accuracy<best.coords.accuracy)best=position;
      if(status)status.textContent=`Finding the Rally Point… current accuracy ±${Math.round(best.coords.accuracy)} m.`;
      if(best.coords.accuracy<=50)finish();
    },error=>finish(new Error(error.code===1?'Location permission was not granted. Enable it for this site, then try again.':'The Rally Point could not be located. Move outdoors or near a window and try again.')),{enableHighAccuracy:true,maximumAge:0,timeout:14000});
  });
}

async function syncRallyPoint(){
  const button=document.getElementById('sync-rally-point'),status=document.getElementById('rally-status');
  const name=clean(document.getElementById('rally-name')?.value,180),directions=clean(document.getElementById('rally-directions')?.value,600),confirmed=document.getElementById('rally-public-confirm')?.checked===true;
  if(!target){if(status)status.textContent='Finish the account Worker setup before publishing a Rally Point.';return}
  if(!savedLocation()?.syncedAt){if(status)status.textContent='Place this Guild on the Guild Map first. The Rally Point is attached to that Guild placement.';return}
  if(!name){if(status)status.textContent='Give the Rally Point a recognizable public place name first.';document.getElementById('rally-name')?.focus();return}
  if(!confirmed){if(status)status.textContent='Confirm that this is a public or community-accessible place, not a private residence.';return}
  const key=claimKey();if(!key){if(status)status.textContent='This browser does not hold the Guildkeeper location key. Re-sync the Guild placement from this browser first.';return}
  if(button)button.disabled=true;
  try{
    if(status)status.textContent='Requesting a fresh Rally Point location reading…';
    const position=await bestCurrentPosition();
    if(position.coords.accuracy>250)throw new Error('The Rally Point reading is too broad. Move outdoors or near a window and try again.');
    const payload={
      nodeIds:target.nodeIds,
      name,
      directions,
      latitude:Number(position.coords.latitude.toFixed(6)),
      longitude:Number(position.coords.longitude.toFixed(6)),
      accuracyMeters:Math.max(1,position.coords.accuracy),
      publicPlaceConfirmed:true,
      capturedAt:new Date(position.timestamp||Date.now()).toISOString()
    };
    if(status)status.textContent='Publishing the Guild Rally Point to the mesh…';
    const response=await fetch(`${target.workerOrigin}/api/fabric/rally-point`,{method:'POST',headers:{'content-type':'application/json','x-civweave-location-key':key},body:JSON.stringify(payload)}),result=await response.json().catch(()=>({}));
    if(!response.ok||result?.ok!==true)throw new Error(result?.error||`Mesh returned HTTP ${response.status}`);
    const state={schema:VERSION,syncedAt:result.rallyPoint?.updatedAt||new Date().toISOString(),nodeCount:Array.isArray(result.nodeIds)?result.nodeIds.length:target.nodeIds.length,rallyPoint:result.rallyPoint};
    save(RALLY_STATE_KEY,state);render();
  }catch(error){if(status)status.textContent=error?.message||String(error)}
  finally{if(button)button.disabled=!target}
}

function installCard(){
  if(document.getElementById('rally-card'))return;
  const after=document.getElementById('location-card');if(!after)return;
  const section=document.createElement('section');section.className='card rally-card';section.id='rally-card';section.innerHTML=`
    <p class="eyebrow">SET THE GUILD RALLY POINT</p>
    <h2>Choose where people regroup offline.</h2>
    <p class="muted">Choose a recognizable public or community-accessible place reasonably near the Guild’s map location: a park, library, plaza, community center, campus common, or similar spot. Do not use a private residence.</p>
    <div class="grid">
      <div class="tile"><small>Purpose</small><strong>Physical reconnection</strong></div>
      <div class="tile"><small>Availability</small><strong>Cached for offline use</strong></div>
      <div class="tile"><small>Visibility</small><strong>Public to Guild members</strong></div>
    </div>
    <div class="rally-fields">
      <label class="rally-field" for="rally-name"><strong>Public place name</strong><input id="rally-name" maxlength="180" autocomplete="off" placeholder="Example: Riverside Park pavilion"></label>
      <label class="rally-field" for="rally-directions"><strong>Short directions or landmark</strong><textarea id="rally-directions" maxlength="600" placeholder="Example: Main pavilion beside the east parking lot"></textarea></label>
    </div>
    <label class="rally-confirm" for="rally-public-confirm"><input id="rally-public-confirm" type="checkbox"><span><strong>This is a public or community-accessible meeting place</strong><span>The Rally Point’s precise coordinates, name, and directions are intentionally public Guild metadata so members can find it when digital networking is unavailable.</span></span></label>
    <p class="location-note">Take this device to the Rally Point before saving it. Civweave stores the Rally Point with the Guild manifest and includes it in the Guild Map directory cache. A member device that has seen the Guild can therefore retain the rendezvous information offline.</p>
    <div class="actions"><button class="primary" id="sync-rally-point" type="button" disabled>Set Rally Point at this device</button><a href="/finder">Open Guild Map</a></div>
    <p id="rally-status" class="status" role="status" aria-live="polite">Loading Guild deployment metadata…</p>
  `;
  after.insertAdjacentElement('afterend',section);
  document.getElementById('sync-rally-point')?.addEventListener('click',syncRallyPoint);
  render();
}

async function loadTarget(){
  try{
    const response=await fetch('/app/host-deployment-v1.json',{cache:'no-store'});if(!response.ok)throw new Error(`metadata returned ${response.status}`);
    const meta=await response.json(),edge=meta?.accountEdge,nodes=Array.isArray(edge?.starterNodes)?edge.starterNodes:[];
    if(edge?.status==='ready'&&edge?.workerOrigin&&nodes.length===3){target={workerOrigin:String(edge.workerOrigin).replace(/\/+$/g,''),nodeIds:nodes.map(node=>node?.nodeId).filter(Boolean)}}
  }catch{target=null}
  render();
}

function boot(){installStyles();installMobileGuildLocationBridge();installCard();loadTarget();const locationStatus=document.getElementById('location-status');if(locationStatus)new MutationObserver(()=>render()).observe(locationStatus,{childList:true,subtree:true,characterData:true});addEventListener('focus',()=>{renderMobileGuildLocation();render()});addEventListener('online',()=>loadTarget().catch(()=>{}));}

document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):queueMicrotask(boot);
})();