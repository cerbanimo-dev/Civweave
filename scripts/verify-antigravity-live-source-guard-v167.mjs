import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

let domReady;
const context={
  console,
  URL,
  Headers,
  Response,
  Request,
  structuredClone,
  setTimeout,
  clearTimeout,
  location:{href:'https://example.test/app/cabinets/living-school/',origin:'https://example.test',protocol:'https:',pathname:'/app/cabinets/living-school/'},
  localStorage:{getItem(){return null}},
  document:{
    readyState:'loading',
    documentElement:{},
    querySelectorAll(){return[]},
    querySelector(){return null},
    addEventListener(){},
  },
  MutationObserver:class{observe(){}},
  addEventListener(type,fn){if(type==='DOMContentLoaded')domReady=fn},
  fetch:async()=>new Response('{}',{status:200,headers:{'content-type':'application/json'}}),
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../public/extensions/civweave-antigravity-live-source-guard-v167.js',import.meta.url),'utf8'),context);
domReady();
const guard=context.CivweaveAntigravityLiveSourceGuardV167;
assert.ok(guard);

const good={
  status:'completed',
  steps:[
    {type:'google_search_call',arguments:{queries:['official docs']}},
    {type:'google_search_result',result:{}},
    {type:'url_context_result',result:{status:'success',retrieved_url:'https://www.youtube.com/watch?v=abcDEF12345'}},
    {type:'model_output',content:[{type:'text',text:JSON.stringify({modules:[{video:{youtubeUrl:'https://youtu.be/abcDEF12345',opened:true}}],sources:[{title:'Docs',url:'https://www.youtube.com/watch?v=abcDEF12345',liveFetched:true}]})}]}
  ]
};
const verified=guard.enforcePayload(good,'youtube-scout');
const parsed=JSON.parse(verified.steps.at(-1).content[0].text);
assert.equal(parsed.modules[0].video.opened,true);
assert.equal(parsed.sources[0].liveFetched,true);
assert.equal(verified.civweave_live_verification.searchUsed,true);
assert.equal(verified.civweave_live_verification.urlContextUsed,true);

const direct={
  status:'completed',
  steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify({modules:[{video:{youtubeUrl:'https://youtu.be/abcDEF12345',opened:true}}],sources:[{title:'Claimed',url:'https://example.com',liveFetched:true}]})}]}]
};
const rejected=guard.enforcePayload(direct,'source-research');
const rejectedJson=JSON.parse(rejected.steps[0].content[0].text);
assert.equal(rejectedJson.modules[0].video.opened,false);
assert.equal(rejectedJson.sources[0].liveFetched,false);

const searchOnly={
  status:'completed',
  steps:[
    {type:'google_search_call',arguments:{queries:['topic']}},
    {type:'model_output',content:[{type:'text',text:JSON.stringify({sources:[{title:'Search citation only',url:'https://example.com',liveFetched:true}]})}]}
  ]
};
const searchOnlyRejected=guard.enforcePayload(searchOnly,'source-research');
assert.equal(JSON.parse(searchOnlyRejected.steps[1].content[0].text).sources[0].liveFetched,false);

console.log(JSON.stringify({
  version:guard.version,
  verified:'google_search + url_context required',
  directAnswerRejected:true,
  searchWithoutRetrievalRejected:true,
},null,2));
