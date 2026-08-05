import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [baseWorker,additiveWorker]=await Promise.all([
  readFile(path.join(root,'public/service-worker.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-v156.js'),'utf8'),
]);
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

function makeContext(){
  const listeners=[];
  const self={
    location:{origin:'https://commonweave.test'},
    addEventListener(type,handler){listeners.push({type,handler});},
    skipWaiting:async()=>{},
    clients:{claim:async()=>{},matchAll:async()=>[]},
  };
  const caches={
    open:async()=>({put:async()=>{},keys:async()=>[],match:async()=>null}),
    keys:async()=>[],
    match:async()=>null,
    delete:async()=>true,
  };
  const context=vm.createContext({
    console,URL,Request,Response,Headers,Set,Map,Promise,self,caches,
    fetch:async()=>new Response('',{status:200}),
  });
  context.importScripts=()=>vm.runInContext(baseWorker,context,{filename:'service-worker.js'});
  return{context,listeners};
}

function evaluate(source){
  const {context,listeners}=makeContext();
  try{
    vm.runInContext(source,context,{filename:'service-worker-v156.js'});
    return{error:null,listeners};
  }catch(error){
    return{error,listeners};
  }
}

assert(baseWorker.includes("const PACKAGE_RECOVERY_REVISION="),'Base worker no longer exposes the collision fixture.');
assert(additiveWorker.includes("const PACKAGE_RECOVERY_REVISION="),'Additive worker no longer exposes the collision fixture.');
assert(additiveWorker.includes("importScripts('/service-worker.js?v=1.0.6-base-r48-worker-evaluation');\n(()=>{"),'Additive worker is not isolated immediately after importScripts.');
assert(additiveWorker.trimEnd().endsWith('})();'),'Additive worker isolation closure is not closed.');
assert(additiveWorker.includes("working-campus-additions-v189-worker-evaluation"),'v189 worker evaluation revision is missing.');

const fixed=evaluate(additiveWorker);
assert(!fixed.error,`Combined service worker evaluation failed: ${fixed.error?.stack||fixed.error}`);
assert(fixed.listeners.filter(entry=>entry.type==='install').length===2,'Base and additive install listeners did not both register.');
assert(fixed.listeners.filter(entry=>entry.type==='fetch').length===2,'Base and additive fetch listeners did not both register.');

const unscoped=additiveWorker
  .replace("(()=>{\n'use strict';\n","'use strict';\n")
  .replace(/\n\}\)\(\);\s*$/,'\n');
const regression=evaluate(unscoped);
assert(regression.error instanceof SyntaxError,'The verifier did not detect the unscoped global redeclaration regression.');
assert(/PACKAGE_RECOVERY_REVISION|already been declared/i.test(String(regression.error.message)),'Regression failed for an unexpected reason.');

console.log(JSON.stringify({
  ok:true,
  revision:'v189-service-worker-evaluation',
  combinedEvaluation:true,
  importedBaseWorker:true,
  additiveGlobalScope:'isolated-iife',
  duplicateGlobalConstCrash:false,
  regressionSensitivity:true,
  installListeners:fixed.listeners.filter(entry=>entry.type==='install').length,
  fetchListeners:fixed.listeners.filter(entry=>entry.type==='fetch').length,
},null,2));
