import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const publicDir=path.join(root,'public');

function extractStringArray(source,name,label){
  const match=source.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[(.*?)\\];`,'s'));
  if(!match)throw new Error(`Could not locate ${name} in ${label}.`);
  const value=Function(`"use strict"; return [${match[1]}];`)();
  if(!Array.isArray(value)||value.some(item=>typeof item!=='string'))throw new Error(`${name} in ${label} must be a string array.`);
  return value;
}

const [core,shellAssets,installerState,integrityText]=await Promise.all([
  fs.readFile(path.join(publicDir,'service-worker-core-v208.js'),'utf8'),
  fs.readFile(path.join(publicDir,'service-worker-shell-assets-v1.js'),'utf8'),
  fs.readFile(path.join(publicDir,'service-worker-installer-state-v280.js'),'utf8'),
  fs.readFile(path.join(publicDir,'app','shell-integrity-v281.json'),'utf8')
]);

const required=[...new Set([
  ...extractStringArray(core,'REQUIRED_SHELL_ASSETS','service-worker-core-v208.js'),
  ...extractStringArray(shellAssets,'REQUIRED_FAMILY_NAV','service-worker-shell-assets-v1.js'),
  ...extractStringArray(shellAssets,'REQUIRED_NAV_MEDIA','service-worker-shell-assets-v1.js'),
  ...extractStringArray(shellAssets,'REQUIRED_CIVWEAVE_BOOT','service-worker-shell-assets-v1.js'),
  ...extractStringArray(shellAssets,'REQUIRED_HUMAN_CHAT','service-worker-shell-assets-v1.js'),
  ...extractStringArray(installerState,'INSTALLER_STATE_ASSETS','service-worker-installer-state-v280.js')
])];
const integrity=JSON.parse(integrityText);
const declared=integrity?.assets&&typeof integrity.assets==='object'?integrity.assets:{};

const missing=[];
const mismatched=[];
for(const pathname of required){
  const file=path.join(publicDir,pathname.replace(/^\/+/,''));
  const bytes=await fs.readFile(file);
  const actual=crypto.createHash('sha256').update(bytes).digest('hex');
  const expected=String(declared[pathname]||'');
  if(!expected)missing.push(pathname);
  else if(actual!==expected)mismatched.push({pathname,expected,actual});
}
const extra=Object.keys(declared).filter(pathname=>!required.includes(pathname));

if(Number(integrity.requiredAssetCount)!==required.length||missing.length||mismatched.length||extra.length){
  console.error(JSON.stringify({
    ok:false,
    contract:'shell-integrity-current-v344',
    declaredCount:Number(integrity.requiredAssetCount),
    actualRequiredCount:required.length,
    missing,
    mismatched,
    extra
  },null,2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok:true,
  contract:'shell-integrity-current-v344',
  requiredAssetCount:required.length,
  checked:required.length,
  persistentShellHash:declared['/app/persistent-system-shell-v1.html']||''
},null,2));
