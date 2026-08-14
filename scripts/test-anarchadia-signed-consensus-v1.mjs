import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canonicalJson,createCredential,sha256} from '../public/app/anarchadia-governance-kernel-v145.js';
import {CONSENSUS_SCHEMA,openSignedConsensusRound,castSignedConsensusPosition,verifySignedConsensusPosition,tallySignedConsensusRound,closeSignedConsensusRound} from '../public/app/anarchadia-consensus-kernel-v1.js';

const source=await readFile(new URL('../public/app/anarchadia-consensus-kernel-v1.js',import.meta.url),'utf8');
assert.doesNotMatch(source,/ensureLocalCitizen|participantLevels|authorityPath|localStorage|document\./,'consensus primitive must not invent electorate or authority policy');

const alice=await createCredential('Alice','member','hub');
const bob=await createCredential('Bob','member','hub');
const carol=await createCredential('Carol','member','hub');
const subject={id:'intention-demo',revisionHash:await sha256(canonicalJson({id:'intention-demo',revision:1}))};

const round=await openSignedConsensusRound(subject,{authorityLevel:'hub',electorate:[carol.record,alice.record,bob.record],quorum:.6,threshold:.67});
assert.equal(round.schema,CONSENSUS_SCHEMA);
assert.deepEqual(round.electorate.map(row=>row.actorId),[alice.record.id,bob.record.id,carol.record.id].sort());

const sameSnapshot=await openSignedConsensusRound(subject,{authorityLevel:'hub',electorate:[bob.record,carol.record,alice.record],quorum:.6,threshold:.67});
assert.equal(round.snapshotHash,sameSnapshot.snapshotHash,'electorate snapshot hash must not depend on input ordering');
await assert.rejects(()=>openSignedConsensusRound(subject,{electorate:[alice.record,alice.record]}),/Duplicate consensus credential/);

const first=await castSignedConsensusPosition(round,alice.record,alice.privateKey,'support');
assert.equal(first.sequence,1);
assert.equal(await verifySignedConsensusPosition(round,first),true);
const replacement=await castSignedConsensusPosition(round,alice.record,alice.privateKey,'support','still support');
assert.equal(replacement.sequence,2,'recasting must advance the signed sequence');
assert.equal(round.positions.length,1,'only the newest position per credential is tallied');
await castSignedConsensusPosition(round,bob.record,bob.privateKey,'support');
await castSignedConsensusPosition(round,carol.record,carol.privateKey,'abstain');
const tally=tallySignedConsensusRound(round);
assert.equal(tally.cast,3);
assert.equal(tally.totals.support,2);
assert.equal(tally.totals.abstain,1);
assert.equal(tally.quorumMet,true);
assert.equal(tally.thresholdMet,true);

const outcome=await closeSignedConsensusRound(round,subject);
assert.equal(outcome.outcome,'adopted');
assert.match(outcome.hash,/^[A-Za-z0-9_-]{40,}$/);
assert.equal(round.status,'closed');

const tamperRound=await openSignedConsensusRound(subject,{electorate:[alice.record],quorum:1,threshold:1});
const signed=await castSignedConsensusPosition(tamperRound,alice.record,alice.privateKey,'support');
signed.choice='oppose';
assert.equal(await verifySignedConsensusPosition(tamperRound,signed),false,'choice tampering must invalidate the signature');
await assert.rejects(()=>closeSignedConsensusRound(tamperRound,subject),/Invalid consensus signature/);

const driftRound=await openSignedConsensusRound(subject,{electorate:[alice.record],quorum:1,threshold:1});
await castSignedConsensusPosition(driftRound,alice.record,alice.privateKey,'support');
const revision2=await sha256('revision-2');
await assert.rejects(()=>closeSignedConsensusRound(driftRound,{...subject,revisionHash:revision2}),/changed after this round opened/);

console.log(JSON.stringify({ok:true,revision:'anarchadia-signed-consensus-round-v1',electorate:'caller-supplied-frozen-snapshot',authorityPolicy:'external',signatures:'ecdsa-p256-sha256',revisionBinding:true,snapshotBinding:true,recastSequence:true,tamperDetection:true},null,2));
