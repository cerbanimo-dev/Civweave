import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const boundary=fs.readFileSync('public/app/install-boundary-v146.js','utf8');
const unified=fs.readFileSync('public/app/unified-chat-system-v1.js','utf8');

assert.match(boundary,/const UNIFIED_CHAT_SYSTEM='\/app\/unified-chat-system-v1\.js';/,'Install boundary must name the unified chat capability layer explicitly.');
const experienceMatch=boundary.match(/const SYSTEM_EXPERIENCE_SCRIPTS=\[([^;]+)\];/s);
assert.ok(experienceMatch,'System experience script list is missing.');
const experience=experienceMatch[1];
assert.ok(experience.includes('GUIDE_WORKSPACE,UNIFIED_CHAT_SYSTEM'),'Unified capability layer must load immediately after the canonical guide chat surface.');
assert.ok(experience.indexOf('UNIFIED_CHAT_SYSTEM')<experience.indexOf('SHARED_GUIDE_SURFACE'),'Unified capability layer must load before the slower shared-guide dependency chain.');
const compatibilityMatch=boundary.match(/const COMPATIBILITY_SCRIPTS=\[([^;]+)\];/s);
assert.ok(compatibilityMatch?.[1].includes('GUIDE_WORKSPACE,UNIFIED_CHAT_SYSTEM'),'Compatibility surfaces must also load the unified capability layer with chat.');

const sandbox={
  console,
  URL,
  URLSearchParams,
  Date,
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  RegExp,
  Promise,
  Set,
  Map,
  setTimeout,
  clearTimeout,
  queueMicrotask:callback=>callback(),
  addEventListener:()=>{},
  dispatchEvent:()=>true,
  CustomEvent:function CustomEvent(type,init={}){this.type=type;this.detail=init.detail},
  localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  document:{
    readyState:'complete',
    documentElement:{dataset:{}},
    getElementById:()=>null,
    scripts:[],
    head:{append:()=>{}},
    querySelectorAll:()=>[]
  }
};
sandbox.globalThis=sandbox;
vm.runInNewContext(unified,sandbox,{filename:'unified-chat-system-v1.js'});
const api=sandbox.CivweaveUnifiedChatSystemV1;
assert.ok(api,'Unified chat API did not initialize.');
assert.equal(api.learningJourneyIntent('I would like to learn to read Tarot',[]),true,'A direct Moss learning goal must enter Learning Journey planning instead of ordinary dialogue.');
const request=api.curriculumRequest({text:'I would like to learn to read Tarot',history:[]});
assert.equal(request.intent,'new','A direct Moss learning goal must create a new Learning Journey request.');
assert.equal(request.newPath,true,'A direct Moss learning goal must be marked as a new path.');
assert.equal(request.capability.toLowerCase(),'read tarot','The Tarot learning goal must survive intent normalization as the requested capability.');
assert.equal(request.count,4,'A new Moss Learning Journey should retain the default four-module request when no module count is specified.');

console.log('Moss Learning Journey bridge regression check passed.');
