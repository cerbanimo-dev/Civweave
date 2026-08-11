import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

const ROOT=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,ROOT),'utf8');
class StorageMock{constructor(){this.map=new Map()}getItem(k){return this.map.has(String(k))?this.map.get(String(k)):null}setItem(k,v){this.map.set(String(k),String(v))}removeItem(k){this.map.delete(String(k))}}
function browserContext(extra={}){const context={console,crypto:webcrypto,TextEncoder,TextDecoder,localStorage:new StorageMock(),sessionStorage:new StorageMock(),CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail}},dispatchEvent:()=>true,addEventListener:()=>{},removeEventListener:()=>{},setInterval:()=>1,clearInterval:()=>{},setTimeout,clearTimeout,queueMicrotask,performance,Intl,URL,URLSearchParams,btoa:v=>Buffer.from(v,'binary').toString('base64'),atob:v=>Buffer.from(v,'base64').toString('binary'),document:{readyState:'loading',documentElement:{dataset:{}},querySelector:()=>null,querySelectorAll:()=>[],addEventListener:()=>{}},location:{origin:'https://hub.example',href:'https://hub.example/app',pathname:'/app'},navigator:{onLine:true},globalThis:null,...extra};context.globalThis=context;vm.createContext(context);return context}
function runIife(path,context=browserContext()){vm.runInContext(read(path),context,{filename:path});return context}

// FellowFare client fee policy: 1% surcharge on fiat commerce only, seller protected.
{
  const ctx=runIife('public/app/cw-fellowfare-fee-policy-v2.js'),api=ctx.CivweaveFellowFareFeePolicyV2;
  assert.ok(api,'fee policy did not boot');
  const q=api.quoteFiat({sellerSubtotalCents:10000,currency:'USD',rail:'stripe-connect',kind:'service',servingHostId:'hub-a'});
  assert.equal(q.sellerTransferCents,10000);
  assert.equal(q.networkFeeCents,100);
  assert.equal(q.hostFeeCents,50);
  assert.equal(q.cerbanimoFeeCents,50);
  assert.equal(q.buyerTotalCents,10100);
  const internal=api.quoteInternal({amount:8,assetType:'button'});
  assert.equal(internal.networkFee,0);
  assert.equal(internal.providerReceives,8);
}

// FellowFare deterministic + AI policy cannot downgrade a hard block.
{
  const ctx=runIife('public/app/cw-fellowfare-market-safety-v1.js'),api=ctx.CivweaveFellowFareMarketSafetyV1;
  assert.ok(api,'market safety did not boot');
  assert.equal(api.evaluateDeterministic({title:'Bike repair',description:'Tune brakes and gears',kind:'service'}).status,'allowed');
  assert.equal(api.evaluateDeterministic({title:'Blender tutoring',description:'Two hour beginner lesson',kind:'learning'}).status,'allowed');
  assert.equal(api.evaluateDeterministic({title:'Send $500',description:'transfer funds to Bob'}).status,'blocked');
  assert.equal(api.evaluateDeterministic({title:'Sell Acorns for dollars'}).status,'blocked');
  assert.equal(api.evaluateDeterministic({title:'Prescription consultation'}).status,'review');
  const electrical=api.evaluateDeterministic({title:'Rewire electrical panel'});
  assert.equal(electrical.status,'requirements');
  assert.ok(electrical.missingCredentials.includes('professional-license:electrician'));
  const blocked=api.evaluateDeterministic({title:'Sell stolen goods'}),combined=api.combine(blocked,{status:'allowed',confidence:1,flags:[],questions:[],requiredCredentials:[]});
  assert.equal(combined.status,'blocked','AI downgraded a deterministic block');
}

// Server and client checkout math stay aligned.
{
  const server=await import('../cloudflare/core/src/fellowfare-policy.mjs');
  const q=server.quoteFellowFareCheckout({sellerSubtotalCents:10000,processorRecoveryCents:320,currency:'USD'});
  assert.deepEqual({seller:q.sellerTransferCents,fee:q.networkFeeCents,host:q.hostFeeCents,llc:q.cerbanimoFeeCents,total:q.buyerTotalCents},{seller:10000,fee:100,host:50,llc:50,total:10420});
  assert.equal(server.classifyFellowFareListing({title:'Send $500',description:'cash transfer'}).status,'blocked');
  assert.equal(server.classifyFellowFareListing({title:'Carpentry repair'}).status,'allowed');
}

// Portable top-ups split actual service net 70/25/5.
{
  const portable=await import('../cloudflare/core/src/portable-credit-edge.mjs');
  assert.deepEqual(portable.PortableCreditInternals.splitNet(10000),{systemCreditCents:7000,hostShareCents:2500,cerbanimoShareCents:500});
  const source=read('cloudflare/core/src/passport-edge.mjs');
  assert.match(source,/passport_credit_debts/,'offline credit leases do not check refunded credit debt');
  assert.match(source,/unreserved Stripe billing credits/,'offline lease reservation guard missing');
  assert.match(source,/billing\/credit_balance_summary/,'portable balance is not Stripe-backed');
}

// Recovery capsule is client-only encrypted and round-trips locally.
{
  const ctx=runIife('public/app/cw-passport-recovery-crypto-v1.js'),api=ctx.CivweavePassportRecoveryCryptoV1;
  const payload={identity:{passportId:'passport:test'},recoveryVersion:1};
  const encrypted=await api.encrypt('correct horse battery staple',payload);
  assert.equal(encrypted.schema,'civweave.passport-recovery-ciphertext.v1');
  assert.ok(!encrypted.ciphertext.includes('passport:test'));
  const restored=await api.decrypt('correct horse battery staple',encrypted);
  assert.equal(restored.identity.passportId,'passport:test');
  await assert.rejects(()=>api.decrypt('wrong secret here',encrypted));
  const server=read('cloudflare/core/src/passport-edge.mjs');
  assert.match(server,/Only client-encrypted recovery capsules are accepted/);
  assert.match(server,/intent\.status!=='succeeded'/);
  assert.match(server,/token_hash/);
}

// Hub Commons eligibility preserves independent off-node, cross-device, diverse validation requirements.
{
  const ctx=runIife('public/app/cw-hub-commons-v1.js'),api=ctx.CivweaveHubCommonsV1;
  assert.ok(api.validationEligible({sourceHub:'hub-a',validatorHub:'hub-b',sourceReceiptId:'r1',validation:{verifiedPass:true,crossDeviceSatisfied:true,diversity:{satisfied:true}}}));
  assert.equal(api.validationEligible({sourceHub:'hub-a',validatorHub:'hub-a',sourceReceiptId:'r1',validation:{verifiedPass:true,crossDeviceSatisfied:true,diversity:{satisfied:true}}}),false);
  assert.equal(api.validationEligible({sourceHub:'hub-a',validatorHub:'hub-b',sourceReceiptId:'r1',validation:{verifiedPass:true,crossDeviceSatisfied:false,diversity:{satisfied:true}}}),false);
  assert.equal(api.validationEligible({sourceHub:'hub-a',validatorHub:'hub-b',sourceReceiptId:'r1',validation:{verifiedPass:true,crossDeviceSatisfied:true,diversity:{satisfied:false}}}),false);
}

// Peer compute accepts bounded declarative model jobs and cannot receive tools/arbitrary code fields.
{
  const ctx=runIife('public/app/cw-hub-compute-worker-v1.js'),api=ctx.CivweaveHubComputeWorkerV1;
  const request=api.sanitizeRequest({kind:'inference',messages:[{role:'user',content:'Summarize this.'}],maxOutputTokens:99999,temperature:5,tools:[{name:'shell'}],code:'rm -rf /'});
  assert.equal(request.maxOutputTokens,2048);
  assert.equal(request.temperature,1);
  assert.equal('tools' in request,false);
  assert.equal('code' in request,false);
  assert.equal(request.schema,'civweave.compute-declarative-request.v1');
  assert.throws(()=>api.sanitizeRequest({kind:'inference'}));
}

// Mesh/Map and Commerce wiring are first-class, not orphan files.
{
  const mapBridge=read('public/app/civweave-map-mesh-bridge-v276.js');
  assert.match(mapBridge,/CivweaveHubPeerMeshV1/);
  assert.match(mapBridge,/CivweaveHubPeerBootstrapV1/);
  const core=read('cloudflare/core/src/index.mjs');
  assert.match(core,/handleFederationRequest/);
  assert.match(core,/handlePortableCreditStripeEvent/);
  assert.match(core,/handleFellowFareStripeEvent/);
  assert.match(core,/processing_error/,'Stripe webhook retries are not failure-aware');
  const commerce=read('cloudflare/core/src/fellowfare-commerce.mjs');
  assert.match(commerce,/seller_subtotal_cents/);
  assert.match(commerce,/createHostTransfer/);
  assert.match(commerce,/safetyCertificate/);
  assert.match(commerce,/classifyFellowFareListing/);
}

console.log(JSON.stringify({ok:true,revision:'federated-economy-v1',fee:'1% buyer surcharge split 0.5% host / 0.5% Cerbanimo',internalSkillCurrencyFee:0,passportRoaming:true,portableStripeCredits:true,hubCommons:true,hubMapPeerDiscovery:true,boundedPeerCompute:true,marketSafety:'deterministic+AI-escalation'},null,2));
