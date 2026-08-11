import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const packageRoot=path.join(root,'node_modules','onnxruntime-web');
const source=path.join(packageRoot,'dist');
const destination=path.join(root,'public','app','vendor','onnxruntime');
const required=['ort.wasm.min.mjs','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'];
const hosted=process.env.RENDER==='true'||process.env.CF_PAGES==='1'||process.env.CLOUDFLARE_PAGES==='1';
const explicitHostedStage=process.env.CIVWEAVE_STAGE_DEVICE_AI_ON_HOST==='1';

async function exists(target){try{await fsp.access(target);return true}catch{return false}}
async function sameSize(sourceFile,targetFile){try{const [a,b]=await Promise.all([fsp.stat(sourceFile),fsp.stat(targetFile)]);return a.size===b.size&&a.size>0}catch{return false}}
async function main(){
  if(hosted&&!explicitHostedStage){
    console.log('[Civweave] Hosted gateway: skipping device-side ONNX Runtime staging. Local model runtimes are installed on demand by the device.');
    return;
  }
  if(!await exists(source))throw new Error('onnxruntime-web is not installed. Run npm install before starting Civweave.');
  const packageJson=JSON.parse(await fsp.readFile(path.join(packageRoot,'package.json'),'utf8'));
  await fsp.mkdir(destination,{recursive:true});
  const staged=[];
  for(const name of required){
    const sourceFile=path.join(source,name),targetFile=path.join(destination,name);
    if(!await exists(sourceFile))throw new Error(`onnxruntime-web ${packageJson.version} is missing dist/${name}.`);
    if(!await sameSize(sourceFile,targetFile))await fsp.copyFile(sourceFile,targetFile);
    const info=await fsp.stat(targetFile);staged.push({name,bytes:info.size});
  }
  await fsp.writeFile(path.join(destination,'stage-manifest.json'),JSON.stringify({schema:'civweave.onnxruntime-stage.v1',package:'onnxruntime-web',version:packageJson.version,entry:'/app/vendor/onnxruntime/ort.wasm.min.mjs',executionProviders:['wasm'],numThreads:1,files:staged},null,2));
  console.log(`[Civweave] Staged fixed ONNX Runtime Web ${packageJson.version}: ${staged.map(item=>`${item.name} (${item.bytes} bytes)`).join(', ')}.`);
}
main().catch(error=>{console.error(error);process.exitCode=1});
