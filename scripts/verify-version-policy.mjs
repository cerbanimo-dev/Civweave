const parse=value=>{
  const match=/^(\d+)\.(\d+)\.(\d+)$/.exec(String(value||'').trim());
  if(!match)throw new Error(`Invalid semantic version: ${value}`);
  return match.slice(1).map(Number);
};
const compare=(left,right)=>{
  for(let i=0;i<3;i+=1){if(left[i]!==right[i])return left[i]-right[i]}
  return 0;
};

export function housekeepingPath(input){
  const file=String(input||'').replaceAll('\\','/').replace(/^\.\//,'');
  return /^(?:docs|ops)\//.test(file)
    || /^\.github\//.test(file)
    || /^site\/cerbanimo-cc\//.test(file)
    || /^(?:README|AGENTS|RELEASE-NOTES)\.md$/.test(file)
    || /^scripts\/(?:verify|test|smoke|align)-[^/]+\.mjs$/.test(file)
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

function selfTest(){
  const cases=[
    {base:'1.0.75',proposed:'1.0.75',files:['docs/README.md','.github/workflows/test.yml','scripts/verify-root-hygiene.mjs'],ok:true},
    {base:'1.0.75',proposed:'1.0.75',files:['site/cerbanimo-cc/app.js','site/cerbanimo-cc/assets/poster.webp'],ok:true},
    {base:'1.0.75',proposed:'1.0.75',files:['public/app/index.html'],ok:false},
    {base:'1.0.75',proposed:'1.0.76',files:['public/app/index.html'],ok:true},
    {base:'1.0.76',proposed:'1.0.75',files:['docs/README.md'],ok:false},
    {base:'1.0.75',proposed:'1.0.75',files:['package-lock.json'],ok:false}
  ];
  for(const test of cases){
    const result=evaluateVersionPolicy(test);
    if(result.ok!==test.ok)throw new Error(`Version-policy self-test failed: ${JSON.stringify({test,result})}`);
  }
  console.log(JSON.stringify({ok:true,cases:cases.length,policy:'housekeeping-may-retain-version; shipping-must-advance'},null,2));
}

if(process.argv.includes('--self-test'))selfTest();
else{
  const [base,proposed]=process.argv.slice(2);
  const files=String(process.env.CHANGED_FILES||'').split(/\r?\n/).filter(Boolean);
  const result=evaluateVersionPolicy({base,proposed,files});
  if(!result.ok){
    console.error(result.reason);
    if(result.shipping.length)console.error(`Shipping paths: ${result.shipping.join(', ')}`);
    process.exit(1);
  }
  console.log(JSON.stringify({ok:true,base,proposed,shippingPaths:result.shipping,reason:result.reason},null,2));
}
