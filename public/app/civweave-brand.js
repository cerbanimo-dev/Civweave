(()=>{
'use strict';

const VERSION='1.0.0';
const FULL_LOGO='/app/logos/civweave.svg';
const SYMBOL_LOGO='/app/logos/civweave-symbol.svg';
const SKIP_TAGS=new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','CODE','PRE']);
const ATTRIBUTES=['alt','title','aria-label','placeholder','content','data-label'];

function brandText(value){
  if(typeof value!=='string'||!value)return value;
  return value.replaceAll('COMMONWEAVE','CIVWEAVE').replaceAll('Commonweave','Civweave');
}

function brandImage(image){
  const source=image.getAttribute('src')||'';
  if(/\/app\/logos\/commonweave\.webp(?:[?#].*)?$/i.test(source)){
    image.setAttribute('src',FULL_LOGO);
    return;
  }
  if(/\/app\/logos\/commonweave-app-icon\.png(?:[?#].*)?$/i.test(source)){
    image.setAttribute('src',SYMBOL_LOGO);
  }
}

function brandElement(element){
  if(!(element instanceof Element))return;
  if(element instanceof HTMLImageElement)brandImage(element);
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
observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRIBUTES.concat('src','value')});

globalThis.CivweaveBrand=Object.freeze({version:VERSION,apply,fullLogo:FULL_LOGO,symbolLogo:SYMBOL_LOGO});
})();
