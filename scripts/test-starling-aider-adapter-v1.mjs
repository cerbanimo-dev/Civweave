import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {executeAiderHandoff,normalizeAiderFiles} from '../tools/starling/aider-adapter-v1.mjs';
const auth={scope:'task',guildId:'g',taskId:'t',actorId:'kami',toolId:'aider',approved:true};
const verified=()=>true;
test('reject path traversal, hidden config and drive paths',()=>{
  for(const file of ['../outside.py','C:\\private.py','.env','a/../../other.js','/absolute.py','.git/config']){
    assert.throws(()=>normalizeAiderFiles([file]));
  }
});
test('no tool execution without trusted scoped authorization',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cw-aider-'));await writeFile(join(root,'main.py'),'print(1)');
  let called=0;
  const basic={workspaceRoot:root,guildId:'g',taskId:'t',actorId:'kami',brief:'Improve this coding task',files:['main.py'],enabledTools:['aider'],runner:async()=>{called++;return {success:true}}};
  try{
    await assert.rejects(()=>executeAiderHandoff({...basic,authorization:auth}));
    await assert.rejects(()=>executeAiderHandoff({...basic,authorization:{...auth,guildId:'wrong'},verifyAuthorization:verified}));
    assert.equal(called,0);
  }finally{await rm(root,{recursive:true,force:true})}
});
test('default preview handoff is non-committing and uses an isolated approved workspace',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cw-aider-'));await writeFile(join(root,'main.py'),'print(1)');
  const observed=[];
  try{
    const res=await executeAiderHandoff({workspaceRoot:root,guildId:'g',taskId:'t',actorId:'kami',brief:'Refactor module safely',files:['main.py'],authorization:auth,verifyAuthorization:verified,enabledTools:['aider'],model:'qwen3.5:4b',runner:async input=>{observed.push(input);return {success:true,stdout:'preview'}}});
    assert.equal(res.mode,'preview');assert.equal(observed.length,1);
    assert.ok(observed[0].args.includes('--dry-run'));assert.ok(observed[0].args.includes('--no-git'));
    assert.equal(observed[0].cwd,root);
    assert.equal(res.applied,false);
  }finally{await rm(root,{recursive:true,force:true})}
});
test('apply requires explicit trusted apply grant in addition to task scope',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cw-aider-'));await writeFile(join(root,'main.py'),'print(1)');
  const basic={workspaceRoot:root,guildId:'g',taskId:'t',actorId:'kami',brief:'Improve script',files:['main.py'],authorization:auth,verifyAuthorization:verified,enabledTools:['aider'],apply:true,runner:async()=>({success:true})};
  try{
    await assert.rejects(()=>executeAiderHandoff(basic),/apply authorization/);
    const result=await executeAiderHandoff({...basic,verifyApplyAuthorization:()=>true});
    assert.equal(result.mode,'apply');
  }finally{await rm(root,{recursive:true,force:true})}
});
test('external remote model endpoints blocked from local-only Aider lane',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cw-aider-'));await writeFile(join(root,'main.py'),'print(1)');
  try{
    await assert.rejects(()=>executeAiderHandoff({workspaceRoot:root,guildId:'g',taskId:'t',actorId:'kami',brief:'Change script',files:['main.py'],authorization:auth,verifyAuthorization:verified,enabledTools:['aider'],baseUrl:'https://some-cloud.example/v1',runner:async()=>({success:true})}),/loopback/);
  }finally{await rm(root,{recursive:true,force:true})}
});
