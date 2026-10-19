import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,rmSync,existsSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const VERSION='4.3.1';
const PACKAGE='@huggingface/transformers-structured-output';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=join(root,'public/app/vendor/transformers-structured-output-v4');
const target=join(output,'index.js');
const manifest=join(output,'stage-manifest.json');
if(existsSync(target)&&existsSync(manifest)&&!process.argv.includes('--force')){
  try{const m=JSON.parse(readFileSync(manifest,'utf8'));if(m.package===PACKAGE&&m.version===VERSION&&m.sha256===createHash('sha256').update(readFileSync(target)).digest('hex')){console.log('Verified self-hosted structured-output companion '+VERSION);process.exit(0)}}catch{}
}
const temp=mkdtempSync(join(tmpdir(),'cw-llama32-grammar-'));
try{
  const npm=process.platform==='win32'?'npm.cmd':'npm';
  const packed=spawnSync(npm,['pack',PACKAGE+'@'+VERSION,'--ignore-scripts','--json','--pack-destination',temp],{encoding:'utf8',timeout:120000,cwd:root});
  if(packed.status!==0)throw new Error('Could not fetch pinned structured-output package: '+String(packed.stderr||packed.stdout||'').slice(0,1200));
  const info=JSON.parse(packed.stdout)[0];
  if(!info?.filename||!info?.integrity)throw new Error('Package archive has no verified integrity metadata.');
  const archive=join(temp,info.filename);
  const unpack=spawnSync('tar',['-xzf',archive,'-C',temp,'package/dist/index.js'],{encoding:'utf8',timeout:60000});
  if(unpack.status!==0)throw new Error('Could not extract the pinned package build: '+String(unpack.stderr||''));
  const bundle=join(temp,'package/dist/index.js');
  if(!existsSync(bundle)||statSync(bundle).size<2000)throw new Error('Constrained output bundle is absent or unexpectedly short.');
  // The npm build marks @huggingface/transformers as an external peer import.
  // Bare package specifiers cannot resolve in Civweave's standalone PWA.
  // Bind the processor to the same self-hosted Transformers.js classes used
  // by the Llama model worker; never fetch a runtime dependency from a CDN.
  const original=readFileSync(bundle,'utf8');
  const possiblePeerImports=['from "@huggingface/transformers"', "from '@huggingface/transformers'"];
  const matches=possiblePeerImports.filter(needle=>original.includes(needle));
  if(matches.length!==1)throw new Error('Unexpected structured-output peer import shape: expected one external import, got '+matches.length);
  const standalone=original.replace(matches[0],'from "../transformers-v4/transformers.min.js"');
  if(standalone.includes('from "@huggingface/transformers"')||standalone.includes("from '@huggingface/transformers'"))throw new Error('Unresolved bare runtime peer dependency.');
  mkdirSync(output,{recursive:true});writeFileSync(target,standalone);
  const sha256=createHash('sha256').update(readFileSync(target)).digest('hex');
  if(!standalone.includes('../transformers-v4/transformers.min.js'))throw new Error('Standalone companion was not rebound to local Transformers.js.');
  writeFileSync(manifest,JSON.stringify({schema:'civweave.structured-decoding-companion.v1',package:PACKAGE,version:VERSION,integrity:info.integrity,sha256,entry:'/app/vendor/transformers-structured-output-v4/index.js',offline:true},null,2)+'\n');
  console.log('Staged self-hosted structured-output processor '+VERSION+' ('+statSync(target).size+' bytes)');
}finally{rmSync(temp,{recursive:true,force:true})}
