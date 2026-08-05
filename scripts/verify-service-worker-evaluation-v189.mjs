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

const criticalImportMatch=additiveWorker.match(/importScripts\('\/service-worker-critical-v199\.js(?:\?[^']+)?'\);/);
const importMatch=additiveWorker.match(/importScripts\('\/service-worker\.js\?v=([^']+)'\);/);
assert(criticalImportMatch,'Additive worker does not import the critical package coordinator.');
assert(importMatch,'Additive worker does not import the base worker.');
const criticalImportLine=criticalImportMatch[0];
const importLine=importMatch[0];
const criticalImportIndex=additiveWorker.indexOf(criticalImportLine);
const importIndex=additiveWorker.indexOf(importLine);
const scopeIndex=additiveWorker.indexOf('(()=>{',importIndex+importLine.length);
const firstAdditiveConst=additiveWorker.indexOf('\nconst ',importIndex+importLine.length);
const finalizePattern=/\s*\(self\.CommonweaveCriticalBootV202\|\|self\.CommonweaveCriticalBootV201\|\|self\.CommonweaveCriticalBootV199\)\?\.finalize\(\);\s*$/;
assert(baseWorker.includes("const PACKAGE_RECOVERY_REVISION="),'Base worker no longer exposes the collision fixture.');
assert(additiveWorker.includes("const PACKAGE_RECOVERY_REVISION="),'Additive worker no longer exposes the collision fixture.');
assert(/base-r(?:48|49|50|51|52)-/.test(importMatch[1]),'Additive worker does not import a recognized isolated-scope base revision.');
assert(criticalImportIndex>=0&&criticalImportIndex<importIndex,'Critical package coordinator must load before the base worker.');
assert(scopeIndex>importIndex,'Additive worker does not open an isolation closure after importScripts.');
assert(firstAdditiveConst<0||scopeIndex<firstAdditiveConst,'An additive lexical declaration appears before the isolation closure.');
assert(finalizePattern.test(additiveWorker),'Additive worker isolation closure or critical finalizer is not closed.');
assert(/working-campus-additions-v(?:189-worker-evaluation|190-weaveling-plan-json|191-memory-credential|194-image-system-nav-repair|195-living-school-boot|196-living-school-reader-loop|197-assistant-runtime-package)/.test(additiveWorker),'Recognized worker evaluation revision is missing.');

const additiveBody=additiveWorker
  .replace(criticalImportLine,'')
  .replace(importLine,'')
  .replace(finalizePattern,'\n');
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
  revision:'v202-cache-busted-critical-coordinator-compatible',
  importedBaseRevision:importMatch[1],
  criticalCoordinatorImportedFirst:true,
  criticalCoordinatorCacheBusted:/\?/.test(criticalImportLine),
  browserStyleSharedLexicalCompilation:true,
  additiveGlobalScope:'isolated-iife',
  duplicateGlobalConstCrash:false,
  regressionSensitivity:true,
  installListeners:combined.listeners.filter(entry=>entry.type==='install').length,
  fetchListeners:combined.listeners.filter(entry=>entry.type==='fetch').length,
},null,2));
