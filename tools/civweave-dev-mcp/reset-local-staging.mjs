import {spawnSync} from 'node:child_process';
import {rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const confirmFlag='--confirm-hard-reset';
if(!process.argv.includes(confirmFlag)){
  console.error(`[local-staging-reset] Refusing destructive reset without ${confirmFlag}.`);
  process.exit(2);
}

function runGit(args,{capture=false}={}){
  const result=spawnSync('git',args,{cwd:root,encoding:'utf8',stdio:capture?'pipe':'inherit'});
  if(result.status!==0){
    if(capture&&result.stderr)process.stderr.write(result.stderr);
    process.exit(result.status??1);
  }
  return capture?(result.stdout||'').trim():'';
}

const branch=runGit(['branch','--show-current'],{capture:true});
if(branch!=='staging'){
  console.error(`[local-staging-reset] Refusing to reset branch "${branch||'(detached)'}". Switch to staging first.`);
  process.exit(2);
}

console.log('[local-staging-reset] fetching origin/staging');
runGit(['fetch','origin','staging']);
console.log('[local-staging-reset] resetting tracked files to origin/staging');
runGit(['reset','--hard','origin/staging']);
console.log('[local-staging-reset] removing untracked non-ignored files/directories');
runGit(['clean','-ffd']);

const forbidden=[
  'mempalace-develop.zip',
  'public/app/models/smollm2-360m-instruct/tokenizer.json',
  'public/app/models/smollm2-360m-instruct/onnx'
];
for(const relativePath of forbidden){
  await rm(path.join(root,...relativePath.split('/')),{recursive:true,force:true});
}

const status=runGit(['status','--short'],{capture:true});
if(status){
  console.error('[local-staging-reset] reset completed, but the working tree is not clean:');
  console.error(status);
  process.exit(1);
}
console.log('[local-staging-reset] staging now matches origin/staging and forbidden payloads are absent.');
