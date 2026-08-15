(()=>{
'use strict';

const VERSION='1.0.0';
const SCHEMA='civweave.operating-mode.v1';
const STORAGE_KEY='civweave.operating-mode.v1';
const STANDARD='standard';
const LUD='lud';
const now=()=>new Date().toISOString();
const clean=(value,max=240)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};

function read(){
  let saved={};
  try{saved=parse(localStorage.getItem(STORAGE_KEY),{})}catch{}
  const mode=saved?.mode===LUD?LUD:STANDARD;
  return{schema:SCHEMA,mode,lud:mode===LUD,updatedAt:clean(saved?.updatedAt,80)||null,source:clean(saved?.source,120)||null};
}

function tellWorker(mode){
  const message={type:'SET_CIVWEAVE_OPERATING_MODE',mode,revision:VERSION};
  try{navigator.serviceWorker?.controller?.postMessage?.(message)}catch{}
  try{navigator.serviceWorker?.ready?.then?.(registration=>registration?.active?.postMessage?.(message)).catch(()=>{})}catch{}
}

function setMode(mode,{source='user'}={}){
  const next=mode===LUD?LUD:STANDARD;
  const value={schema:SCHEMA,mode:next,lud:next===LUD,updatedAt:now(),source:clean(source,120)||'user'};
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value))}catch{}
  try{document.documentElement.dataset.civweaveOperatingMode=next}catch{}
  tellWorker(next);
  try{dispatchEvent(new CustomEvent('civweave:operating-mode-changed',{detail:value}))}catch{}
  return value;
}

function enable(options={}){return setMode(LUD,options)}
function disable(options={}){return setMode(STANDARD,options)}
function isEnabled(){return read().mode===LUD}
function aiAllowed(){return !isEnabled()}
function assertAIAllowed(capability='AI generation'){
  if(aiAllowed())return true;
  const error=new Error(`${capability} is unavailable in Lud Mode.`);
  error.code='CIVWEAVE_LUD_AI_DISABLED';
  error.mode=LUD;
  throw error;
}
function contentVisible(record){
  if(!isEnabled())return true;
  return globalThis.CivweaveContentProvenanceV1?.isLudVisible?.(record)===true;
}
function filterContent(rows){return isEnabled()?(Array.isArray(rows)?rows:[]).filter(contentVisible):(Array.isArray(rows)?rows:[])}
function applyDocumentMode(){const state=read();try{document.documentElement.dataset.civweaveOperatingMode=state.mode}catch{};tellWorker(state.mode);return state}

const api=Object.freeze({
  version:VERSION,
  schema:SCHEMA,
  storageKey:STORAGE_KEY,
  STANDARD,
  LUD,
  read,
  set:setMode,
  enable,
  disable,
  isEnabled,
  aiAllowed,
  assertAIAllowed,
  contentVisible,
  filterContent,
  applyDocumentMode
});

globalThis.CivweaveLudModeV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',applyDocumentMode,{once:true});else applyDocumentMode();
try{dispatchEvent(new CustomEvent('civweave:lud-mode-ready',{detail:{version:VERSION,state:read()}}))}catch{}
})();
