(()=>{
'use strict';

const VERSION='1.0.32-asset-customization-v239';
const STORAGE_KEY='civweave.asset-lockboard.v239';
const STYLE_PATH_MARK='data-cw-asset-customized';

if(globalThis.CivweaveAssetCustomizationV239?.version===VERSION)return;

const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
let frame=0;
let observer=null;
let overrides=new Map();

function readConfig(){
  let value={};
  try{value=parse(localStorage.getItem(STORAGE_KEY),{})}catch{}
  const enabled=value.personalEnabled!==false;
  const rows=value.pathOverrides&&typeof value.pathOverrides==='object'?Object.entries(value.pathOverrides):[];
  overrides=new Map(enabled?rows.filter(([from,to])=>from&&to&&from!==to):[]);
  return{enabled,count:overrides.size};
}

function pathname(value,base=location.href){
  try{return decodeURI(new URL(value,base).pathname)}catch{return''}
}

function replacement(value,base=location.href){
  const path=pathname(value,base);
  return path&&overrides.get(path)||'';
}

function replaceUrlToken(value,base=location.href){
  const source=String(value||'');
  if(!source||!overrides.size)return source;
  return source.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi,(whole,quote,url)=>{
    const next=replacement(url,base);
    return next?`url("${next}")`:whole;
  });
}

function replaceSrcset(value,base=location.href){
  return String(value||'').split(',').map(part=>{
    const bits=part.trim().split(/\s+/);
    const next=replacement(bits[0],base);
    if(next)bits[0]=next;
    return bits.join(' ');
  }).join(', ');
}

function setAttributeIfChanged(node,name,next){
  if(!next)return false;
  const current=node.getAttribute(name)||'';
  if(current===next)return false;
  node.setAttribute(name,next);
  node.setAttribute(STYLE_PATH_MARK,'1');
  return true;
}

function applyElement(node){
  if(!(node instanceof Element)||!overrides.size)return false;
  let changed=false;
  for(const name of ['src','poster']){
    if(!node.hasAttribute(name))continue;
    const current=node.getAttribute(name)||'';
    const next=replacement(current,node.baseURI||location.href);
    if(next)changed=setAttributeIfChanged(node,name,next)||changed;
  }
  if(node.hasAttribute('href')&&(node.matches('link[rel~="icon"],image,use')||node.namespaceURI==='http://www.w3.org/2000/svg')){
    const current=node.getAttribute('href')||'';
    const next=replacement(current,node.baseURI||location.href);
    if(next)changed=setAttributeIfChanged(node,'href',next)||changed;
  }
  if(node.hasAttribute('srcset')){
    const current=node.getAttribute('srcset')||'';
    const next=replaceSrcset(current,node.baseURI||location.href);
    if(next!==current)changed=setAttributeIfChanged(node,'srcset',next)||changed;
  }
  if(node.hasAttribute('style')){
    const current=node.getAttribute('style')||'';
    const next=replaceUrlToken(current,node.baseURI||location.href);
    if(next!==current)changed=setAttributeIfChanged(node,'style',next)||changed;
  }
  return changed;
}

function applyTree(root=document){
  if(!overrides.size)return 0;
  let changed=0;
  if(root instanceof Element&&applyElement(root))changed+=1;
  const nodes=root.querySelectorAll?.('img[src],source[src],source[srcset],video[poster],input[type="image"][src],link[rel~="icon"][href],svg image[href],svg use[href],[style*="url("]')||[];
  for(const node of nodes)if(applyElement(node))changed+=1;
  return changed;
}

function walkRules(rules,base){
  if(!rules)return 0;
  let changed=0;
  for(const rule of rules){
    if(rule.cssRules){changed+=walkRules(rule.cssRules,base);continue}
    const style=rule.style;
    if(!style)continue;
    for(const property of [...style]){
      const current=style.getPropertyValue(property);
      if(!/url\(/i.test(current))continue;
      const next=replaceUrlToken(current,base);
      if(next===current)continue;
      try{style.setProperty(property,next,style.getPropertyPriority(property));changed+=1}catch{}
    }
  }
  return changed;
}

function applyStylesheets(){
  if(!overrides.size)return 0;
  let changed=0;
  for(const sheet of [...document.styleSheets]){
    let rules;
    try{rules=sheet.cssRules}catch{continue}
    changed+=walkRules(rules,sheet.href||location.href);
  }
  return changed;
}

function apply(){
  frame=0;
  readConfig();
  const dom=applyTree(document);
  const css=applyStylesheets();
  document.documentElement.dataset.civweaveAssetCustomization=overrides.size?'active':'off';
  try{dispatchEvent(new CustomEvent('civweave:asset-customization-applied',{detail:{version:VERSION,overrides:overrides.size,dom,css}}))}catch{}
  return{overrides:overrides.size,dom,css};
}

function schedule(){
  if(frame)return;
  frame=requestAnimationFrame(apply);
}

function observe(){
  observer?.disconnect();
  observer=new MutationObserver(records=>{
    if(!overrides.size)return;
    let touched=false;
    for(const record of records){
      if(record.type==='attributes'){
        if(applyElement(record.target))touched=true;
        continue;
      }
      for(const node of record.addedNodes){
        if(node instanceof Element){applyTree(node);touched=true}
      }
    }
    if(touched)document.documentElement.dataset.civweaveAssetCustomization='active';
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset','poster','href','style']});
}

function destroy(){
  observer?.disconnect();
  if(frame)cancelAnimationFrame(frame);
  removeEventListener('storage',onStorage);
  removeEventListener('civweave:asset-lockboard-changed',schedule);
}

function onStorage(event){if(!event.key||event.key===STORAGE_KEY)schedule()}

function boot(){
  readConfig();
  apply();
  observe();
  addEventListener('storage',onStorage);
  addEventListener('civweave:asset-lockboard-changed',schedule);
  addEventListener('load',schedule,{once:true});
  addEventListener('pagehide',destroy,{once:true});
}

document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();

globalThis.CivweaveAssetCustomizationV239=Object.freeze({version:VERSION,storageKey:STORAGE_KEY,refresh:schedule,apply,destroy,state:()=>({overrides:overrides.size})});
})();
