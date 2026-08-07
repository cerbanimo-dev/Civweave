#!/usr/bin/env node
import {cpSync,existsSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDir=dirname(fileURLToPath(import.meta.url));
const repoRoot=resolve(scriptDir,'..');
const sourceDir=resolve(repoRoot,'node_modules/sql.js/dist');
const targetDir=resolve(repoRoot,'public/app/vendor/sql.js');
const required=['sql-wasm.js','sql-wasm.wasm'];

if(!existsSync(sourceDir))throw new Error(`sql.js is not installed: ${sourceDir}`);
mkdirSync(targetDir,{recursive:true});
for(const file of required){
  const source=resolve(sourceDir,file);
  if(!existsSync(source))throw new Error(`Missing sql.js runtime asset: ${source}`);
  cpSync(source,resolve(targetDir,file),{force:true});
}
console.log(`Staged ${required.length} sql.js assets in ${targetDir}`);
