import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const [legacy,wrapper,cleanup,core]=await Promise.all([read('public/service-worker-v156.js'),read('public/service-worker-v203.js'),read('public/service-worker-living-school-cleanroom-v218.js'),read('public/service-worker-core-v208.js')]);
function context(){const listeners=[];const self={location:{origin:'https://commonweave.test'},addEventListener:(type,handler)=>listeners.push({type,handler}),skipWaiting:async()=>{},clients:{claim:async()=>{},matchAll:async()=>[]}};const caches={open:async()=>({put:async()=>{},keys:async()=>[],match:async()=>null,delete:async()=>true}),keys:async()=>[],match:async()=>null,delete:async()=>true};return{listeners,scope:vm.createContext({console,URL,Request,Response,Headers,Set,Map,Promise,AbortController,setTimeout,clearTimeout,self,caches,fetch:async()=>new Response('',{status:200})})}}
function evaluate(source,name){const test=context();vm.runInContext(source,test.scope,{filename:name});return test.listeners}
assert(legacy.includes("importScripts('/service-worker-v203.js"),'Legacy registrations no longer bridge to v203.');
const cleanupImport=wrapper.match(/importScripts\('\/service-worker-living-school-cleanroom-v218\.js[^']*'\);/)?.[0];
const coreImport=wrapper.match(/importScripts\('\/service-worker-core-v208\.js[^']*'\);/)?.[0];
assert(cleanupImport&&coreImport,'v203 is missing clean-room or retained-core import.');
assert(wrapper.indexOf(cleanupImport)<wrapper.indexOf(coreImport),'Cache retirement must execute before the retained core.');
const cleanupListeners=evaluate(cleanup,'living-school-cleanroom-worker.js');
const coreListeners=evaluate(core,'lightweight-core-worker.js');
assert(cleanupListeners.some(row=>row.type==='install')&&cleanupListeners.some(row=>row.type==='fetch'),'Clean-room worker boundary did not register install and fetch protection.');
assert(coreListeners.some(row=>row.type==='install')&&coreListeners.some(row=>row.type==='fetch'),'Retained worker core did not register install and fetch behavior.');
const combined=evaluate(`${cleanup}\n${core}`,'combined-cleanroom-worker.js');
assert(combined.filter(row=>row.type==='install').length>=2&&combined.filter(row=>row.type==='fetch').length>=2,'Worker layers did not compile together.');
assert(cleanup.includes('event.stopImmediatePropagation()'),'Living School requests are not isolated before the generic runtime cache.');
console.log(JSON.stringify({ok:true,revision:'v218-cleanroom-plus-retained-lightweight-core',legacyBridge:true,duplicateGlobalConstCrash:false,cleanroomFetchBoundary:true,retainedOfflineCore:true},null,2));
