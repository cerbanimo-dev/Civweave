(()=>{
'use strict';

const VERSION='guild-symbol-v1';
const SRC='/app/assets/guild-symbol.png';
const STYLE_ID='cw-guild-symbol-v1-style';
const ICON_CLASS='cw-guild-symbol-icon';
let queued=false;

function installStyle(doc=document){
  if(!doc?.documentElement||doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
.${ICON_CLASS}{display:inline-block;width:1.25em;height:1.25em;object-fit:contain;flex:0 0 auto;vertical-align:-.22em}
.realm-icon.guilds .${ICON_CLASS},.ri.guilds .${ICON_CLASS}{width:100%;height:100%;max-width:2rem;max-height:2rem;vertical-align:middle}
#cw-guild-quest-browser-v1 .cw-gqb-icon .${ICON_CLASS}{width:24px;height:24px;vertical-align:middle}
#cw-working-campus-guilds-v243 .${ICON_CLASS}{width:1.55rem;height:1.55rem}
`;
  (doc.head||doc.documentElement).append(style);
}

function makeIcon(doc=document){
  const img=doc.createElement('img');
  img.src=SRC;
  img.alt='';
  img.className=ICON_CLASS;
  img.setAttribute('aria-hidden','true');
  img.decoding='async';
  return img;
}

function replaceSlot(slot){
  if(!slot||slot.dataset?.cwGuildSymbol==='1')return false;
  const doc=slot.ownerDocument||document;
  installStyle(doc);
  if(slot.tagName==='IMG'){
    slot.src=SRC;
    slot.alt='';
    slot.classList.add(ICON_CLASS);
    slot.setAttribute('aria-hidden','true');
  }else{
    slot.replaceChildren(makeIcon(doc));
    slot.setAttribute('aria-hidden','true');
  }
  slot.dataset.cwGuildSymbol='1';
  return true;
}

function replaceLeadingFlag(node){
  if(!node||node.dataset?.cwGuildSymbol==='1')return false;
  const text=String(node.textContent||'').trim();
  if(!/^\s*[⚑⚐]\s*/.test(text)||! /\bguilds?\b/i.test(text))return false;
  const label=text.replace(/^\s*[⚑⚐]\s*/,'');
  const doc=node.ownerDocument||document;
  installStyle(doc);
  node.replaceChildren(makeIcon(doc),doc.createTextNode(` ${label}`));
  node.dataset.cwGuildSymbol='1';
  return true;
}

function enhance(doc=document){
  if(!doc?.querySelectorAll)return;
  installStyle(doc);

  doc.querySelectorAll('.realm-icon.guilds,.ri.guilds,[data-realm="guild"] .realm-icon,[data-realm="guilds"] .realm-icon,#cw-guild-quest-browser-v1 .cw-gqb-icon').forEach(replaceSlot);

  doc.querySelectorAll('.mode-text,button,a,[role="button"],[role="menuitem"],summary').forEach(control=>{
    const label=String(control.getAttribute?.('aria-label')||control.textContent||'');
    if(!/\bguilds?\b/i.test(label))return;
    if(replaceLeadingFlag(control))return;
    const direct=[...(control.children||[])].find(child=>{
      if(child.classList?.contains(ICON_CLASS))return false;
      if(/\bguilds?\b/i.test(String(child.textContent||'')))return false;
      return child.matches?.('img,svg,.icon,[class~="icon"],[class*="-icon"],[aria-hidden="true"]');
    });
    if(direct)replaceSlot(direct);
  });

  doc.querySelectorAll('iframe').forEach(wireFrame);
}

function schedule(doc=document){
  if(queued)return;
  queued=true;
  (doc.defaultView?.requestAnimationFrame||requestAnimationFrame)(()=>{
    queued=false;
    enhance(doc);
  });
}

function wireFrame(frame){
  if(!frame||frame.dataset?.cwGuildSymbolFrame==='1')return;
  frame.dataset.cwGuildSymbolFrame='1';
  const sync=()=>{try{wire(frame.contentDocument)}catch{}};
  frame.addEventListener('load',sync);
  sync();
}

function wire(doc=document){
  if(!doc?.documentElement)return;
  enhance(doc);
  if(doc.documentElement.dataset.cwGuildSymbolObserver==='1')return;
  doc.documentElement.dataset.cwGuildSymbolObserver='1';
  const observer=new MutationObserver(()=>schedule(doc));
  observer.observe(doc.documentElement,{childList:true,subtree:true,characterData:true});
}

function start(){wire(document)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();

globalThis.CivweaveGuildSymbolV1=Object.freeze({version:VERSION,src:SRC,refresh:()=>enhance(document)});
})();
