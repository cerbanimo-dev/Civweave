import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { applyLivePaymentEvent, signLiveChallenge } from '../lib/node-ai-live-commerce-v1.mjs';
import { NODE_MONEY_EVENT_SCHEMA, verifyNodeChallenge } from '../lib/node-money-edge-v1.mjs';

const pair=()=>{const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');return{publicKey:publicKey.export({type:'spki',format:'pem'}),privateKey:privateKey.export({type:'pkcs8',format:'pem'})}};

test('node proves control of its advertised receipt key for money-edge registration',()=>{
  const keys=pair(),challenge=crypto.randomBytes(32).toString('base64url');
  const signature=signLiveChallenge({nodeId:'node-1',challenge,privateKey:keys.privateKey});
  assert.equal(verifyNodeChallenge({nodeId:'node-1',challenge,publicKey:keys.publicKey,signature}),true);
  assert.equal(verifyNodeChallenge({nodeId:'node-other',challenge,publicKey:keys.publicKey,signature}),false);
});

test('verified money events reuse the durable node wallet top-up and adjustment lanes and carry zero mint authority',()=>{
  const calls=[];
  const ledger={
    creditTopUp(input){calls.push(['credit',input]);return{ok:true}},
    debitAdjustment(input){calls.push(['debit',input]);return{ok:true}}
  };
  const paid={schema:NODE_MONEY_EVENT_SCHEMA,id:'evt-1',provider:'stripe-connect-direct-v1',userId:'user-1',type:'topup.paid',grossCents:1000,processorFeeCents:59,userCreditCents:1000,externalAccountId:'acct_node_1',metadata:{topupId:'topup-1'},mintEffect:0,supplyEffect:0};
  applyLivePaymentEvent(ledger,paid);
  assert.equal(calls[0][0],'credit');
  assert.equal(calls[0][1].grossCents,1000);
  assert.equal(calls[0][1].processorFeeCents,59);
  assert.equal(calls[0][1].metadata.liveMoney,true);
  const refund={schema:NODE_MONEY_EVENT_SCHEMA,id:'evt-2',provider:'stripe-connect-direct-v1',userId:'user-1',type:'topup.refunded',userCreditCents:400,mintEffect:0,supplyEffect:0};
  applyLivePaymentEvent(ledger,refund);
  assert.equal(calls[1][0],'debit');
  assert.equal(calls[1][1].amountCents,400);
  assert.throws(()=>applyLivePaymentEvent(ledger,{...paid,id:'evt-bad',mintEffect:1}),/cannot carry mint/i);
});
