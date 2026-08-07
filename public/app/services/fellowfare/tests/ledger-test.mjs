import {
  createAgreementFromProposal, normalizeAgreement, agreementProgress, addMilestone, completeMilestone,
  addEvidence, recordSettlement, openRepair, resolveRepair, addReview, advanceRecurringAgreement,
  createLedgerEvent, buildCivweaveBundle, trustSnapshotFromReviews
} from '../ledger.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const thread = { id:'t1', ownerId:'p1', title:'Repair the garden gate', description:'Repair the hinge and test the latch.', category:'Repair', amount:80, amountLabel:'$80', methods:['Cash'], when:'next week' };
const proposal = { id:'p1', threadId:'t1', fromId:'me', message:'I can replace the hinge and test the latch.', compensation:'$75', when:'next week', conditions:'Materials included', createdAt:'2026-07-29T12:00:00.000Z' };
let agreement = createAgreementFromProposal(proposal, thread, [], { actorId:'me', id:'a1', milestoneId:'m1', createdAt:'2026-07-29T12:00:00.000Z' });
assert(agreement.id === 'a1' && agreement.milestones.length === 1, 'Accepted proposal should become an agreement with a milestone');
assert(agreement.settlement.amount === 75 && agreement.settlement.currency === 'USD', 'Settlement should infer the offered USD amount');
agreement.participants.forEach((participant) => participant.confirmedAt = '2026-07-29T12:05:00.000Z');
agreement = normalizeAgreement(agreement);
assert(agreement.status === 'active', 'Confirmed agreement should become active');
addMilestone(agreement,{id:'m2',title:'Requester inspects latch',ownerId:'p1'});
assert(agreementProgress(agreement) === 0, 'New milestones should begin pending');
completeMilestone(agreement,'m1','2026-07-30T12:00:00.000Z');
assert(agreementProgress(agreement) === 50, 'Completing one of two milestones should yield 50% progress');
const proof = addEvidence(agreement,{id:'e1',label:'Hinge receipt',kind:'receipt',note:'Receipt number 42'},'m1');
assert(agreement.milestones[0].evidenceIds.includes(proof.id), 'Evidence should attach to a milestone');
completeMilestone(agreement,'m2','2026-07-30T13:00:00.000Z');
assert(agreement.status === 'fulfilled', 'Completing every milestone should fulfill the agreement');
recordSettlement(agreement,{method:'Cash',amount:75,note:'Paid in person'},'2026-07-30T14:00:00.000Z');
assert(agreement.status === 'settled', 'Fulfillment plus settlement should settle the agreement');
openRepair(agreement,{issue:'Latch sticks','requestedRemedy':'Adjust latch'},'2026-07-30T15:00:00.000Z');
assert(agreement.status === 'repair', 'Open repair should supersede settled status');
resolveRepair(agreement,'Latch adjusted','2026-07-30T16:00:00.000Z');
assert(agreement.status === 'settled', 'Resolved repair should return to derived settled status');
const review = addReview(agreement,{fromId:'me',toId:'p1',context:'Gate repair',ratings:{communication:5,reliability:4,quality:5,repair:5},note:'Clear and repairable.'});
const trust = trustSnapshotFromReviews({communication:80,reliability:80,quality:80,repair:80},[review]);
assert(trust.communication > 80 && trust.quality > 80, 'Contextual review should update trust snapshot');
agreement.recurrence={enabled:true,cadence:'monthly',nextAt:'2026-08-01T12:00:00.000Z'};
advanceRecurringAgreement(agreement,'2026-08-01T12:00:00.000Z');
assert(agreement.status === 'active' && agreement.settlement.status === 'pending' && agreementProgress(agreement) === 0, 'Recurring cycle should reset execution state without deleting terms');
const event=createLedgerEvent('milestone.completed','agreement','a1','me',{milestoneId:'m1'},'2026-07-30T12:00:00.000Z');
const bundle=buildCivweaveBundle({version:'0.3.0',profile:{id:'me',settings:{ai:{apiKey:'secret'}}},people:[{id:'p1'}],threads:[thread],proposals:[proposal],assemblies:[],agreements:[agreement],ledgerEvents:[event]},{version:'0.3.0'});
assert(bundle.format === 'civweave.exchange-bundle' && bundle.entities.agreements.length === 1, 'Civweave bundle should carry agreements');
assert(!bundle.entities.people[0].settings?.ai?.apiKey, 'Civweave bundle must strip model secrets');
assert(bundle.mapping.evidence === 'proof.item' && bundle.events[0].type === 'milestone.completed', 'Bundle should publish semantic mappings and event history');
console.log('Fellowfare exchange ledger tests passed.');
