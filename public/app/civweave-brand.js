(()=>{
'use strict';

const VERSION='1.0.28-brand-canonical-v319-language-switch';
const CANONICAL_LOGO='/app/logos/civweave-pwa-512-v247.png';
const FULL_LOGO=CANONICAL_LOGO;
const SYMBOL_LOGO=CANONICAL_LOGO;
const LANGUAGE_KEY='civweave.language.v1';
const JAPANESE_RUNTIME='/app/japanese-mode-v1.js?v=japanese-shell-language-v2';
const JAPANESE_SHELL_COPY='/app/japanese-shell-copy-v1.js?v=japanese-shell-language-v2';
const LANGUAGE_SWITCH_STYLE_ID='cw-language-route-control-style';
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
function wantsJapanese(){
  try{
    const params=new URLSearchParams(location.search);
    const explicit=(params.get('lang')||params.get('locale')||'').toLowerCase();
    if(explicit==='ja'||explicit==='ja-jp'||params.get('japanese')==='1'){localStorage.setItem(LANGUAGE_KEY,'ja');return true}
    if(explicit==='en'||explicit==='en-us'){localStorage.setItem(LANGUAGE_KEY,'en');return false}
    return localStorage.getItem(LANGUAGE_KEY)==='ja';
  }catch{return false}
}
function appendLanguageScript(src,marker){
  if(document.querySelector(`script[data-civweave-language-runtime="${marker}"]`))return false;
  const script=document.createElement('script');script.src=src;script.async=false;script.dataset.civweaveLanguageRuntime=marker;document.head.append(script);return true
}
function installLanguageRuntime(){
  if(!wantsJapanese())return false;
  if(!globalThis.CivweaveJapaneseModeV1)appendLanguageScript(JAPANESE_RUNTIME,'japanese-mode');
  if(!globalThis.CivweaveJapaneseShellCopyV1)appendLanguageScript(JAPANESE_SHELL_COPY,'japanese-shell-copy');
  return true
}
function ensureLanguageSwitchStyles(){
  if(document.getElementById(LANGUAGE_SWITCH_STYLE_ID))return;
  const style=document.createElement('style');
  style.id=LANGUAGE_SWITCH_STYLE_ID;
  style.textContent='.cw-language-route-control{position:relative;z-index:4;display:inline-flex!important;align-items:center;justify-content:center;min-height:32px;padding:6px 9px!important;border:1px solid currentColor!important;border-radius:999px!important;background:color-mix(in srgb,currentColor 9%,transparent)!important;color:inherit!important;font:800 11px/1 system-ui,-apple-system,"Noto Sans JP",sans-serif!important;cursor:pointer!important;white-space:nowrap!important}@media(max-width:560px){.cw-language-route-control{min-height:30px;padding:5px 8px!important}}';
  (document.head||document.documentElement).append(style);
}
function ensureEnglishLanguageControl(){
  if(wantsJapanese()||document.querySelector('[data-cw-en-language-control]'))return false;
  const host=document.getElementById('cwf104-head')||document.querySelector('.top,header,[role="banner"]');
  if(!host)return false;
  ensureLanguageSwitchStyles();
  const button=document.createElement('button');
  button.type='button';
  button.className='cw-language-route-control';
  button.dataset.cwEnLanguageControl='';
  button.textContent='JP';
  button.title='日本語に切り替える';
  button.setAttribute('aria-label','Switch Civweave to Japanese');
  button.addEventListener('click',()=>{
    try{localStorage.setItem(LANGUAGE_KEY,'ja')}catch{}
    const next=new URL('/ja/',location.origin);
    next.searchParams.set('lang','ja');
    next.searchParams.set('source','english-language-switch-v1');
    location.assign(next.href);
  });
  host.append(button);
  return true;
}
function installInstallerDeliveryBridge(){
  if(location.pathname!=='/app/index.html'||document.querySelector('script[data-civweave-hub-delivery-intent]'))return false;
  const script=document.createElement('script');script.src='/app/hub-delivery-intent-v1.js?v=hub-recovery-inbound-v1';script.async=false;script.dataset.civweaveHubDeliveryIntent='v1';document.head.append(script);return true
}
function apply(){
  document.title=brandText(document.title);
  brandTree(document.documentElement);
  document.documentElement.dataset.publicBrand='civweave';
  installLanguageRuntime();
  ensureEnglishLanguageControl();
  installInstallerDeliveryBridge();
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
  ensureEnglishLanguageControl();
});
observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRIBUTES.concat('src','srcset','href','value')});
globalThis.CivweaveBrand=Object.freeze({version:VERSION,apply,canonicalLogo:CANONICAL_LOGO,fullLogo:FULL_LOGO,symbolLogo:SYMBOL_LOGO,settingsDependency:false,installLanguageRuntime,ensureEnglishLanguageControl,installInstallerDeliveryBridge});
})();