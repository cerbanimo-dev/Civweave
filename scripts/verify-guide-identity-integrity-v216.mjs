import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const [identity,boundary,chat,assistant]=await Promise.all([
  read('public/app/guide-identity-integrity-v216.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/persistent-guide-chat-v215.js'),
  read('public/app/assistant-runtime-v141.js')
]);

new Function(identity);
new Function(boundary);

for(const token of [
  "const VERSION='1.0.1-guide-identity-integrity-v216'",
  "const CHAT_KEY='civweave.persistent-guide-chat.v214'",
  'row.actionSnapshot?.system',
  "row.identityCorrection='v216-action-owner'",
  "row.identityCorrection='v216-response-owner'",
  'Identity boundary:',
  'requestedSystem',
  'respondingSystem',
  'handedOff',
  'rememberResponseIdentity',
  'correctChatPayload',
  'reconcilePersistentDom',
  "Object.defineProperty(globalThis,'CivweaveAssistantV141'",
  "identityPolicy:'selected-guide-or-receiving-guide-after-handoff'"
])assert(identity.includes(token),`Guide identity integrity runtime is missing ${token}`);

for(const token of [
  "const GUIDE_IDENTITY_SCRIPT='/app/guide-identity-integrity-v216.js'",
  "const PERSISTENT_GUIDE_CHAT_SCRIPT='/app/persistent-guide-chat-v215.js'",
  "const GUIDE_WORKSPACE='/app/guide-workspace-v242.js'",
  "guideIdentityRevision:'v216-explicit-responder-ownership'",
  "guideIdentityPolicy:'explicit-selected-guide-or-explicit-handoff'",
  "guideIdentityMigration:'realm-action-owner'"
])assert(boundary.includes(token),`Install boundary is missing ${token}`);
assert(boundary.includes('const ADDITIONS_VERSION=`${requestedRelease}-chat-convergence-v250`;'),'Install boundary does not use the release-aware v250 cache identity.');
const expStart=boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),expEnd=boundary.indexOf('];',expStart),experience=boundary.slice(expStart,expEnd);
assert(experience.includes('GUIDE_IDENTITY_SCRIPT'),'Canonical experience no longer loads identity integrity.');
assert(experience.includes('GUIDE_WORKSPACE'),'Canonical experience no longer loads the guide workspace.');
assert(!experience.includes('PERSISTENT_GUIDE_CHAT_SCRIPT'),'Canonical experience must not boot the retained v215 compatibility runtime.');
assert(experience.indexOf('GUIDE_IDENTITY_SCRIPT')<experience.indexOf('GUIDE_WORKSPACE'),'Identity integrity must load before the canonical workspace reads realm history.');
assert(chat.includes("const STORAGE_KEY='civweave.persistent-guide-chat.v214'"),'Retained persistent chat compatibility history key changed unexpectedly.');
assert(assistant.includes("if(systemId==='civweave'&&routedSystem!=='civweave')systemId=routedSystem"),'Verifier no longer covers the realm-handoff boundary.');

const stored=new Map();
stored.set('civweave.persistent-guide-chat.v214',JSON.stringify({
  messages:[{
    role:'assistant',
    guide:'civweave',
    text:'A learning draft was prepared.',
    actionSnapshot:{system:'living-school'}
  }]
}));

const makeNode=()=>{
  const attributes=new Map();
  return{
    dataset:{},
    hasAttribute:name=>attributes.has(name),
    getAttribute:name=>attributes.get(name)??null,
    setAttribute(name,value){attributes.set(name,String(value));if(name==='data-civweave-system')this.dataset.civweaveSystem=String(value)},
    removeAttribute(name){attributes.delete(name);if(name==='data-civweave-system')delete this.dataset.civweaveSystem}
  };
};

const location={
  pathname:'/app/cabinets/living-school/index.html',
  search:'?system=living-school',
  hash:'',
  hostname:'example.test',
  href:'https://example.test/app/cabinets/living-school/index.html?system=living-school'
};
const listeners=new Map();
const addEventListener=(type,listener)=>{const rows=listeners.get(type)||[];rows.push(listener);listeners.set(type,rows)};
const removeEventListener=(type,listener)=>listeners.set(type,(listeners.get(type)||[]).filter(item=>item!==listener));
const dispatchEvent=event=>{for(const listener of listeners.get(event.type)||[])listener(event);return true};
const localStorage={getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,String(value))};
const sandbox={
  console,URL,URLSearchParams,Promise,Date,JSON,String,Object,Array,Error,Math,
  document:{documentElement:makeNode(),body:makeNode(),getElementById:()=>null},
  location,localStorage,
  CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},
  MutationObserver:class MutationObserver{constructor(callback){this.callback=callback}observe(){}disconnect(){}},
  addEventListener,removeEventListener,dispatchEvent,
  queueMicrotask:callback=>callback(),setInterval:callback=>{callback();return 1},clearInterval:()=>{}
};
sandbox.globalThis=sandbox;
vm.runInNewContext(identity,sandbox,{filename:'guide-identity-integrity-v216.js'});

const migrated=JSON.parse(stored.get('civweave.persistent-guide-chat.v214'));
assert.equal(migrated.messages[0].guide,'living-school','Stored realm-action response was not reassigned to Moss.');
assert.equal(migrated.messages[0].responderSystem,'living-school','Responder ownership was not persisted.');

sandbox.CivweavePersistentGuideChatV215={switchGuide:system=>{sandbox.switchedGuide=system}};
sandbox.CivweaveAssistantV141={
  respond:async options=>({
    response:{answer:'Identity held.',choice:{system:options.systemId,nextAction:'Continue.'}},
    context:{guide:{system:options.systemId}},
    provider:'test-provider',model:'test-model'
  })
};

const moss=await sandbox.CivweaveAssistantV141.respond({systemId:'living-school',history:[]});
assert.equal(moss.respondingSystem,'living-school');
assert.equal(moss.respondingGuide,'Moss');
assert.equal(moss.handedOff,false);

const handedOff=await sandbox.CivweaveAssistantV141.respond({systemId:'civweave',history:[]});
assert.equal(handedOff.requestedSystem,'civweave');
assert.equal(handedOff.respondingSystem,'living-school');
assert.equal(handedOff.respondingGuide,'Moss');
assert.equal(handedOff.handedOff,true);
assert.equal(sandbox.switchedGuide,'living-school','Compatibility chat API did not switch to the receiving guide.');

console.log(JSON.stringify({ok:true,revision:'v216-identity-integrity-v250-canonical-workspace',canonicalChatOwner:'v242',v215CompatibilityOnly:true},null,2));
