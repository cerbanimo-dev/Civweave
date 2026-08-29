import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const target=new URL('public/app/working-campus-v156.js',root);
const parts=[1,2,3,4,5].map(index=>new URL(`public/app/working-campus-v156.part${index}.txt`,root));
const START='/* CIVWEAVE_FAST_BOOT_CORE_START */';
const END='/* CIVWEAVE_FAST_BOOT_CORE_END */';
const checkOnly=process.argv.includes('--check');

const [source,...partSource]=await Promise.all([readFile(target,'utf8'),...parts.map(path=>readFile(path,'utf8'))]);
const start=source.indexOf(START),end=source.indexOf(END);
assert.ok(start>=0&&end>start,'Working Campus fast-boot core markers are missing or out of order.');
const expected=`\n${partSource.join('')}\n`;
const bodyStart=start+START.length;
const actual=source.slice(bodyStart,end);

if(actual!==expected){
  if(checkOnly)throw new Error('Compiled Working Campus core is stale. Run node scripts/build-working-campus-fast-boot-v1.mjs.');
  const next=`${source.slice(0,bodyStart)}${expected}${source.slice(end)}`;
  await writeFile(target,next,'utf8');
  console.log(JSON.stringify({ok:true,updated:true,target:'public/app/working-campus-v156.js',parts:partSource.length,bytes:expected.length},null,2));
}else{
  console.log(JSON.stringify({ok:true,updated:false,target:'public/app/working-campus-v156.js',parts:partSource.length,bytes:expected.length,checkOnly},null,2));
}
