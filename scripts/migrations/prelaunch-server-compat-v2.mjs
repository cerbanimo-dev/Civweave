import {access,mkdir,readFile,readdir,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const exists=async relative=>access(path.join(root,relative)).then(()=>true,()=>false);
const read=relative=>readFile(path.join(root,relative),'utf8');
const write=async(relative,content)=>{await mkdir(path.dirname(path.join(root,relative)),{recursive:true});await writeFile(path.join(root,relative),content,'utf8')};

const moves=Object.fromEntries([125,126,127,128,129].map(version=>[
  `server-v${version}.mjs`,
  `server/compat/server-v${version}.mjs`
]));
for(const target of Object.values(moves))await mkdir(path.dirname(path.join(root,target)),{recursive:true});
for(const [from,to] of Object.entries(moves))if(await exists(from)&&!(await exists(to)))await rename(path.join(root,from),path.join(root,to));

const textExt=new Set(['.md','.txt','.json','.mjs','.js','.yml','.yaml','.sh']);
const excluded=['.git/','node_modules/','archive/','docs/history/','public/downloads/','public/app/models/'];
async function walk(relative=''){
  for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){
    const child=relative?`${relative}/${entry.name}`:entry.name;
    if(excluded.some(prefix=>child===prefix.slice(0,-1)||child.startsWith(prefix)))continue;
    if(entry.isDirectory()){await walk(child);continue}
    if(!entry.isFile()||!textExt.has(path.extname(entry.name)))continue;
    let source;
    try{source=await read(child)}catch{continue}
    let next=source;
    for(const [from,to] of Object.entries(moves))next=next.split(from).join(to);
    if(next!==source)await write(child,next);
  }
}
await walk();

for(const version of [125,126]){
  const relative=`server/compat/server-v${version}.mjs`;
  let source=await read(relative);
  source=source.replace(
    /const root\s*=\s*path\.dirname\(fileURLToPath\(import\.meta\.url\)\);/,
    "const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');"
  );
  await write(relative,source);
}
for(const version of [127,128,129]){
  const relative=`server/compat/server-v${version}.mjs`;
  let source=await read(relative);
  source=source.replace(
    /const rootDir\s*=\s*path\.dirname\(fileURLToPath\(import\.meta\.url\)\);/,
    "const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');"
  );
  await write(relative,source);
}

console.log(JSON.stringify({ok:true,moved:Object.entries(moves),rootSource:'server.mjs',compatDirectory:'server/compat'},null,2));
