import {
  deterministicDraft, deterministicMatches, deterministicReview, deterministicAssembly,
  deterministicProposal, deterministicProviderProfile, deterministicMarketSignals, parseLooseJSON
} from '../ai.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const draft = deterministicDraft('I need two people and a pickup truck Saturday. I can pay $80 or trade design help.', 'need');
assert(draft.category === 'Transport', 'Draft should classify transport');
assert(draft.amount === 80, 'Draft should extract amount');
assert(draft.partial === true, 'Draft should allow partial fulfillment');
assert(draft.methods.includes('Cash') && draft.methods.includes('Barter'), 'Draft should extract exchange methods');

const threads = [
  { id:'need', ownerId:'me', mode:'need', title:'Move a sofa Saturday', description:'Need a pickup truck and one helper', category:'Transport', methods:['Cash'], area:'Watertown', partial:true, status:'open' },
  { id:'offer', ownerId:'p1', mode:'offer', title:'Truck and hauling', description:'Pickup truck for furniture moves', category:'Transport', methods:['Cash','Barter'], area:'Watertown', partial:false, status:'open' },
  { id:'food', ownerId:'p2', mode:'offer', title:'Fresh bread', description:'Sourdough loaves Friday', category:'Food', methods:['Cash'], area:'Watertown', partial:false, status:'open' }
];
const matches = deterministicMatches(threads[0],threads,[{id:'p1',name:'Mara'}]);
assert(matches[0]?.threadId === 'offer', 'Semantic matching should rank truck offer first');
assert(matches[0].score > 50, 'Strong match should have useful score');

const review = deterministicReview({ title:'Fix my roof', description:'The roof leaks', category:'Repair', methods:[], area:'', when:'', quantity:'', amount:null });
assert(review.issues.some((item) => item.severity === 'high'), 'Safety-sensitive review should include a high-severity item');
assert(review.issues.some((item) => /Compensation/.test(item.title)), 'Review should flag unclear compensation');

const assembly = deterministicAssembly(threads[0],matches,threads,[{id:'p1',name:'Mara'}]);
assert(assembly.contributions.length === 1, 'Assembly should use visible complementary offer');
assert(assembly.contributions.every((item) => item.status === 'suggested'), 'Assembly contributions must remain unconfirmed');

const proposal = deterministicProposal(threads[0],{name:'Cami'});
assert(proposal.message && proposal.checklist.length >= 3, 'Proposal helper should create reviewable terms');

const provider = deterministicProviderProfile('I can design flyers, organize events, and teach beginners.',{});
assert(provider.suggestedOffers.length >= 2, 'Provider helper should create offer options');

const signals = deterministicMarketSignals(threads);
assert(signals.signals.length >= 2, 'Market signals should group categories');

assert(parseLooseJSON('```json\n{"ok":true}\n```').ok === true, 'Loose JSON parser should accept fenced JSON');
console.log('Fellowfare Loom deterministic tests passed.');
