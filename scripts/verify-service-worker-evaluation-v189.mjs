import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [baseWorker,additiveWorker,lightweightWorker]=await Promise.all([
  readFile(path.join(root,'public/service-worker.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-v156.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-v203.js'),'utf8'),
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

const bridgeImportMatch=additiveWorker.match(/importScripts\('\/service-worker-v203\.js(?:\?[^']+)?'\);/);
if(bridgeImportMatch){
  assert(additiveWorker.includes('legacy-v156-bridge-v209'),'Legacy worker bridge revision is missing.');
  assert(!additiveWorker.includes('/service-worker-critical-v199.js'),'Legacy bridge still imports the collision-prone critical coordinator.');
  assert(!additiveWorker.includes("importScripts('/service-worker.js"),'Legacy bridge still imports the collision-prone base worker.');
  assert(!additiveWorker.includes('const PACKAGE_RECOVERY_REVISION='),'Legacy bridge redeclares the collision-prone recovery binding.');
  for(const type of ['GET_SHARED_IMAGE_STATUS','GET_CRITICAL_BOOT_STATUS','GET_ADDITIONS_STATUS']){
    assert(additiveWorker.includes(type),`Legacy bridge does not answer ${type}.`);
  }
  assert(/lightweight-shell-v208/.test(lightweightWorker),'Legacy bridge target is not the lightweight shell worker.');
  assert(!/importScripts\(/.test(lightweightWorker),'Lightweight shell worker unexpectedly imports the layered worker stack.');

  const bridgeBody=additiveWorker.replace(bridgeImportMatch[0],'');
  const bridgeEvaluation=evaluate(bridgeBody,'legacy-v156-bridge.js');
  assert(!bridgeEvaluation.error,`Legacy bridge does not compile independently: ${bridgeEvaluation.error?.stack||bridgeEvaluation.error}`);
  assert(bridgeEvaluation.listeners.some(entry=>entry.type==='message'),'Legacy bridge did not register its compatibility message listener.');

  const lightweightEvaluation=evaluate(lightweightWorker,'lightweight-service-worker-v203.js');
  assert(!lightweightEvaluation.error,`Lightweight worker does not compile in a browser-style scope: ${lightweightEvaluation.error?.stack||lightweightEvaluation.error}`);
  assert(lightweightEvaluation.listeners.some(entry=>entry.type==='install'),'Lightweight worker did not register an install listener.');
  assert(lightweightEvaluation.listeners.some(entry=>entry.type==='fetch'),'Lightweight worker did not register a fetch listener.');

  const combined=evaluate(`${bridgeBody}\n${lightweightWorker}`,'bridged-lightweight-service-worker.js');
  assert(!combined.error,`Legacy bridge and lightweight worker collide in one browser-style scope: ${combined.error?.stack||combined.error}`);

  console.log(JSON.stringify({
    ok:true,
    revision:'v209-legacy-bridge-lightweight-shell',
    bridgeTarget:'service-worker-v203.js',
    layeredImports:false,
    duplicateGlobalConstCrash:false,
    compatibilityMessageListener:true,
    lightweightInstallListener:true,
    lightweightFetchListener:true,
  },null,2));
  process.exit(0);
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
const finalizePattern=/\s*\(self\.CommonweaveCriticalBootV205\|\|self\.CommonweaveCriticalBootV204\|\|self\.CommonweaveCriticalBootV202\|\|self\.CommonweaveCriticalBootV201\|\|self\.CommonweaveCriticalBootV199\)\?\.finalize\(\);\s*$/;
assert(baseWorker.includes("const BASE_PACKAGE_RECOVERY_REVISION="),'Base worker recovery binding is not isolated.');
assert(!baseWorker.includes("const PACKAGE_RECOVERY_REVISION="),'Base worker still exports the generic collision-prone recovery binding.');
assert(additiveWorker.includes("const PACKAGE_RECOVERY_REVISION="),'Additive worker recovery binding is missing from its isolation closure.');
assert(/base-r(?:48|49|50|51|52|53)-/.test(importMatch[1]),'Additive worker does not import a recognized isolated-scope base revision.');
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
const collisionBase=baseWorker.replaceAll('BASE_PACKAGE_RECOVERY_REVISION','PACKAGE_RECOVERY_REVISION');
const regression=evaluate(`${collisionBase}\n${unscopedBody}`,'unscoped-service-worker.js');
assert(regression.error?.name==='SyntaxError','The verifier did not detect the unscoped global redeclaration regression.');
assert(/PACKAGE_RECOVERY_REVISION|already been declared/i.test(String(regression.error.message)),'Regression failed for an unexpected reason.');

console.log(JSON.stringify({
  ok:true,
  revision:'v205-memory-bridge-critical-coordinator-compatible',
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
