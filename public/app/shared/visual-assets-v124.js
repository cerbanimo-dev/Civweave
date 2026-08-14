(()=>{
'use strict';
const cache=new Map();
async function chroma(src,mode='auto'){
  const key=mode+src;if(cache.has(key))return cache.get(key);
  const promise=new Promise(resolve=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{const c=document.createElement('canvas'),x=c.getContext('2d',{willReadFrequently:true});c.width=img.naturalWidth;c.height=img.naturalHeight;x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height),p=d.data;for(let i=0;i<p.length;i+=4){const r=p[i],g=p[i+1],b=p[i+2],magenta=r>175&&b>145&&g<115,green=g>145&&g>r*1.35&&g>b*1.18;if((mode==='magenta'&&magenta)||(mode==='green'&&green)||(mode==='auto'&&(magenta||green))){const strength=mode==='green'?Math.min(255,(g-Math.max(r,b))*3.4):Math.min(255,(Math.min(r,b)-g)*3.2);p[i+3]=Math.max(0,255-strength)}}x.putImageData(d,0,0);resolve(c.toDataURL('image/webp',.92))};img.onerror=()=>resolve(src);img.src=src});cache.set(key,promise);return promise
}
async function weavelingPose(src,pose='reflect'){
  const key='w:'+pose+src;if(cache.has(key))return cache.get(key);
  const promise=new Promise(resolve=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas'),x=c.getContext('2d');c.width=img.naturalWidth;c.height=img.naturalHeight;const palettes={reflect:['#7ee5ff',1,false],plan:['#d4a8ff',.96,false],learn:['#b8e986',.94,false],build:['#ff9df0',1.02,true],acquire:['#f4c56b',.98,false],govern:['#ff4f91',.96,true]},[glow,scale,flip]=palettes[pose]||palettes.reflect;x.save();x.translate(c.width/2,c.height/2);x.scale(flip?-scale:scale,scale);x.shadowColor=glow;x.shadowBlur=Math.max(c.width,c.height)*.035;x.drawImage(img,-img.naturalWidth/2,-img.naturalHeight/2);x.restore();resolve(c.toDataURL('image/webp',.92))};img.onerror=()=>resolve(src);img.src=src});cache.set(key,promise);return promise
}
const rook={welcome:'assets/generated/rook-new/rook-welcome.png',button:'assets/generated/rook-new/rook-button.png',ledger:'assets/generated/rook-new/rook-ledger.png',point:'assets/generated/rook-new/rook-point-shop.png',celebrate:'assets/generated/rook-new/rook-celebrate.png',listen:'assets/generated/rook-new/rook-listen.png'};
function contextPose(){let i={};try{i=JSON.parse(localStorage.getItem('civweave.active-intention')||'{}')}catch{}const s=`${i.realm||''} ${i.nextRealm||''} ${i.status||''}`.toLowerCase();if(/living|learn|study/.test(s))return'learn';if(/cerban|build|work|quest/.test(s))return'build';if(/fellow|material|trade|offer|need/.test(s))return'acquire';if(/anarch|govern|approve|consent/.test(s))return'govern';if(i.steps?.length)return'plan';return'reflect'}
function repair(){return false}
window.CivweaveVisualAssets=Object.freeze({chroma,weavelingPose,rook,repair,contextPose,sourceTruth:true,runtimeCanonicalRepair:false});
})();
