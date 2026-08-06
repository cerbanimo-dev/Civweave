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
  "if(lightweightBridge){\n  assert(additiveWorker.includes('legacy-v156-bridge-v209'),'Legacy v156 registration no longer identifies the direct lightweight bridge.');\n  assert(/service-worker-v203\\.js\\?v=1\\.0\\.\\d+-lightweight-shell-v208-legacy-v156-bridge-v209/.test(additiveWorker),'Legacy v156 registration does not rotate through the active lightweight shell.');\n}else{\n  assert(/working-campus-additions-v19[12]-(?:memory-credential|credential-usable)/.test(additiveWorker),'Additive cache did not retain or advance the memory/credential package.');\n}",
  'additive package revision assertion'
);

await writeFile(runtimePath,source,'utf8');
try{
  await import(pathToFileURL(runtimePath).href+`?run=${Date.now()}`);
}finally{
  await unlink(runtimePath).catch(()=>{});
}
