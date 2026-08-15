import {access,readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await readFile(path.join(root,'config/runtime-global-ownership.json'),'utf8'));
const allowed=new Map(config.boundaries.map(item=>[`${item.file}::${item.global}`,item]));
const seen=new Set();
const failures=[];
const scans=['public/app','public/extensions'];
const intercept=/Object\.defineProperty\s*\(\s*globalThis\s*,\s*['"]([^'"]+)['"]/g;

async function walk(directory){
  const rows=await readdir(directory,{withFileTypes:true});
  for(const row of rows){
    const absolute=path.join(directory,row.name),relative=path.relative(root,absolute).replaceAll('\\','/');
    if(row.isDirectory()){
      if(relative.includes('/tests')||relative.endsWith('/tests'))continue;
      await walk(absolute);continue;
    }
    if(!/\.(?:js|mjs)$/i.test(row.name))continue;
    const source=await readFile(absolute,'utf8');
    for(const match of source.matchAll(intercept)){
      const global=match[1],key=`${relative}::${global}`;
      if(!allowed.has(key))failures.push(`${relative} intercepts globalThis.${global} without a declared ownership boundary.`);else seen.add(key);
    }
  }
}
for(const scan of scans)await walk(path.join(root,scan));

for(const [key,item] of allowed){
  if(!seen.has(key))failures.push(`Declared global boundary is missing from source: ${key}`);
  const source=await readFile(path.join(root,item.file),'utf8');
  if(/setInterval\s*\([^\n]*(?:wrap|patch|install)/i.test(source)||/(?:wrap|patch|install)[\s\S]{0,120}setInterval\s*\(/i.test(source))failures.push(`${item.file} repeatedly reinstalls its global boundary.`);
  for(const restriction of item.restrictions||[]){
    if(restriction==='no polling'&&/setInterval\s*\(/.test(source))failures.push(`${item.file} violates declared restriction: no polling.`);
    if(restriction==='no DOM mutation observer'&&/new\s+MutationObserver\s*\(/.test(source))failures.push(`${item.file} violates declared restriction: no DOM mutation observer.`);
  }
}
for(const file of config.forbiddenFormerInterceptors||[]){
  if(file==='public/app/platform-experience-v160.js'){
    const source=await readFile(path.join(root,file),'utf8');
    if(intercept.test(source)||/installPatchedGlobal|patchAssistant|patchContracts/.test(source))failures.push(`${file} regained foreign-global interception.`);
    intercept.lastIndex=0;
    continue;
  }
  try{await access(path.join(root,file));failures.push(`${file} is a retired interceptor and must remain physically absent.`)}catch(error){if(error?.code!=='ENOENT')throw error}
}

if(failures.length){console.error(JSON.stringify({ok:false,schema:config.schema,policy:config.policy,declared:[...allowed.keys()],seen:[...seen],failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,schema:config.schema,policy:config.policy,declared:[...allowed.keys()],foreignInterceptors:0,retiredInterceptorsAbsent:(config.forbiddenFormerInterceptors||[]).filter(file=>file!=='public/app/platform-experience-v160.js').length,platformForeignPatching:false},null,2));
