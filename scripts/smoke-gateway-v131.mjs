import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const version=(await read('VERSION')).trim(),port=18792,origin=`http://127.0.0.1:${port}`;
const dataDir=await mkdtemp(path.join(os.tmpdir(),'civweave-gateway-smoke-'));
const runtimePaths=['.civweave-canonical-gateway.entry.mjs','.civweave-gateway-v132.loader.mjs','.civweave-gateway-v131.runtime.mjs'];
const originals=await Promise.all(runtimePaths.map(async relative=>{
  try{return await readFile(path.join(root,relative))}catch(error){if(error.code==='ENOENT')return null;throw error}
}));
const output=[];
const child=spawn(process.execPath,['scripts/start-civweave-v131.mjs'],{cwd:root,env:{...process.env,RENDER:'true',HOST:'127.0.0.1',PORT:String(port),DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
let spawnError=null;
child.once('error',error=>{spawnError=error});
child.stdout.on('data',chunk=>output.push(String(chunk)));
child.stderr.on('data',chunk=>output.push(String(chunk)));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(route,options={}){return fetch(origin+route,{cache:'no-store',signal:AbortSignal.timeout(10000),...options})}
async function ready(){
  let failure;
  for(let attempt=0;attempt<80;attempt++){
    if(spawnError)throw spawnError;
    if(child.exitCode!==null)throw new Error(`Gateway exited before health readiness (${child.exitCode}).`);
    try{const response=await request('/api/health');if(response.ok)return await response.json();failure=new Error(`Health returned ${response.status}.`)}catch(error){failure=error}
    await sleep(200);
  }
  throw failure||new Error('Gateway did not become ready.');
}
async function servedSource(relative,{html=false}={}){
  const response=await request('/'+relative.replace(/^public\//,''));
  assert.equal(response.status,200,`${relative} must be publicly distributable`);
  if(html)assert.match(response.headers.get('content-type')||'',/text\/html/i,`${relative} content type`);
  const text=await response.text(),expected=await read(relative);
  assert.ok(text===expected,`${relative} must serve the current checked-in canonical bytes`);
  return text;
}
try{
  const health=await ready();
  assert.ok(output.join('').includes('Starting gateway runtime.'),'Render startup must select the gateway');
  assert.equal(health.appVersion,version);
  assert.equal(health.build,`${version}-install-only-fullscreen-family-gateway`);
  assert.equal(health.release?.localInstallRequired,true);
  const launcher=await servedSource('public/index.html',{html:true});
  assert.ok(launcher.includes("new URL('/app/index.html'")&&launcher.includes('/app/pwa-start-v436.html'),'root must expose the canonical installer and installed entry paths');
  const installer=await servedSource('public/app/index.html',{html:true});
  assert.ok(installer.includes(`<title>Install Civweave v${version}</title>`));
  for(const route of ['/loom/','/lite/']){
    const response=await request(route);
    assert.equal(response.status,410,`${route} must retain the legacy install boundary`);
    assert.equal((await response.json()).localInstallRequired,true);
  }
  const routeContext={URL,URLSearchParams};
  vm.runInNewContext(await read('public/app/system-routes-v227.js'),routeContext);
  const routes=routeContext.CivweaveSystemRoutesV227;
  assert.equal(routes.systems.length,5);
  for(const system of routes.systems){
    const entry=routes.routeFor(system);
    const html=await servedSource('public'+entry.pathname,{html:true});
    assert.ok(html.includes(`data-civweave-system="${system}"`),`${system} entry must declare its system`);
  }
  await servedSource('public/app/persistent-system-shell-v1.html',{html:true});
  for(const relative of ['public/service-worker.js','public/service-worker-v203.js','public/service-worker-core-v208.js','public/app/system-routes-v227.js','public/app/manifest.webmanifest'])await servedSource(relative);
  const core=await read('public/service-worker-core-v208.js');
  const declared=core.match(/const REQUIRED_SHELL_ASSETS = (\[[\s\S]*?\]);/)?.[1];
  assert.ok(declared,'canonical worker must declare its required first-paint assets');
  const requiredAssets=vm.runInNewContext(declared);
  assert.ok(requiredAssets.length>0);
  for(const asset of requiredAssets){
    assert.doesNotMatch(asset,/model_quantized\.onnx|ort-wasm|transformers\.min\.js/,'heavy inference payloads must remain outside the required app shell');
    const response=await request(asset,{headers:{'x-civweave-package':'install'}});
    assert.equal(response.status,200,`required shell asset ${asset}`);await response.arrayBuffer();
  }
  const settings=await servedSource('public/app/settings-gateway-v317.js');
  assert.ok(settings.includes('inputOwner:true,presentationOwner:true,credentialOwner:true')&&settings.includes('singleMenu:true')&&settings.includes('singleLauncherListener:true'));
  const open=settings.slice(settings.indexOf('function open(launcher)'),settings.indexOf('function ensure()'));
  assert.ok(open.length>0);
  assert.doesNotMatch(open,/await |fetch\(|\.generate\(|new Worker|navigator\.gpu|showModal\(|ensureManagement\(/,'opening Settings must remain inert');
  for(const relative of ['public/app/model-settings-controller-v173.js','public/app/unified-ai-settings-v175.js','public/app/settings-delegation-v175.js']){
    const facade=await servedSource(relative);
    assert.ok(facade.includes('compatibilityFacade:true')&&facade.includes("canonical:'CivweaveSettingsV320'"),`${relative} must delegate to canonical Settings`);
    assert.ok(facade.includes('inputOwnership:false')&&facade.includes('presentationOwnership:false'),`${relative} must not claim Settings ownership`);
    assert.ok(!/document\.createElement\(['"](?:dialog|div|form|section|button)['"]|document\.addEventListener\('click'|showModal\(/.test(facade),`${relative} must not own Settings presentation/input`);
  }
  for(const retired of ['/extensions/civweave-settings-safe-open-v171.js','/extensions/civweave-settings-safe-open-v172.js'])assert.equal((await request(retired)).status,404);
  const ledger=await request('/app/shared/civweave-parity-ledger.json',{headers:{'x-civweave-package':'install'}});
  assert.equal(ledger.status,200);assert.ok((await ledger.json()).systems.length>=5);
  const telemetry=await request('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'room-opened'})});
  assert.equal(telemetry.status,204);
  console.log(JSON.stringify({ok:true,version,build:health.build,systems:routes.systems.length,requiredCoreAssetCount:requiredAssets.length,canonicalSourceBytes:true,settingsSingleOwner:true,settingsOpenInert:true,legacyInstallBoundary:true,bootTelemetry:true,verificationMutation:false},null,2));
}catch(error){console.error(output.join(''));throw error}
finally{
  if(child.exitCode===null&&child.signalCode===null){
    const exited=once(child,'exit').catch(()=>[]);child.kill('SIGTERM');await Promise.race([exited,sleep(1500)]);
    if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited;}
  }
  for(let index=0;index<runtimePaths.length;index++){
    const filename=path.join(root,runtimePaths[index]);
    if(originals[index]===null)await rm(filename,{force:true});else await writeFile(filename,originals[index]);
  }
  await rm(dataDir,{recursive:true,force:true});
}
