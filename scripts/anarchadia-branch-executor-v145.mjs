#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateExecutionPacket} from '../public/app/anarchadia-governance-kernel-v145.js';

function argument(name){
  const index=process.argv.indexOf(name);
  return index>=0?process.argv[index+1]:'';
}
function run(command,args,cwd,options={}){
  return execFileSync(command,args,{cwd,encoding:'utf8',stdio:options.capture?'pipe':'inherit',maxBuffer:20*1024*1024}).trim();
}
const packetPath=path.resolve(argument('--packet')||'');
const repo=path.resolve(argument('--repo')||process.cwd());
if(!packetPath)throw new Error('Usage: npm run anarchadia:execute -- --packet /path/to/execution.json [--repo /path/to/Commonweave]');
const packet=JSON.parse(await fs.readFile(packetPath,'utf8'));
const validation=await validateExecutionPacket(packet);
if(!validation.valid)throw new Error(`Execution packet rejected:\n- ${validation.errors.join('\n- ')}`);
const {changeSet,authorization}=packet;
if(authorization.executionMode!=='branch-only')throw new Error('Only branch-only authorization is supported.');
if(!/^agent\/anarchadia-[a-z0-9._/-]+$/i.test(authorization.targetBranch))throw new Error('Target branch is outside the Anarchadia branch namespace.');
const status=run('git',['status','--porcelain'],repo,{capture:true});
if(status)throw new Error('Repository must be clean before preparing an authorized branch.');
run('git',['cat-file','-e',`${authorization.baseCommit}^{commit}`],repo,{capture:true});
let branchExists=false;
try{run('git',['show-ref','--verify',`refs/heads/${authorization.targetBranch}`],repo,{capture:true});branchExists=true}catch{}
if(branchExists)throw new Error(`Branch already exists: ${authorization.targetBranch}`);
const worktree=await fs.mkdtemp(path.join(os.tmpdir(),'anarchadia-worktree-'));
let commitSha='';
try{
  run('git',['worktree','add','-b',authorization.targetBranch,worktree,authorization.baseCommit],repo);
  for(const file of changeSet.files){
    const relative=String(file.path).replace(/\\/g,'/').replace(/^\/+/,'');
    if(relative.includes('..')||relative.startsWith('.git/')||relative==='')throw new Error(`Unsafe packet path: ${relative}`);
    const target=path.join(worktree,relative);
    if(!target.startsWith(worktree+path.sep))throw new Error(`Packet path escaped worktree: ${relative}`);
    if(file.delete){await fs.rm(target,{force:true,recursive:false});continue}
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.writeFile(target,String(file.content),'utf8');
  }
  run('npm',['run','check'],worktree);
  run('git',['add','-A'],worktree);
  const staged=run('git',['diff','--cached','--name-only'],worktree,{capture:true});
  if(!staged)throw new Error('Authorized packet produced no file changes.');
  run('git',['-c','user.name=Anarchadia Branch Executor','-c','user.email=anarchadia@local.invalid','commit','-m',`Anarchadia governed change: ${changeSet.title}`],worktree);
  commitSha=run('git',['rev-parse','HEAD'],worktree,{capture:true});
  const receipt={schema:'commonweave.anarchadia-execution-receipt.v1',packetId:packet.id,packetHash:packet.packetHash,changeSetId:changeSet.id,changeHash:changeSet.revisionHash,baseCommit:authorization.baseCommit,targetBranch:authorization.targetBranch,preparedCommit:commitSha,checks:['npm run check'],status:'prepared-local-branch',pushPerformed:false,mergePerformed:false,deployPerformed:false,preparedAt:new Date().toISOString()};
  const receiptPath=packetPath.replace(/\.json$/i,'')+'.receipt.json';
  await fs.writeFile(receiptPath,JSON.stringify(receipt,null,2),'utf8');
  console.log(JSON.stringify(receipt,null,2));
}finally{
  try{run('git',['worktree','remove','--force',worktree],repo)}catch{}
}
