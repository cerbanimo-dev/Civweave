import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {NodeAiLedger} from '../lib/node-ai-ledger-sqlite-v1.mjs';
import {createNodeServiceManifest} from '../lib/node-ai-marketplace-v1.mjs';
import {createNodeAiTrialCommerceHandler} from '../lib/node-ai-trial-commerce-v1.mjs';
import {createNodeAiOnboardingEnv,validateNodeAiOnboardingDraft} from '../lib/node-ai-onboarding-v1.mjs';

const dir=await mkdtemp(path.join(os.tmpdir(),'cw-node-trial-'));
const ledger=new NodeAiLedger({databasePath:path.join(dir,'ledger.sqlite'),nodeId:'node:trial',operatorId:'operator:test',platformFeeBps:2000});
const manifest=createNodeServiceManifest({nodeId:'node:trial',operatorId:'operator:test',displayName:'Trial Node',platformFeeBps:2000,services:[{id:'general',label:'General',capabilities:['chat'],billing:{minimumChargeCents:1,maxRequestCents:50},backend:{ownership:'node-operator'},disclosures:{}}],metadata:{endpoints:{baseUrls:['http://127.0.0.1']}}});
const authSecret='a'.repeat(64),internalSecret='i'.repeat(64);
const trial=createNodeAiTrialCommerceHandler({ledger,manifest,requested:true,authSecret,internalSecret,maxTopUpCents:10_000});
assert.equal(trial.status().enabled,true);
assert.equal(trial.status().livePayments,false);
assert.equal(trial.status().sandbox,true);
const ticket=trial.pairingTicket({userId:'user:trial',label:'Cami test phone',ttlSeconds:600,sessionTtlSeconds:3600});
assert.match(ticket.code,/^cwpair_/);
const paired=await trial.redeem({code:ticket.code,deviceId:'device:trial',label:'Trial device'});
assert.equal(paired.userId,'user:trial');
assert.equal(paired.wallet.balanceCents,0);
await assert.rejects(()=>trial.redeem({code:ticket.code,deviceId:'device:second'}),/already been redeemed/);

const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1');if(await trial.handle(req,res,url))return;res.writeHead(404).end()});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const userHeaders={authorization:`Bearer ${paired.session}`,'content-type':'application/json'};
const internalHeaders={'x-civweave-internal-secret':internalSecret,'content-type':'application/json'};
async function request(route,{method='GET',headers={},body}={}){const response=await fetch(`${base}${route}`,{method,headers,body:body==null?undefined:JSON.stringify(body)});const payload=await response.json().catch(()=>({}));return{response,payload}}
let result=await request('/api/ai/node/trial/topups',{method:'POST',headers:userHeaders,body:{grossCents:1000,idempotencyKey:'topup-1'}});
assert.equal(result.response.status,200);assert.equal(result.payload.applied.wallet.balanceCents,1000);assert.equal(result.payload.applied.quote.platformFeeCents,200);
result=await request('/api/ai/node/trial/topups',{method:'POST',headers:userHeaders,body:{grossCents:1000,idempotencyKey:'topup-1'}});
assert.equal(result.payload.applied.idempotent,true);assert.equal(result.payload.applied.wallet.balanceCents,1000,'duplicate sandbox top-up must not double-credit');
result=await request('/api/ai/node/trial/refunds',{method:'POST',headers:userHeaders,body:{amountCents:200,idempotencyKey:'refund-1'}});
assert.equal(result.payload.applied.wallet.balanceCents,800);
ledger.reserve({userId:'user:trial',reservationId:'trial:reserved',serviceId:'general',maxRetailCostCents:700});
result=await request('/api/ai/node/trial/chargebacks',{method:'POST',headers:internalHeaders,body:{userId:'user:trial',amountCents:500,idempotencyKey:'chargeback-1'}});
assert.equal(result.response.status,200);assert.equal(result.payload.applied.recoveredCents,100,'chargeback may only recover unreserved credits');assert.equal(result.payload.applied.debtAddedCents,400);assert.equal(result.payload.applied.wallet.debtCents,400);assert.equal(result.payload.applied.wallet.reservedCents,700);
result=await request('/api/ai/node/trial/history',{headers:{authorization:`Bearer ${paired.session}`}});assert.equal(result.response.status,200);assert.ok(result.payload.entries.some(entry=>entry.kind==='topup-credit'));assert.ok(result.payload.entries.some(entry=>entry.kind==='payment.chargeback'));
result=await request('/api/ai/node/trial/operator/summary',{headers:{'x-civweave-internal-secret':internalSecret}});assert.equal(result.response.status,200);assert.equal(result.payload.summary.sandbox,true);assert.equal(result.payload.summary.adjustments.refundCents,200);assert.equal(result.payload.summary.adjustments.chargebackCents,500);assert.equal(result.payload.summary.pairings.redeemed,1);
result=await request('/api/ai/node/trial/operator/self-test',{method:'POST',headers:internalHeaders,body:{}});assert.equal(result.response.status,200);assert.equal(result.payload.ok,true);assert.ok(result.payload.checks.find(check=>check.id==='inference'&&!check.ok),'self-test should report inference package absence without failing sandbox accounting readiness');

const draft={nodeId:'node:wizard',operatorId:'operator:wizard',displayName:'Wizard Node',platformFeeBps:1250,publicBaseUrls:['https://node.example'],publicLocation:{lat:43.9,lon:-75.9},services:[{id:'general',capabilities:['chat'],billing:{minimumChargeCents:1,referenceRequestCents:4,maxRequestCents:20},backend:{model:'operator/model'}}],retentionPolicy:'request metadata for 7 days',thirdPartyInference:true,servicePackageModule:'./examples/node-ai-fireworks-package-v1.mjs',trialCommerceEnabled:true};
const normalized=validateNodeAiOnboardingDraft(draft);assert.equal(normalized.platformFeeBps,1250);assert.equal(normalized.services[0].billing.referenceRequestCents,4);const env=createNodeAiOnboardingEnv(draft);assert.match(env,/NODE_AI_TRIAL_COMMERCE_ENABLED=1/);assert.match(env,/NODE_AI_SERVICES_JSON=/);assert.ok(!env.includes(authSecret));assert.throws(()=>validateNodeAiOnboardingDraft({...draft,servicePackageModule:'https://evil.example/package.mjs'}),/local node modules/);

server.close();ledger.close();await rm(dir,{recursive:true,force:true});
console.log(JSON.stringify({ok:true,revision:'node-onboarding-trial-commerce-v1',pairingSingleUse:true,sandboxIdempotent:true,reservationProtectedFromChargeback:true,debtCreated:true,onboardingValidated:true,livePayments:false},null,2));
