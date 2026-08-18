import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('public/app/guide-chat-response-integrity-v1.js','utf8');
const events=[];
const sandbox={
  console,
  document:{readyState:'loading',scripts:[],head:{append(){}},addEventListener(){}},
  addEventListener(){},
  dispatchEvent(event){events.push(event)},
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  setTimeout(){return 0},
  clearTimeout(){},
  URL,
  location:{href:'https://civweave-staging.pages.dev/app/working-campus-v156.html'}
};
sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox,{filename:'guide-chat-response-integrity-v1.js'});
const api=sandbox.CivweaveGuideChatResponseIntegrityV1;
if(!api)throw new Error('Guide chat response integrity API did not install.');

const complete=api.visibleText('{"answer":"Clean answer","choice":{"nextAction":"Continue"}}');
if(complete!=='Clean answer')throw new Error(`Complete JSON envelope leaked: ${complete}`);
const clipped=api.visibleText('{"answer":"Partial but readable answer');
if(clipped!=='Partial but readable answer')throw new Error(`Clipped JSON answer was not recovered: ${clipped}`);
const plain=api.visibleText('Ordinary assistant prose.');
if(plain!=='Ordinary assistant prose.')throw new Error('Plain assistant prose was changed.');

const test=api.testResult('civweave');
if(!test?.response?.answer?.includes('Weaveling')||!test.response.answer.includes('Quest'))throw new Error('Weaveling test response lost canonical identity.');
if(/love themselves|current wish|saved/i.test(test.response.answer))throw new Error('Test response is contaminated by prior working memory.');
if(test.provider!=='chat-integrity-local')throw new Error('Test response should not spend a generative provider call.');

sandbox.CivweaveUnifiedChatSystemV1={
  curriculumIntent(text){return /learning path/i.test(text)},
  async runLivingSchoolCurriculum(){return{response:{answer:'Learning Journey created.',choice:{mode:'Learn',system:'living-school',nextAction:'Review it.'}},provider:'living-school-learning-engine',model:'test'}}
};
const learning=await api.learningJourneyResult({text:'make a learning path that teaches parents gentle parenting',history:[]},'living-school');
if(learning?.response?.answer!=='Learning Journey created.')throw new Error('Moss structured learning request did not use the canonical Learning Journey capability.');
if(learning?.provider!=='living-school-learning-engine')throw new Error('Moss structured learning request fell through to ordinary chat generation.');

if(!events.some(event=>event.type==='civweave:response-route'))throw new Error('Integrity paths did not publish route decisions for the MiniLM strip.');
console.log('Guide chat response integrity verified: raw JSON hidden, clipped answers recovered, Test isolated from memory, and Moss Learning Journeys use the canonical capability.');
