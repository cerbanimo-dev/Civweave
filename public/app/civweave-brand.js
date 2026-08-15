(()=>{
'use strict';

const VERSION='1.0.30-current-logo-clock-v1';
const DAY_LOGO='/app/logos/civweave-day-logo.jpg';
const NIGHT_LOGO='/app/logos/civweave-night-logo.jpg';
const CANONICAL_LOGO=DAY_LOGO;
const FULL_LOGO=CANONICAL_LOGO;
const SYMBOL_LOGO=CANONICAL_LOGO;
const LANGUAGE_KEY='civweave.language.v1';
const JAPANESE_RUNTIME='/app/japanese-mode-v1.js?v=japanese-shell-language-v2';
const JAPANESE_SHELL_COPY='/app/japanese-shell-copy-v1.js?v=japanese-shell-language-v2';

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
  const script=document.createElement('script');
  script.src=src;
  script.async=false;
  script.dataset.civweaveLanguageRuntime=marker;
  document.head?.append(script);
  return true;
}

function installLanguageRuntime(){
  if(!wantsJapanese())return false;
  if(!globalThis.CivweaveJapaneseModeV1)appendLanguageScript(JAPANESE_RUNTIME,'japanese-mode');
  if(!globalThis.CivweaveJapaneseShellCopyV1)appendLanguageScript(JAPANESE_SHELL_COPY,'japanese-shell-copy');
  return true;
}

function bindEnglishLanguageControl(){
  if(wantsJapanese())return false;
  const button=document.querySelector('[data-cw-en-language-control]');
  if(!button||button.dataset.cwLanguageBound==='true')return Boolean(button);
  button.dataset.cwLanguageBound='true';
  button.addEventListener('click',()=>{
    try{localStorage.setItem(LANGUAGE_KEY,'ja')}catch{}
    const next=new URL('/ja/',location.origin);
    next.searchParams.set('lang','ja');
    next.searchParams.set('source','english-language-switch-v1');
    location.assign(next.href);
  });
  return true;
}

function installInstallerDeliveryBridge(){
  if(location.pathname!=='/app/index.html'||document.querySelector('script[data-civweave-hub-delivery-intent]'))return false;
  const script=document.createElement('script');
  script.src='/app/hub-delivery-intent-v1.js?v=hub-recovery-inbound-v1';
  script.async=false;
  script.dataset.civweaveHubDeliveryIntent='v1';
  document.head?.append(script);
  return true;
}

function logoForLocalClock(date=new Date()){
  const hour=Number(date?.getHours?.());
  return Number.isFinite(hour)&&hour>=6&&hour<18?DAY_LOGO:NIGHT_LOGO;
}

function syncBrowserIcon(){
  let icon=document.querySelector('link[rel~="icon"]');
  if(!icon){icon=document.createElement('link');icon.rel='icon';document.head?.append(icon)}
  if(!icon)return false;
  icon.type='image/jpeg';
  icon.href=logoForLocalClock();
  icon.dataset.civweaveClockLogo=icon.href.includes('night')?'night':'day';
  return true;
}

function apply(){
  document.documentElement.dataset.publicBrand='civweave';
  syncBrowserIcon();
  installLanguageRuntime();
  bindEnglishLanguageControl();
  installInstallerDeliveryBridge();
  return true;
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
else apply();

globalThis.CivweaveBrand=Object.freeze({
  version:VERSION,
  apply,
  canonicalLogo:CANONICAL_LOGO,
  fullLogo:FULL_LOGO,
  symbolLogo:SYMBOL_LOGO,
  settingsDependency:false,
  sourceTruth:true,
  runtimeBrandRewrite:false,
  installLanguageRuntime,
  ensureEnglishLanguageControl:bindEnglishLanguageControl,
  installInstallerDeliveryBridge,
  logoForLocalClock,
  syncBrowserIcon,
  dayLogo:DAY_LOGO,
  nightLogo:NIGHT_LOGO
});
})();
