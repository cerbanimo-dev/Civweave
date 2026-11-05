#!/usr/bin/env node
// Civweave Loom Parcels: deterministic, lossless, content-addressed binary chunks.
// Public tracked GitHub source only; not an exporter of private chats, models or memories.
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, readdir, realpath, stat, lstat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const SCHEMA = 'civweave.loom-parcels/v1';
const SEED_FILES = new Set([
  'README.md','VERSION','AGENTS.md','config/agent-work-context.json',
  'docs/architecture/repository-map.md',
  'docs/contracts/mobile-interface-contract.md',
  'docs/architecture/node-reconstruction-backups-v1.md',
  'lib/node-reconstruction-backup-v1.mjs',
  'scripts/node-reconstruction-backup-v1.mjs',
  'scripts/loom-parcel.mjs','docs/operations/loom-parcels.md',
]);
const NONPORTABLE_PATH = /(?:^|\/)(?:\.env(?:\.|$)|id_(?:rsa|ed25519)(?:\.|$)|[^/]*\.(?:pem|p12|pfx|key)|[^/]*(?:secret|credential|recovery-phrase|private-key)[^/]*)$/i;
const BINARY_FILE = /\.(?:png|jpe?g|gif|webp|avif|ico|pdf|mp[34]|wav|flac|ogg|webm|mkv|mov|ttf|otf|woff2?|wasm|onnx|bin|gguf|safetensors|zip|tar|gz|br|xz|zst|7z|sqlite(?:3)?|db|lockb|apk|aab|exe|dll|so|dylib|jar|class|pyc|pkl|npy|npz)$/i;
const sha = b => createHash('sha256').update(b).digest('hex');
function fail(message) { throw new Error(message); }
function parseOptions(args) {
  const [command,...rest]=args;
  if(!['pack','verify','restore'].includes(command)) fail('Usage: loom-parcel.mjs pack|verify|restore --root DIR --out DIR [--tier seed|source|full] [--chunk-kib 64|128|256]');
  const o={command};
  for(let i=0;i<rest.length;i+=2) {
    const key=rest[i],value=rest[i+1];
    if(!key?.startsWith('--')||value===undefined||value.startsWith('--'))fail('Bad option '+key);
    if(!['root','out','tier','chunk-kib','into'].includes(key.slice(2)))fail('Unknown option '+key);
    o[key.slice(2)]=value;
  }
  if(!o.out)fail('--out is required');
  if(command==='pack'&&!o.root)fail('--root is required for pack');
  if(command==='restore'&&!o.into)fail('--into is required for restore');
  if(o.tier&&!['seed','source','full'].includes(o.tier))fail('Unknown tier');
  if(o['chunk-kib']&&![64,128,256].includes(Number(o['chunk-kib'])))fail('chunk-kib must be 64, 128 or 256');
  return o;
}
function safeName(p) {
  if(typeof p!=='string'||!p||p.includes('\\')||p.includes('\0')||p.includes('\r')||p.startsWith('/')||/^[a-z]:/i.test(p))fail('Unsafe path '+p);
  if(p.split('/').some(s=>!s||s==='.'||s==='..'))fail('Unsafe path '+p);
  return p;
}
function git(root,args,{optional=false}={}) {
  const r=spawnSync('git',args,{cwd:root,encoding:'buffer',maxBuffer:64*1024*1024});
  if(r.error||r.status!==0) {if(optional)return null;fail('git '+args.join(' ')+' failed');}
  return r.stdout;
}
function gitPaths(root) {
  return git(root,['ls-files','-z','--cached','--full-name']).toString('utf8').split('\0').filter(Boolean).map(safeName).sort();
}
function sourceIdentity(root) {
  const commit=git(root,['rev-parse','HEAD'],{optional:true})?.toString('utf8').trim()||null;
  const remote=git(root,['config','--get','remote.origin.url'],{optional:true})?.toString('utf8').trim()||null;
  return {commit,remote:remote&&!remote.includes('@')?remote:null};
}
function included(tier,p) {
  if(NONPORTABLE_PATH.test(p))return false;
  if(tier==='seed')return SEED_FILES.has(p);
  if(tier==='source')return !BINARY_FILE.test(p)&&!p.startsWith('mempalace-develop/')&&!p.startsWith('releases/');
  return true;
}
async function pack(o) {
  const root=path.resolve(o.root),out=path.resolve(o.out),tier=o.tier||'seed';
  const realRoot=await realpath(root);
  if(out===root)fail('Output must be separate from repository root');
  const paths=gitPaths(root);
  if(out.startsWith(root+path.sep)) {
    const rel=path.relative(root,out).split(path.sep).join('/');
    if(paths.some(p=>p===rel||p.startsWith(rel+'/')))fail('Output overlaps tracked source');
  }
  const chunkBytes=Number(o['chunk-kib']||128)*1024;
  await mkdir(out,{recursive:true});
  if((await readdir(out)).length)fail('New output directory must be empty');
  await mkdir(path.join(out,'parts'));
  const files=[];let totalInputBytes=0,totalPackedBytes=0,partsWritten=0;
  for(const p of paths) {
    if(!included(tier,p))continue;
    const original=path.join(root,p),lst=await lstat(original);
    if(lst.isSymbolicLink())fail('Tracked symlink not portable: '+p);
    if(!lst.isFile())continue;
    if(!(await realpath(original)).startsWith(realRoot+path.sep))fail('File escapes root: '+p);
    const entry={path:p,size:lst.size,mode:(lst.mode&0o111)?'exec':'file',sha256:null,parts:[]};
    const fullHash=createHash('sha256'),fh=await open(original,'r');
    try {
      const block=Buffer.alloc(chunkBytes);
      for(let offset=0;offset<lst.size;) {
        const expected=Math.min(chunkBytes,lst.size-offset);
        let read=0;
        while(read<expected) {
          const r=await fh.read(block,read,expected-read,offset+read);
          if(r.bytesRead===0)fail('Source truncated: '+p);
          read+=r.bytesRead;
        }
        const raw=block.subarray(0,expected);
        fullHash.update(raw);
        const br=brotliCompressSync(raw,{params:{[constants.BROTLI_PARAM_QUALITY]:8,[constants.BROTLI_PARAM_LGWIN]:20}});
        const codec=br.length<raw.length?'br':'raw',bytes=codec==='br'?br:raw;
        const id=sha(bytes),target=path.join(out,'parts',id+'.lmp');
        try{await stat(target);}catch(error) {
          if(error.code!=='ENOENT')throw error;
          await writeFile(target,bytes,{flag:'wx'});
          partsWritten++;totalPackedBytes+=bytes.length;
        }
        entry.parts.push({id,codec,rawBytes:expected,packedBytes:bytes.length});
        offset+=read;
      }
    } finally {await fh.close();}
    const after=await lstat(original);
    if(after.size!==lst.size||after.mtimeMs!==lst.mtimeMs)fail('Source changed during pack: '+p);
    entry.sha256=fullHash.digest('hex');totalInputBytes+=entry.size;files.push(entry);
  }
  if(!files.length)fail('No files selected for tier '+tier);
  const manifest={format:SCHEMA,kind:'tracked-git-snapshot',tier,chunkBytes,source:sourceIdentity(root),files};
  const packed=brotliCompressSync(Buffer.from(JSON.stringify(manifest)),{params:{[constants.BROTLI_PARAM_QUALITY]:9}});
  await writeFile(path.join(out,'manifest.json.br'),packed);
  const index={
    format:SCHEMA,kind:'portable-seed',tier,source:manifest.source,
    manifest:'manifest.json.br',manifestSha256:sha(packed),fileCount:files.length,
    sourceBytes:totalInputBytes,uniqueParcelCount:partsWritten,
    packedParcelBytes:totalPackedBytes,chunkBytes,
    restore:'node loom-restore.mjs restore --out PARCEL_DIRECTORY --into EMPTY_DESTINATION',
    note:'Tracked source only; not Git history, a private memory archive or model-weight backup.',
  };
  await writeFile(path.join(out,'loom-seed.json'),JSON.stringify(index,null,2)+'\n');
  // Ship the decoder uncompressed to avoid a recovery bootstrap dependency.
  await writeFile(path.join(out,'loom-restore.mjs'),await readFile(fileURLToPath(import.meta.url)));
  return index;
}
async function loadManifest(out) {
  const index=JSON.parse(await readFile(path.join(out,'loom-seed.json'),'utf8'));
  if(index.format!==SCHEMA||index.kind!=='portable-seed')fail('Bad seed');
  const packed=await readFile(path.join(out,'manifest.json.br'));
  if(sha(packed)!==index.manifestSha256)fail('Manifest hash mismatch');
  const manifest=JSON.parse(brotliDecompressSync(packed).toString('utf8'));
  if(manifest.format!==SCHEMA||manifest.kind!=='tracked-git-snapshot'||manifest.tier!==index.tier)fail('Bad manifest');
  const seen=new Set();
  for(const entry of manifest.files) {
    safeName(entry.path);
    if(seen.has(entry.path))fail('Duplicate file in manifest');
    seen.add(entry.path);
  }
  return {index,manifest};
}
async function forEachRestored(out,manifest,consumer) {
  for(const entry of manifest.files) {
    const fileHash=createHash('sha256');let total=0;
    const writer=await consumer(entry);
    for(const part of entry.parts) {
      if(!/^[a-f0-9]{64}$/.test(part.id)||!['br','raw'].includes(part.codec))fail('Unsafe parcel reference');
      const packed=await readFile(path.join(out,'parts',part.id+'.lmp'));
      if(packed.length!==part.packedBytes||sha(packed)!==part.id)fail('Corrupt parcel '+part.id);
      const raw=part.codec==='br'?brotliDecompressSync(packed):packed;
      if(raw.length!==part.rawBytes||raw.length>manifest.chunkBytes)fail('Bad unpack length: '+part.id);
      fileHash.update(raw);total+=raw.length;
      if(writer)await writer.write(raw);
    }
    if(writer)await writer.close();
    if(total!==entry.size||fileHash.digest('hex')!==entry.sha256)fail('File integrity mismatch: '+entry.path);
  }
}
async function verify(o) {
  const out=path.resolve(o.out),{index,manifest}=await loadManifest(out);
  await forEachRestored(out,manifest,async()=>null);
  return {ok:true,fileCount:manifest.files.length,sourceBytes:index.sourceBytes};
}
async function restore(o) {
  const out=path.resolve(o.out),into=path.resolve(o.into);
  if(out===into||out.startsWith(into+path.sep)||into.startsWith(out+path.sep))fail('Restore and parcel directories must not overlap');
  const result=await verify(o);
  await mkdir(into,{recursive:true});
  if((await readdir(into)).length)fail('Restore destination must be empty');
  const {manifest}=await loadManifest(out);
  await forEachRestored(out,manifest,async(entry)=>{
    const target=path.join(into,entry.path);
    await mkdir(path.dirname(target),{recursive:true});
    return open(target,'wx',entry.mode==='exec'?0o755:0o644);
  });
  return {...result,restoredInto:into};
}
export {pack,verify,restore};
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) {
  try{
    const o=parseOptions(process.argv.slice(2));
    console.log(JSON.stringify(await ({pack,verify,restore})[o.command](o),null,2));
  }catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
}
