import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HQ_STARLING_FUNDING_SCHEMA,
  HQ_STARLING_FUNDING_ROUTE,
  approximateFundedNeurons,
  estimatePrepaidGatewayCreditsCents,
  HQ_GATEWAY_CREDIT_FEE_BPS,
  residualBackingCents,
  publicHeadquartersFundingStatus,
  createHeadquartersFundingCheckout,
  settleHeadquartersFundingCheckout,
  handleHeadquartersFundingPaymentEvent,
  handleHeadquartersFundingRequest
} from '../cloudflare/core/src/headquarters-starling-funding-v1.mjs';

test('HQ contributions estimate *prepaid Gateway* credits after Cloudflare 5% load fee, not Workers Paid overage', () => {
  assert.equal(HQ_GATEWAY_CREDIT_FEE_BPS, 500);
  assert.equal(estimatePrepaidGatewayCreditsCents(105), 100);
  assert.equal(approximateFundedNeurons(105), 90909);
  assert.equal(estimatePrepaidGatewayCreditsCents(0), 0);
  assert.throws(()=>estimatePrepaidGatewayCreditsCents(-1));
  assert.equal(residualBackingCents({ grossCents: 1000,backingCents: 940,refundedGrossCents: 500 }), 470);
  assert.equal(residualBackingCents({ grossCents: 1000,backingCents: 940,refundedGrossCents: 500,disputedGrossCents: 500 }), 0);
  assert.throws(()=>approximateFundedNeurons(-1));
});
function harness({ ready = true } = {}) {
  const rows = new Map(), byKey = new Map();
  const calls = [];
  const db = { prepare(sql) {
    let args=[];
    return {
      bind(...values){ args=values; return this; },
      async run(){
        if(sql.startsWith('INSERT OR IGNORE INTO headquarters_starling_contributions')){
          if(!byKey.has(args[1])){
            const row={contribution_id:args[0],idempotency_key:args[1],gross_cents:args[2],
              status:'creating',created_at:args[3],updated_at:args[3],backing_cents:0,
              refunded_gross_cents:0,disputed_gross_cents:0};
            rows.set(args[0],row);byKey.set(args[1],row);
          }
          return {meta:{changes:1}};
        }
        const row=rows.get(args.at(-1));
        if(!row)throw new Error('Missing test contribution');
        if(sql.includes("stripe_session_id=?1,checkout_url=?2")){
          Object.assign(row,{stripe_session_id:args[0],checkout_url:args[1],status:'checkout-pending'});
        } else if(sql.includes("stripe_payment_intent_id=?2")){
          if(row.settled_at)return {meta:{changes:0}};
          Object.assign(row,{stripe_session_id:args[0],stripe_payment_intent_id:args[1],
            stripe_charge_id:args[2],processor_fee_cents:args[3],backing_cents:args[4],refunded_gross_cents:args[5],disputed_gross_cents:args[6],status:'settled',settled_at:args[7]});
        }else if(sql.includes('refunded_gross_cents=?1')){
          row.refunded_gross_cents=args[0];row.status=args[0]>=row.gross_cents?'refunded':'partially-refunded';
        }else if(sql.includes('disputed_gross_cents=?1')){
          row.disputed_gross_cents=args[0];
        }else throw new Error('Unexpected SQL update: '+sql);
        return {meta:{changes:1}};
      },
      async first(){
        if(sql.includes('COUNT(*) AS paid_count')){
          const paid=[...rows.values()].filter(row=>row.settled_at);
          return {paid_count:paid.length,funded_cents:paid.reduce((sum,row)=>sum+residualBackingCents({
            grossCents:row.gross_cents,backingCents:row.backing_cents,
            refundedGrossCents:row.refunded_gross_cents,disputedGrossCents:row.disputed_gross_cents
          }),0)};
        }
        if(sql.includes('WHERE idempotency_key=?1'))return byKey.get(args[0])||null;
        if(sql.includes('WHERE contribution_id=?1'))return rows.get(args[0])||null;
        if(sql.includes('WHERE stripe_charge_id=?1'))return [...rows.values()].find(row=>row.stripe_charge_id===args[0])||null;
        throw new Error('Unexpected SQL read: '+sql);
      }
    };
  }};
  const env={
    CIVWEAVE_HEADQUARTERS_FUNDING_ENABLED:ready?'1':'0',
    CIVWEAVE_HEADQUARTERS_GATEWAY_PREPAID_READY:'1',
    HQ_STARLING_GATEWAY_ID:'starling-prepaid',
    HQ_FUNDING_RATE_LIMITER:{limit:async()=>({success:true})},
    DB:db
  };
  const provider={
    request:async(path,opts)=>{calls.push({path,opts});return {id:'cs_hq_test',url:'https://checkout.stripe.com/c/pay/test'};},
    retrieveCheckoutSession:async()=>({
      id:'cs_hq_test',payment_status:'paid',mode:'payment',currency:'usd',amount_total:1000,
      metadata:{civweave_schema:HQ_STARLING_FUNDING_SCHEMA,civweave_contribution_id:[...rows.keys()][0]},
      payment_intent:{id:'pi_hq_test',status:'succeeded',latest_charge:{
        id:'ch_hq_test',status:'succeeded',balance_transaction:{id:'txn_hq_test',fee:59}
      }}
    })
  };
  const edge={env,db,provider,readiness:()=>({liveReady:true})};
  return {edge,rows,calls};
}
const valid={amountCents:1000,idempotencyKey:'testcheckoutrequest123456'};
test('headquarters route remains closed unless prepaid gateway is configured; no Workers Paid plan requirement',async()=>{
  const h=harness({ready:false});
  const res=await handleHeadquartersFundingRequest(new Request('https://core.example'+HQ_STARLING_FUNDING_ROUTE,{
    method:'POST',headers:{origin:'https://civweave.cc','content-type':'application/json'},body:JSON.stringify(valid)
  }),h.edge.env,()=>h.edge);
  assert.equal(res.status,503);assert.equal(h.calls.length,0);
  const noGateway=harness(); delete noGateway.edge.env.HQ_STARLING_GATEWAY_ID;
  const noGatewayResult=await handleHeadquartersFundingRequest(new Request('https://core.example'+HQ_STARLING_FUNDING_ROUTE,{method:'POST',headers:{origin:'https://civweave.cc','content-type':'application/json'},body:JSON.stringify(valid)}),noGateway.edge.env,()=>noGateway.edge);
  assert.equal(noGatewayResult.status,503);
  assert.equal(noGateway.calls.length,0);
  const denied=await handleHeadquartersFundingRequest(new Request('https://core.example'+HQ_STARLING_FUNDING_ROUTE,{
    method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify(valid)
  }),h.edge.env,()=>h.edge);
  assert.equal(denied.status,403);
});
test('public checkout is guest friendly and settles only after verified Stripe charge and actual fee',async()=>{
  const h=harness();
  const created=await createHeadquartersFundingCheckout(h.edge,valid,'https://civweave.cc');
  assert.equal(created.status,'checkout-pending');
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].opts.form['line_items[0][price_data][unit_amount]'],'1000');
  assert.equal(h.calls[0].opts.form['payment_intent_data[metadata][civweave_schema]'],HQ_STARLING_FUNDING_SCHEMA);
  assert.equal((await publicHeadquartersFundingStatus(h.edge)).fundedCents,0);
  const applied=await settleHeadquartersFundingCheckout(h.edge,{
    id:'cs_hq_test',metadata:{civweave_schema:HQ_STARLING_FUNDING_SCHEMA,civweave_contribution_id:created.contributionId}
  });
  assert.equal(applied.backingCents,941);
  const fundedStatus=await publicHeadquartersFundingStatus(h.edge);
  assert.equal(fundedStatus.fundedCents,941);
  assert.equal(fundedStatus.billingMode,'ai-gateway-prepaid-unified');
  assert.equal(fundedStatus.estimatedGatewayCreditCents,Math.floor(941*10000/10500));
  assert.equal(fundedStatus.creditLoadConfirmed,false);
  assert.equal('estimatedPurchasedNeurons' in fundedStatus,false);
  const again=await settleHeadquartersFundingCheckout(h.edge,{
    id:'cs_hq_test',metadata:{civweave_schema:HQ_STARLING_FUNDING_SCHEMA,civweave_contribution_id:created.contributionId}
  });
  assert.equal(again.duplicate,true);
  await handleHeadquartersFundingPaymentEvent(h.edge,{type:'charge.refunded',data:{object:{id:'ch_hq_test',amount_refunded:500}}});
  assert.equal((await publicHeadquartersFundingStatus(h.edge)).fundedCents,470);
  await handleHeadquartersFundingPaymentEvent(h.edge,{type:'charge.dispute.created',data:{object:{id:'dp_test',charge:'ch_hq_test',amount:500}}});
  assert.equal((await publicHeadquartersFundingStatus(h.edge)).fundedCents,0);
});
test('unknown Stripe money event is not consumed by headquarters funding',async()=>{
  const h=harness();
  assert.deepEqual(await handleHeadquartersFundingPaymentEvent(h.edge,{
    type:'checkout.session.completed',data:{object:{metadata:{civweave_schema:'civweave.node-money-topup.v2'}}}
  }),{matched:false});
});
