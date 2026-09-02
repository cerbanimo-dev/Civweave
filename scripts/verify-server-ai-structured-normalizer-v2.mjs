import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('public/app/server-ai-output-normalizer-v1.js','utf8');
new vm.Script(source,{filename:'server-ai-output-normalizer-v1.js'});

const middleware=new Map();
let repairCalls=0;
let repairRequest=null;
const validPlan={
  title:'Read Tarot',
  capability:'read Tarot cards with a grounded interpretive process',
  level:'beginner',
  proof:'complete and explain a three-card reading',
  modules:[
    {title:'Deck Structure',focus:'Major and Minor Arcana',outcome:'identify card families'},
    {title:'Card Meanings',focus:'symbol and context',outcome:'interpret a card in context'},
    {title:'Spreads',focus:'positions and relationships',outcome:'complete a three-card spread'}
  ],
  assumptions:[]
};
const serverHandle=async request=>{
  repairCalls+=1;
  repairRequest=request;
  assert.equal(request.__cwServerAIStructuredRepair,true,'repair request marker missing');
  assert.equal(request.config.provider,'cloudflare-workers-ai','invalid server-auto structured output must advance to Cloudflare instead of repeating the same server-local tier');
  assert.equal(request.config.route,'cloudflare-workers-ai','structured repair route must advance with provider');
  return{handled:true,result:{
    status:'success',
    actual:{provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'},
    outputText:`Here is the corrected plan:\n\n\`\`\`json\n${JSON.stringify(validPlan)}\n\`\`\``,
    structured:{requested:true,valid:true,repairAttempts:0},
    usage:{inputTokens:20,outputTokens:30,totalTokens:50,chargedNeurons:7,remainingNeurons:90},
    diagnostics:[]
  }};
};
const sandbox={
  console,
  structuredClone,
  setInterval:()=>0,
  clearInterval:()=>{},
  setTimeout:()=>0,
  queueMicrotask:callback=>callback(),
  addEventListener:()=>{},
  dispatchEvent:()=>{},
  CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail}},
  document:{scripts:[],head:{append:()=>{}}},
  location:{href:'https://civweave-staging.pages.dev/app/'},
  CivweaveFastInteractiveV192:{register(id,hooks,priority){middleware.set(id,{hooks,priority});return()=>middleware.delete(id)}},
  CivweaveServerAIRouterV301:{handle:serverHandle},
  CivweaveSelectedProviderAuthorityV1:{version:'1.1.0-selected-provider-authority-v1-all-routes',install(){}},
  CivweaveAssistantOutputSanitizerV1:{version:'1.0.1-assistant-output-sanitizer-v1-wrapper-resilient',install(){}}
};
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'server-ai-output-normalizer-v1.js'});

assert.ok(middleware.has('server-ai-output-normalizer-v1'),'normalizer must register under its own middleware id');
assert.ok(!middleware.has('server-auto-v301'),'normalizer must not replace the server-auto middleware');
const normalizer=middleware.get('server-ai-output-normalizer-v1');
assert.equal(typeof normalizer.hooks.after,'function','normalizer must be an after-hook');

// Simulate the server router re-registering later. The normalizer must remain present.
middleware.set('server-auto-v301',{hooks:{handle:serverHandle},priority:60});
assert.ok(middleware.has('server-ai-output-normalizer-v1'),'server router re-registration erased the normalizer');

// Reproduce the real server-auto failure: a server-local tier returns successful prose for a request that required JSON.
// The result may even omit structured.requested; the request contract itself must still force validation.
const first={
  status:'success',
  actual:{provider:'server-local',model:'paired-local-model'},
  outputText:'I drafted a plan, but did not format it as JSON.',
  usage:{inputTokens:10,outputTokens:12,totalTokens:22,chargedNeurons:5,remainingNeurons:97},
  diagnostics:[]
};
const request={
  requestId:'tarot-plan',
  purpose:'living-school-learning-plan-review-v2',
  config:{provider:'server-auto',route:'server-auto',stream:false},
  responseFormat:'json',
  schema:{type:'object'},
  maxRepairAttempts:1,
  messages:[{role:'user',content:'I would like to learn to read Tarot'}]
};
const repaired=await normalizer.hooks.after(first,request);
assert.equal(repairCalls,1,'invalid server structured output should receive exactly one repair call');
assert.equal(repairRequest.config.provider,'cloudflare-workers-ai');
assert.equal(repaired.status,'success');
assert.equal(repaired.actual.provider,'cloudflare-workers-ai');
assert.equal(repaired.outputJson.title,'Read Tarot');
assert.equal(repaired.outputJson.modules.length,3);
assert.equal(repaired.structured.valid,true);
assert.equal(repaired.structured.repairAttempts,1);
assert.equal(repaired.usage.chargedNeurons,12,'usage must include both the original and repair calls');
assert.ok(repaired.diagnostics.some(row=>row.code==='WORKERS_AI_STRUCTURED_TIER_FAILOVER'),'structured tier failover diagnostic missing');
assert.ok(repaired.diagnostics.some(row=>row.code==='WORKERS_AI_STRUCTURED_OUTPUT_REPAIRED'),'structured repair diagnostic missing');

const enveloped={
  status:'success',
  outputText:JSON.stringify({id:'chatcmpl-test',choices:[{message:{role:'assistant',content:JSON.stringify(validPlan)}}]}),
  structured:{requested:true,valid:true,repairAttempts:0},
  diagnostics:[]
};
const normalized=sandbox.CivweaveServerAIOutputNormalizerV1.normalizeModelResult(enveloped);
assert.equal(normalized.status,'success');
assert.equal(normalized.outputJson.title,'Read Tarot');
assert.ok(normalized.diagnostics.some(row=>row.code==='WORKERS_AI_STRUCTURED_OUTPUT_RECOVERED'));
assert.equal(sandbox.CivweaveServerAIOutputNormalizerV1.repairRoute(request,first),'cloudflare-workers-ai');
assert.equal(sandbox.CivweaveServerAIOutputNormalizerV1.state().structuredTierFailover,true);

console.log('Server AI structured output normalizer regression checks passed.');
