(()=>{
'use strict';
const VERSION='257.1-device-owned-gemini-direct';
if(globalThis.CivweaveGeminiDeviceDirectV257?.version===VERSION)return;
const GOOGLE_ORIGIN='https://generativelanguage.googleapis.com';
const GOOGLE_BASE='/v1beta/interactions';
const PROXY_BASE='/api/ai/gemini/interactions';
const HOST_KEY='civweave.host-node.v1';
const nativeFetch=globalThis.fetch?.bind(globalThis);

function retireProxyAdvertisement(){
  try{
    const saved=JSON.parse(localStorage.getItem(HOST_KEY)||'null');
    if(!saved||typeof saved!=='object')return false;
    const features=Array.isArray(saved.features)?saved.features.filter(item=>String(item).toLowerCase()!=='gemini-agent-proxy'):saved.features;
    const next={...saved,features,geminiProxy:false,geminiAgentProxy:false};
    if(JSON.stringify(next)!==JSON.stringify(saved))localStorage.setItem(HOST_KEY,JSON.stringify(next));
    return true;
  }catch{return false}
}
retireProxyAdvertisement();
if(!nativeFetch){globalThis.CivweaveGeminiDeviceDirectV257=Object.freeze({version:VERSION,installed:false});return}

function targetUrl(input){
  try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}
}
function directUrl(url){
  if(!url||!(url.pathname===PROXY_BASE||url.pathname.startsWith(`${PROXY_BASE}/`)))return'';
  const suffix=url.pathname.slice(PROXY_BASE.length);
  const next=new URL(`${GOOGLE_BASE}${suffix}`,GOOGLE_ORIGIN);
  next.search=url.search;
  return next.href;
}
function safeHeaders(input,init){
  const headers=new Headers(init?.headers||(typeof Request!=='undefined'&&input instanceof Request?input.headers:undefined)||{});
  for(const name of ['authorization','x-civweave-hub-token','x-civweave-ai-capability','x-civweave-internal-secret','x-civweave-payment-signature'])headers.delete(name);
  return headers;
}
async function deviceFetch(input,init={}){
  const source=targetUrl(input),replacement=directUrl(source);
  if(!replacement)return nativeFetch(input,init);
  const next={...init,headers:safeHeaders(input,init),credentials:'omit',cache:init.cache||'no-store'};
  try{dispatchEvent(new CustomEvent('civweave:gemini-device-direct',{detail:{from:source?.origin||'',to:GOOGLE_ORIGIN,at:new Date().toISOString()}}))}catch{}
  if(typeof Request!=='undefined'&&input instanceof Request){
    const request=new Request(replacement,input);
    return nativeFetch(request,next);
  }
  return nativeFetch(replacement,next);
}

globalThis.fetch=deviceFetch;
globalThis.CivweaveGeminiDeviceDirectV257=Object.freeze({version:VERSION,installed:true,googleOrigin:GOOGLE_ORIGIN,proxyPathRetired:PROXY_BASE,hostKey:HOST_KEY});
})();
