import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [direct,full,compat,shared,gateway]=await Promise.all([
 read('public/app/settings-local-models-direct-v325.js'),
 read('public/app/settings-local-route-v331.js'),
 read('public/app/settings-local-route-v327.js'),
 read('public/app/shared/civweave-ai-fleet-v1.js'),
 read('public/app/settings-gateway-v317.js')
]);
for(const [name,source] of [['direct',direct],['full',full],['compat',compat]]){
 assert.match(source,/showUnifiedFleet/,'Shared AI Fleet must own '+name+' selection display.');
 assert.match(source,/civweave-ai-fleet-v1\.js/,'Fleet loader missing from '+name+'.');
 assert.match(source,/return true/,'Fleet takeover must stop obsolete display path in '+name+'.');
}
assert.match(gateway,/data-settings-tab="local-models">AI fleet<\/button>/);
assert.match(shared,/qwen35-08b-onnx-webgpu/);
assert.match(shared,/qwen35-4b-onnx-webgpu/);
assert.match(shared,/qwen35-4b-gguf/);
assert.match(shared,/qwen2\.5-coder:7b/);
assert.match(shared,/llama3\.3:70b/);

// Shared Settings display must not read model cache, download, run inference,
// change provider or touch the network simply by opening the AI Fleet tab.
let writes=0,reads=0,renders=0;
const target={innerHTML:'',querySelector(){return null}};
const header={textContent:'CIVWEAVE SETTINGS · v324'};
const form={querySelector(sel){
 if(sel==='[data-settings-tab-panel="local-models"]')return target;
 return null;
}};
const layer={isConnected:true,hidden:false,dataset:{},querySelector(sel){
 if(sel==='[data-cw-settings-form]')return form;
 if(sel==='[data-settings-tab-panel="local-models"]')return target;
 if(sel==='header small')return header;
 return null;
}};
const context={
 console,URL,setTimeout,clearTimeout,
 document:{getElementById:id=>id==='cw-settings-v320'?layer:null,
 createElement(){throw Error('AI Fleet should be loaded already.');},
 addEventListener(){},head:{}},
 localStorage:{getItem(){reads++;return null},setItem(){writes++}},
 CivweaveAIFleetV1:{render(){renders++;target.innerHTML='<h3>AI Fleet</h3>';return true}},
 addEventListener(){},queueMicrotask(){},globalThis:null
};
context.globalThis=context;
Object.defineProperty(context,'CivweaveLocalModelDownloadV266',{get(){throw Error('Model manager accessed on view')}});
vm.runInNewContext(direct,context,{filename:'settings-local-models-direct-v325.js'});
assert.equal(context.CivweaveSettingsLocalDirectV325.render(layer),true);
assert.equal(renders,1);
assert.equal(writes,0);
assert.match(target.innerHTML,/AI Fleet/);
assert.doesNotMatch(target.innerHTML,/LiteRT|Premier Phone Pack|Individual Civweave models/i);
assert.equal(header.textContent,'CIVWEAVE SETTINGS · v325');
console.log(JSON.stringify({ok:true,revision:'ai-fleet-shared-settings',renders,reads,writes}));
