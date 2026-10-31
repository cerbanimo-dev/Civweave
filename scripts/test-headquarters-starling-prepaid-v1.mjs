import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  HQ_STARLING_PREPAID_SCHEMA,
  HQ_STARLING_PREPAID_ROOT,
  normalizeCloudflareCreditBalance,
  gatewayCashCostCents,
  initializePrepaidBaseline,
  reconcilePrepaidCreditLoad,
  headquartersPrepaidStatus,
  runBoundedHeadquartersPrepaidInference,
  handleHeadquartersPrepaidRequest
} from '../cloudflare/core/src/headquarters-starling-prepaid-v1.mjs';

const migrations = ['0014_headquarters_starling_contributions.sql','0015_headquarters_starling_prepaid.sql'];
function fixture() {
  const sqlite=new DatabaseSync(':memory:');
  for(const file of migrations)sqlite.exec(readFileSync(new URL('../cloudflare/core/migrations/'+file,import.meta.url),'utf8'));
  const db={
    prepare(sql){
      let args=[];
      const stmt={
        bind(...values){args=values;return stmt;},
        async first(){return sqlite.prepare(sql).get(...args)||null;},
        async all(){return {results:sqlite.prepare(sql).all(...args)};},
        async run(){const ret=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(ret.changes)}};}
      };
      return stmt;
    },
    async batch(statements){
      sqlite.exec('BEGIN TRANSACTION');
      try{
        const result=[];for(const statement of statements)result.push(await statement.run());
        sqlite.exec('COMMIT');return result;
      }catch(error){sqlite.exec('ROLLBACK');throw error;}
    }
  };
  sqlite.prepare("INSERT INTO headquarters_starling_contributions(contribution_id,idempotency_key,gross_cents,processor_fee_cents,backing_cents,status,created_at,updated_at,settled_at) VALUES('contribution','fixture-id',2000,200,1800,'settled','2026-10-31','2026-10-31','2026-10-31')").run();
  const calls=[];
  let balanceUsd=0, billingMode='unified', spendLimit=true, autoTopup=0;
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});
    if(url.includes('/billing/credit-balance')){
      return {ok:true,json:async()=>({success:true,result:{balance:balanceUsd,topup_config:{amount:autoTopup,threshold:1}}})};
    }
    if(url.includes('/gateways/starling-prepaid')){
      return {ok:true,json:async()=>({success:true,result:{workers_ai_billing_mode:billingMode,spend_limits:{
        enabled:spendLimit,rules:[{enabled:true,limit:1,window:86400,limitType:'cost'}]
      }}})};
    }
    throw new Error('Unexpected remote request: '+url);
  };
  const generation=[];
  const env={
    CIVWEAVE_HEADQUARTERS_GATEWAY_PREPAID_READY:'1',
    HQ_STARLING_GATEWAY_ID:'starling-prepaid',
    CLOUDFLARE_ACCOUNT_ID:'123456789012345678901234567890ab',
    HQ_STARLING_CLOUDFLARE_READ_TOKEN:'read_token_123456789012345678901234567890',
    HQ_STARLING_OPERATOR_TOKEN:'hq_operator_123456789012345678901234567890',
    CIVWEAVE_HEADQUARTERS_FUNDING_ENABLED:'1',
    HQ_FUNDING_RATE_LIMITER:{limit:async()=>({success:true})},
    HQ_STARLING_FUNDED_INFERENCE_ENABLED:'1',
    HQ_STARLING_PREPAID_MODEL:'@cf/meta/llama-3.1-8b-instruct',
    HQ_STARLING_MODEL_INPUT_NEURONS_PER_1K_BYTES:'10',
    HQ_STARLING_MODEL_OUTPUT_NEURONS_PER_1K_TOKENS:'100',
    AI:{run:async(model,payload,settings)=>{
      generation.push({model,payload,settings});return {response:'A test answer.',usage:{prompt_tokens:12,completion_tokens:5}};
    }}
  };
  const edge={env,db,readiness:()=>({liveReady:true})};
  return {sqlite,edge,fetchImpl,calls,generation,setBalance:v=>balanceUsd=v,setBilling:v=>billingMode=v,
    setSpendLimit:v=>spendLimit=v,setAutoTopup:v=>autoTopup=v};
}
const key='hq-prepaid-request-0000000001';
const input={requestId:key,model:'@cf/meta/llama-3.1-8b-instruct',messages:[{role:'user',content:'Test safe task.'}],max_tokens:100};

test('normalizes non-negative Cloudflare dollars and blocks auto-topup',()=>{
  assert.equal(normalizeCloudflareCreditBalance({success:true,result:{balance:12.5}}),12_500_000);
  assert.throws(()=>normalizeCloudflareCreditBalance({success:true,result:{balance:-0.01}}),/negative/);
  assert.throws(()=>normalizeCloudflareCreditBalance({success:true,result:{balance:5,topup_config:{amount:2000,threshold:500}}}),/automatic/);
  assert.equal(gatewayCashCostCents(1000),1050);
  assert.throws(()=>gatewayCashCostCents(999));
});

test('prepaid balance baseline starts at zero spendable, manual load is bound to verified cash and actual balance rise',async()=>{
  const f=fixture();
  const before=await initializePrepaidBaseline(f.edge,{fetchImpl:f.fetchImpl});
  assert.equal(before.confirmedCreditMicroUsd,0);
  assert.equal((await headquartersPrepaidStatus(f.edge,{fetchImpl:f.fetchImpl})).availableMicroUsd,0);
  await assert.rejects(()=>reconcilePrepaidCreditLoad(f.edge,{providerReference:'cf-charge-1',creditCents:1000},{fetchImpl:f.fetchImpl}),/does not show/);
  f.setBalance(10);
  const loaded=await reconcilePrepaidCreditLoad(f.edge,{providerReference:'cf-charge-1',creditCents:1000},{fetchImpl:f.fetchImpl});
  assert.equal(loaded.confirmed,true);
  assert.equal(loaded.cashCostCents,1050);
  const status=await headquartersPrepaidStatus(f.edge,{fetchImpl:f.fetchImpl});
  assert.equal(status.confirmedCreditMicroUsd,10_000_000);
  assert.equal(status.availableMicroUsd,9_000_000); // $1 account safety margin
  const retry=await reconcilePrepaidCreditLoad(f.edge,{providerReference:'cf-charge-1',creditCents:1000},{fetchImpl:f.fetchImpl});
  assert.equal(retry.duplicate,true);
  await assert.rejects(()=>reconcilePrepaidCreditLoad(f.edge,{providerReference:'cf-charge-2',creditCents:1000},{fetchImpl:f.fetchImpl}),/contributions/);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM headquarters_starling_prepaid_loads').get().n,1);
});

test('prepaid model requests require approved model, quote and live balance, reserve exactly once, send explicit gateway',async()=>{
  const f=fixture();
  await initializePrepaidBaseline(f.edge,{fetchImpl:f.fetchImpl});
  f.setBalance(10);
  await reconcilePrepaidCreditLoad(f.edge,{providerReference:'cf-charge-1',creditCents:1000},{fetchImpl:f.fetchImpl});
  const result=await runBoundedHeadquartersPrepaidInference(f.edge,input,{fetchImpl:f.fetchImpl});
  assert.equal(result.schema,HQ_STARLING_PREPAID_SCHEMA);
  assert.equal(f.generation.length,1);
  assert.deepEqual(f.generation[0].settings,{gateway:{id:'starling-prepaid'}});
  assert.ok(result.reservedAndChargedMicroUsd>0);
  assert.equal(f.sqlite.prepare('SELECT status FROM headquarters_starling_prepaid_requests').get().status,'settled');
  await assert.rejects(()=>runBoundedHeadquartersPrepaidInference(f.edge,input,{fetchImpl:f.fetchImpl}),/already been used/);
  assert.equal(f.generation.length,1);
  await assert.rejects(()=>runBoundedHeadquartersPrepaidInference(f.edge,{...input,requestId:key+'x',model:'openai/gpt-5.5'},{fetchImpl:f.fetchImpl}),/not approved/);
  f.sqlite.prepare('UPDATE headquarters_starling_contributions SET refunded_gross_cents=1500').run();
  await assert.rejects(()=>runBoundedHeadquartersPrepaidInference(f.edge,{...input,requestId:key+'y'},{fetchImpl:f.fetchImpl}),/No verified prepaid credits/);
});

test('Cloudflare account mode, gateway spend caps and auto topup are verified, not assumed',async()=>{
  const f=fixture();
  f.setBalance(10);
  f.setBilling('postpaid');
  await assert.rejects(()=>initializePrepaidBaseline(f.edge,{fetchImpl:f.fetchImpl}),/not configured for prepaid/);
  f.setBilling('unified');f.setSpendLimit(false);
  await assert.rejects(()=>initializePrepaidBaseline(f.edge,{fetchImpl:f.fetchImpl}),/global spend limit/);
  f.setSpendLimit(true);f.setAutoTopup(1000);
  await assert.rejects(()=>initializePrepaidBaseline(f.edge,{fetchImpl:f.fetchImpl}),/automatic credit top-up/);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM headquarters_starling_prepaid_state').get().n,0);
});

test('operator endpoints are not public and do not grant paid calls by default',async()=>{
  const f=fixture();
  const make=(auth,path,body)=>new Request('https://core.example'+HQ_STARLING_PREPAID_ROOT+path,{
    method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:JSON.stringify(body)
  });
  const wrong=await handleHeadquartersPrepaidRequest(make('Bearer nope','/baseline',{}),f.edge.env,()=>f.edge,{fetchImpl:f.fetchImpl});
  assert.equal(wrong.status,401);
  const authorized=await handleHeadquartersPrepaidRequest(
    make('Bearer '+f.edge.env.HQ_STARLING_OPERATOR_TOKEN,'/baseline',{}),f.edge.env,()=>f.edge,{fetchImpl:f.fetchImpl});
  assert.equal(authorized.status,201);
  f.edge.env.HQ_STARLING_FUNDED_INFERENCE_ENABLED='0';
  const noSpend=await handleHeadquartersPrepaidRequest(
    make('Bearer '+f.edge.env.HQ_STARLING_OPERATOR_TOKEN,'/generate',input),f.edge.env,()=>f.edge,{fetchImpl:f.fetchImpl});
  assert.equal(noSpend.status,503);assert.equal(f.generation.length,0);
});
