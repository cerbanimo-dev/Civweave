import {readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const sourcePath=path.join(dir,'verify-memory-credential-v191-legacy.mjs');
const runtimePath=path.join(dir,'.verify-memory-credential-v191.runtime.mjs');
let source=await readFile(sourcePath,'utf8');

function replaceRequired(before,after,label){
  if(!source.includes(before))throw new Error(`Memory verifier compatibility patch could not find ${label}.`);
  source=source.replace(before,after);
}

replaceRequired(
  "const document={documentElement:{dataset:{}},getElementById(){return null},querySelector(){return null},head:{append(){}},body:{append(){}}};",
  "const settingsUrl='https://civweave.test/app/model-settings-controller-v173.js?activate=1';\nconst document={currentScript:{src:settingsUrl},documentElement:{dataset:{}},getElementById(){return null},querySelector(){return null},head:{append(){}},body:{append(){}}};",
  'explicit settings controller activation fixture'
);
replaceRequired(
  "const settingsSandbox={console,Date,Math,JSON,localStorage:settingsLocal,sessionStorage:settingsSession,CustomEvent,HTMLElement,document,dispatchEvent:event=>{settingsEvents.push(event);return true},globalThis:null};",
  "const settingsSandbox={console,Date,Math,JSON,URL,location:{href:settingsUrl},localStorage:settingsLocal,sessionStorage:settingsSession,CustomEvent,HTMLElement,document,dispatchEvent:event=>{settingsEvents.push(event);return true},globalThis:null};",
  'settings URL context'
);
replaceRequired(
  "assert(controller?.credentialStatus?.().remembered===true,'Remembered device credential was not detected.');\nassert(controller.credentialStatus().session===true,'Remembered device credential was not restored into the runtime session.');\nassert(JSON.parse(settingsSession.getItem('civweave-model-session')).apiKey===persisted.apiKey,'Restored Gemini key did not reach the session key used by the model runtime.');",
  "assert(controller?.credentialStatus?.().remembered===true,'Remembered device credential was not detected.');\nassert(controller.credentialStatus().session===false,'Remembered device credential must not restore merely because Settings code loaded.');\nassert(!settingsSession.getItem('civweave-model-session'),'Settings controller mutated the runtime session at module load.');\nassert(controller.restoreRememberedCredential()===true,'Explicit remembered-credential restore failed.');\nassert(controller.credentialStatus().session===true,'Explicit restore did not populate the runtime session.');\nassert(JSON.parse(settingsSession.getItem('civweave-model-session')).apiKey===persisted.apiKey,'Explicitly restored Gemini key did not reach the session key used by the model runtime.');",
  'explicit remembered credential restore contract'
);
replaceRequired(
  "assert(deviceSource.includes('restoresConsent:true')&&deviceSource.includes('mirrorsRuntimeSecret:true'),'Credential bridge does not declare the v192 usability repair.');\nfor(const token of ['/app/weaveling-memory-v191.js','/app/weaveling-memory-bridge-v191.js']){",
  "assert(deviceSource.includes('restoresConsent:true')&&deviceSource.includes('mirrorsRuntimeSecret:true'),'Credential bridge does not declare the v192 usability repair.');\nconst lightweightBridge=additiveWorker.includes(\"importScripts('/service-worker-v203.js?v=\");\nfor(const token of ['/app/weaveling-memory-v191.js','/app/weaveling-memory-bridge-v191.js']){",
  'lightweight bridge detection'
);
replaceRequired(
  "  assert(additiveWorker.includes(token),`Additive package is missing ${token}.`);",
  "  if(!lightweightBridge)assert(additiveWorker.includes(token),`Layered additive package is missing ${token}.`);",
  'layered additive memory assertion'
);
replaceRequired(
  "assert(/working-campus-additions-v19[12]-(?:memory-credential|credential-usable)/.test(additiveWorker),'Additive cache did not retain or advance the memory/credential package.');",
  "if(lightweightBridge){\n  assert(additiveWorker.includes('legacy-v156-bridge-v209'),'Legacy v156 registration no longer identifies the direct lightweight bridge.');\n  assert(/service-worker-v203\\.js\\?v=1\\.0\\.\\d+-code-coherence-v288-lightweight-shell-v208-legacy-v156-bridge-v209/.test(additiveWorker),'Legacy v156 registration does not rotate through the active v288 code-coherent lightweight shell.');\n}else{\n  assert(/working-campus-additions-v19[12]-(?:memory-credential|credential-usable)/.test(additiveWorker),'Additive cache did not retain or advance the memory/credential package.');\n}",
  'additive package revision assertion'
);

await writeFile(runtimePath,source,'utf8');
try{
  await import(pathToFileURL(runtimePath).href+`?run=${Date.now()}`);
}finally{
  await unlink(runtimePath).catch(()=>{});
}
