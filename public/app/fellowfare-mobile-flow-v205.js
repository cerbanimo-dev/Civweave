(()=>{
'use strict';
const VERSION='fellowfare-mobile-flow-v205';
const REVISION='fellowfare-page-flow-v206';
if(globalThis.CivweaveFellowFarePageFlowV206?.revision===REVISION)return;

const iframe=document.getElementById('ffc144-workbench');
const shell=iframe?.closest('.ffc144-frame');
const INNER_LAYOUT_SELECTOR='.app-shell,#app,#main,.ff-world-main,.ff-projected-main,.ff-route-scene,.ff-world-projection';
let resizeObserver=null;
let mutationObserver=null;
let innerResizeHandler=null;
let frameRaf=0;
let settleTimers=[];
let lastHeight=0;

function innerDocument(){
  try{return iframe?.contentDocument||null}catch{return null}
}

function clearObservers(){
  resizeObserver?.disconnect();
  mutationObserver?.disconnect();
  resizeObserver=null;
  mutationObserver=null;
  if(innerResizeHandler&&iframe?.contentWindow){
    try{iframe.contentWindow.removeEventListener('resize',innerResizeHandler)}catch{}
  }
  innerResizeHandler=null;
  settleTimers.forEach(clearTimeout);
  settleTimers=[];
}

function scheduleMeasure(){
  cancelAnimationFrame(frameRaf);
  frameRaf=requestAnimationFrame(measure);
}

function settle(){
  scheduleMeasure();
  settleTimers.forEach(clearTimeout);
  settleTimers=[60,160,360,760,1400].map(delay=>setTimeout(scheduleMeasure,delay));
}

function markFlowNode(node){
  if(!node)return;
  node.dataset.ffcParentPageFlow='true';
  node.style.setProperty('height','auto','important');
  node.style.setProperty('min-height','0','important');
  node.style.setProperty('max-height','none','important');
  node.style.setProperty('overflow-x','hidden','important');
  node.style.setProperty('overflow-y','visible','important');
  node.style.setProperty('overscroll-behavior-y','auto','important');
}

function prepareInner(doc){
  const root=doc.documentElement;
  const body=doc.body;
  root?.setAttribute('data-ffc-parent-page-flow','true');
  markFlowNode(root);
  markFlowNode(body);
  doc.querySelectorAll(INNER_LAYOUT_SELECTOR).forEach(markFlowNode);
  if(body)body.style.setProperty('touch-action','pan-y','important');

  const app=doc.querySelector('#app,.app-shell');
  if(app){
    app.style.setProperty('padding-bottom','0','important');
    app.style.setProperty('margin-bottom','0','important');
  }

  /* Parent tabs already own Market / Sell / Orders / Wallet / You. The child
     fixed nav was the element colliding with the shared guide window. */
  const localNav=doc.querySelector('.bottom-nav');
  if(localNav){
    localNav.dataset.ffcParentPageFlow='true';
    localNav.style.setProperty('display','none','important');
  }
}

function naturalHeight(doc){
  const body=doc.body;
  const app=doc.querySelector('#app,.app-shell');
  const main=doc.querySelector('#main');
  const candidates=[
    main?.scrollHeight,main?.offsetHeight,
    app?.scrollHeight,app?.offsetHeight,
    body?.scrollHeight,body?.offsetHeight
  ].map(Number).filter(Number.isFinite);
  return Math.max(480,...candidates);
}

function measure(){
  if(!iframe||!shell)return;
  const doc=innerDocument();
  if(!doc)return;
  prepareInner(doc);

  const height=Math.ceil(naturalHeight(doc));
  if(Math.abs(height-lastHeight)>2){
    lastHeight=height;
    document.body.style.setProperty('--ffc144-flow-height',`${height}px`);
    document.body.style.setProperty('--ffc144-mobile-frame-height',`${height}px`);
    shell.style.setProperty('height','auto','important');
    shell.style.setProperty('min-height','0','important');
    shell.style.setProperty('overflow','visible','important');
    iframe.style.setProperty('height',`${height}px`,'important');
  }
  document.body.classList.add('ffc144-page-flow');
  document.body.classList.add('ffc144-mobile-flow');
  iframe.setAttribute('scrolling','no');
}

function bindInner(){
  clearObservers();
  const doc=innerDocument();
  if(!doc)return;
  prepareInner(doc);
  if(typeof ResizeObserver==='function'){
    resizeObserver=new ResizeObserver(scheduleMeasure);
    const main=doc.querySelector('#main');
    const app=doc.querySelector('#app,.app-shell');
    if(main)resizeObserver.observe(main);
    if(app)resizeObserver.observe(app);
    if(doc.body)resizeObserver.observe(doc.body);
  }
  mutationObserver=new MutationObserver(scheduleMeasure);
  mutationObserver.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});
  innerResizeHandler=settle;
  try{iframe.contentWindow.addEventListener('resize',innerResizeHandler,{passive:true})}catch{}
  settle();
}

iframe?.addEventListener('load',bindInner);
addEventListener('resize',settle,{passive:true});
addEventListener('orientationchange',settle,{passive:true});
globalThis.visualViewport?.addEventListener('resize',settle,{passive:true});
document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-ffc-command], [data-ffc-rook-action], .ffc144-frame button, .ffc144-frame a'))settle();
},true);
addEventListener('message',event=>{if(event.source===iframe?.contentWindow)settle()});

if(iframe?.contentDocument?.readyState==='complete')bindInner();
else settle();

const api={version:VERSION,revision:REVISION,measure:scheduleMeasure,rebind:bindInner,status:()=>({singleScroll:true,height:lastHeight,bound:Boolean(innerDocument())})};
globalThis.CivweaveFellowFarePageFlowV206=api;
globalThis.CivweaveFellowFareMobileFlowV205=api;
})();
