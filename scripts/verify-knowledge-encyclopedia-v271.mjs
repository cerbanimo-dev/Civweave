import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {classifyKnowledgeQuestion,buildKnowledgeContext,PERSONALITY_MATRICES} from '../public/app/shared/knowledge-encyclopedia-v271.mjs';

const systems={
  civweave:'Weaveling',
  'living-school':'Moss',
  cerbanimo:'Kamiya',
  fellowfare:'Rook',
  anarchadia:'Merlin'
};

assert.deepEqual(Object.keys(PERSONALITY_MATRICES).sort(),Object.keys(systems).sort(),'all five guide personality matrices must exist');
for(const [system,guide] of Object.entries(systems))assert.equal(PERSONALITY_MATRICES[system].guide,guide,`${system} must keep the correct guide personality`);

assert.equal(classifyKnowledgeQuestion('What is photosynthesis?').eligible,true);
assert.equal(classifyKnowledgeQuestion('How do I build a dovetail joint?').eligible,true,'how-to knowledge should enter encyclopedia mode');
assert.equal(classifyKnowledgeQuestion('Who are you?').eligible,false,'assistant identity should not search the encyclopedia');
assert.equal(classifyKnowledgeQuestion('Can you build me a bookshelf?').eligible,false,'direct action requests should remain actions');
assert.equal(classifyKnowledgeQuestion('Who is the president of France?').reason,'freshness-sensitive','current office holders require fresh information');
assert.equal(classifyKnowledgeQuestion('What is the latest weather forecast?').reason,'freshness-sensitive','weather/current queries must not use archived knowledge as fresh verification');

let searches=0;
const fakeSearch=async(query,{limit,maxSchools})=>{
  searches+=1;
  assert.equal(limit,5);
  assert.equal(maxSchools,12);
  return[{title:'Photosynthesis',articleTitle:'Photosynthesis',schoolName:'Science',canonicalUrl:'https://example.invalid/photosynthesis',notes:'Photosynthesis converts light energy into chemical energy in organisms such as plants.',score:42}];
};
for(const [system,guide] of Object.entries(systems)){
  const context=await buildKnowledgeContext('What is photosynthesis?',system,{search:fakeSearch});
  assert.equal(context.mode,'local-encyclopedia');
  assert.equal(context.searched,true);
  assert.equal(context.sources.length,1);
  assert.equal(context.personality.guide,guide);
  assert.match(context.sources[0].provenance,/not live-checked/i);
}
assert.equal(searches,5,'each guide should perform the local context search for a knowledge question');

const beforeFresh=searches;
const fresh=await buildKnowledgeContext('Who is the president of France?','civweave',{search:fakeSearch});
assert.equal(fresh.searched,false);
assert.equal(searches,beforeFresh,'freshness-sensitive questions must not search the archived local encyclopedia');

const bridge=await readFile(new URL('../public/app/knowledge-encyclopedia-bridge-v271.js',import.meta.url),'utf8');
const loader=await readFile(new URL('../public/app/family-ai-loader-v105.js',import.meta.url),'utf8');
assert.match(bridge,/civweave-guide-response-v141/,'bridge must intercept shared guide model generation');
assert.match(bridge,/questDraft:null/,'knowledge mode must explicitly suppress quest drafting');
assert.match(bridge,/patchCompose/,'realm action composition must be bypassed for knowledge questions');
assert.match(bridge,/patchPlanner/,'Weaveling intention creation must be bypassed for knowledge questions');
assert.match(loader,/knowledge-encyclopedia-bridge-v271\.js/,'family loader must load the encyclopedia bridge');
assert.match(loader,/knowledgeRevision:'v271-local-encyclopedia'/,'family loader must advertise the encyclopedia revision');

console.log('knowledge encyclopedia v271 verified: five personalities, local retrieval, action suppression, and freshness boundary');
