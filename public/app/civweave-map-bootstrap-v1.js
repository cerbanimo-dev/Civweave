(()=>{
'use strict';
const VERSION='civweave-map-v1-bootstrap-1.0.0';
let started=false,fallbackActive=false,errorCount=0;
const now=()=>new Date().toISOString();
function service(){return globalThis.CivweaveMapService}
function graticule(){
  const features=[];
  for(let lon=-180;lon<=180;lon+=15)features.push({type:'Feature',properties:{kind:lon===0?'prime':'longitude'},geometry:{type:'LineString',coordinates:Array.from({length:25},(_,i)=>[lon,-90+i*7.5])}});
  for(let lat=-75;lat<=75;lat+=15)features.push({type:'Feature',properties:{kind:lat===0?'equator':'latitude'},geometry:{type:'LineString',coordinates:Array.from({length:49},(_,i)=>[-180+i*7.5,lat])}});
  return{type:'FeatureCollection',features};
}
function palette(theme){return theme==='parchment'?{bg:'#efe5ca',grid:'#927b65',axis:'#695746'}:theme==='midnight'?{bg:'#020711',grid:'#27374d',axis:'#657a96'}:{bg:'#07131f',grid:'#294655',axis:'#5c8190'}}
function fallbackStyle(){const p=palette(service()?.state?.theme||'weave');return{version:8,name:'Civweave offline coordinate field',sources:{'civweave-graticule':{type:'geojson',data:graticule()}},layers:[{id:'cw-bootstrap-bg',type:'background',paint:{'background-color':p.bg}},{id:'cw-bootstrap-grid',type:'line',source:'civweave-graticule',paint:{'line-color':['case',['match',['get','kind'],['equator','prime'],true,false],p.axis,p.grid],'line-width':['case',['match',['get','kind'],['equator','prime'],true,false],1.15,0.55],'line-opacity':0.55}}]}}
function activate(reason='offline-startup'){
  const svc=service(),map=svc?.state?.map;if(!map)return false;if(globalThis.CivweaveMapOfflineV1?.status?.()?.activePackId)return false;
  svc.state.styleReady=false;map.setStyle(fallbackStyle());fallbackActive=true;const provider=document.getElementById('provider');if(provider)provider.textContent='Offline coordinate field · downloaded PMTiles will replace this when available';
  dispatchEvent(new CustomEvent('civweave:map-bootstrap-fallback',{detail:{reason,at:now()}}));return true;
}
function start(){
  if(started)return status();const map=service()?.state?.map;if(!map)return false;started=true;
  map.on?.('error',event=>{if(navigator.onLine!==false||globalThis.CivweaveMapOfflineV1?.status?.()?.activePackId)return;errorCount++;if(errorCount>=2&&!fallbackActive)activate('remote-style-failed')});
  if(navigator.onLine===false)queueMicrotask(()=>activate('offline-startup'));
  addEventListener('online',()=>{errorCount=0;if(fallbackActive&&!globalThis.CivweaveMapOfflineV1?.status?.()?.activePackId){fallbackActive=false;service()?.changeTheme?.(service()?.state?.theme||'weave')}});
  return status();
}
function status(){return{version:VERSION,started,fallbackActive,errorCount}}
function boot(){if(service()?.state?.map)return start();let ticks=0;const timer=setInterval(()=>{if(service()?.state?.map){clearInterval(timer);start()}else if(++ticks>240)clearInterval(timer)},50)}
globalThis.CivweaveMapBootstrapV1=Object.freeze({version:VERSION,graticule,fallbackStyle,activate,start,status});document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):queueMicrotask(boot);
})();
