import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await fs.readFile(path.join(root,'VERSION'),'utf8')).trim();
const deleted=[
  '/app/fullscreen-family-v104.html','/app/lite-v128.html','/app/lite-v129.html',
  '/app/loom-v127.html','/app/loom-v128.html','/app/realm-v127.html','/app/realm-v128.html',
  '/cabinetonly/index.html','/app/cabinet-only-v144.html','/app/cabinet-mode-v142.html',
  '/app/cabinet-visual-v141.html','/app/cabinet-calibrator-v144.html',
  '/app/services/cerbanimo/index.html','/app/services/living-school/index.html',
  '/app/services/fellowfare/index.html','/app/services/anarchadia/index.html'
];
const changed=[];
async function edit(relative,transform,{required=true}={}){
  const file=path.join(root,relative);
  let before;
  try{before=await fs.readFile(file,'utf8')}catch(error){if(!required&&error.code==='ENOENT')return;throw error}
  const after=transform(before);
  if(after===before)return;
  await fs.writeFile(file,after,'utf8');changed.push(relative);
}
const normalize=value=>'/'+String(value||'').replace(/^\/+/, '');

await edit('public/service-worker-core-v208.js',source=>source
  .split(/\r?\n/)
  .filter(line=>!line.includes("'/app/fullscreen-family-v104"))
  .join('\n'));

await edit('public/service-worker-chat-repair-v245.js',source=>{
  let next=source;
  if(!next.includes("'/app/guide-chat-surface-v350.js'"))next=next.replace("  '/app/guide-workspace-v242.js',","  '/app/guide-workspace-v242.js',\n  '/app/guide-chat-surface-v350.js',");
  for(const route of deleted){if(!next.includes(`'${route}'`))next=next.replace("  '/app/chat-single-owner-v245.js'","  '/app/chat-single-owner-v245.js',\n  '"+route+"'");}
  return next;
});

await edit('public/app/seed.json',source=>{
  const data=JSON.parse(source),retired=new Set(deleted);
  if(Array.isArray(data.files))data.files=data.files.filter(row=>!retired.has(normalize(row?.path||row?.entry)));
  data.presentationPolicy='active-public-screen-inventory-v350';
  data.retiredScreensPurged=deleted.length;
  return `${JSON.stringify(data,null,2)}\n`;
});

await edit('public/app/install-boundary-v146.js',source=>source
  .replace("const GUIDE_WORKSPACE='/app/guide-workspace-v242.js';","const GUIDE_WORKSPACE='/app/guide-chat-surface-v350.js';")
  .replace("globalThis.CivweaveGuideWorkspaceV242?.closeWorkspace?.();","globalThis.CivweaveGuideChatSurfaceV350?.close?.();")
  .replace("canonicalPolicy:'five-system-first-class-routes-v242-canonical-chat-owner'","canonicalPolicy:'five-system-first-class-routes-v350-canonical-chat-owner'")
  .replace("sharedGuideSurfaceRevision:'v236-navigation-lifecycle-v424-mirror-into-v242-canonical-thread'","sharedGuideSurfaceRevision:'v236-navigation-lifecycle-v424-mirror-into-v350-canonical-thread'")
  .replace("guideWorkspaceRevision:'v250-v242-canonical-owner'","guideWorkspaceRevision:'v350-single-current-chat-surface'")
  .replace("guideSurfaceOwnershipPolicy:'v250-single-v242-runtime-five-local-window-ledgers-handover-only-cross-realm'","guideSurfaceOwnershipPolicy:'v350-single-current-surface-five-private-ledgers-handover-only-cross-realm'")
  .replace("guideWorkspaceWindowPolicy:'five-switchable-windows-current-realm-launcher'","guideWorkspaceWindowPolicy:'single-current-surface-explicit-guide-selector'")
);

await edit('public/app/family-ai-loader-v105.js',source=>source
  .replace("if(globalThis.CivweaveGuideWorkspaceV242?.openWindow)return{kind:'workspace',api:globalThis.CivweaveGuideWorkspaceV242};","if(globalThis.CivweaveGuideChatSurfaceV350?.open)return{kind:'surface',api:globalThis.CivweaveGuideChatSurfaceV350};")
  .replace("  if(owner.kind==='workspace')return owner.api.openWindow(target,{prefill,focus:true});\n  return owner.api.open({guide:target,prefill,focus:true});","  return owner.api.open({guide:target,prefill,focus:true});")
  .replaceAll("'civweave:guide-workspace-ready'","'civweave:guide-chat-ready'")
  .replace("canonicalChatOwner:'guide-workspace-v242'","canonicalChatOwner:'guide-chat-surface-v350'")
);

const releaseGateway=`releases/${version}/server/server-gateway-v131-base.mjs`;
await edit(releaseGateway,source=>source.replace(
  /  if \(gatewayRequest && packageInstall && \(pathname === '\/loom'[\s\S]*?return json\(res,404,\{error:'The full-screen Civweave family entry is missing from this device package\.'\}\); \}\n/,
  "  if (gatewayRequest && packageInstall && (pathname === '/loom' || pathname === '/loom/' || pathname === '/loom/index.html' || pathname === '/lite' || pathname === '/lite/' || pathname === '/lite/index.html' || pathname === '/cabinetonly' || pathname === '/cabinetonly/' || pathname === '/cabinetonly/index.html')) { res.writeHead(302,{location:'/app/installed-entry-v146.html?installed=1&system=civweave','cache-control':'no-store','x-civweave-retired-surface':'v350'}); return res.end(); }\n"
),{required:false});

const releaseLocal=`releases/${version}/server/server-local-v131.mjs`;
await edit(releaseLocal,source=>source
  .split(/\r?\n/)
  .filter(line=>!deleted.some(route=>line.includes(`'${route}'`)))
  .join('\n'),{required:false});

await edit('scripts/smoke-gateway-v131.mjs',source=>source
  .replace("const after = \"  for(const route of ['/loom/','/lite/']){const response=await fetch(origin+route,{cache:'no-store'}),body=await response.json();assert(response.status===410,`${route} returned ${response.status}, expected 410`);assert(body.localInstallRequired===true,`${route} does not explain installation`)}\\n  for(const route of ['/app/','/app/index.html','/app/working-campus-v156.html','/app/realm-console-v140.html','/app/fullscreen-family-v104.html','/app/cabinet-mode-v142.html']){const response=await fetch(origin+route,{cache:'no-store'});assert(response.ok,`${route} returned ${response.status}, expected a public installed-runtime asset`);const type=String(response.headers.get('content-type')||'');assert(/text\\\\/html/i.test(type),`${route} returned unexpected content type ${type}`)}\";",
  "const after = \"  for(const route of ['/loom/','/lite/']){const response=await fetch(origin+route,{cache:'no-store'}),body=await response.json();assert(response.status===410,`${route} returned ${response.status}, expected 410`);assert(body.localInstallRequired===true,`${route} does not explain installation`)}\\n  for(const route of ['/app/','/app/index.html','/app/working-campus-v156.html','/app/realm-console-v140.html']){const response=await fetch(origin+route,{cache:'no-store'});assert(response.ok,`${route} returned ${response.status}, expected a public installed-runtime asset`);const type=String(response.headers.get('content-type')||'');assert(/text\\\\/html/i.test(type),`${route} returned unexpected content type ${type}`)}\\n  for(const route of ['/app/fullscreen-family-v104.html','/app/cabinet-mode-v142.html']){const response=await fetch(origin+route,{cache:'no-store'});assert(response.status===404,`${route} returned ${response.status}, expected retired 404`)}\";"
));

await edit('scripts/smoke-gateway-v131-base.mjs',source=>source.replace(
  "  for(const route of ['/loom/','/lite/','/app/realm-console-v140.html','/app/fullscreen-family-v104.html','/app/cabinet-mode-v142.html']){const response=await fetch(origin+route,{cache:'no-store'}),body=await response.json();assert(response.status===410,`${route} returned ${response.status}, expected 410`);assert(body.localInstallRequired===true,`${route} does not explain installation`)}",
  "  for(const route of ['/loom/','/lite/','/app/realm-console-v140.html']){const response=await fetch(origin+route,{cache:'no-store'}),body=await response.json();assert(response.status===410,`${route} returned ${response.status}, expected 410`);assert(body.localInstallRequired===true,`${route} does not explain installation`)}\n  for(const route of ['/app/fullscreen-family-v104.html','/app/cabinet-mode-v142.html']){const response=await fetch(origin+route,{cache:'no-store'});assert(response.status===404,`${route} returned ${response.status}, expected retired 404`)}"
));

console.log(JSON.stringify({ok:true,version,revision:'retired-presentation-surfaces-v350',deletedScreens:deleted.length,changed},null,2));
