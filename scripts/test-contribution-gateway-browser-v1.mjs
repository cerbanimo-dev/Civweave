import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto,createHash} from 'node:crypto';

function norm(v){if(Array.isArray(v))return v.map(norm);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,norm(v[k])]));return v}
async function hashObject(v){return`sha256:${createHash('sha256').update(JSON.stringify(norm(v))).digest('hex')}`}
function topic(address){return`0x${'0'.repeat(24)}${address.toLowerCase().slice(2)}`}
const recipient='0x1111111111111111111111111111111111111111',sender='0x2222222222222222222222222222222222222222';

test('browser gateway exports Base presets, keeps mainnet opt-in, and validates finalized USDC proof',async()=>{
  const local=new Map();
  const context={console,crypto:webcrypto,TextEncoder,structuredClone,btoa,atob,setTimeout,clearTimeout,fetch:async()=>{throw new Error('unused')},location:{href:'https://civweave.test/',origin:'https://civweave.test'},navigator:{onLine:true},localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,String(v))},document:{readyState:'complete',documentElement:{dataset:{civweaveSystem:'test'}},querySelector:()=>null,addEventListener:()=>{}},dispatchEvent:()=>{},CustomEvent:class{},indexedDB:{open:()=>{throw new Error('unused')}},CivweaveContributionMeshV1:{version:'mesh+committee',DB_NAME:'x',hashObject,walletIdForKey:async()=> 'wallet:x',credentials:async()=>({deviceId:'device:x'}),security:{committeeFor:async()=>({}),secureWalletIdentity:async()=>({walletId:'wallet:x'}),launchStatus:async()=>({eligibleValidatorRoots:3})}},};context.globalThis=context;vm.createContext(context);vm.runInContext(await readFile(new URL('../public/app/shared/civweave-contribution-gateway-v1.js',import.meta.url),'utf8'),context);
  const api=context.CivweaveContributionGatewayV1;assert.ok(api);assert.equal(api.presets.base.chainId,8453);assert.equal(api.presets.base.tokenAddress.toLowerCase(),'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');assert.equal(api.presets.baseSepolia.chainId,84532);assert.equal(api.settings().allowMainnet,false);api.setSettings({enabled:true});assert.equal(api.settings().enabled,true);
  const amount=2500000n,checked=api.validateErc20Observation({external:{chainId:8453,tokenAddress:api.presets.base.tokenAddress,recipient,expectedSender:sender,amountAtomic:amount.toString(),amountPolicy:'exact'}},{chainId:8453,txHash:`0x${'ab'.repeat(32)}`,receiptStatus:'0x1',blockNumber:'0x64',blockHash:`0x${'cd'.repeat(32)}`,finalizedBlockNumber:'0x65',log:{address:api.presets.base.tokenAddress,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',topic(sender),topic(recipient)],data:`0x${amount.toString(16)}`,logIndex:'0x1'}});assert.equal(checked.ok,true);assert.match(checked.proofKey,/^evm:8453:/);
});

test('runtime contains a hard local finality and balance gate for gateway-linked transfers',async()=>{
  const source=await readFile(new URL('../public/app/shared/civweave-contribution-gateway-v1.js',import.meta.url),'utf8');
  assert.match(source,/gateway-linked transfer requires committee-certified external payment/);
  assert.match(source,/async function witnessTransfer\(transferId/);
  assert.match(source,/async function finalizeTransfer\(transferId/);
  assert.match(source,/async function gatewayBalanceCorrection\(ownerId,asset/);
  assert.match(source,/at\(paymentCertificate\)<=at\(transferCertificate\)/);
  assert.match(source,/status:'gateway-payment-required',secureFinal:false/);
  assert.match(source,/const wrapped=Object\.freeze\(\{\.\.\.prior,balance,availableBalance,transferStatus,witnessTransfer,finalizeTransfer/);
  assert.match(source,/externalValueCanMint:false/);
  assert.doesNotMatch(source,/apiKey|secretKey|privateRpcKey/i);
});
