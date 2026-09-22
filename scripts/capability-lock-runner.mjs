#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {appendFileSync, existsSync, readFileSync, rmSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REGISTRY_PATH='config/accepted-capabilities.json';
const EXPECTED_SCHEMA='civweave.accepted-capabilities.v1';
const ZERO_SHA=/^0+$/;

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

const cli=parseArgs(process.argv.slice(2));
const repo=path.resolve(String(cli.repo||process.cwd()));
let baseRef=String(cli['base-ref']||process.env.CIVWEAVE_CAPABILITY_BASE_REF||'').trim();
if(!baseRef||ZERO_SHA.test(baseRef)){
  baseRef=git(['rev-parse','HEAD^']).trim();
}

function git(args,options={}){
  return execFileSync('git',args,{cwd:repo,encoding:options.encoding===null?null:'utf8',maxBuffer:512*1024*1024,stdio:options.stdio||['ignore','pipe','pipe']});
}

function refHas(ref,file){
  const result=spawnSync('git',['cat-file','-e',`${ref}:${file}`],{cwd:repo,stdio:'ignore'});
  return result.status===0;
}

function readJsonFile(file){
  return JSON.parse(readFileSync(path.join(repo,file),'utf8'));
}

function readJsonAtRef(ref,file){
  return JSON.parse(git(['show',`${ref}:${file}`]));
}

function canonical(value){
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

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

function restoreTrustedRoots(ref,roots){
  for(const root of roots){
    assert.match(root,/^(scripts|tests)\/$/,`Unapproved trusted contract root: ${root}`);
    const target=path.join(repo,root);
    if(existsSync(target))rmSync(target,{recursive:true,force:true});
    const archive=git(['archive','--format=tar',ref,root],{encoding:null});
    const extracted=spawnSync('tar',['-xf','-','-C',repo],{input:archive,stdio:['pipe','inherit','inherit']});
    assert.equal(extracted.status,0,`Unable to restore trusted contract root ${root} from ${ref}`);
  }
}

function runCapability(capability){
  const [file,...args]=capability.command;
  process.stdout.write(`\n=== ${capability.id} · ${capability.name} ===\n`);
  const result=spawnSync(file,args,{
    cwd:repo,
    env:{...process.env,CIVWEAVE_CAPABILITY_LOCK:'1'},
    stdio:'inherit',
    timeout:capability.timeoutSeconds*1000
  });
  if(result.error){
    const timeout=result.error.code==='ETIMEDOUT';
    return {ok:false,reason:timeout?`timed out after ${capability.timeoutSeconds}s`:result.error.message};
  }
  if(result.signal)return {ok:false,reason:`terminated by ${result.signal}`};
  if(result.status!==0)return {ok:false,reason:`exited ${result.status}`};
  return {ok:true,reason:'passed'};
}

const headRegistry=readJsonFile(REGISTRY_PATH);
validateRegistry(headRegistry,'candidate');
const baseHasRegistry=refHas(baseRef,REGISTRY_PATH);
const trustedRegistry=baseHasRegistry?readJsonAtRef(baseRef,REGISTRY_PATH):headRegistry;
validateRegistry(trustedRegistry,baseHasRegistry?'base':'bootstrap');

const runTiers=new Set(trustedRegistry.policy.runTiers);
const trustedCapabilities=trustedRegistry.capabilities.filter(capability=>runTiers.has(capability.tier));
let proposedAdditions=[];

if(baseHasRegistry){
  const headById=new Map(headRegistry.capabilities.map(capability=>[capability.id,capability]));
  const missing=[];
  const modified=[];
  for(const accepted of trustedRegistry.capabilities){
    const candidate=headById.get(accepted.id);
    if(!candidate){missing.push(accepted.id);continue}
    if(canonical(candidate)!==canonical(accepted))modified.push(accepted.id);
  }
  assert.equal(missing.length,0,`CAPABILITY REGRESSION: accepted capabilities removed: ${missing.join(', ')}`);
  assert.equal(modified.length,0,`CAPABILITY REGRESSION: accepted capability definitions changed: ${modified.join(', ')}`);
  assert.ok(headRegistry.capabilities.length>=trustedRegistry.capabilities.length,'CAPABILITY REGRESSION: accepted capability registry shrank');
  const trustedIds=new Set(trustedRegistry.capabilities.map(capability=>capability.id));
  proposedAdditions=headRegistry.capabilities.filter(capability=>!trustedIds.has(capability.id));
}

restoreTrustedRoots(baseRef,trustedRegistry.policy.trustedContractRoots);

const results=[];
for(const capability of trustedCapabilities){
  const outcome=runCapability(capability);
  results.push({id:capability.id,name:capability.name,tier:capability.tier,...outcome});
}

const failures=results.filter(result=>!result.ok);
const summary={
  ok:failures.length===0,
  schema:EXPECTED_SCHEMA,
  trustSource:baseHasRegistry?'base-commit':'bootstrap-head-registry-with-base-contract-files',
  baseRef,
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
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,`# Civweave Capability Lock\n\n**${summary.passedCount}/${summary.executedP0P1Count} accepted P0/P1 capabilities passed.**\n\nTrust source: \`${summary.trustSource}\`  \nBase: \`${baseRef}\`  \nAccepted registry size: **${summary.acceptedCapabilityCount}**  \nProposed additions: **${summary.proposedAdditionCount}**\n\n| Capability | Tier | Result | Detail |\n|---|---:|---:|---|\n${rows}\n`);
}

if(failures.length){
  for(const failure of failures){
    if(process.env.GITHUB_ACTIONS)console.error(`::error title=Capability regression ${failure.id}::${failure.reason}`);
  }
  process.exitCode=1;
}
