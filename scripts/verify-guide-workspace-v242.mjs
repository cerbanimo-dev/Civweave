import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const exists=path=>access(new URL(path,root)).then(()=>true,()=>false);
const [workspace,boundary,campusCss,release]=await Promise.all([
  read('public/app/guide-workspace-v242.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/working-campus-v156.css'),
  read('VERSION')
]);
new Function(workspace);new Function(boundary);
const version=release.trim(),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
check('repository release is semantic',/^\d+\.\d+\.\d+$/.test(version));
check('workspace runtime remains v242',workspace.includes('guide-workspace-v242'));
check('workspace is the canonical chat owner',workspace.includes('canonicalOwner:true')&&workspace.includes("document.documentElement.dataset.civweaveGuideWorkspace='v250-canonical-owner'"));
check('workspace has five canonical windows',workspace.includes("const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia']"));
check('realm ledgers stay isolated',workspace.includes('readThread(activeWindow)')&&workspace.includes('Switching windows never mixes histories'));
check('page launcher opens page realm directly',workspace.includes('openWindow(pageSystem)'));
check('switchGuide maps to switchWindow',workspace.includes('switchGuide:(system,options={})=>switchWindow'));
check('ordinary guide selection stays closed until explicitly opened',workspace.includes('open:options.open===true'));
check('cross-context model turns explicitly select their guide',workspace.includes('handoffSystem:system!==pageSystem?system:undefined'));
check('only explicit handoff fields create cross-realm packets',workspace.includes('explicitHandoffTarget')&&!workspace.includes('choice?.system,80'));
check('workspace owns submission at capture',workspace.includes("document.addEventListener('submit',onSubmitCapture,true)"));
check('workspace owns Working Campus embedded submit',workspace.includes("target.id==='weaveling-chat-form'")&&workspace.includes("openWindow('civweave');void submitActive(text)"));
check('workspace owns persona pointer switching',workspace.includes('switchControl')&&workspace.includes('data-cw242-window')&&workspace.includes("document.addEventListener('pointerdown',onPointerDownCapture,true)"));
const internalGuard=workspace.indexOf('if(root?.contains(event.target)||launcher?.contains(event.target))return;');
const genericTrigger=workspace.indexOf("const trigger=event.target.closest?.('[data-cwf-chat]");
check('internal chat controls bypass generic guide routing',internalGuard>=0&&genericTrigger>internalGuard);
check('send remains a native submit button',workspace.includes('<button data-send type="submit">Send</button>'));
check('workspace has deterministic transport recovery',workspace.includes('fallbackReply')&&workspace.includes('CivweaveModelRuntime')&&workspace.includes("provider:'deterministic-local'"));
check('workspace does not lock document overflow',!/document\.(?:body|documentElement)\.style\.overflow/.test(workspace));
check('mobile workspace leaves page visible',workspace.includes('height:min(62dvh,560px)!important'));
check('floating chat outranks Working Campus base header',workspace.includes('z-index:2147483644!important')&&campusCss.includes('.top{position:relative;z-index:2'));
check('chat log releases edge scrolling',workspace.includes('overscroll-behavior:auto!important'));
check('workspace directly owns visual viewport resize',workspace.includes('globalThis.visualViewport?.addEventListener')&&workspace.includes('--cw242-visual-height'));
check('workspace uses dynamic viewport and safe area sizing',workspace.includes('100dvh')&&workspace.includes('env(safe-area-inset-bottom)'));
for(const retired of ['public/app/persistent-guide-chat-v215.js','public/app/persistent-guide-viewport-v216.js','public/app/chat-single-owner-v245.js'])check(`retired owner deleted: ${retired}`,!(await exists(retired)));
const realmIndex=boundary.indexOf('REALM_SESSION_INTEGRITY,'),workspaceIndex=boundary.indexOf('GUIDE_WORKSPACE,');
check('workspace loads after realm session integrity',realmIndex>=0&&workspaceIndex>realmIndex);
const experienceStart=boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),experienceEnd=boundary.indexOf('];',experienceStart),experience=boundary.slice(experienceStart,experienceEnd);
check('canonical boundary boots workspace without retired runtime constants',experience.includes('GUIDE_WORKSPACE')&&!boundary.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')&&!boundary.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'));
check('boundary exposes v250 policy',boundary.includes("guideWorkspaceRevision:'v250-v242-canonical-owner'"));
console.log(JSON.stringify({ok:true,version,checks:checks.length,workspace:'v242-canonical-v250',viewportOwner:'v242',scrollTrap:false,launcherFirst:true,duplicateOwners:0,deletedOwners:3},null,2));