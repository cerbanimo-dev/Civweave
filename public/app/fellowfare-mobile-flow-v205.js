(()=>{
'use strict';
const VERSION='fellowfare-mobile-flow-v205';
if(globalThis.CommonweaveFellowFareMobileFlowV205?.version===VERSION)return;

const iframe=document.getElementById('ffc144-workbench');
const shell=iframe?.closest('.ffc144-frame');
const mobileQuery=matchMedia('(max-width: 760px)');
const INNER_LAYOUT_SELECTOR='.app-shell,#main,.ff-world-main,.ff-projected-main,.ff-route-scene,.ff-world-projection';
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

function markMobileNode(node){
  if(!node||node.dataset.ffcParentMobileNode==='true')return;
  node.dataset.ffcParentMobileNode='true';
  node.style.setProperty('height','auto','important');
  node.style.setProperty('min-height','0','important');
  node.style.setProperty('max-height','none','important');
  node.style.setProperty('overflow-x','hidden','important');
  node.style.setProperty('overflow-y','visible','important');
}

function prepareInnerMobile(doc){
  const root=doc.documentElement;
  const body=doc.body;
  if(root?.getAttribute('data-ffc-parent-mobile-flow')!=='true')root?.setAttribute('data-ffc-parent-mobile-flow','true');
  markMobileNode(root);
  markMobileNode(body);
  if(root&&root.style.getPropertyValue('overscroll-behavior-y')!=='auto')root.style.setProperty('overscroll-behavior-y','auto','important');
  if(body){
    if(body.style.getPropertyValue('overscroll-behavior-y')!=='auto')body.style.setProperty('overscroll-behavior-y','auto','important');
    if(body.style.getPropertyValue('touch-action')!=='pan-y')body.style.setProperty('touch-action','pan-y','important');
  }
  doc.querySelectorAll(INNER_LAYOUT_SELECTOR).forEach(markMobileNode);
  const localNav=doc.querySelector('.bottom-nav');
  if(localNav&&localNav.dataset.ffcParentMobileNode!=='true'){
    localNav.dataset.ffcParentMobileNode='true';
    localNav.style.setProperty('display','none','important');
  }
}

function restoreInnerDesktop(doc){
  const root=doc?.documentElement;
  root?.removeAttribute('data-ffc-parent-mobile-flow');
  doc?.querySelectorAll('[data-ffc-parent-mobile-node="true"]').forEach(node=>{
    delete node.dataset.ffcParentMobileNode;
    for(const property of ['display','height','min-height','max-height','overflow-x','overflow-y','overscroll-behavior-y','touch-action'])node.style.removeProperty(property);
  });
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
globalThis.visualViewport?.addEventListener('resize',settle,{passive:true});
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
