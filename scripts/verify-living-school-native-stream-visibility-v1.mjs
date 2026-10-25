import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=file=>readFileSync(file,'utf8');
const core=read('public/app/cabinets/living-school/living-school-cleanroom-core-v218.mjs');
const ui=read('public/app/living-school-active-run-ui-v2.js');
const index=read('public/app/cabinets/living-school/index.html');
const runtime=read('public/app/shared/civweave-model-runtime.js');

assert.match(core,/function withNativeMossStream\(config/);
assert.match(core,/config:withNativeMossStream\(/,'Curriculum design enables native SSE');
assert.match(core,/smallConfig=withNativeMossStream\(/,'Module compilation enables native SSE');
assert.match(runtime,/pendingText\+=delta/,'Native server emits raw text deltas');
assert.match(index,/active-run-ui-v2\.js\?v=2\.1\.0-native-stream-visible-v3/);
assert.ok(ui.includes("phase==='partial'"),'Run panel consumes the streaming partial event');

const helper=core.slice(core.indexOf('function withNativeMossStream('),core.indexOf('function resultText('));
const nativeConfig={provider:'openai-compatible',model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1',stream:false};
const helperScope={
  clean:(v,max=6000)=>String(v??'').slice(0,max),
  providerName:c=>String(c.provider||c.route||'').toLowerCase(),
  configs:[],
};
const nativeStream=vm.runInNewContext(helper+'\nwithNativeMossStream',helperScope);
assert.equal(nativeStream(nativeConfig).stream,true,'Same-phone Qwen requests must stream');
assert.equal(nativeConfig.stream,false,'Do not mutate saved model settings');
assert.equal(nativeStream({...nativeConfig,model:'other-model'}).stream,false,'Do not change other models');
assert.equal(nativeStream({...nativeConfig,endpoint:'http://192.168.1.5:8080/v1'}).stream,false,'Do not change remote or LAN endpoints');
assert.equal(nativeStream({...nativeConfig,provider:'gemini'}).stream,false,'Do not change hosted providers');

let railHtml='',updates=0;
const nodes={
  '.lsc-run-dots':{scrollLeft:0,scrollWidth:0},
  '.lsc-run-time':{textContent:''},
  '.lsc-run-phase':{textContent:''},
  '.lsc-run-stream-status':{textContent:''},
  '.lsc-run-stream-text':{textContent:'',scrollTop:0,scrollHeight:100,clientHeight:100}
};
const rail={
  hidden:true,
  querySelector(selector){return nodes[selector]||null},
  get innerHTML(){return railHtml},
  set innerHTML(html){railHtml=html;updates++;nodes['.lsc-run-stream-text'].textContent='';nodes['.lsc-run-stream-status'].textContent=''}
};
const button={disabled:true,textContent:'Generating curriculum',getAttribute(name){return name==='aria-busy'?'true':null}};
const document={
  readyState:'loading',
  documentElement:{dataset:{}},
  getElementById(id){if(id==='lsc-living-school-generation-run-rail')return rail;if(id==='lsc-living-school-generation-run-style-v2')return {};return null},
  querySelector(selector){if(selector==='[data-ls-action="generate-curriculum"]')return button;return null}
};
const scope={document,Date,console,setInterval(){return 1},clearInterval(){},addEventListener(){},queueMicrotask(){},globalThis:null};
scope.globalThis=scope;
vm.runInNewContext(ui,scope,{filename:'public/app/living-school-active-run-ui-v2.js'});
const api=scope.CivweaveLivingSchoolActiveRunUIV2;
const base={requestId:'call-1',purpose:'living-school-research-grounded-curriculum-v218.1',provider:'openai-compatible',model:'qwen35-4b-native',at:new Date().toISOString()};
api.onModelEvent({detail:{...base,phase:'connecting',streamed:true}});
assert.ok(railHtml.includes('lsc-run-stream-text'),'Visible stream section must be mounted on first event');
assert.match(nodes['.lsc-run-stream-status'].textContent,/Connecting to model/);
api.onModelEvent({detail:{...base,phase:'partial',text:'Tarot ',accumulatedText:'Tarot '}});
assert.equal(nodes['.lsc-run-stream-text'].textContent,'Tarot ');
assert.match(nodes['.lsc-run-stream-status'].textContent,/6 characters received/);
const renderedAfterFirst=updates;
api.onModelEvent({detail:{...base,phase:'partial',text:'guide',accumulatedText:'Tarot guide'}});
assert.equal(nodes['.lsc-run-stream-text'].textContent,'Tarot guide');
assert.equal(updates,renderedAfterFirst,'Streaming text must not remount the entire run panel');
const untrusted='<img src=x onerror=alert(1)>';
api.onModelEvent({detail:{...base,phase:'partial',text:untrusted,accumulatedText:untrusted}});
assert.equal(nodes['.lsc-run-stream-text'].textContent,untrusted);
assert.ok(!railHtml.includes(untrusted),'Do not interpolate streamed text into HTML');
const long='a'.repeat(20000);
api.onModelEvent({detail:{...base,phase:'partial',text:'a',accumulatedText:long}});
assert.equal(api.session.runs[0].generatedChars,20000);
assert.equal(nodes['.lsc-run-stream-text'].textContent.length,16000,'Keep stream preview bounded');
api.onModelEvent({detail:{...base,phase:'partial',text:'',accumulatedText:long,complete:true,finishReason:'stop'}});
api.onModelEvent({detail:{...base,phase:'completed',status:'success',usage:{outputTokens:500}}});
assert.equal(api.session.runs[0].status,'complete');
assert.match(nodes['.lsc-run-stream-status'].textContent,/500 output tokens/);
assert.match(nodes['.lsc-run-stream-status'].textContent,/finish stop/);
console.log('PASS: Native SSE is scoped to local Qwen; live draft renders with safe text, bounded memory and request diagnostics.');
