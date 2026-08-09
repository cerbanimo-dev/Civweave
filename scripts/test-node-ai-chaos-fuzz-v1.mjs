import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {NodeAiLedger} from '../lib/node-ai-ledger-sqlite-v1.mjs';

const defaults={runs:4,operations:3000,nodes:3,users:6,seed:'civweave-node-ai-chaos-v1'};
const startMs=Date.parse('2026-08-09T00:00:00Z');
const summaryWindow={periodStart:'2026-01-01T00:00:00Z',periodEnd:'2035-01-01T00:00:00Z'};
const iso=ms=>new Date(ms).toISOString();
const total=xs=>xs.reduce((n,v)=>n+Number(v||0),0);

function args(argv){
  const out={...defaults};
  for(const raw of argv){const m=/^--([a-z-]+)=(.*)$/.exec(raw);if(!m)throw new Error(`Bad argument ${raw}`);const [,k,v]=m;if(k==='seed')out.seed=v;else if(['runs','operations','nodes','users'].includes(k))out[k]=Number(v);else throw new Error(`Unknown argument ${k}`)}
  for(const [k,min,max] of [['runs',1,100],['operations',100,200000],['nodes',1,12],['users',1,50]])if(!Number.isSafeInteger(out[k])||out[k]<min||out[k]>max)throw new Error(`${k} out of range`);
  return out;
}
function seed32(s){let h=2166136261>>>0;for(const c of String(s)){h^=c.codePointAt(0);h=Math.imul(h,16777619)>>>0}return h||0x9e3779b9}
function random(seed){let s=seed32(seed);const next=()=>{s^=s<<13;s>>>=0;s^=s>>>17;s>>>=0;s^=s<<5;s>>>=0;return s/0x100000000};return{int:(a,b)=>a+Math.floor(next()*(b-a+1)),bool:(p=.5)=>next()<p,pick:a=>a.length?a[Math.floor(next()*a.length)]:null}}
const fee=(gross,bps)=>Math.floor(gross*bps/10000);
const userModel=id=>({id,exists:false,balance:0,debt:0,res:new Map()});
const reserved=u=>total([...u.res.values()].map(r=>r.max));
const available=u=>Math.max(0,u.balance-reserved(u));
const mapPick=(m,rng)=>rng.pick([...m.values()]);
const otherUser=(node,id,rng)=>rng.pick([...node.users.values()].filter(u=>u.id!==id))||node.users.get(id);
function open(node){return new NodeAiLedger({databasePath:node.dbPath,nodeId:node.id,operatorId:node.operatorId,platformFeeBps:node.bps})}
function removeReservation(node,r){node.resOwners.delete(r.id);node.users.get(r.userId)?.res.delete(r.id)}
async function mustThrow(fn,label){let e=null;try{await fn()}catch(err){e=err}assert.ok(e,`${label}: expected failure`)}

function checkUser(node,u,ctx){
  const w=node.ledger.getWallet(u.id);
  if(!u.exists){assert.equal(w,null,`${ctx}: unexpected wallet`);return}
  assert.ok(w,`${ctx}: missing wallet`);
  assert.equal(w.balanceCents,u.balance,`${ctx}: balance`);
  assert.equal(w.debtCents,u.debt,`${ctx}: debt`);
  assert.equal(w.reservedCents,reserved(u),`${ctx}: reserved`);
  assert.equal(w.availableCents,available(u),`${ctx}: available`);
  assert.ok(w.balanceCents>=0&&w.debtCents>=0,`${ctx}: negative state`);
  assert.ok(w.reservedCents<=w.balanceCents,`${ctx}: unbacked reservation`);
  if(w.debtCents>0)assert.equal(w.availableCents,0,`${ctx}: debt with spendable credit`);
}
function deepCheck(node,ctx){
  for(const u of node.users.values())checkUser(node,u,ctx);
  const expectedWallets=[...node.users.values()].filter(u=>u.exists);
  const walletRows=node.ledger.db.prepare('SELECT user_id,balance_cents,debt_cents FROM node_ai_wallets WHERE node_id=?').all(node.id);
  assert.equal(walletRows.length,expectedWallets.length,`${ctx}: wallet row count`);
  const rRows=node.ledger.db.prepare('SELECT reservation_id,user_id,max_retail_cost_cents FROM node_ai_reservations WHERE node_id=?').all(node.id);
  assert.equal(rRows.length,node.resOwners.size,`${ctx}: reservation row count`);
  for(const row of rRows){const r=node.resOwners.get(row.reservation_id);assert.ok(r,`${ctx}: unknown durable reservation`);assert.equal(row.user_id,r.userId);assert.equal(Number(row.max_retail_cost_cents),r.max)}
  const pCount=Number(node.ledger.db.prepare('SELECT COUNT(*) c FROM node_ai_payment_events WHERE node_id=?').get(node.id)?.c||0);
  assert.equal(pCount,node.sources.size,`${ctx}: payment-event count`);
  const balanceLedger=Number(node.ledger.db.prepare("SELECT COALESCE(SUM(amount_cents),0) v FROM node_ai_ledger WHERE node_id=? AND kind!='cerbanimo-platform-fee-accrual'").get(node.id)?.v||0);
  assert.equal(balanceLedger,total(expectedWallets.map(u=>u.balance)),`${ctx}: conserved wallet value`);
  const feeLedger=Number(node.ledger.db.prepare("SELECT COALESCE(SUM(amount_cents),0) v FROM node_ai_ledger WHERE node_id=? AND kind='cerbanimo-platform-fee-accrual'").get(node.id)?.v||0);
  assert.equal(feeLedger,node.summary.platformFeeDueCents,`${ctx}: fee ledger`);
  const s=node.ledger.settlementSummary(summaryWindow),e=node.summary;
  for(const k of ['topupCount','grossTopupsCents','processorFeesCents','userCreditsIssuedCents','platformFeeDueCents','nodeNetCashCents','usageReceiptCount'])assert.equal(s[k],e[k],`${ctx}: summary ${k}`);
}

async function opTopup(node,u,rng,state){
  if(node.sources.size&&rng.bool(.28)){
    const prior=mapPick(node.sources,rng),actor=rng.bool(.82)?node.users.get(prior.userId):otherUser(node,prior.userId,rng),gross=rng.int(1,5000),processor=rng.int(0,Math.floor(gross*.08));
    if(actor.id!==prior.userId)await mustThrow(()=>node.ledger.creditTopUp({userId:actor.id,sourceId:prior.id,grossCents:gross,processorFeeCents:processor,at:iso(state.now)}),'cross-user duplicate topup');
    else assert.equal(node.ledger.creditTopUp({userId:actor.id,sourceId:prior.id,grossCents:gross,processorFeeCents:processor,at:iso(state.now)}).idempotent,true);
    return `dup-topup ${prior.id}`;
  }
  const gross=rng.int(1,5000),processor=rng.int(0,Math.floor(gross*.08)),id=`pay:${node.id}:${state.event++}`,result=node.ledger.creditTopUp({userId:u.id,sourceId:id,grossCents:gross,processorFeeCents:processor,at:iso(state.now),metadata:{chaos:true}});
  assert.equal(result.idempotent,false);const f=fee(gross,node.bps);assert.equal(result.quote.platformFeeCents,f);
  const debtPaid=Math.min(u.debt,gross);u.debt-=debtPaid;u.balance+=gross-debtPaid;u.exists=true;node.sources.set(id,{id,userId:u.id});
  const s=node.summary;s.topupCount++;s.grossTopupsCents+=gross;s.processorFeesCents+=processor;s.userCreditsIssuedCents+=gross;s.platformFeeDueCents+=f;s.nodeNetCashCents+=gross-processor-f;
  return `topup ${u.id} +${gross}`;
}
async function opAdjust(node,u,rng,state){
  if(node.sources.size&&rng.bool(.25)){
    const prior=mapPick(node.sources,rng),actor=rng.bool(.82)?node.users.get(prior.userId):otherUser(node,prior.userId,rng),amount=rng.int(1,5000);
    if(actor.id!==prior.userId)await mustThrow(()=>node.ledger.debitAdjustment({userId:actor.id,sourceId:prior.id,amountCents:amount,eventType:'payment.chargeback',at:iso(state.now)}),'cross-user duplicate adjustment');
    else assert.equal(node.ledger.debitAdjustment({userId:actor.id,sourceId:prior.id,amountCents:amount,eventType:'topup.refunded',at:iso(state.now)}).idempotent,true);
    return `dup-adjust ${prior.id}`;
  }
  const amount=rng.int(1,5000),kind=rng.bool()?'topup.refunded':'payment.chargeback',id=`adj:${node.id}:${state.event++}`;
  if(!u.exists){await mustThrow(()=>node.ledger.debitAdjustment({userId:u.id,sourceId:id,amountCents:amount,eventType:kind,at:iso(state.now)}),'adjust no wallet');return 'reject-adjust-no-wallet'}
  const recover=Math.min(available(u),amount),debt=amount-recover,result=node.ledger.debitAdjustment({userId:u.id,sourceId:id,amountCents:amount,eventType:kind,at:iso(state.now),metadata:{chaos:true}});
  assert.equal(result.recoveredCents,recover);assert.equal(result.debtAddedCents,debt);u.balance-=recover;u.debt+=debt;node.sources.set(id,{id,userId:u.id});return `${kind} ${amount}`;
}
async function opReserve(node,u,rng,state){
  if(node.resOwners.size&&rng.bool(.22)){
    const prior=mapPick(node.resOwners,rng),actor=rng.bool(.82)?node.users.get(prior.userId):otherUser(node,prior.userId,rng);
    if(actor.id!==prior.userId)await mustThrow(()=>node.ledger.reserve({userId:actor.id,reservationId:prior.id,serviceId:'general',maxRetailCostCents:rng.int(1,500),ttlSeconds:60,at:iso(state.now)}),'cross-user duplicate reservation');
    else{const x=node.ledger.reserve({userId:actor.id,reservationId:prior.id,serviceId:'changed',maxRetailCostCents:rng.int(1,500),ttlSeconds:60,at:iso(state.now)});assert.equal(x.idempotent,true);assert.equal(x.reservation.maxRetailCostCents,prior.max)}
    return `dup-reserve ${prior.id}`;
  }
  const id=`res:${node.id}:${state.res++}`,max=rng.int(1,Math.max(1,Math.min(3000,u.balance+500))),ttl=rng.int(30,300),ok=u.exists&&u.debt===0&&available(u)>=max;
  if(!ok){await mustThrow(()=>node.ledger.reserve({userId:u.id,reservationId:id,serviceId:'general',maxRetailCostCents:max,ttlSeconds:ttl,at:iso(state.now)}),'invalid reservation');return 'reject-reserve'}
  const x=node.ledger.reserve({userId:u.id,reservationId:id,serviceId:'general',maxRetailCostCents:max,ttlSeconds:ttl,at:iso(state.now),metadata:{chaos:true}});assert.equal(x.idempotent,false);
  const r={id,userId:u.id,max,expires:state.now+ttl*1000};u.res.set(id,r);node.resOwners.set(id,r);return `reserve ${id} ${max}`;
}
async function opSettle(node,u,rng,state){
  if(!node.resOwners.size||rng.bool(.18)){const id=`unknown:${state.res++}`;await mustThrow(()=>node.ledger.settle({userId:u.id,reservationId:id,actualRetailCostCents:rng.int(0,50),requestId:`req:${state.req++}`,at:iso(state.now)}),'unknown settle');return 'reject-unknown-settle'}
  const r=mapPick(node.resOwners,rng),owner=node.users.get(r.userId),actor=rng.bool(.08)?otherUser(node,r.userId,rng):owner;
  if(actor.id!==r.userId){await mustThrow(()=>node.ledger.settle({userId:actor.id,reservationId:r.id,actualRetailCostCents:0,requestId:`req:${state.req++}`,at:iso(state.now)}),'cross-user settle');return 'reject-cross-user-settle'}
  const over=rng.bool(.15),actual=over?r.max+rng.int(1,100):rng.int(0,r.max);
  if(over){await mustThrow(()=>node.ledger.settle({userId:owner.id,reservationId:r.id,actualRetailCostCents:actual,requestId:`req:${state.req++}`,at:iso(state.now)}),'over ceiling');return 'reject-over-ceiling'}
  node.ledger.settle({userId:owner.id,reservationId:r.id,actualRetailCostCents:actual,requestId:`req:${state.req++}`,at:iso(state.now),metadata:{chaos:true}});owner.balance-=actual;removeReservation(node,r);node.summary.usageReceiptCount++;return `settle ${r.id} ${actual}`;
}
async function opCancel(node,u,rng,state){
  if(!node.resOwners.size||rng.bool(.2)){const x=node.ledger.cancel({userId:u.id,reservationId:`unknown-cancel:${state.res++}`,at:iso(state.now)});assert.equal(x.cancelled,false);return 'cancel-noop'}
  const r=mapPick(node.resOwners,rng),actor=rng.bool(.1)?otherUser(node,r.userId,rng):node.users.get(r.userId),x=node.ledger.cancel({userId:actor.id,reservationId:r.id,at:iso(state.now)});
  if(actor.id!==r.userId){assert.equal(x.cancelled,false);return 'reject-cross-user-cancel'}assert.equal(x.cancelled,true);removeReservation(node,r);return `cancel ${r.id}`;
}
async function opExpire(node,rng,state){
  state.now+=rng.int(30000,600000);const gone=[...node.resOwners.values()].filter(r=>r.expires<=state.now);let count=0;for(;;){const n=node.ledger.expireReservations({at:iso(state.now),limit:5000});count+=n;if(n<5000)break}assert.equal(count,gone.length);gone.forEach(r=>removeReservation(node,r));return `expire ${count}`;
}
async function opRestart(node){node.ledger.close();node.ledger=open(node);node.restarts++;return 'restart'}
async function opEnsure(node,u){const w=node.ledger.ensureWallet({userId:u.id});u.exists=true;assert.equal(w.balanceCents,u.balance);return 'ensure'}
async function opInvalid(node,u,rng,state){
  const v=rng.int(0,4);if(v===0)await mustThrow(()=>node.ledger.creditTopUp({userId:u.id,sourceId:`bad:${state.event++}`,grossCents:0,at:iso(state.now)}),'zero topup');
  if(v===1)await mustThrow(()=>node.ledger.creditTopUp({userId:u.id,sourceId:`bad:${state.event++}`,grossCents:10,processorFeeCents:11,at:iso(state.now)}),'bad processor fee');
  if(v===2)await mustThrow(()=>node.ledger.debitAdjustment({userId:u.id,sourceId:`bad:${state.event++}`,amountCents:0,at:iso(state.now)}),'zero adjustment');
  if(v===3)await mustThrow(()=>node.ledger.reserve({userId:u.id,reservationId:`bad:${state.res++}`,serviceId:'general',maxRetailCostCents:1,ttlSeconds:1,at:iso(state.now)}),'bad ttl');
  if(v===4)await mustThrow(()=>node.ledger.settle({userId:u.id,reservationId:`bad:${state.res++}`,actualRetailCostCents:-1,at:iso(state.now)}),'negative settle');return `invalid ${v}`;
}
async function execute(node,u,rng,state){const n=rng.int(0,99);if(n<24)return opTopup(node,u,rng,state);if(n<39)return opAdjust(node,u,rng,state);if(n<59)return opReserve(node,u,rng,state);if(n<74)return opSettle(node,u,rng,state);if(n<84)return opCancel(node,u,rng,state);if(n<89)return opExpire(node,rng,state);if(n<93)return opRestart(node);if(n<96)return opEnsure(node,u);return opInvalid(node,u,rng,state)}

async function runOne({seed,operations,nodes:nodeCount,users:userCount,runIndex}){
  const rng=random(seed),dir=await mkdtemp(path.join(os.tmpdir(),'cw-ai-chaos-')),state={now:startMs,event:1,res:1,req:1},nodes=[],trace=[];
  try{
    for(let i=0;i<nodeCount;i++){const node={id:`node:chaos:${runIndex}:${i}`,operatorId:`operator:chaos:${i}`,bps:[0,750,1250,2000,3333][rng.int(0,4)],dbPath:path.join(dir,`node-${i}.sqlite`),ledger:null,users:new Map(),sources:new Map(),resOwners:new Map(),restarts:0,summary:{topupCount:0,grossTopupsCents:0,processorFeesCents:0,userCreditsIssuedCents:0,platformFeeDueCents:0,nodeNetCashCents:0,usageReceiptCount:0}};for(let j=0;j<userCount;j++){const id=`user:${runIndex}:${j}`;node.users.set(id,userModel(id))}node.ledger=open(node);nodes.push(node)}
    for(let i=0;i<operations;i++){state.now+=rng.int(1,5000);const node=rng.pick(nodes),u=rng.pick([...node.users.values()]),ctx=`seed=${seed} op=${i} node=${node.id}`;try{trace.push(`${i} ${node.id} ${await execute(node,u,rng,state)}`);if(trace.length>60)trace.shift();for(const x of node.users.values())checkUser(node,x,ctx);if(i%25===0)deepCheck(node,ctx);if(i%250===0)for(const n of nodes)deepCheck(n,`${ctx} full`)}catch(e){e.message+=`\nREPLAY: node scripts/test-node-ai-chaos-fuzz-v1.mjs --seed=${seed} --runs=1 --operations=${operations} --nodes=${nodeCount} --users=${userCount}\nLast operations:\n${trace.join('\n')}`;throw e}}
    for(const n of nodes){deepCheck(n,`${seed} final`);await opRestart(n);deepCheck(n,`${seed} reopen`)}
    return{seed,operations,restarts:total(nodes.map(n=>n.restarts)),wallets:total(nodes.map(n=>[...n.users.values()].filter(u=>u.exists).length)),events:total(nodes.map(n=>n.sources.size)),settlements:total(nodes.map(n=>n.summary.usageReceiptCount)),balanceCents:total(nodes.flatMap(n=>[...n.users.values()].map(u=>u.balance))),debtCents:total(nodes.flatMap(n=>[...n.users.values()].map(u=>u.debt)))};
  }finally{for(const n of nodes)try{n.ledger?.close()}catch{}await rm(dir,{recursive:true,force:true})}
}

const opt=args(process.argv.slice(2)),results=[];
for(let i=0;i<opt.runs;i++){const seed=opt.runs===1?opt.seed:`${opt.seed}:${i}`;results.push(await runOne({...opt,seed,runIndex:i}))}
console.log(JSON.stringify({ok:true,revision:'node-ai-chaos-fuzz-v1',baseSeed:opt.seed,runs:opt.runs,randomizedOperations:opt.runs*opt.operations,nodesPerRun:opt.nodes,usersPerNode:opt.users,invariants:['independent wallet/debt model','reservation backing','debt blocks spendable credit','payment idempotency','cross-user identifier isolation','settlement ceiling','chargeback reservation protection','durable ledger value conservation','Cerbanimo fee reconciliation','SQLite restart persistence','settlement-summary reconciliation'],totals:{restarts:total(results.map(r=>r.restarts)),wallets:total(results.map(r=>r.wallets)),events:total(results.map(r=>r.events)),settlements:total(results.map(r=>r.settlements)),balanceCents:total(results.map(r=>r.balanceCents)),debtCents:total(results.map(r=>r.debtCents))},results},null,2));
