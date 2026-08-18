'use strict';

const REVISION='staging-pwa-rescue-worker-v434.1-transparent-navigation';
const ROOT='/?installed=1&source=staging-rescue-worker-v434';
const CAMPUS='/app/working-campus-v156.html?installed=1&version=1.0.163&source=staging-rescue-worker-v434';

self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});

function recoveryPage(reason='The staging launch target was unavailable.'){
  const body=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061019"><title>Civweave recovery</title><style>html,body{margin:0;min-height:100%;background:#061019;color:#eefaff;font:16px/1.5 system-ui}body{display:grid;place-items:center;padding:24px}main{max-width:34rem;padding:22px;border:1px solid #8de5ef55;border-radius:18px;background:#0a1a25}a{display:block;margin-top:12px;padding:12px;border-radius:12px;background:#163244;color:#fff;text-decoration:none;font-weight:800}</style></head><body><main><strong>Civweave launch recovery</strong><p>${String(reason).replace(/[<>&]/g,'')}</p><a href="${ROOT}">Open Civweave</a><a href="${CAMPUS}">Open Working Campus</a></main></body></html>`;
  return new Response(body,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-civweave-staging-rescue':REVISION}});
}

// This worker exists only to break a retained Android/WebAPK launch that points
// at the release marker. It must not proxy ordinary document navigations. Doing
// fetch(event.request) + respondWith() for every navigation can make Chromium
// abort an in-flight navigation when the rescue worker is replaced and surface
// ERR_FAILED. Normal documents therefore go directly to Cloudflare Pages.
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||request.mode!=='navigate')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname!=='/VERSION')return;
  event.respondWith((async()=>{
    try{return Response.redirect(new URL(ROOT,self.location.origin).href,302)}
    catch(error){return recoveryPage(error?.message||String(error))}
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type!=='GET_CIVWEAVE_STAGING_RESCUE_WORKER')return;
  const packet={type:'CIVWEAVE_STAGING_RESCUE_WORKER',revision:REVISION,root:ROOT,campus:CAMPUS,navigationPolicy:'transparent-except-version-marker'};
  try{event.ports?.[0]?.postMessage(packet)}catch{}
  try{event.source?.postMessage?.(packet)}catch{}
});
