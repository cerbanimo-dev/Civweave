#!/usr/bin/env node

import {cpSync,existsSync,mkdirSync,readdirSync,rmSync,statSync} from 'node:fs';
import {dirname,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=resolve(repoRoot,'public');
const output=resolve(repoRoot,'.cloudflare-pages');
const MAX_BYTES=24*1024*1024;

if(!existsSync(source))throw new Error('public/ is missing. The current Civweave tree cannot be built.');
rmSync(output,{recursive:true,force:true});
mkdirSync(output,{recursive:true});
cpSync(source,output,{recursive:true});

function walk(dir){const out=[];for(const entry of readdirSync(dir,{withFileTypes:true})){const full=resolve(dir,entry.name);if(entry.isDirectory())out.push(...walk(full));else if(entry.isFile())out.push(full)}return out}
const files=walk(output),oversize=[];
for(const file of files){const info=statSync(file);if(info.size>MAX_BYTES)oversize.push({file:relative(output,file),bytes:info.size})}
if(oversize.length)throw new Error(`Cloudflare Pages build contains oversized assets: ${JSON.stringify(oversize)}`);
console.log(JSON.stringify({ok:true,source:'public/',output:'.cloudflare-pages/',files:files.length,historicalSourceSelection:false,releaseMaterialization:false,sourceArchives:false},null,2));
