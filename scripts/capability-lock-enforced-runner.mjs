#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REGISTRY_PATH='config/accepted-capabilities.json';
const EXPECTED_SCHEMA='civweave.accepted-capabilities.v1';
const SHA_RE=/^[0-9a-f]{40}$/i;
const LOCKED_CONTROL_FILES=Object.freeze([
  '.github/workflows/capability-lock-enforced.yml',
  '.github/CODEOWNERS',
  'scripts/capability-lock-enforced-runner.mjs'
]);

function parseArgs(argv){
  const out={};
  for(let i=0;i<argv.length;i+=1){
    const token=argv[i];
    if(!token.startsWith('--'))continue;
    const key=token.slice(2);
    const value=argv[i+1];
    if(value==null||value.startsWith('--'))out[key]=true;
    else{out[key]=value;i+=1}
  }
  return out;
}

function canonical(value){
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function shellQuote(value){return `'${String(value).replaceAll("'","'\\''")}'`}

const cli=parseArgs(process.argv.slice(2));
const authority=path.resolve(String(cli.authority||''));
const authorityRef=String(cli['authority-ref']||'').trim();
const baseRef=String(cli['base-ref']||'').trim();
const candidateRef=String(cli['candidate-ref']||'').trim();
const workRoot=path.resolve(String(cli['work-root']||path.join(process.cwd(),'.capability-lock-v2')));
const toolsNodeModules=cli['tools-node-modules']?path.resolve(String(cli['tools-node-modules'])):'';

assert.ok(existsSync(authority),'Trusted authority checkout is missing');
for(const [label,ref] of [['authority',authorityRef],['base',baseRef],['candidate',candidateRef]])assert.match(ref,SHA_RE,`${label} ref must be a full commit SHA`);

function git(args,options={}){
  return execFileSync('git',args,{cwd:authority,encoding:options.encoding===null?null:'utf8',maxBuffer:64*1024*1024,stdio:options.stdio||['ignore','pipe','pipe']});
}

function refHas(ref,file){return spawnSync('git',['cat-file','-e',`${ref}:${file}`],{cwd:authority,stdio:'ignore'}).status===0}
function textAt(ref,file){return git(['show',`${ref}:${file}`])}
function jsonAt(ref,file){return JSON.parse(textAt(ref,file))}

function validateRegistry(registry,label){
  assert.equal(registry?.schema,EXPECTED_SCHEMA,`${label} registry has unexpected schema`);
  assert.ok(Array.isArray(registry?.capabilities),`${label} registry capabilities must be an array`);
  assert.ok(Array.isArray(registry?.policy?.trustedContractRoots)&&registry.policy.trustedContractRoots.length>0,`${label} registry must declare trusted contract roots`);
  assert.ok(Array.isArray(registry?.policy?.runTiers)&&registry.policy.runTiers.length>0,`${label} registry must declare run tiers`);
  const ids=new Set();
  for(const capability of registry.capabilities){
    assert.match(String(capability?.id||''),/^[A-Z0-9-]+$/,`${label} registry has invalid capability id`);
    assert.ok(!ids.has(capability.id),`${label} registry repeats capability ${capability.id}`);
    ids.add(capability.id);
    assert.ok(typeof capability.name==='string'&&capability.name.trim(),`${capability.id} must have a name`);
    assert.ok(['P0','P1','P2'].includes(capability.tier),`${capability.id} has invalid tier`);
    assert.ok(Array.isArray(capability.command)&&capability.command.length>=2,`${capability.id} must have an argv command`);
    assert.ok(capability.command.every(part=>typeof part==='string'&&part.length>0),`${capability.id} command contains an invalid argument`);
    assert.ok(Number.isInteger(capability.timeoutSeconds)&&capability.timeoutSeconds>=1&&capability.timeoutSeconds<=1800,`${capability.id} has invalid timeoutSeconds`);
  }
}

for(const ref of [authorityRef,baseRef,candidateRef])git(['cat-file','-e',`${ref}^{commit}`]);

for(const file of LOCKED_CONTROL_FILES){
  assert.ok(refHas(authorityRef,file),`Trusted default-branch authority is missing ${file}`);
  assert.ok(refHas(candidateRef,file),`Candidate removed locked control-plane file ${file}`);
  assert.equal(textAt(candidateRef,file),textAt(authorityRef,file),`CONTROL-PLANE REGRESSION: ${file} differs from default-branch authority`);
}

const trustedRegistry=jsonAt(baseRef,REGISTRY_PATH);
const candidateRegistry=jsonAt(candidateRef,REGISTRY_PATH);
validateRegistry(trustedRegistry,'base');
validateRegistry(candidateRegistry,'candidate');
assert.equal(canonical(candidateRegistry.policy),canonical(trustedRegistry.policy),'CAPABILITY REGRESSION: accepted registry policy changed');

const candidateById=new Map(candidateRegistry.capabilities.map(capability=>[capability.id,capability]));
const missing=[];
const modified=[];
for(const accepted of trustedRegistry.capabilities){
  const candidate=candidateById.get(accepted.id);
  if(!candidate){missing.push(accepted.id);continue}
  if(canonical(candidate)!==canonical(accepted))modified.push(accepted.id);
}
assert.equal(missing.length,0,`CAPABILITY REGRESSION: accepted capabilities removed: ${missing.join(', ')}`);
assert.equal(modified.length,0,`CAPABILITY REGRESSION: accepted capability definitions changed: ${modified.join(', ')}`);
assert.ok(candidateRegistry.capabilities.length>=trustedRegistry.capabilities.length,'CAPABILITY REGRESSION: accepted capability registry shrank');

const trustedIds=new Set(trustedRegistry.capabilities.map(capability=>capability.id));
const proposedAdditions=candidateRegistry.capabilities.filter(capability=>!trustedIds.has(capability.id));
const runTiers=new Set(trustedRegistry.policy.runTiers);
const trustedCapabilities=trustedRegistry.capabilities.filter(capability=>runTiers.has(capability.tier));

function archiveInto(ref,root,dest){
  const rootArg=root||'';
  const command=`set -euo pipefail; git -C ${shellQuote(authority)} archive --format=tar ${shellQuote(ref)}${rootArg?` ${shellQuote(rootArg)}`:''} | tar -xf - -C ${shellQuote(dest)}`;
  execFileSync('bash',['-lc',command],{stdio:'inherit'});
}

function needsExternalModules(capability){return capability.command.some(part=>/browser|playwright/i.test(part))}

mkdirSync(workRoot,{recursive:true});
const prepared=[];
for(const capability of trustedCapabilities){
  const workspace=path.join(workRoot,capability.id.toLowerCase().replace(/[^a-z0-9-]/g,'-'));
  rmSync(workspace,{recursive:true,force:true});
  mkdirSync(workspace,{recursive:true});
  archiveInto(candidateRef,'',workspace);
  for(const root of trustedRegistry.policy.trustedContractRoots){
    assert.match(root,/^(scripts|tests)\/$/,`Unapproved trusted contract root: ${root}`);
    rmSync(path.join(workspace,root),{recursive:true,force:true});
    archiveInto(baseRef,root,workspace);
  }
  if(needsExternalModules(capability)){
    assert.ok(toolsNodeModules&&existsSync(toolsNodeModules),'Browser capability requires preinstalled trusted node_modules');
    cpSync(toolsNodeModules,path.join(workspace,'node_modules'),{recursive:true,dereference:true});
  }
  prepared.push({capability,workspace});
}

function childEnv(){
  const keep=['PATH','HOME','TMPDIR','TEMP','TMP','LANG','LC_ALL','PLAYWRIGHT_BROWSERS_PATH','CI'];
  const env={};
  for(const key of keep)if(process.env[key]!=null)env[key]=process.env[key];
  env.CI='true';
  env.CIVWEAVE_CAPABILITY_LOCK='2';
  env.CIVWEAVE_CAPABILITY_AUTHORITY='default-branch';
  return env;
}

function runCapability(capability,workspace){
  const [file,...args]=capability.command;
  process.stdout.write(`\n=== ${capability.id} · ${capability.name} ===\n`);
  const result=spawnSync(file,args,{cwd:workspace,env:childEnv(),stdio:'inherit',timeout:capability.timeoutSeconds*1000});
  if(result.error){
    const timeout=result.error.code==='ETIMEDOUT';
    return {ok:false,reason:timeout?`timed out after ${capability.timeoutSeconds}s`:result.error.message};
  }
  if(result.signal)return {ok:false,reason:`terminated by ${result.signal}`};
  if(result.status!==0)return {ok:false,reason:`exited ${result.status}`};
  return {ok:true,reason:'passed'};
}

const results=[];
for(const {capability,workspace} of prepared)results.push({id:capability.id,name:capability.name,tier:capability.tier,...runCapability(capability,workspace)});
const failures=results.filter(result=>!result.ok);
const summary={
  ok:failures.length===0,
  schema:'civweave.capability-lock.enforced.v2',
  authorityRef,
  baseRef,
  candidateRef,
  lockedControlFiles:[...LOCKED_CONTROL_FILES],
  acceptedCapabilityCount:trustedRegistry.capabilities.length,
  executedP0P1Count:results.length,
  passedCount:results.length-failures.length,
  failedCount:failures.length,
  proposedAdditionCount:proposedAdditions.length,
  proposedAdditions:proposedAdditions.map(capability=>capability.id),
  failures:failures.map(({id,reason})=>({id,reason}))
};
console.log(`\n${JSON.stringify(summary,null,2)}`);

if(process.env.GITHUB_STEP_SUMMARY){
  const rows=results.map(result=>`| ${result.id} | ${result.tier} | ${result.ok?'PASS':'FAIL'} | ${result.reason} |`).join('\n');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,`# Civweave Capability Lock — enforced v2\n\n**${summary.passedCount}/${summary.executedP0P1Count} accepted P0/P1 capabilities passed.**\n\nDefault-branch authority: \`${authorityRef}\`  \nPR base: \`${baseRef}\`  \nCandidate merge: \`${candidateRef}\`  \nAccepted registry size: **${summary.acceptedCapabilityCount}**  \nProposed additions: **${summary.proposedAdditionCount}**\n\n| Capability | Tier | Result | Detail |\n|---|---:|---:|---|\n${rows}\n`);
}

if(failures.length){
  for(const failure of failures)if(process.env.GITHUB_ACTIONS)console.error(`::error title=Capability regression ${failure.id}::${failure.reason}`);
  process.exitCode=1;
}
