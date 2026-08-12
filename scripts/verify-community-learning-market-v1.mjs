import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const paths={
  shared:'public/app/shared/community-learning-market-v1.mjs',
  living:'public/app/living-school-fellowfare-publish-v1.mjs',
  fellowfare:'public/app/services/fellowfare/community-learning-market-v1.mjs',
  packs:'public/app/living-school-learning-packs-v1.mjs',
  labor:'public/app/services/fellowfare/labor-context-v1.mjs'
};
const source={};
for(const [name,file] of Object.entries(paths)){
  const full=path.join(root,file);
  source[name]=await fs.readFile(full,'utf8');
  if(file.endsWith('.mjs')){
    const checked=spawnSync(process.execPath,['--check',full],{encoding:'utf8'});
    assert.equal(checked.status,0,`${file} failed node --check: ${checked.stderr||checked.stdout}`);
  }
}

for(const token of ['civweave.interactive-learning-package.v1','civweave.fellowfare.learning-listing.v1','civweave.fellowfare.learning-purchase.v1','trialSummary','buildInteractiveLearningPackage','publishLivingSchoolToFellowFare','purchaseLearningListing','communityLibrary','progress:{}','requiresLocalResolution','CivweaveCanonicalRewardsV2'])assert.ok(source.shared.includes(token),`Shared community learning contract lost ${token}`);
assert.ok(!source.shared.includes('application/pdf')&&!source.shared.includes('.pdf"')&&!source.shared.includes(".pdf'"),'Interactive learning package must never flatten curriculum into PDF output.');
for(const token of ['Sell / Tutor','Acorn price for the interactive module','Also offer tutoring for this module','USD price','Button price','not a PDF or static export','trialSummary'])assert.ok(source.living.includes(token),`Living School publisher lost ${token}`);
for(const token of ['Interactive modules & tutors','What stays interactive','quiz banks','rubrics','visualizations','media metadata','purchaseLearningListing','createTutorRequest'])assert.ok(source.fellowfare.includes(token),`FellowFare learning shelf lost ${token}`);
assert.ok(source.packs.includes("living-school-fellowfare-publish-v1.mjs"),'Living School boot path does not load its FellowFare publisher.');
assert.ok(source.labor.includes("community-learning-market-v1.mjs")&&source.labor.includes("cw-reward-ledger-v2.js"),'FellowFare boot path does not load community learning plus canonical rewards.');

class StorageMock{constructor(){this.map=new Map()}getItem(key){return this.map.has(String(key))?this.map.get(String(key)):null}setItem(key,value){this.map.set(String(key),String(value))}removeItem(key){this.map.delete(String(key))}}
globalThis.localStorage=new StorageMock();
globalThis.CustomEvent=class{constructor(type,options={}){this.type=type;this.detail=options.detail}};
globalThis.dispatchEvent=()=>true;
const market=await import(new URL(`../${paths.shared}?verify=${Date.now()}`,import.meta.url));
const school={id:'school-test',title:'Interactive Test School',capability:'Teach a small observable capability',level:'beginner',proof:'A working demonstration',generation:{formatContract:'living-school-module-contract-v218.1'},modules:[{id:'module-1',title:'Try it',summary:'Do the thing.',lessonBlocks:[{id:'lesson-1',heading:'Lesson',content:'Interactive content',sourceIds:['source-1'],provenance:'source-grounded'}],practice:{prompt:'Practice',steps:['Try it'],deliverable:'Artifact',rubric:[{criterion:'Works',weight:100}],completionCriteria:'It works'},visualization:{type:'flow',title:'Flow',caption:'Inspect it',items:[{label:'A',detail:'B'}]},quiz:{questionsPerAttempt:3,passScore:80,bank:[{id:'q1',type:'multiple-choice',prompt:'Question?',options:['Yes','No'],answer:'Yes'}],remediation:'Review'},video:{kind:'open-media',url:'blob:https://example.test/dead-runtime-url',recordKey:'video-1',contentHash:'sha256:abc',source:'civweave-open-learning-media',license:{label:'CC BY'},attribution:{creator:'Creator'}}}]};
const livingState={school,sources:[{id:'source-1',title:'Source',url:'https://example.test/source',verified:true}],passport:{learnerId:'author-1',displayName:'Author'},progress:{'module-1':{lessonComplete:true,assessmentPassed:true,attempts:[{score:100}],evidence:[{id:'e1'}]}}};
const published=await market.publishLivingSchoolToFellowFare(livingState,{acornPrice:4,tutor:{enabled:true,usdPrice:25,buttonPrice:6,priceUnit:'session',availability:'Evenings'}});
assert.equal(published.learning.acornPrice,4);assert.equal(published.tutor.usdPrice,25);assert.equal(published.tutor.buttonPrice,6);
const packagedModule=published.package.school.modules[0];
assert.equal(packagedModule.lessonBlocks[0].content,'Interactive content');assert.equal(packagedModule.quiz.bank[0].prompt,'Question?');assert.equal(packagedModule.video.url,'');assert.equal(packagedModule.video.requiresLocalResolution,true);assert.equal(packagedModule.video.portableRef.recordKey,'video-1');
const ownPurchase=await market.purchaseLearningListing(published.learning.id,{buyer:{id:'author-1',name:'Author'}});assert.equal(ownPurchase.amount,0);
const installed=JSON.parse(localStorage.getItem(market.LIVING_SCHOOL_STATE_KEY));assert.equal(installed.school.modules[0].quiz.bank[0].prompt,'Question?');assert.deepEqual(installed.progress,{});assert.equal(installed.communityLibrary.length,1);assert.equal(installed.final,null);assert.equal(installed.credential,null);

console.log('Community learning market verified: creator trial gate, interactive package preservation, fresh learner install, Acorn pricing, and USD/Button tutoring are intact.');
