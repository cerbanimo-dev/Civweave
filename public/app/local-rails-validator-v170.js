(()=>{
'use strict';
const VERSION='1.0.4-local-rails-validator-v170';
if(globalThis.CommonweaveLocalRailsValidatorV170?.version===VERSION)return;
const MODEL_ID='Xenova/all-MiniLM-L6-v2';
const clean=(value,max=20000)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value).toLowerCase();
const words=value=>lower(value).match(/[a-z0-9][a-z0-9_-]*/g)||[];
const unique=value=>[...new Set(words(value))];
const overlap=(left,right)=>{const a=new Set(unique(left)),b=new Set(unique(right));if(!a.size||!b.size)return 0;let hits=0;a.forEach(token=>{if(b.has(token))hits++});return hits/Math.sqrt(a.size*b.size)};
function normalizeRail(item,index){
  if(typeof item==='string')return{id:`rail-${index+1}`,label:clean(item,500),required:true,checks:[],evidenceKinds:[]};
  const checks=Array.isArray(item?.checks)?item.checks:[];
  return{id:clean(item?.id,120)||`rail-${index+1}`,label:clean(item?.label||item?.description,500)||`Rail ${index+1}`,description:clean(item?.description||item?.label,1200),required:item?.required!==false,checks:checks.slice(0,20),evidenceKinds:(Array.isArray(item?.evidenceKinds)?item.evidenceKinds:[]).map(value=>lower(value)).filter(Boolean).slice(0,12)};
}
function syntaxCheck(code,language='text'){
  const source=String(code??''),kind=lower(language||'text');
  if(!source.trim())return{state:'missing',ok:false,message:'No code was submitted.'};
  try{
    if(['json','application/json'].includes(kind)){JSON.parse(source);return{state:'pass',ok:true,message:'JSON parsed successfully.'}}
    if(['javascript','js','typescript','ts'].includes(kind)){
      if(/\b(import|export)\b/.test(source))return{state:'inconclusive',ok:false,message:'Module syntax requires a project parser or test command; it was not executed in the browser.'};
      new Function(source);return{state:'pass',ok:true,message:'The submitted script passed a syntax-only parse. It was not executed.'};
    }
    if(['html','text/html'].includes(kind)&&typeof DOMParser!=='undefined'){
      const doc=new DOMParser().parseFromString(source,'text/html'),error=doc.querySelector('parsererror');
      return error?{state:'fail',ok:false,message:'The HTML parser reported an error.'}:{state:'pass',ok:true,message:'The HTML parsed successfully. Runtime behavior was not tested.'};
    }
    if(['xml','svg','application/xml','image/svg+xml'].includes(kind)&&typeof DOMParser!=='undefined'){
      const doc=new DOMParser().parseFromString(source,'application/xml'),error=doc.querySelector('parsererror');
      return error?{state:'fail',ok:false,message:error.textContent?.slice(0,500)||'The XML parser reported an error.'}:{state:'pass',ok:true,message:'The XML parsed successfully.'};
    }
    if(['css','text/css'].includes(kind)&&typeof CSSStyleSheet!=='undefined'){
      const sheet=new CSSStyleSheet();sheet.replaceSync(source);return{state:'pass',ok:true,message:'The stylesheet parsed successfully. It was not applied.'};
    }
    return{state:'inconclusive',ok:false,message:'No deterministic syntax parser is installed for this language.'};
  }catch(error){return{state:'fail',ok:false,message:clean(error?.message||'The syntax parser rejected the submission.',800)}}
}
function runCheck(check,context){
  const type=lower(check?.type),target=check?.target==='evidence'?context.evidenceText:context.code,value=String(check?.value??''),label=clean(check?.label||type,200)||'rail check';
  try{
    if(type==='contains')return{label,type,ok:target.includes(value),detail:`Expected ${check.target==='evidence'?'evidence':'code'} to contain ${JSON.stringify(value)}.`};
    if(type==='not-contains')return{label,type,ok:!target.includes(value),detail:`Expected ${check.target==='evidence'?'evidence':'code'} not to contain ${JSON.stringify(value)}.`};
    if(type==='regex'){const expression=new RegExp(value,check?.flags||'m');return{label,type,ok:expression.test(target),detail:`Checked /${value}/${check?.flags||'m'}.`}}
    if(type==='max-bytes'){const bytes=new TextEncoder().encode(target).byteLength,limit=Number(check?.value);return{label,type,ok:Number.isFinite(limit)&&bytes<=limit,detail:`${bytes} bytes, limit ${limit}.`}}
    if(type==='min-bytes'){const bytes=new TextEncoder().encode(target).byteLength,limit=Number(check?.value);return{label,type,ok:Number.isFinite(limit)&&bytes>=limit,detail:`${bytes} bytes, minimum ${limit}.`}}
    if(type==='test-result'){
      const match=(context.runResults||[]).find(row=>String(row?.id||row?.name)===String(check?.value||check?.id));
      return{label,type,ok:Boolean(match?.passed),detail:match?`Recorded test result: ${match.passed?'passed':'failed'}.`:'No matching test result was supplied.'};
    }
    return{label,type,ok:false,inconclusive:true,detail:`Unsupported deterministic check type: ${type||'blank'}.`};
  }catch(error){return{label,type,ok:false,inconclusive:true,detail:clean(error?.message,500)}}
}
function deterministicReview({code='',language='text',rails=[],evidence=[],runResults=[]}={}){
  const rows=(Array.isArray(rails)?rails:[]).slice(0,40).map(normalizeRail),proofs=(Array.isArray(evidence)?evidence:[]).map(item=>typeof item==='string'?{kind:'note',value:item}:item||{}),evidenceText=proofs.map(item=>`${item.kind||'note'}: ${item.label||''} ${item.value||item.text||item.url||''}`).join('\n'),context={code:String(code??''),evidenceText,runResults:Array.isArray(runResults)?runResults:[]};
  const syntax=syntaxCheck(context.code,language),coverage=rows.map(rail=>{
    const checks=rail.checks.map(check=>runCheck(check,context)),missingKinds=rail.evidenceKinds.filter(kind=>!proofs.some(proof=>lower(proof.kind)===kind)),hasChecks=checks.length>0,failed=checks.filter(check=>!check.ok&&!check.inconclusive),inconclusive=checks.filter(check=>check.inconclusive),state=missingKinds.length||failed.length?'fail':hasChecks&&!inconclusive.length?'pass':'review';
    return{id:rail.id,label:rail.label,required:rail.required,state,checks,missingEvidenceKinds:missingKinds,reason:missingKinds.length?`Missing evidence kinds: ${missingKinds.join(', ')}.`:failed.length?failed[0].detail:hasChecks&&inconclusive.length?'One or more checks could not run locally.':'This rail has no explicit machine-checkable rule, so local validation cannot honestly pass it.'};
  });
  const required=coverage.filter(row=>row.required),failed=required.filter(row=>row.state==='fail'),review=required.filter(row=>row.state==='review'),status=syntax.state==='fail'||failed.length?'fail':syntax.state==='pass'&&!review.length&&required.length?'pass':'review';
  return{schema:'commonweave.local-rails-review.v1',version:VERSION,authority:'deterministic-local-validation',model:null,status,syntax,coverage,failedRails:failed.map(row=>row.label),reviewRails:review.map(row=>row.label),canAutoAccept:status==='pass',generatedChanges:false,appliedChanges:false,requiresImportedGenerativeModelForChanges:true,nextAction:status==='pass'?'The explicit local rails passed. Preserve the test receipts before acceptance.':syntax.state==='fail'?'Repair the syntax error and resubmit.':failed.length?`Repair: ${failed[0].label}`:'Run project tests or add explicit machine-checkable rail rules before acceptance.'};
}
async function semanticAdvisory({code='',rails=[],evidence=[]}={}){
  const api=globalThis.CommonweaveMerlinitesV164,rows=(Array.isArray(rails)?rails:[]).slice(0,40).map(normalizeRail),query=`${clean(code,12000)}\n${clean(JSON.stringify(evidence),5000)}`;
  if(!api?.rank||!rows.length)return{available:false,model:MODEL_ID,authority:'semantic-advisory-only',matches:[]};
  try{const result=await api.rank(query,rows.map(row=>({id:row.id,text:`${row.label}. ${row.description}`})),{limit:Math.min(12,rows.length),semanticWaitMs:900});return{available:true,model:MODEL_ID,device:result.device||'lexical',authority:'semantic-advisory-only',matches:(result.matches||[]).map(match=>({...match,meaning:'Similarity suggests possible relevance only. It is not proof that the rail passed.'}))}}catch(error){return{available:false,model:MODEL_ID,authority:'semantic-advisory-only',matches:[],error:clean(error?.message,500)}}
}
async function validateSubmission(input={}){const deterministic=deterministicReview(input),semantic=await semanticAdvisory(input);return{...deterministic,semantic,boundary:{miniLM:'May rank likely rail relevance and retrieve similar examples.',deterministicTools:'Parsers, tests, schemas, receipts, and explicit rules decide local pass or fail.',generativeModels:'Only an imported generative model may propose code changes. No model may apply them without a separate approval gate.'}}}
const capabilities={syntaxParsing:true,explicitRailRules:true,testReceiptChecks:true,semanticRailRanking:true,codeGeneration:false,patchApplication:false,automaticAcceptance:'Only when every required rail has explicit deterministic checks and all pass.'};
globalThis.CommonweaveLocalRailsValidatorV170={version:VERSION,model:MODEL_ID,capabilities,syntaxCheck,deterministicReview,semanticAdvisory,validateSubmission};
try{dispatchEvent(new CustomEvent('commonweave:local-rails-validator-ready',{detail:{version:VERSION,capabilities}}))}catch{}
})();
