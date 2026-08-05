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
    keys:async()=>[],match:async()=>null,delete:async()=>true,
  };
  return{
    context:vm.createContext({
      console,URL,Request,Response,Headers,Set,Map,Promise,self,caches,
      fetch:async()=>new Response('',{status:200}),
    }),
    listeners,
  };
}

function evaluate(source,filename='worker.js'){
  const {context,listeners}=makeContext();
  try{
    vm.runInContext(source,context,{filename});
    return{error:null,listeners};
  }catch(error){
    return{error,listeners};
  }
}

const importLine="importScripts('/service-worker.js?v=1.0.6-base-r48-worker-evaluation');";
assert(baseWorker.includes("const PACKAGE_RECOVERY_REVISION="),'Base worker no longer exposes the collision fixture.');
assert(additiveWorker.includes("const PACKAGE_RECOVERY_REVISION="),'Additive worker no longer exposes the collision fixture.');
assert(additiveWorker.includes(`${importLine}\n(()=>{`),'Additive worker is not isolated immediately after importScripts.');
assert(additiveWorker.trimEnd().endsWith('})();'),'Additive worker isolation closure is not closed.');
assert(additiveWorker.includes('working-campus-additions-v189-worker-evaluation'),'v189 worker evaluation revision is missing.');

const additiveBody=additiveWorker.replace(`${importLine}\n`,'');
const combined=evaluate(`${baseWorker}\n${additiveBody}`,'combined-service-worker.js');
assert(!combined.error,`Base and additive workers do not compile in one browser-style lexical scope: ${combined.error?.stack||combined.error}`);
assert(combined.listeners.filter(entry=>entry.type==='install').length===2,'Base and additive install listeners did not both register.');
assert(combined.listeners.filter(entry=>entry.type==='fetch').length===2,'Base and additive fetch listeners did not both register.');

const unscopedBody=additiveBody
  .replace("(()=>{\n'use strict';\n","'use strict';\n")
  .replace(/\n\}\)\(\);\s*$/,'\n');
const regression=evaluate(`${baseWorker}\n${unscopedBody}`,'unscoped-service-worker.js');
assert(regression.error?.name==='SyntaxError','The verifier did not detect the unscoped global redeclaration regression.');
assert(/PACKAGE_RECOVERY_REVISION|already been declared/i.test(String(regression.error.message)),'Regression failed for an unexpected reason.');

console.log(JSON.stringify({
  ok:true,
  revision:'v189-service-worker-evaluation',
  browserStyleSharedLexicalCompilation:true,
  additiveGlobalScope:'isolated-iife',
  duplicateGlobalConstCrash:false,
  regressionSensitivity:true,
  installListeners:combined.listeners.filter(entry=>entry.type==='install').length,
  fetchListeners:combined.listeners.filter(entry=>entry.type==='fetch').length,
},null,2));
