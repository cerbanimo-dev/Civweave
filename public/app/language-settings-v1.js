(()=>{
'use strict';
const VERSION='language-settings-v1-compat-v320';
const LANGUAGE_KEY='civweave.language.v1';
if(globalThis.CivweaveLanguageSettingsV1?.version===VERSION)return;
function normalize(value){return String(value||'').toLowerCase().startsWith('ja')?'ja':'en'}
function current(){try{return normalize(localStorage.getItem(LANGUAGE_KEY)||'en')}catch{return'en'}}
function persist(value){const canonical=globalThis.CivweaveSettingsV320;if(canonical?.persistLanguage)return canonical.persistLanguage(value);const language=normalize(value);try{localStorage.setItem(LANGUAGE_KEY,language)}catch{}try{globalThis.CivweaveJapaneseModeV1?.setLanguage?.(language)}catch{}return language}
function choose(value){const canonical=globalThis.CivweaveSettingsV320;if(canonical?.chooseLanguage)return canonical.chooseLanguage(value);const language=persist(value),next=new URL(location.href);next.searchParams.set('lang',language);next.searchParams.set('source','settings-v320');location.replace(next.href);return language}
function mount(layer=document.getElementById('cw-settings-v320')){return layer?.querySelector?.('[data-cw-language-settings="v320"]')||null}
const api=Object.freeze({version:VERSION,key:LANGUAGE_KEY,current,persist,choose,mount,compatibilityFacade:true,canonical:'CivweaveSettingsV320',inputOwnership:false,presentationOwnership:false,settingsLauncherOwnership:false,documentClickListeners:0,domInsertion:false,prototypePatching:false,globalObserverPatch:false,inferenceWork:'none'});
globalThis.CivweaveLanguageSettingsV1=api;
})();
