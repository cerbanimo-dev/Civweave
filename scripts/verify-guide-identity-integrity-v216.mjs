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
  "const VERSION='1.0.0-guide-identity-integrity-v216'",
  "const CHAT_KEY='commonweave.persistent-guide-chat.v214'",
  'row.actionSnapshot?.system',
  "row.identityCorrection='v216-action-owner'",
  'Identity boundary:',
  'requestedSystem',
  'respondingSystem',
  "Object.defineProperty(globalThis,'CommonweaveAssistantV141'",
  "identityPolicy:'explicit-selected-guide-or-explicit-handoff'"
])assert(identity.includes(token),`Guide identity integrity runtime is missing ${token}`);

for(const token of [
  "const GUIDE_IDENTITY_SCRIPT='/app/guide-identity-integrity-v216.js'",
  "const ADDITIONS_VERSION='v216-guide-identity-integrity'",
  "const GUIDE_IDENTITY_REVISION='v216-explicit-responder-ownership'",
  'addScript(GUIDE_IDENTITY_SCRIPT);addScript(PERSISTENT_GUIDE_CHAT_SCRIPT)',
  "guideIdentityPolicy:'explicit-selected-guide-or-explicit-handoff'",
  "guideIdentityMigration:'realm-action-owner'"
])assert(boundary.includes(token),`Install boundary is missing ${token}`);

assert(
  boundary.indexOf('addScript(GUIDE_IDENTITY_SCRIPT)')<boundary.indexOf('addScript(PERSISTENT_GUIDE_CHAT_SCRIPT)'),
  'Identity integrity must load before the persistent chat reads its shared history.'
);
assert(chat.includes("const STORAGE_KEY='commonweave.persistent-guide-chat.v214'"),'Persistent chat history key changed unexpectedly.');
assert(assistant.includes("if(systemId==='commonweave'&&routedSystem!=='commonweave')systemId=routedSystem"),'Verifier no longer covers the legacy realm-coercion boundary.');

const stored=new Map();
stored.set('commonweave.persistent-guide-chat.v214',JSON.stringify({
  messages:[{
    role:'assistant',
    guide:'commonweave',
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
    setAttribute(name,value){attributes.set(name,String(value));if(name==='data-commonweave-system')this.dataset.commonweaveSystem=String(value)},
    removeAttribute(name){attributes.delete(name);if(name==='data-commonweave-system')delete this.dataset.commonweaveSystem}
  };
};

const location={pathname:'/app/cabinets/living-school/index.html',search:'?system=living-school',hash:'',href:'https://example.test/app/cabinets/living-school/index.html?system=living-school'};
const replaceState=(_state,_title,relative)=>{
  const next=new URL(relative,location.href);
  location.pathname=next.pathname;
  location.search=next.search;
  location.hash=next.hash;
  location.href=next.href;
};
const events=[];
const sandbox={
  console,
  URL,
  Promise,
  Date,
  JSON,
  String,
  Object,
  Array,
  Error,
  Math,
  document:{documentElement:makeNode(),body:makeNode()},
  location,
  history:{state:null,replaceState},
  localStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,String(value))},
  CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},
  dispatchEvent:event=>{events.push(event);return true}
};
sandbox.globalThis=sandbox;
vm.runInNewContext(identity,sandbox,{filename:'guide-identity-integrity-v216.js'});

const migrated=JSON.parse(stored.get('commonweave.persistent-guide-chat.v214'));
assert.equal(migrated.messages[0].guide,'living-school','Stored realm-action response was not reassigned to Moss.');
assert.equal(migrated.messages[0].responderSystem,'living-school','Responder ownership was not persisted.');

sandbox.CommonweaveAssistantV141={
  respond:async options=>({
    response:{answer:'Identity held.',choice:{system:options.systemId}},
    context:{guide:{system:options.systemId}}
  })
};

const moss=await sandbox.CommonweaveAssistantV141.respond({systemId:'living-school',history:[]});
assert.equal(moss.respondingSystem,'living-school');
assert.equal(moss.respondingGuide,'Moss');

const weaveling=await sandbox.CommonweaveAssistantV141.respond({systemId:'commonweave',history:[]});
assert.equal(weaveling.respondingSystem,'commonweave');
assert.equal(weaveling.respondingGuide,'Weaveling');
assert.equal(location.search,'?system=living-school','Temporary page-system shadow was not restored.');

console.log(JSON.stringify({
  ok:true,
  revision:'v216-explicit-responder-ownership',
  migratedGuide:migrated.messages[0].guide,
  explicitGuideSelection:true,
  identityBoundary:true,
  patchLoadsBeforePersistentChat:true
},null,2));
