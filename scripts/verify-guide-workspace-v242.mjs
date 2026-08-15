import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const exists=path=>access(new URL(path,root)).then(()=>true,()=>false);
const [compat,chat,boundary,ownershipText,campusCss,release]=await Promise.all([
  read('public/app/guide-workspace-v242.js'),
  read('public/app/guide-chat-surface-v350.js'),
  read('public/app/install-boundary-v146.js'),
  read('config/system-ownership.json'),
  read('public/app/working-campus-v156.css'),
  read('VERSION')
]);
for(const source of [compat,chat,boundary])new Function(source);
const ownership=JSON.parse(ownershipText),version=release.trim(),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
check('repository release is semantic',/^\d+\.\d+\.\d+$/.test(version));
check('system ownership names V350 as canonical chat owner',ownership.systems?.['guide-chat']?.owner==='public/app/guide-chat-surface-v350.js');
check('historical V242 filename is compatibility-only',compat.includes("const TARGET='/app/guide-chat-surface-v350.js'")&&compat.includes("civweaveCompatibilityLoader='guide-workspace-v242'")&&compat.includes('CivweaveGuideChatSurfaceV350'));
for(const forbidden of ['const ROOT_ID=','data-persistent-form','function submitActive','function switchWindow','new MutationObserver',"document.addEventListener('pointerdown'", "document.addEventListener('submit'"])check(`V242 compatibility loader does not own ${forbidden}`,!compat.includes(forbidden));
check('V350 supplies canonical presentation ownership',chat.includes("presentationOwner:'guide-chat-surface-v350'")&&chat.includes('canonicalOwner:true'));
check('V350 owns one current chat surface',chat.includes("presentation:'single-current-chat-surface'")&&chat.includes("const ROOT_ID='cw-persistent-guide-chat-v215'")&&chat.includes("const LAUNCHER_ID='cwp215-launcher'"));
check('V350 covers every themed guide',chat.includes("const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia']")&&['Weaveling','Moss','Kamiya','Rook','Merlin'].every(name=>chat.includes(`name:'${name}'`)));
check('realm ledgers stay isolated',chat.includes('readThread(activeSystem)')&&chat.includes('writeThread(system,thread)'));
check('guide selection changes the current surface without parallel windows',chat.includes('function switchGuide(system,options={})')&&!chat.includes('five-window'));
check('cross-context model turns explicitly select their guide',chat.includes('handoffSystem:system!==pageSystem?system:undefined'));
check('only explicit handoff fields create cross-realm packets',chat.includes('explicitHandoffTarget')&&!chat.includes('choice?.system,80'));
check('V350 owns form submission locally',chat.includes("root.querySelector('[data-persistent-form]').addEventListener('submit'")&&chat.includes('void submitActive(text)'));
check('V350 exposes direct submission and notification APIs',chat.includes('async function submitText(text,system=activeSystem)')&&chat.includes('function notify(system,text,options={})'));
for(const forbidden of ["document.addEventListener('pointerdown'","document.addEventListener('click'","document.addEventListener('submit'",'new MutationObserver','visualViewport?.addEventListener','requestSubmit','.click()'])check(`V350 avoids ${forbidden}`,!chat.includes(forbidden));
check('V350 has deterministic transport recovery',chat.includes('fallbackReply')&&chat.includes('CivweaveModelRuntime')&&chat.includes("provider:'deterministic-local'"));
check('V350 does not lock document overflow',!/document\.(?:body|documentElement)\.style\.overflow/.test(chat));
check('mobile V350 owns the full dynamic viewport',chat.includes('height:100dvh')&&chat.includes('env(safe-area-inset-bottom)')&&chat.includes('@media(max-width:720px)'));
check('floating V350 chat outranks Working Campus base header',chat.includes('z-index:2147483612')&&campusCss.includes('.top{position:relative;z-index:2'));
for(const retired of ['public/app/persistent-guide-chat-v215.js','public/app/persistent-guide-viewport-v216.js','public/app/chat-single-owner-v245.js'])check(`retired owner deleted: ${retired}`,!(await exists(retired)));
const realmIndex=boundary.indexOf('REALM_SESSION_INTEGRITY,'),chatIndex=boundary.indexOf('GUIDE_WORKSPACE,');
check('canonical chat loads after realm session integrity',realmIndex>=0&&chatIndex>realmIndex);
check('boundary points GUIDE_WORKSPACE at V350',boundary.includes("const GUIDE_WORKSPACE='/app/guide-chat-surface-v350.js'"));
check('boundary exposes V350 single-surface policy',boundary.includes("guideWorkspaceRevision:'v350-single-current-chat-surface'")&&boundary.includes("guideSurfaceOwnershipPolicy:'v350-single-current-surface-five-private-ledgers-handover-only-cross-realm'"));
console.log(JSON.stringify({ok:true,version,checks:checks.length,compatibilityFilename:'guide-workspace-v242',canonicalOwner:'guide-chat-surface-v350',presentation:'single-current-chat-surface',documentCapture:false,duplicateOwners:0,deletedOwners:3},null,2));
