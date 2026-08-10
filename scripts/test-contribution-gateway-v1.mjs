import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ContributionGatewayBook,
  ERC20_TRANSFER_TOPIC,
  GATEWAY_PRESETS,
  addressTopic,
  validateErc20PaymentObservation,
} from '../lib/contribution-gateway-v1.mjs';

const preset = GATEWAY_PRESETS.baseUsdc;
const seller='wallet:seller', buyer='wallet:buyer';
const recipient='0x1111111111111111111111111111111111111111';
const sender='0x2222222222222222222222222222222222222222';
const txHash=`0x${'ab'.repeat(32)}`, blockHash=`0x${'cd'.repeat(32)}`;
const amount=2500000n;
function intent(id='g1') { return {
  intentId:id,sellerId:seller,buyerId:buyer,asset:'BUTTON',amount:5,transferId:`t:${id}`,
  expiresAt:'2026-08-11T00:00:00.000Z',
  external:{...preset,recipient,expectedSender:sender,amountAtomic:amount.toString(),amountPolicy:'exact'},
}; }
function observation(overrides={}) { return {
  chainId:preset.chainId,txHash,receiptStatus:'0x1',blockNumber:'0x64',blockHash,finalizedBlockNumber:'0x70',rpcObserverId:'rpc:base-a',
  log:{address:preset.tokenAddress,topics:[ERC20_TRANSFER_TOPIC,addressTopic(sender),addressTopic(recipient)],data:`0x${amount.toString(16)}`,logIndex:'0x2',removed:false},
  ...overrides,
}; }
function observe(book,id,root,device,obs=observation()) { return book.recordObservation({intentId:id,observerRootId:root,observerDeviceId:device,committeeHash:'committee:1',observation:obs}); }

test('valid Base USDC transfer proof is normalized and finalized',()=>{
  const result=validateErc20PaymentObservation(intent(),observation());
  assert.equal(result.ok,true);
  assert.match(result.proofKey,/^evm:8453:/);
  assert.equal(result.normalized.amountAtomic,amount.toString());
});

test('wrong chain, token, recipient, amount, failed receipt and non-final block are rejected',()=>{
  const cases=[
    observation({chainId:1}),
    observation({log:{...observation().log,address:'0x3333333333333333333333333333333333333333'}}),
    observation({log:{...observation().log,topics:[ERC20_TRANSFER_TOPIC,addressTopic(sender),addressTopic('0x4444444444444444444444444444444444444444')]}}),
    observation({log:{...observation().log,data:'0x1'}}),
    observation({receiptStatus:'0x0'}),
    observation({finalizedBlockNumber:'0x63'}),
  ];
  for(const row of cases) assert.equal(validateErc20PaymentObservation(intent(),row).ok,false);
});

test('gateway certification requires independent selected roots and one identical proof',()=>{
  const book=new ContributionGatewayBook();book.openIntent(intent());book.claimPayment('g1',txHash);
  observe(book,'g1','root:a','device:a');
  assert.throws(()=>book.certifyPayment({intentId:'g1',committeeRoots:['root:a','root:b','root:c'],committeeHash:'committee:1',quorum:2}),/lacks one selected-root proof quorum/);
  assert.throws(()=>observe(book,'g1','root:a','device:b'),/observer root already submitted/);
  assert.throws(()=>observe(book,'g1','root:b','device:a'),/observer device already submitted/);
  observe(book,'g1','root:b','device:b');
  const cert=book.certifyPayment({intentId:'g1',committeeRoots:['root:a','root:b','root:c'],committeeHash:'committee:1',quorum:2});
  assert.equal(cert.supplyEffect,0);assert.equal(cert.mintEffect,0);
});

test('the same external proof cannot settle two gateway intents',()=>{
  const book=new ContributionGatewayBook();
  for(const id of ['g1','g2']) {book.openIntent(intent(id));book.claimPayment(id,txHash);observe(book,id,`root:${id}:a`,`device:${id}:a`);observe(book,id,`root:${id}:b`,`device:${id}:b`);}
  book.certifyPayment({intentId:'g1',committeeRoots:['root:g1:a','root:g1:b'],committeeHash:'committee:1',quorum:2});
  assert.throws(()=>book.certifyPayment({intentId:'g2',committeeRoots:['root:g2:a','root:g2:b'],committeeHash:'committee:1',quorum:2}),/already consumed/);
});

test('gateway never mints contribution currency and settles only after transfer certificate',()=>{
  const book=new ContributionGatewayBook();book.openIntent(intent());book.claimPayment('g1',txHash);observe(book,'g1','root:a','device:a');observe(book,'g1','root:b','device:b');book.certifyPayment({intentId:'g1',committeeRoots:['root:a','root:b'],committeeHash:'committee:1',quorum:2});
  assert.throws(()=>book.settle({intentId:'g1'}),/transfer certificate/);
  const settled=book.settle({intentId:'g1',transferCertificateHash:'sha256:transfercert'});assert.equal(settled.status,'settled');
  for(const event of book.events){assert.notEqual(event.type,'MintFinalized');assert.equal(event.payload.mintEffect??0,0);assert.equal(event.payload.supplyEffect??0,0);}
});

test('cancellation and expiry release the gateway state only before payment certification',()=>{
  const book=new ContributionGatewayBook();book.openIntent(intent('cancel'));assert.equal(book.cancel('cancel').status,'cancelled');
  book.openIntent(intent('expire'));assert.equal(book.expire('expire',Date.parse('2026-08-12T00:00:00Z')).status,'expired');
  book.openIntent(intent('cert'));book.claimPayment('cert',txHash);observe(book,'cert','root:a','device:a');observe(book,'cert','root:b','device:b');book.certifyPayment({intentId:'cert',committeeRoots:['root:a','root:b'],committeeHash:'committee:1',quorum:2});
  assert.throws(()=>book.cancel('cert'),/cannot be cancelled/);
});

test('late external proof dispute is append-only and does not rewrite settlement',()=>{
  const book=new ContributionGatewayBook();book.openIntent(intent());book.claimPayment('g1',txHash);observe(book,'g1','root:a','device:a');observe(book,'g1','root:b','device:b');book.certifyPayment({intentId:'g1',committeeRoots:['root:a','root:b'],committeeHash:'committee:1',quorum:2});book.settle({intentId:'g1',transferCertificateHash:'sha256:t'});
  const before=book.events.length;const status=book.dispute('g1','provider-reorg-alert');assert.equal(status.status,'disputed-settled');assert.equal(book.events.length,before+1);assert.ok(book.events.some(e=>e.type==='GatewaySettledV1'));
});
