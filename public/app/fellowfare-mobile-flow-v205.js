(()=>{
'use strict';
const VERSION='fellowfare-mobile-flow-v205';
if(globalThis.CommonweaveFellowFareMobileFlowV205?.version===VERSION)return;

const iframe=document.getElementById('ffc144-workbench');
const shell=iframe?.closest('.ffc144-frame');
const mobileQuery=matchMedia('(max-width: 760px)');
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
  settleTimers=[80,220,520,1100].map(delay=>setTimeout(scheduleMeasure,delay));
}

function naturalHeight(doc){
  const root=doc.documentElement;
  const body=doc.body;
  return Math.max(
    root?.scrollHeight||0,
    root?.offsetHeight||0,
    root?.clientHeight||0,
    body?.scrollHeight||0,
    body?.offsetHeight||0,
    body?.clientHeight||0,
    480
  );
}

function prepareInnerMobile(doc){
  const root=doc.documentElement;
  const body=doc.body;
  root?.setAttribute('data-ffc-parent-mobile-flow','true');
  if(root){
    root.style.setProperty('height','auto','important');
    root.style.setProperty('min-height','0','important');
    root.style.setProperty('overflow-x','hidden','important');
    root.style.setProperty('overflow-y','visible','important');
    root.style.setProperty('overscroll-behavior-y','auto','important');
  }
  if(body){
    body.style.setProperty('height','auto','important');
    body.style.setProperty('min-height','0','important');
    body.style.setProperty('overflow-x','hidden','important');
    body.style.setProperty('overflow-y','visible','important');
    body.style.setProperty('overscroll-behavior-y','auto','important');
    body.style.setProperty('touch-action','pan-y','important');
  }
}

function restoreInnerDesktop(doc){
  const root=doc?.documentElement;
  const body=doc?.body;
  root?.removeAttribute('data-ffc-parent-mobile-flow');
  for(const node of [root,body]){
    if(!node)continue;
    for(const property of ['height','min-height','overflow-x','overflow-y','overscroll-behavior-y','touch-action'])node.style.removeProperty(property);
  }
}

function measure(){
  if(!iframe||!shell)return;
  const doc=innerDocument();
  if(!doc)return;
  if(!mobileQuery.matches){
    document.body.classList.remove('ffc144-mobile-flow');
    document.body.style.removeProperty('--ffc144-mobile-frame-height');
    shell.style.removeProperty('height');
    iframe.style.removeProperty('height');
    iframe.setAttribute('scrolling','yes');
    restoreInnerDesktop(doc);
    lastHeight=0;
    return;
  }

  prepareInnerMobile(doc);
  const height=Math.ceil(naturalHeight(doc));
  if(Math.abs(height-lastHeight)>2){
    lastHeight=height;
    document.body.style.setProperty('--ffc144-mobile-frame-height',`${height}px`);
    shell.style.setProperty('height',`${height}px`,'important');
    iframe.style.setProperty('height','100%','important');
  }
  document.body.classList.add('ffc144-mobile-flow');
  iframe.setAttribute('scrolling','no');
}

function bindInner(){
  clearObservers();
  const doc=innerDocument();
  if(!doc)return;
  if(typeof ResizeObserver==='function'){
    resizeObserver=new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(doc.documentElement);
    if(doc.body)resizeObserver.observe(doc.body);
  }
  mutationObserver=new MutationObserver(scheduleMeasure);
  mutationObserver.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});
  innerResizeHandler=scheduleMeasure;
  try{iframe.contentWindow.addEventListener('resize',innerResizeHandler,{passive:true})}catch{}
  settle();
}

iframe?.addEventListener('load',bindInner);
mobileQuery.addEventListener?.('change',()=>{bindInner();settle()});
addEventListener('resize',settle,{passive:true});
addEventListener('orientationchange',settle,{passive:true});
visualViewport?.addEventListener('resize',settle,{passive:true});
document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-ffc-command], [data-ffc-rook-action], .ffc144-frame button, .ffc144-frame a'))settle();
},true);
addEventListener('message',event=>{
  if(event.source===iframe?.contentWindow)settle();
});

if(iframe?.contentDocument?.readyState==='complete')bindInner();
else settle();

globalThis.CommonweaveFellowFareMobileFlowV205={version:VERSION,measure:scheduleMeasure,rebind:bindInner,status:()=>({mobile:mobileQuery.matches,height:lastHeight,bound:Boolean(innerDocument())})};
})();
