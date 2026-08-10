import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { NodeMoneyEdgeService, NODE_MONEY_CHALLENGE_DOMAIN, NODE_MONEY_EVENT_SCHEMA, signNodeMoneyEdgeRequest, verifyMoneyEdgeEvent } from '../lib/node-money-edge-v1.mjs';
import { StripeConnectDirectProvider } from '../lib/node-money-edge-stripe-v1.mjs';

const pemPair=()=>{
  const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
  return {publicKey:publicKey.export({type:'spki',format:'pem'}),privateKey:privateKey.export({type:'pkcs8',format:'pem'})};
};
const challengeSignature=({nodeId,challenge,privateKey})=>{
  const raw=Buffer.from(`${nodeId}\n${challenge}`);
  const message=Buffer.concat([Buffer.from(`${NODE_MONEY_CHALLENGE_DOMAIN}\n0\n`),raw]);
  return crypto.sign(null,message,privateKey).toString('base64url');
};
const jsonResponse=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

function liveConfig(){return{liveMoneyEnabled:true,emergencyStop:false,complianceApproved:true,jurisdictionApproved:true,kycAmlReady:true,taxReportingReady:true,termsApproved:true};}

class FakeDirectProvider{
  constructor(){this.id='stripe-connect-direct-v1';this.mode='live';this.credentialsPresent=true;this.webhookVerificationReady=true;this.refundsReady=true;this.reconciliationReady=true;this.operatorPayouts='stripe-connected-account-native';this.checkoutCalls=[];this.refunds=[];this.accountCreates=0;}
  async createStandardAccount(){this.accountCreates+=1;return{id:'acct_node_1'}}
  async createAccountLink(){return{url:'https://connect.stripe.test/onboard',expires_at:2_000_000_000}}
  async retrieveAccount(){return{id:'acct_node_1',charges_enabled:true,payouts_enabled:true,details_submitted:true,requirements:{currently_due:[],past_due:[]}}}
  async createTopUpCheckout(input){this.checkoutCalls.push(input);return{id:'cs_live_1',url:'https://checkout.stripe.test/cs_live_1'}}
  async verifyTopUpSession(input){return{ok:true,sessionId:input.sessionId,paymentIntentId:'pi_1',chargeId:'ch_1',balanceTransactionId:'txn_1',processorFeeCents:59,applicationFeeCents:50,nodeNetCashCents:891}}
  verifyWebhook(){return{}}
  async refundTopUp(input){this.refunds.push(input);return{id:'re_1',amount:input.amountCents,status:'succeeded'}}
}

test('money edge issues a short-lived identity-bound grant, owns the platform fee, and rejects grant replay',async()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'cw-money-edge-'));
  const nodeKeys=pemPair(),edgeKeys=pemPair(),provider=new FakeDirectProvider();
  const delivered=[];
  const fetchImpl=async(url,options={})=>{
    const u=new URL(url);
    if(u.origin==='https://node.example'&&u.pathname==='/api/ai/node/manifest')return jsonResponse({manifest:{nodeId:'node-1',operatorId:'operator-1',publicKey:nodeKeys.publicKey,platformFee:{basisPoints:9999}}});
    if(u.origin==='https://node.example'&&u.pathname==='/api/ai/node/live/challenge'){
      const body=JSON.parse(String(options.body||'{}'));
      return jsonResponse({nodeId:body.nodeId,signature:challengeSignature({nodeId:body.nodeId,challenge:body.challenge,privateKey:nodeKeys.privateKey})});
    }
    if(u.origin==='https://node.example'&&u.pathname==='/api/ai/node/live/payments/webhook'){
      const raw=Buffer.from(options.body);
      assert.equal(verifyMoneyEdgeEvent(raw,options.headers['x-civweave-money-edge-signature'],{publicKey:edgeKeys.publicKey,now:()=>1_700_000_000_000}),true);
      delivered.push(JSON.parse(raw));
      return jsonResponse({ok:true});
    }
    throw new Error(`unexpected fetch ${u.href}`);
  };
  const service=new NodeMoneyEdgeService({databasePath:path.join(dir,'edge.sqlite'),provider,privateKey:edgeKeys.privateKey,keyId:'edge-key',platformFeeBps:500,config:liveConfig(),fetchImpl,now:()=>1_700_000_000_000});
  try{
    assert.equal(service.readiness().liveReady,true);
    assert.equal(service.readiness().platformFeeBps,500);
    const trust=service.trustDocument();
    assert.equal(trust.algorithm,'Ed25519');
    assert.equal(trust.fingerprint,crypto.createHash('sha256').update(String(edgeKeys.publicKey).trim()).digest('hex'));

    const enrollment=await service.createEnrollmentGrant({nodeId:'node-1',operatorId:'operator-1',callbackUrl:'https://node.example'});
    assert.equal(enrollment.platformFeeBps,500,'Cerbanimo fee must come from the money edge, not the node manifest');
    assert.equal(enrollment.singleUse,true);
    const registration=await service.registerNode({nodeId:'node-1',operatorId:'operator-1',callbackUrl:'https://node.example',enrollmentGrant:enrollment.token,email:'operator@example.test',country:'US'});
    assert.equal(registration.connectedAccountId,'acct_node_1');
    assert.equal(registration.platformFeeBps,500);
    assert.equal(registration.operatorPayouts,'stripe-connected-account-native');
    assert.equal(provider.accountCreates,1);
    await assert.rejects(()=>service.registerNode({nodeId:'node-1',operatorId:'operator-1',callbackUrl:'https://node.example',enrollmentGrant:enrollment.token}),/already used/i);
    assert.equal(provider.accountCreates,1,'grant replay must not create another Stripe account');

    const input={nodeId:'node-1',userId:'user-1',grossCents:1000,currency:'USD',idempotencyKey:'topup-key-1',successUrl:'https://node.example/app/federation-finder-local-v269.html?paid=1',cancelUrl:'https://node.example/app/federation-finder-local-v269.html?cancel=1'};
    const raw=Buffer.from(JSON.stringify(input));
    const sig=signNodeMoneyEdgeRequest(raw,{privateKey:nodeKeys.privateKey,keyId:'node-key',timestamp:1_700_000_000});
    const topup=await service.createTopUp(input,raw,sig);
    assert.equal(topup.platformFeeCents,50);
    assert.equal(topup.checkoutUrl,'https://checkout.stripe.test/cs_live_1');
    assert.equal(provider.checkoutCalls[0].accountId,'acct_node_1');
    assert.equal(provider.checkoutCalls[0].applicationFeeCents,50);

    const settled=await service.handleProviderEvent({id:'evt_checkout_1',type:'checkout.session.completed',account:'acct_node_1',livemode:true,data:{object:{id:'cs_live_1',payment_status:'paid'}}});
    assert.equal(settled.applied,true);
    assert.equal(delivered.length,1);
    assert.equal(delivered[0].schema,NODE_MONEY_EVENT_SCHEMA);
    assert.equal(delivered[0].type,'topup.paid');
    assert.equal(delivered[0].grossCents,1000);
    assert.equal(delivered[0].processorFeeCents,59);
    assert.equal(delivered[0].platformFeeBps,500);
    assert.equal(delivered[0].platformFeeCents,50);
    assert.equal(delivered[0].metadata.feeAuthority,'cerbanimo-money-edge');
    assert.equal(delivered[0].userCreditCents,1000);
    assert.equal(delivered[0].mintEffect,0);
    assert.equal(delivered[0].supplyEffect,0);

    const refundBody=Buffer.from(JSON.stringify({nodeId:'node-1',amountCents:400}));
    const refundSig=signNodeMoneyEdgeRequest(refundBody,{privateKey:nodeKeys.privateKey,keyId:'node-key',timestamp:1_700_000_000});
    const refund=await service.refundTopUp({nodeId:'node-1',topupId:topup.topupId,amountCents:400},refundBody,refundSig);
    assert.equal(refund.status,'succeeded');
    await service.handleProviderEvent({id:'evt_refund_1',type:'charge.refunded',account:'acct_node_1',livemode:true,data:{object:{id:'ch_1',amount_refunded:400}}});
    assert.equal(delivered.at(-1).type,'topup.refunded');
    assert.equal(delivered.at(-1).userCreditCents,400);
  }finally{service.close();rmSync(dir,{recursive:true,force:true});}
});

test('Stripe direct-charge adapter puts checkout and refund calls on the connected account and calculates processor fee separately from Cerbanimo fee',async()=>{
  const requests=[];
  const now=()=>1_700_000_000_000;
  const fetchImpl=async(url,options={})=>{
    const u=new URL(url),form=new URLSearchParams(String(options.body||''));
    requests.push({u,options,form});
    if(u.pathname==='/v1/checkout/sessions'&&options.method==='POST')return jsonResponse({id:'cs_1',url:'https://checkout.stripe.test/cs_1'});
    if(u.pathname==='/v1/checkout/sessions/cs_1')return jsonResponse({id:'cs_1',payment_status:'paid',amount_total:1000,currency:'usd',metadata:{civweave_node_id:'node-1',civweave_user_id:'user-1',civweave_topup_id:'topup-1'},payment_intent:{id:'pi_1',status:'succeeded',application_fee_amount:50,latest_charge:{id:'ch_1',status:'succeeded',balance_transaction:{id:'txn_1',fee:109}}}});
    if(u.pathname==='/v1/refunds')return jsonResponse({id:'re_1',amount:400,status:'succeeded'});
    throw new Error(`unexpected Stripe request ${u.pathname}`);
  };
  const provider=new StripeConnectDirectProvider({secretKey:'sk_live_test_value',webhookSecret:'whsec_test_value',apiBase:'https://api.stripe.test',fetchImpl,now});
  await provider.createTopUpCheckout({accountId:'acct_node_1',nodeId:'node-1',userId:'user-1',topupId:'topup-1',grossCents:1000,applicationFeeCents:50,successUrl:'https://node.example/success',cancelUrl:'https://node.example/cancel',idempotencyKey:'idem_1'});
  const checkoutReq=requests[0];
  assert.equal(checkoutReq.options.headers['stripe-account'],'acct_node_1');
  assert.equal(checkoutReq.form.get('payment_intent_data[application_fee_amount]'),'50');
  const verified=await provider.verifyTopUpSession({accountId:'acct_node_1',sessionId:'cs_1',nodeId:'node-1',userId:'user-1',topupId:'topup-1',grossCents:1000,currency:'usd'});
  assert.equal(verified.applicationFeeCents,50);
  assert.equal(verified.processorFeeCents,59);
  assert.equal(verified.nodeNetCashCents,891);
  await provider.refundTopUp({accountId:'acct_node_1',chargeId:'ch_1',amountCents:400,idempotencyKey:'refund-1'});
  const refundReq=requests.at(-1);
  assert.equal(refundReq.options.headers['stripe-account'],'acct_node_1');
  assert.equal(refundReq.form.get('refund_application_fee'),'true');

  const raw=Buffer.from(JSON.stringify({id:'evt_1',type:'checkout.session.completed',account:'acct_node_1',livemode:true}));
  const timestamp=1_700_000_000;
  const signature=crypto.createHmac('sha256','whsec_test_value').update(`${timestamp}.`).update(raw).digest('hex');
  assert.deepEqual(provider.verifyWebhook(raw,`t=${timestamp},v1=${signature}`),{id:'evt_1',type:'checkout.session.completed',account:'acct_node_1',livemode:true});

  const wrongModeRaw=Buffer.from(JSON.stringify({id:'evt_wrong_mode',type:'checkout.session.completed',account:'acct_node_1',livemode:false}));
  const wrongModeSignature=crypto.createHmac('sha256','whsec_test_value').update(`${timestamp}.`).update(wrongModeRaw).digest('hex');
  assert.throws(()=>provider.verifyWebhook(wrongModeRaw,`t=${timestamp},v1=${wrongModeSignature}`),/livemode does not match/i);
});
