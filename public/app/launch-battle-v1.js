(()=>{
'use strict';
const stage=document.getElementById('cw-launch-battle');
if(!stage)return;
const fighter=document.getElementById('cw-launch-fighter');
const name=document.getElementById('cw-launch-fighter-name');
const CAST=Object.freeze([
  {name:'Weaveling',sheet:'/app/assets/ai/weaveling-review-sprites-v1.png',accent:'#8af5d2'},
  {name:'Moss',sheet:'/app/assets/ai/moss-review-sprites-v1.png',accent:'#aeea57'},
  {name:'Kamiya',sheet:'/app/assets/ai/kamiya-review-sprites-v1.png',accent:'#e8a1ff'},
  {name:'Rook',sheet:'/app/assets/ai/rook-review-sprites-v1.png',accent:'#efb452'},
  {name:'Merlin',sheet:'/app/assets/ai/merlin-review-sprites-v1.png',accent:'#ff80b4'}
]);
const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
let bag=[],current=-1,timer=0,closed=false;
function shuffle(){
  bag=CAST.map((_,i)=>i);
  for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]]}
  if(bag.at(-1)===current&&bag.length>1)[bag[bag.length-1],bag[0]]=[bag[0],bag[bag.length-1]];
}
function choose(){
  if(!bag.length)shuffle();
  current=bag.pop();
  const item=CAST[current];
  name.textContent=item.name;
  fighter.style.setProperty('--cw-guide-sheet',`url("${item.sheet}")`);
  stage.style.setProperty('--cw-guide-accent',item.accent);
  stage.dataset.guide=item.name.toLowerCase();
  stage.dataset.playing='false';
  if(!reduced?.matches&&document.visibilityState!=='hidden'){
    void stage.offsetWidth; // Restart the purely decorative sprite choreography.
    stage.dataset.playing='true';
  }
}
function stop(){if(timer)clearInterval(timer);timer=0}
function start(){if(closed)return;stop();choose();if(!reduced?.matches&&document.visibilityState!=='hidden')timer=setInterval(choose,3400)}
function visibility(){if(document.visibilityState==='hidden'){stop();stage.dataset.playing='false'}else start()}
document.addEventListener('visibilitychange',visibility);
reduced?.addEventListener?.('change',start);
globalThis.addEventListener('pagehide',()=>{closed=true;stop();document.removeEventListener('visibilitychange',visibility);reduced?.removeEventListener?.('change',start)},{once:true});
start();
})();
