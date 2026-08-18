import assert from 'node:assert/strict';
import { addTribunalVote, tribunalDecision } from '../lib/creator-provenance-tribunal-v1.mjs';

const request={sampleId:'sample:1',creatorUserId:'creator:1',receipt:{sessionId:'creation:1',headHash:'head',receiptHash:'receipt',origin:'unknown'},reviewRequest:{reviewId:'review:1'}};
let state={votes:[]};
state=addTribunalVote(state,{outcome:'unknown-origin',confidence:0.9,rationale:'External origin remains unverified.'},{request,reviewerId:'member:a'});
assert.equal(state.votes.length,1);assert.equal(tribunalDecision(state.votes).status,'pending-human-review');
assert.throws(()=>addTribunalVote(state,{outcome:'verified'},{request,reviewerId:'member:a'}),/already voted/);
assert.throws(()=>addTribunalVote(state,{outcome:'verified'},{request,reviewerId:'creator:1'}),/creator may not review/i);
state=addTribunalVote(state,{outcome:'unknown-origin',confidence:0.8,rationale:'No trusted origin evidence was added.'},{request,reviewerId:'member:b'});
let decision=tribunalDecision(state.votes);assert.equal(decision.status,'reviewed');assert.equal(decision.outcome,'unknown-origin');assert.equal(decision.requiredVotes,2);assert.equal(decision.finding.reviewerKind,'human');assert.equal(decision.finding.outcome,'unknown-origin');

let conflict={votes:[]};
conflict=addTribunalVote(conflict,{outcome:'verified',confidence:0.7,rationale:'Supported.'},{request:{...request,creatorUserId:'creator:2'},reviewerId:'member:a'});
conflict=addTribunalVote(conflict,{outcome:'unknown-origin',confidence:0.7,rationale:'Uncertain.'},{request:{...request,creatorUserId:'creator:2'},reviewerId:'member:b'});
decision=tribunalDecision(conflict.votes);assert.equal(decision.status,'pending-human-review');assert.equal(decision.requiredVotes,3);
conflict=addTribunalVote(conflict,{outcome:'verified',confidence:0.9,rationale:'Chain supports the claim.'},{request:{...request,creatorUserId:'creator:2'},reviewerId:'member:c'});
decision=tribunalDecision(conflict.votes);assert.equal(decision.status,'reviewed');assert.equal(decision.outcome,'verified');assert.equal(decision.voteCount,3);

let split={votes:[]};
for(const [reviewer,outcome]of [['a','verified'],['b','unknown-origin'],['c','anomalous']])split=addTribunalVote(split,{outcome,confidence:0.6,rationale:'Independent review.'},{request:{...request,creatorUserId:'creator:x'},reviewerId:`member:${reviewer}`});
decision=tribunalDecision(split.votes);assert.equal(decision.status,'needs-escalation');assert.equal(decision.outcome,'needs-human-review');
assert.ok(split.votes.every(vote=>vote.detectorInferenceUsed===false&&vote.rawPacketRetained===false));

console.log('Creator provenance independent human tribunal contract passed');
