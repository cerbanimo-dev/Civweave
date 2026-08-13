(()=>{
'use strict';

const VERSION='1.0.27-brand-canonical-v317';
const CANONICAL_LOGO='/app/logos/civweave-pwa-512-v247.png';
const FULL_LOGO=CANONICAL_LOGO;
const SYMBOL_LOGO=CANONICAL_LOGO;
const SKIP_TAGS=new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','CODE','PRE']);
const ATTRIBUTES=['alt','title','aria-label','placeholder','content','data-label'];
const BRAND_ASSET=/(?:^|\/)(?:commonweave|civweave)(?:-symbol|-app-icon|-adaptive-foreground-512|-icon-(?:\d+|maskable-\d+))?\.(?:svg|png|webp)(?:[?#].*)?$/i;

function brandText(value){
  if(typeof value!=='string'||!value)return value;
  return value.replaceAll('COMMONWEAVE','CIVWEAVE').replaceAll('Commonweave','Civweave');
}
function isBrandAsset(value){return typeof value==='string'&&BRAND_ASSET.test(value)}
function brandImage(image){
  const source=image.getAttribute('src')||'';
  if(isBrandAsset(source)&&source!==CANONICAL_LOGO)image.setAttribute('src',CANONICAL_LOGO);
  const srcset=image.getAttribute('srcset')||'';
  if(srcset&&srcset.split(',').some(part=>isBrandAsset(part.trim().split(/\s+/)[0])))image.setAttribute('srcset',CANONICAL_LOGO);
}
function brandLink(link){
  const rel=(link.getAttribute('rel')||'').toLowerCase();
  if(!rel.split(/\s+/).some(value=>value==='icon'||value==='apple-touch-icon'))return;
  const href=link.getAttribute('href')||'';
  if(!href||isBrandAsset(href)){
    link.setAttribute('href',CANONICAL_LOGO);
    link.setAttribute('type','image/png');
  }
}
function brandMeta(meta){
  const key=(meta.getAttribute('property')||meta.getAttribute('name')||'').toLowerCase();
  if(!['og:image','twitter:image'].includes(key))return;
  const content=meta.getAttribute('content')||'';
  if(isBrandAsset(content))meta.setAttribute('content',CANONICAL_LOGO);
}
function brandElement(element){
  if(!(element instanceof Element))return;
  if(element instanceof HTMLImageElement)brandImage(element);
  if(element instanceof HTMLLinkElement)brandLink(element);
  if(element instanceof HTMLMetaElement)brandMeta(element);
  for(const name of ATTRIBUTES){
    if(!element.hasAttribute(name))continue;
    const current=element.getAttribute(name);
    const next=brandText(current);
    if(next!==current)element.setAttribute(name,next);
  }
  if(element instanceof HTMLInputElement&&['button','submit','reset'].includes(element.type)){
    const next=brandText(element.value);
    if(next!==element.value)element.value=next;
  }
}
function brandTree(root){
  if(!root)return;
  if(root.nodeType===Node.ELEMENT_NODE)brandElement(root);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{
    acceptNode(node){
      const parent=node.nodeType===Node.TEXT_NODE?node.parentElement:node;
      return parent&&SKIP_TAGS.has(parent.tagName)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;
    }
  });
  let node=walker.currentNode;
  while(node){
    if(node.nodeType===Node.TEXT_NODE){
      const next=brandText(node.nodeValue);
      if(next!==node.nodeValue)node.nodeValue=next;
    }else brandElement(node);
    node=walker.nextNode();
  }
}
function apply(){
  document.title=brandText(document.title);
  brandTree(document.documentElement);
  document.documentElement.dataset.publicBrand='civweave';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
else apply();
const observer=new MutationObserver(records=>{
  for(const record of records){
    if(record.type==='characterData'){
      const next=brandText(record.target.nodeValue);
      if(next!==record.target.nodeValue)record.target.nodeValue=next;
      continue;
    }
    for(const node of record.addedNodes)brandTree(node);
    if(record.type==='attributes')brandElement(record.target);
  }
});
observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRIBUTES.concat('src','srcset','href','value')});
globalThis.CivweaveBrand=Object.freeze({version:VERSION,apply,canonicalLogo:CANONICAL_LOGO,fullLogo:FULL_LOGO,symbolLogo:SYMBOL_LOGO,settingsDependency:false});
})();