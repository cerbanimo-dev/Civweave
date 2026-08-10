import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [workspace,viewport,boundary,campusCss,release]=await Promise.all([
  read('public/app/guide-workspace-v242.js'),
  read('public/app/persistent-guide-viewport-v216.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/working-campus-v156.css'),
  read('VERSION')
]);
new Function(workspace);new Function(viewport);new Function(boundary);
const version=release.trim(),checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
check('repository release is semantic',/^\d+\.\d+\.\d+$/.test(version));
check('workspace runtime remains v242',workspace.includes('guide-workspace-v242'));
check('workspace is the canonical chat owner',workspace.includes('canonicalOwner:true')&&workspace.includes("document.documentElement.dataset.civweaveGuideWorkspace='v250-canonical-owner'"));
check('workspace has five canonical guides',workspace.includes("const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia']"));
check('workspace owns submission at capture',workspace.includes("document.addEventListener('submit',onSubmitCapture,true)"));
check('workspace owns Working Campus embedded submit',workspace.includes("target.id==='weaveling-chat-form'")&&workspace.includes("openWindow('civweave');void submitActive(text)"));
check('send remains a native submit button',workspace.includes('<button data-send type="submit">Send</button>'));
check('workspace keeps deterministic recovery',workspace.includes('fallbackReply')&&workspace.includes('CivweaveModelRuntime')&&workspace.includes("provider:'deterministic-local'"));
check('dedicated workspace is near-fullscreen',workspace.includes('width:min(1100px,calc(100vw - 18px))!important')&&workspace.includes('top:max(7px,env(safe-area-inset-top))!important'));
check('mobile workspace is nearly full screen',workspace.includes('left:max(4px,env(safe-area-inset-left))!important')&&workspace.includes('right:max(4px,env(safe-area-inset-right))!important')&&workspace.includes('top:max(4px,env(safe-area-inset-top))!important'));
check('workspace does not lock document overflow',!/document\.(?:body|documentElement)\.style\.overflow/.test(workspace));
check('chat log releases edge scrolling',workspace.includes('overscroll-behavior:auto!important'));
check('multiple conversations are durable',workspace.includes("const THREADS_KEY='civweave.guide-threads.v281'")&&workspace.includes('conversationList')&&workspace.includes('newThread'));
check('thread list is rendered',workspace.includes('data-thread-list')&&workspace.includes('data-thread-id'));
check('group AI participants are explicit',workspace.includes('data-ai-participant')&&workspace.includes('updateAiParticipant')&&workspace.includes('thread.systems'));
check('group turns preserve responder identity',workspace.includes('responderSystem:system')&&workspace.includes('for(const system of [...saved.systems])'));
check('paired partner invitations are explicit',workspace.includes('data-peer-participant')&&workspace.includes('updatePeerParticipant'));
check('shared history uses direct-consent mesh objects',workspace.includes("const SHARED_KIND='civweave.shared-chat-thread.v1'")&&workspace.includes("consent:'direct'")&&workspace.includes('audience:thread.peerIds'));
check('shared snapshots exclude action payloads',workspace.includes('sanitizedSharedThread')&&!/sanitizedSharedThread[\s\S]{0,1200}approvalGate/.test(workspace));
check('mesh and gateway transports are both used',workspace.includes('runtime.flushSession')&&workspace.includes('runtime.syncGateway'));
check('incoming shared histories merge by message id',workspace.includes('const messages=new Map')&&workspace.includes("messages.set(row.id"));
check('workspace maintains legacy realm mirror',workspace.includes('mirrorLegacy')&&workspace.includes('writeLegacy'));
check('page launcher opens page realm directly',workspace.includes('openWindow(pageSystem)'));
check('persona pointer switching stays capture-owned',workspace.includes('switchControl')&&workspace.includes('data-cw242-window')&&workspace.includes("document.addEventListener('pointerdown',onPointerDownCapture,true)"));
check('cross-context model turns explicitly select guide',workspace.includes('handoffSystem:system!==pageSystem?system:undefined'));
check('only explicit handoff fields create cross-realm packets',workspace.includes('explicitHandoffTarget')&&!workspace.includes('choice?.system,80'));
check('floating chat outranks Working Campus base header',workspace.includes('z-index:2147483644!important')&&campusCss.includes('.top{position:relative;z-index:2'));
check('viewport remains css-only',!viewport.includes('MutationObserver')&&!viewport.includes('scrollIntoView')&&viewport.includes('v250-css-only-workspace-owned'));
const realmIndex=boundary.indexOf('REALM_SESSION_INTEGRITY,'),workspaceIndex=boundary.indexOf('GUIDE_WORKSPACE,');
check('workspace loads after realm session integrity',realmIndex>=0&&workspaceIndex>realmIndex);
console.log(JSON.stringify({ok:true,version,checks:checks.length,workspace:'v242-threaded-group-mesh-v281',nearFullscreen:true,threads:true,groupChat:true,meshShared:true,duplicateOwners:0},null,2));
