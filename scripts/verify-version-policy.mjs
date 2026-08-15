import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const parse=value=>{
  const match=/^(\d+)\.(\d+)\.(\d+)$/.exec(String(value||'').trim());
  if(!match)throw new Error(`Invalid semantic version: ${value}`);
  return match.slice(1).map(Number);
};
const compare=(left,right)=>{
  for(let i=0;i<3;i+=1){if(left[i]!==right[i])return left[i]-right[i]}
  return 0;
};
const normalizePath=input=>String(input||'').replaceAll('\\','/').replace(/^\.\//,'');

export function housekeepingPath(input){
  const file=normalizePath(input);
  return /^(?:docs|ops)\//.test(file)
    || /^\.github\//.test(file)
    || /^site\/cerbanimo-cc\//.test(file)
    || /^tools\/civweave-dev-mcp\//.test(file)
    || /^(?:README|AGENTS|RELEASE-NOTES)\.md$/.test(file)
    || /^scripts\/(?:verify|test|smoke|align)-[^/]+\.mjs$/.test(file)
    || file==='scripts/sync-release-coherence-v220.mjs'
    || /^scripts\/migrations\//.test(file);
}

export function evaluateVersionPolicy({base,proposed,files}){
  const left=parse(base),right=parse(proposed);
  const changed=[...new Set((files||[]).map(String).map(value=>value.trim()).filter(Boolean))];
  const shipping=changed.filter(file=>!housekeepingPath(file));
  const order=compare(right,left);
  if(order<0)return{ok:false,shipping,reason:`VERSION may not move backwards (${base} -> ${proposed}).`};
  if(shipping.length&&order<=0)return{ok:false,shipping,reason:`Shipping/runtime changes require VERSION to advance (${base} -> ${proposed}).`};
  return{ok:true,shipping,reason:shipping.length?`Shipping change advances VERSION ${base} -> ${proposed}.`:`Housekeeping-only change may retain VERSION ${proposed}.`};
}

function canonicalHashRepairOnly(input,baseRef='origin/main'){
  const file=normalizePath(input),match=/^releases\/(\d+\.\d+\.\d+)\/release\.json$/.exec(file);
  if(!match)return false;
  try{
    const current=JSON.parse(readFileSync(file,'utf8'));
    const previous=JSON.parse(execFileSync('git',['show',`${baseRef}:${file}`],{encoding:'utf8'}));
    if(current?.schema!=='civweave.canonical-release.v1'||previous?.schema!==current.schema)return false;
    if(current.version!==match[1]||previous.version!==current.version)return false;
    const currentCopy={...current},previousCopy={...previous};
    delete currentCopy.sha256;delete previousCopy.sha256;
    if(JSON.stringify(currentCopy)!==JSON.stringify(previousCopy))return false;
    const currentHashes=current.sha256&&typeof current.sha256==='object'?current.sha256:{};
    const previousHashes=previous.sha256&&typeof previous.sha256==='object'?previous.sha256:{};
    const currentKeys=Object.keys(currentHashes).sort(),previousKeys=Object.keys(previousHashes).sort();
    if(JSON.stringify(currentKeys)!==JSON.stringify(previousKeys)||!currentKeys.length)return false;
    let changed=false;
    for(const key of currentKeys){
      const expected=String(currentHashes[key]||'');
      if(!/^[a-f0-9]{64}$/.test(expected))return false;
      if(expected!==previousHashes[key])changed=true;
      const bytes=readFileSync(`releases/${match[1]}/${key}`);
      const actual=createHash('sha256').update(bytes).digest('hex');
      if(actual!==expected)return false;
    }
    return changed;
  }catch{return false}
}

function selfTest(){
  const cases=[
    {base:'1.0.75',proposed:'1.0.75',files:['docs/README.md','.github/workflows/test.yml','scripts/verify-root-hygiene.mjs'],ok:true},
    {base:'1.0.75',proposed:'1.0.75',files:['site/cerbanimo-cc/app.js','site/cerbanimo-cc/assets/poster.webp'],ok:true},
    {base:'1.0.75',proposed:'1.0.75',files:['tools/civweave-dev-mcp/server.mjs','tools/civweave-dev-mcp/test/dev-tools-mcp.test.mjs'],ok:true},
    {base:'1.0.75',proposed:'1.0.75',files:['scripts/sync-release-coherence-v220.mjs','scripts/verify-chat-convergence-v250.mjs'],ok:true},
    {base:'1.0.75',proposed:'1.0.75',files:['public/app/index.html'],ok:false},
    {base:'1.0.75',proposed:'1.0.76',files:['public/app/index.html'],ok:true},
    {base:'1.0.76',proposed:'1.0.75',files:['docs/README.md'],ok:false},
    {base:'1.0.75',proposed:'1.0.75',files:['package-lock.json'],ok:false}
  ];
  for(const test of cases){
    const result=evaluateVersionPolicy(test);
    if(result.ok!==test.ok)throw new Error(`Version-policy self-test failed: ${JSON.stringify({test,result})}`);
  }
  console.log(JSON.stringify({ok:true,cases:cases.length,policy:'housekeeping-release-coherence-and-dev-tools-may-retain-version; shipping-must-advance; verified-canonical-hash-repair-may-retain'},null,2));
}

if(process.argv.includes('--self-test'))selfTest();
else{
  const [base,proposed]=process.argv.slice(2);
  const files=String(process.env.CHANGED_FILES||'').split(/\r?\n/).filter(Boolean);
  const verifiedCanonicalHashRepairs=files.filter(file=>canonicalHashRepairOnly(file));
  const remainingFiles=files.filter(file=>!verifiedCanonicalHashRepairs.includes(file));
  const result=evaluateVersionPolicy({base,proposed,files:remainingFiles});
  if(!result.ok){
    console.error(result.reason);
    if(result.shipping.length)console.error(`Shipping paths: ${result.shipping.join(', ')}`);
    process.exit(1);
  }
  console.log(JSON.stringify({ok:true,base,proposed,shippingPaths:result.shipping,verifiedCanonicalHashRepairs,reason:result.reason},null,2));
}