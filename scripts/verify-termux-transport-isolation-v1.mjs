#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=path=>fs.readFileSync(path,'utf8');
const runtime=read('public/app/shared/civweave-model-runtime.js');
const guide=read('public/app/guide-chat-surface-v350.js');
const moss=read('public/app/unified-chat-system-v1.js');
const settings=read('public/app/settings-gateway-v317.js');
const campus=read('public/app/working-campus-v440.html');
const diag=read('public/native-server-diagnostic.html');
const slice=(src,a,b)=>{const start=src.indexOf(a),end=src.indexOf(b,start);assert(start>=0&&end>start,'Missing anchor '+a);return src.slice(start,end)};
for(const [name,code] of [['runtime',runtime],['guide',guide],['Moss',moss],['settings',settings]])new vm.Script(code,{filename:name});
const diagScript=diag.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(diagScript,'Diagnostic must include isolated script');
new vm.Script(diagScript,{filename:'native-server-diagnostic'});
assert.doesNotMatch(diag,/<script[^>]+src=/,'Diagnostic must not load Civweave boot scripts');
assert.ok(diag.includes("method:'POST'")&&diag.includes("'/models'"),'Diagnostic must exercise browser CORS preflight without inference');
const storage=new Map();
storage.set('civweave.mobile.gguf-primary.v2',JSON.stringify({enabled:true,engine:'wllama',model:'qwen35-4b-native'}));
const global={localStorage:{getItem:key=>storage.get(key)||null}};
const embedded=vm.runInNewContext(`
const GGUF_BROWSER_SELECTION_KEY='civweave.mobile.gguf-primary.v2';
const GGUF_BROWSER_ENDPOINT='http://127.0.0.1:8080/v1';
${slice(runtime,'function selectedEmbeddedGGUF(config) {','  async function invokeOpenAI(')}
selectedEmbeddedGGUF
`,{global,runtimeError:(_code,message)=>new Error(message)});
assert.equal(embedded({provider:'openai-compatible',model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1'}),null,'Native alias must NOT start Wllama');
storage.set('civweave.mobile.gguf-primary.v2',JSON.stringify({enabled:true,engine:'wllama',model:'browser-gguf-4b'}));
assert.equal(embedded({provider:'openai-compatible',model:'browser-gguf-4b',endpoint:'http://127.0.0.1:8080/v1'}).model,'browser-gguf-4b','Imported GGUF route remains available');
assert.match(moss,/if\(config\.model==='qwen35-4b-native'.*return null/,'Moss must distinguish native alias from browser GGUF');
const probeFns=slice(guide,'function activeNativePhoneServer(){','function voiceState()');
const selected={provider:'openai-compatible',route:'openai-compatible',model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1'};
let calls=0;
const browser={
  CivweaveSettingsV320:{readState:()=>selected},
  CivweaveModelRuntime:{}
};
const ready=vm.runInNewContext(probeFns+';({activeNativePhoneServer,verifyNativePhoneServerTransport})',{
  globalThis:browser,configuredRoute:()=>selected.route,
  fetch:async url=>{calls++;assert.equal(url,'http://127.0.0.1:8080/v1/models');return{ok:true,json:async()=>({data:[{id:'qwen35-4b-native'}]})}},
  AbortController,setTimeout,clearTimeout,
  clean:v=>String(v||''),localStorage:{getItem:()=>null},parse:(v,f)=>{try{return JSON.parse(v)||f}catch{return f}}
});
assert.equal(ready.activeNativePhoneServer(),true);
assert.equal(await ready.verifyNativePhoneServerTransport(),true);
assert.equal(calls,1);
assert.match(guide,/await verifyNativePhoneServerTransport\(\);\s*await globalThis\.CivweaveFamilyAILoaderV105/,'Transport probe must precede heavy assistant setup');
assert.match(campus,/guide-chat-surface-v350\.js\?v=1\.0\.176-native-server-preflight-guard/,'Campus must load updated guide');
assert.match(settings,/const browserGGUF=route==='openai-compatible'&&byName\(form,'model'\)\?\.value!=='qwen35-4b-native'/,'Settings must distinguish native route');
console.log('PASS native alias never intercepted by Wllama; browser GGUF remains functional; bounded server probe runs before assistant initialization; standalone diagnostic is inert on load');
