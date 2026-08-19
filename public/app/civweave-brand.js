(()=>{
'use strict';

const VERSION='1.0.34-ai-pack-browser-downloads-v1';
const DAY_LOGO='/app/logos/civweave-day-logo.jpg';
const NIGHT_LOGO='/app/logos/civweave-night-logo.jpg';
const CANONICAL_LOGO=DAY_LOGO;
const FULL_LOGO=CANONICAL_LOGO;
const SYMBOL_LOGO=CANONICAL_LOGO;
const LANGUAGE_KEY='civweave.language.v1';
const JAPANESE_RUNTIME='/app/japanese-mode-v1.js?v=japanese-shell-language-v2';
const JAPANESE_SHELL_COPY='/app/japanese-shell-copy-v1.js?v=japanese-shell-language-v2';
const SUPPORT_URL='https://www.patreon.com/c/Civweave';
const LUD_MODE_URL='/app/lud/';
const CREATOR_SUITE_URL='/creator-suite/';
const AI_PACK_BROWSER_DOWNLOADS='/app/installer-ai-pack-downloads-v1.js?v=browser-download-manager-v1';

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

function ensureAiPackBrowserDownloads(){
  if(location.pathname!=='/app/index.html')return false;
  if(globalThis.CivweaveInstallerAiPackDownloadsV1||document.querySelector('script[data-civweave-ai-pack-browser-loader]'))return true;
  const script=document.createElement('script');
  script.src=AI_PACK_BROWSER_DOWNLOADS;
  script.async=false;
  script.dataset.civweaveAiPackBrowserLoader='v1';
  document.head?.append(script);
  return true;
}

function ensureLudModeLink(){
  if(location.pathname!=='/app/index.html')return false;
  if(document.querySelector('[data-civweave-lud-mode-download]'))return true;
  const footer=document.querySelector('.quest-footer-note');
  const main=document.querySelector('main.gateway');
  if(!main)return false;
  const panel=document.createElement('aside');
  panel.dataset.civweaveLudModeDownload='';
  panel.setAttribute('aria-label','Optional Lud Mode download');
  panel.style.cssText='max-width:760px;margin:12px auto;padding:12px;border:1px solid #ffd45f66;border-radius:14px;background:linear-gradient(145deg,#171b12dd,#16152add);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#fffaf0;';
  const copy=document.createElement('span');
  copy.style.cssText='display:grid;gap:3px;min-width:0;flex:1 1 360px;';
  const title=document.createElement('strong');
  title.textContent='Lud Mode — human-operated Civweave';
  const detail=document.createElement('small');
  detail.textContent='Download the separate no-AI Civweave lane with the Lud HUD, Questboard, human validation, Passport, Guild, and human-only FellowFare tools.';
  detail.style.cssText='color:#d5cfb4;line-height:1.4;';
  const link=document.createElement('a');
  link.href=LUD_MODE_URL;
  link.textContent='Download Lud Mode';
  link.setAttribute('aria-label','Open the separate Civweave Lud Mode download');
  link.style.cssText='display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:8px 11px;border:1px solid #ffd45f88;border-radius:10px;background:#3b2f16;color:#fff8d6;text-decoration:none;font-weight:850;white-space:nowrap;';
  copy.append(title,detail);
  panel.append(copy,link);
  if(footer)footer.insertAdjacentElement('beforebegin',panel);else main.append(panel);
  return true;
}

function ensureCreatorSuiteLink(){
  if(location.pathname!=='/app/index.html')return false;
  if(document.querySelector('[data-civweave-creator-suite-download]'))return true;
  const footer=document.querySelector('.quest-footer-note');
  const main=document.querySelector('main.gateway');
  if(!main)return false;
  const panel=document.createElement('aside');
  panel.dataset.civweaveCreatorSuiteDownload='';
  panel.setAttribute('aria-label','Optional Creator Suite download');
  panel.style.cssText='max-width:760px;margin:12px auto;padding:12px;border:1px solid #8de5ef55;border-radius:14px;background:#07151fcc;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#dffcff;';
  const copy=document.createElement('span');
  copy.style.cssText='display:grid;gap:3px;min-width:0;flex:1 1 360px;';
  const title=document.createElement('strong');
  title.textContent='Creator Suite — optional separate download';
  const detail=document.createElement('small');
  detail.textContent='Install the offline-first text, audio, and video workspace with tracked human/AI creation provenance. It is not bundled with Civweave core.';
  detail.style.cssText='color:#b9cbd1;line-height:1.4;';
  const link=document.createElement('a');
  link.href=CREATOR_SUITE_URL;
  link.textContent='Download Creator Suite';
  link.setAttribute('aria-label','Open the separate Civweave Creator Suite download');
  link.style.cssText='display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:8px 11px;border:1px solid #8de5ef77;border-radius:10px;background:#12303a;color:#efffff;text-decoration:none;font-weight:850;white-space:nowrap;';
  copy.append(title,detail);
  panel.append(copy,link);
  if(footer)footer.insertAdjacentElement('beforebegin',panel);else main.append(panel);
  return true;
}

function ensureInstallerSupportLink(){
  if(location.pathname!=='/app/index.html')return false;
  if(document.querySelector('[data-civweave-core-support]'))return true;
  const footer=document.querySelector('.quest-footer-note');
  const main=document.querySelector('main.gateway');
  if(!main)return false;
  const panel=document.createElement('aside');
  panel.dataset.civweaveCoreSupport='';
  panel.setAttribute('aria-label','Support Civweave directly');
  panel.style.cssText='max-width:760px;margin:12px auto 28px;padding:10px 12px;border:1px solid #8de5ef44;border-radius:14px;background:#07151fcc;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#dffcff;';
  const copy=document.createElement('span');
  copy.style.cssText='display:grid;gap:2px;min-width:0;';
  const title=document.createElement('strong');
  title.textContent='Support Civweave directly';
  const detail=document.createElement('small');
  detail.textContent='Help Cerbanimo maintain the shared Civweave software and infrastructure.';
  detail.style.cssText='color:#b9cbd1;line-height:1.35;';
  const link=document.createElement('a');
  link.href=SUPPORT_URL;
  link.target='_blank';
  link.rel='noopener noreferrer';
  link.textContent='patreon.com/c/Civweave';
  link.setAttribute('aria-label','Support Civweave directly on Patreon');
  link.style.cssText='display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:7px 10px;border:1px solid #e8c96b66;border-radius:10px;background:#3b2f16;color:#fff;text-decoration:none;font-weight:850;white-space:nowrap;';
  copy.append(title,detail);
  panel.append(copy,link);
  if(footer)footer.insertAdjacentElement('afterend',panel);else main.append(panel);
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
  ensureAiPackBrowserDownloads();
  ensureLudModeLink();
  ensureCreatorSuiteLink();
  ensureInstallerSupportLink();
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
  ensureAiPackBrowserDownloads,
  aiPackBrowserDownloadsUrl:AI_PACK_BROWSER_DOWNLOADS,
  ensureLudModeLink,
  ludModeUrl:LUD_MODE_URL,
  ensureCreatorSuiteLink,
  creatorSuiteUrl:CREATOR_SUITE_URL,
  ensureInstallerSupportLink,
  supportUrl:SUPPORT_URL,
  logoForLocalClock,
  syncBrowserIcon,
  dayLogo:DAY_LOGO,
  nightLogo:NIGHT_LOGO
});
})();
