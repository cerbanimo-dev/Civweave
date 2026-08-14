(()=>{
'use strict';

const VERSION='language-settings-v1';
const LANGUAGE_KEY='civweave.language.v1';
const SECTION_SELECTOR='[data-cw-language-settings]';
if(globalThis.CivweaveLanguageSettingsV1?.version===VERSION)return;

function normalize(value){return String(value||'').toLowerCase().startsWith('ja')?'ja':'en'}
function current(){
  try{return normalize(localStorage.getItem(LANGUAGE_KEY)||'en')}catch{return'en'}
}
function persist(value){
  const language=normalize(value);
  try{localStorage.setItem(LANGUAGE_KEY,language)}catch{}
  try{globalThis.CivweaveJapaneseModeV1?.setLanguage?.(language)}catch{}
  return language;
}
function navigate(language){
  const next=new URL(location.href);
  next.searchParams.set('lang',language);
  next.searchParams.set('source','settings-language-v1');
  location.replace(next.href);
}
function choose(language){const selected=persist(language);navigate(selected);return selected}
function renderState(section){
  if(!section)return;
  const selected=current();
  section.querySelectorAll('[data-cw-language-option]').forEach(button=>{
    const active=button.dataset.cwLanguageOption===selected;
    button.setAttribute('aria-pressed',active?'true':'false');
    button.dataset.active=active?'true':'false';
  });
  const status=section.querySelector('[data-cw-language-status]');
  if(status)status.textContent=selected==='ja'?'日本語を使用中':'Using English';
}
function mount(layer=document.getElementById('cw-ai-settings-cleanroom-v188')){
  if(!layer||layer.hidden)return null;
  const existing=layer.querySelector(SECTION_SELECTOR);
  if(existing){renderState(existing);return existing}
  const form=layer.querySelector('form[data-cw-cleanroom-form]');
  if(!form)return null;
  const section=document.createElement('section');
  section.className='cw-clean-panel';
  section.dataset.cwLanguageSettings='v1';
  section.innerHTML=`<div><h3>Language / 言語</h3><p>Choose the interface language. This preference stays on this device and is used by the installed Civweave app.</p></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button type="button" data-cw-language-option="en">English</button><button type="button" data-cw-language-option="ja" lang="ja">日本語</button></div><output data-cw-language-status aria-live="polite"></output>`;
  section.querySelectorAll('[data-cw-language-option]').forEach(button=>button.addEventListener('click',()=>choose(button.dataset.cwLanguageOption)));
  const note=form.querySelector('.cw-clean-note');
  if(note)form.insertBefore(section,note);else form.append(section);
  renderState(section);
  return section;
}

const api=Object.freeze({version:VERSION,key:LANGUAGE_KEY,current,persist,choose,mount,inputOwnership:false,settingsLauncherOwnership:false,documentClickListeners:0,prototypePatching:false,globalObserverPatch:false,inferenceWork:'none'});
globalThis.CivweaveLanguageSettingsV1=api;
try{dispatchEvent(new CustomEvent('civweave:language-settings-ready',{detail:{version:VERSION,current:current(),inputOwnership:false}}))}catch{}
})();
