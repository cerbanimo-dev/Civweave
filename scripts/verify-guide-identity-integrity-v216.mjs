import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const exists=file=>access(path.join(root,file)).then(()=>true,()=>false);
const [identity,boundary,workspace,assistant]=await Promise.all([
  read('public/app/guide-identity-integrity-v216.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/assistant-runtime-v141.js')
]);

new Function(identity);new Function(boundary);new Function(workspace);
for(const token of [
  "const VERSION='1.0.2-guide-identity-integrity-v216-v242-only'",
  'Identity boundary:',
  'requestedSystem',
  'respondingSystem',
  'handedOff',
  "Object.defineProperty(globalThis,'CivweaveAssistantV141'",
  "identityPolicy:'selected-guide-or-receiving-guide-after-handoff'",
  'CivweaveGuideWorkspaceV242?.switchWindow',
  "canonicalChatOwner:'guide-workspace-v242'"
])assert(identity.includes(token),`Guide identity integrity runtime is missing ${token}`);
for(const forbidden of ['civweave.persistent-guide-chat.v214','cw-persistent-guide-chat-v215','MutationObserver','setInterval(','Storage?.prototype','reconcilePersistentDom','migratePersistentThread'])assert(!identity.includes(forbidden),`Guide identity runtime still contains retired chat behavior: ${forbidden}`);

for(const token of [
  "const GUIDE_IDENTITY_SCRIPT='/app/guide-identity-integrity-v216.js'",
  "const GUIDE_WORKSPACE='/app/guide-workspace-v242.js'",
  "guideIdentityRevision:'v216-explicit-responder-ownership'",
  "guideIdentityPolicy:'explicit-selected-guide-or-explicit-handoff'",
  "guideIdentityMigration:'realm-action-owner'"
])assert(boundary.includes(token),`Install boundary is missing ${token}`);
assert(!boundary.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')&&!boundary.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'),'Install boundary must not retain deleted chat runtime constants.');
const expStart=boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),expEnd=boundary.indexOf('];',expStart),experience=boundary.slice(expStart,expEnd);
assert(experience.includes('GUIDE_IDENTITY_SCRIPT'),'Canonical experience no longer loads identity integrity.');
assert(experience.includes('GUIDE_WORKSPACE'),'Canonical experience no longer loads the guide workspace.');
assert(experience.indexOf('GUIDE_IDENTITY_SCRIPT')<experience.indexOf('GUIDE_WORKSPACE'),'Identity integrity must load before the canonical workspace reads realm history.');
assert(workspace.includes('canonicalOwner:true'),'Guide workspace must remain canonical.');
assert(assistant.includes("if(systemId==='civweave'&&routedSystem!=='civweave')systemId=routedSystem"),'Verifier no longer covers the realm-handoff boundary.');
for(const retired of ['public/app/persistent-guide-chat-v215.js','public/app/persistent-guide-viewport-v216.js'])assert.equal(await exists(retired),false,`${retired} must remain deleted.`);

const listeners=new Map(),switched=[];
const addEventListener=(type,listener)=>{const rows=listeners.get(type)||[];rows.push(listener);listeners.set(type,rows)};
const removeEventListener=(type,listener)=>listeners.set(type,(listeners.get(type)||[]).filter(item=>item!==listener));
const dispatchEvent=event=>{for(const listener of listeners.get(event.type)||[])listener(event);return true};
const sandbox={console,URLSearchParams,location:{pathname:'/app/cabinets/living-school/index.html',search:'?system=living-school',hostname:'example.test'},document:{documentElement:{dataset:{civweaveSystemRoute:'living-school'},hasAttribute:()=>false},body:{dataset:{}}},CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},addEventListener,removeEventListener,dispatchEvent,queueMicrotask:callback=>callback(),CivweaveGuideWorkspaceV242:{switchWindow:(system,options)=>switched.push({system,open:Boolean(options?.open)})}};
sandbox.globalThis=sandbox;
vm.runInNewContext(identity,sandbox,{filename:'guide-identity-integrity-v216.js'});
sandbox.CivweaveAssistantV141={respond:async options=>({response:{answer:'Identity held.',choice:{system:options.systemId,nextAction:'Continue.'}},context:{guide:{system:options.systemId}},provider:'test-provider',model:'test-model'})};
const moss=await sandbox.CivweaveAssistantV141.respond({systemId:'living-school',history:[]});
assert.equal(moss.respondingSystem,'living-school');assert.equal(moss.respondingGuide,'Moss');assert.equal(moss.handedOff,false);
const handedOff=await sandbox.CivweaveAssistantV141.respond({systemId:'civweave',history:[]});
assert.equal(handedOff.requestedSystem,'civweave');assert.equal(handedOff.respondingSystem,'living-school');assert.equal(handedOff.respondingGuide,'Moss');assert.equal(handedOff.handedOff,true);
assert.equal(switched.at(-1)?.system,'living-school','Canonical workspace did not switch to the receiving guide after handoff.');
assert.equal(switched.at(-1)?.open,false,'Identity handoff must not force the chat window open.');

console.log(JSON.stringify({ok:true,revision:'v216-identity-integrity-v242-only',canonicalChatOwner:'guide-workspace-v242',legacyChatMigration:false,documentObservers:0},null,2));