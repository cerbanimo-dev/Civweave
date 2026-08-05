(()=>{
'use strict';
const VERSION='living-school-image-runtime-v202';
const STATE_KEY='commonweave.living-school.cabinet.v151';
const BASE='/app/assets/living-school/';
const SCENES={
  desk:'home.webp',
  forge:'forge.webp',
  research:'library.webp',
  map:'home.webp',
  lesson:'library.webp',
  observatory:'moss.webp',
  workshop:'workshop.webp',
  bridge:'workshop.webp',
  credential:'forge.webp',
  systems:'moss.webp'
};
let observer=null;
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
function stage(){return document.getElementById('stage')}
function currentRoom(){return stage()?.dataset.room||parse(localStorage.getItem(STATE_KEY),{})?.room||'desk'}
function scene(room=currentRoom()){return BASE+(SCENES[room]||SCENES.desk)}
function ensureArt(){
  const root=stage();if(!root)return null;
  let image=document.getElementById('ls-world-art');
  if(!image){
    image=document.createElement('img');
    image.id='ls-world-art';
    image.className='ls-world-art';
    image.alt='';
    image.width=941;
    image.height=2072;
    image.loading='eager';
    image.decoding='async';
    image.fetchPriority='high';
    const room=document.getElementById('room');
    root.insertBefore(image,room||root.firstChild);
    image.addEventListener('load',()=>image.classList.remove('is-switching'));
    image.addEventListener('error',()=>{image.classList.remove('is-switching');document.documentElement.dataset.livingSchoolImageError=image.src});
  }
  return image;
}
function update(){
  const image=ensureArt();if(!image)return;
  const next=scene();
  if(new URL(image.src||location.href,location.href).pathname===new URL(next,location.href).pathname)return;
  image.classList.add('is-switching');
  image.src=next;
  image.dataset.room=currentRoom();
}
function enhanceMoss(){
  const button=document.getElementById('moss');if(!button||button.querySelector('img'))return;
  button.innerHTML='<img src="/app/assets/ai/moss.png" alt="" width="96" height="96" loading="eager" decoding="async"><b>Moss</b>';
}
function preloadRest(){
  const paths=[...new Set(Object.values(SCENES))].filter(name=>BASE+name!==scene());
  for(const name of paths){const image=new Image();image.decoding='async';image.src=BASE+name}
}
function boot(){
  const root=stage();if(!root)return;
  update();enhanceMoss();
  observer?.disconnect();
  observer=new MutationObserver(update);
  observer.observe(root,{attributes:true,attributeFilter:['data-room']});
  addEventListener('storage',event=>{if(event.key===STATE_KEY)update()});
  document.addEventListener('commonweave:living-school-ready',()=>{
    update();enhanceMoss();
    (globalThis.requestIdleCallback||((callback)=>setTimeout(callback,600)))(preloadRest,{timeout:2500});
  },{once:true});
  document.documentElement.dataset.livingSchoolVisual=VERSION;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.LivingSchoolVisualShellV202={version:VERSION,update,scene};
})();
