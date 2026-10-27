#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(p,'utf8');
const tracker=read('public/app/guide-generation-tracker-v1.js');
const guide=read('public/app/guide-chat-surface-v350.js');
const native=read('public/app/local-ai/native-server-guide-fastpath-v1.js');
const quest=read('public/extensions/civweave-weaveling-plan-json-v190.js');
const moss=read('public/app/unified-chat-system-v1.js');
const working=read('public/app/working-campus-v440.html');
const shell=read('public/app/persistent-system-shell-v1.js');
const authority=read('public/app/local-ai/gemma4-litert-request-authority-v1.js');

assert.match(guide,/ensureGenerationTracker\(\)/);
assert.match(guide,/await ensureGenerationTracker\(\)/,'Native fastpath must wait for tracker before inference.');
assert.match(guide,/1\.2\.23-universal-artifact-rail/);
assert.match(native,/1\.2\.13-universal-quest-rail/);
assert.match(quest,/maxTokens:4096,timeoutMs:1500000/);
assert.match(quest,/questProgress\(args,'streaming'/);
assert.match(quest,/questProgress\(args,'validating'/);
assert.match(quest,/questProgress\(args,'validated'/);
assert.match(quest,/questProgress\(args,'saved'/);
assert.match(quest,/questProgress\(args,'failed'/);
assert.match(quest,/state:'review'/);
assert.match(working,/guide-chat-surface-v350\.js\?v=1\.0\.198-universal-artifact-rail/);
assert.match(shell,/guide-chat-surface-v350\.js\?v=1\.0\.198-universal-artifact-rail/);
assert.match(authority,/TRACKER_VERSION='1\.2\.23/);
assert.match(moss,/1\.2\.13-universal-quest-rail/);

const events=new Map();
const doc={
  getElementById:()=>null,
  createElement:()=>({style:{},dataset:{},append(){},appendChild(){}}),
  head:{append(){}},
  addEventListener(type,fn){events.set(type,fn)}
};
const context={
  console,Date,Math,JSON,Set,WeakMap,Map,Array,Object,String,Number,Promise,
  document:doc,localStorage:{getItem:()=>null,setItem(){}},
  addEventListener(type,fn){events.set(type,fn)},
  dispatchEvent(){},queueMicrotask(){},
  location:{origin:'http://example.test'},
  parent:null
};
context.globalThis=context;
vm.runInNewContext(tracker,context,{filename:'guide-generation-tracker-v1.js'});
const ui=context.CivweaveGuideGenerationTrackerV1;
assert.equal(ui.version,'1.2.23-guide-generation-tracker-v1-universal-artifact-rail');
ui.resetForRequest({text:'Help me build a community garden',route:'quest',system:'civweave',messageId:'m1'});
assert.equal(ui.state().showPipeline,true);
const emit=detail=>events.get('civweave:structured-artifact-progress')({detail:{artifact:'quest',system:'civweave',model:'qwen35-4b-native',...detail}});
emit({phase:'started'});
assert.equal(ui.state().stages.intake.state,'complete');
assert.equal(ui.state().stages.compile.state,'skipped','A single-pass JSON request must not invent a second compiler.');
emit({phase:'streaming',accumulatedText:'{"title":"Community garden"',characters:27});
assert.equal(ui.state().stages.draft.state,'streaming');
assert.match(ui.state().streams.draft,/Community garden/);
assert.equal(ui.state().terminal,'','Raw JSON is not a saved Quest.');
emit({phase:'validating'});
assert.equal(ui.state().stages.validate.state,'running');
emit({phase:'validated',paths:[{realm:'fellowfare',title:'Gather tools and materials',steps:['Identify donated tools','Inspect delivery']},{realm:'cerbanimo',title:'Construct garden beds',steps:['Measure site','Build and test beds']}]});
assert.equal(ui.state().stages.validate.state,'complete');
assert.equal(ui.state().beats.length,2,'Quest beats must only be shown after schema validation.');
assert.deepEqual(Array.from(ui.state().beats.map(x=>x.realm)),['fellowfare','cerbanimo']);
assert.equal(ui.state().stages.saved.state,'queued');
emit({phase:'saved',planId:'review-only-1'});
assert.equal(ui.state().stages.saved.state,'complete');
assert.equal(ui.state().terminal,'complete');

ui.resetForRequest({text:'Create a resource manifest',route:'resource',system:'fellowfare',messageId:'m2'});
const manifest=events.get('civweave:structured-artifact-progress');
manifest({detail:{artifact:'manifest',system:'fellowfare',phase:'started'}});
manifest({detail:{artifact:'manifest',system:'fellowfare',phase:'repairing'}});
assert.equal(ui.state().stages.repair.state,'running');
manifest({detail:{artifact:'manifest',system:'fellowfare',phase:'failed',message:'Truncated JSON'}});
assert.equal(ui.state().terminal,'failed');
assert.match(ui.state().errorDetail,/Truncated JSON/);
assert.notEqual(ui.state().stages.saved.state,'complete');
assert.equal(ui.state().kind,'manifest','The shared progress bus must support non-Quest artifact types.');
ui.resetForRequest({text:'Explain morning bed-making habits',route:'',system:'civweave',messageId:'m3'});
events.get('civweave:guide-generation-progress')({detail:{system:'civweave',phase:'streaming',text:'A habit needs a cue and a small repeatable step.'}});
assert.equal(ui.state().kind,'dialogue');
assert.equal(ui.state().stages.draft.state,'streaming');
assert.match(ui.state().streams.draft,/repeatable step/);
events.get('civweave:realm-guide-thread-changed')({detail:{system:'civweave',thread:{updatedAt:'now',messages:[
 {role:'user',text:'Explain morning bed-making habits'},
 {role:'assistant',id:'m3',text:'A habit needs a cue and a small repeatable step.'}
]}}});
assert.equal(ui.state().terminal,'complete');
assert.equal(ui.state().stages.saved.state,'skipped','A plain chat answer is not a saved artifact.');
console.log('PASS universal tracker: one-pass Quest JSON shows real stages, live text, validation and REVIEW save; other realm artifacts share the rail and failures are not saved.');
