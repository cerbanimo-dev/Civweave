import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
globalThis.document={getElementById:()=>null};globalThis.localStorage={getItem:()=>null,setItem(){}};
const {assertGenerationActive,generationCancelled}=await import('../public/app/cabinets/living-school/living-school-cleanroom-core-v218-base.mjs');

const path='public/app/living-school-local-research-v243.mjs';
const source=fs.readFileSync(path,'utf8');

assert.ok(!source.includes("provider!=='gemini'"),'Living School research fallback must not require Gemini.');
assert.ok(!source.includes('A Gemini interactive profile is not configured for the training-data fallback.'),'Legacy Gemini-only failure remains.');
assert.ok(source.includes("sourceType:'model-training-knowledge'"),'Fallback sources must use provider-neutral model-training provenance.');
assert.ok(source.includes("provenance:'selected-model-training-data'"),'Fallback sources must record selected-model provenance.');
assert.ok(source.includes('Treat every returned note as model-derived and unverified regardless of provider.'),'Provider-neutral fallback safety contract is missing.');

const transformed=source
  .replace("import * as core from './cabinets/living-school/living-school-cleanroom-core-v218.mjs';","const core=globalThis.__core;")
  .replace("import {searchDownloadedKnowledge,stageMissingSupplementalForQuery} from './knowledge-school-runtime-v243.mjs?v=topic-gap-recovery-v267';","const {searchDownloadedKnowledge,stageMissingSupplementalForQuery}=globalThis.__knowledge;")
  .replace('export async function researchCapability','async function researchCapability')
  +'\nglobalThis.__livingSchoolResearchTestApi={researchCapability};\n';

new vm.Script(transformed,{filename:path});

const state={sources:[],research:null};
const persistRows=[];
const generateCalls=[];
let uid=0;
const core={
  assertGenerationActive,generationCancelled,
  clean(value,max=12000){return String(value??'').trim().slice(0,max)},
  state(){return state},
  uid(prefix='id'){uid+=1;return `${prefix}-${uid}`},
  now(){return '2026-09-02T01:00:00.000Z'},
  persist(type,payload){persistRows.push({type,payload});return payload}
};
const runtime={
  readSharedConfig(profile){
    if(profile==='agentic')return{provider:'server-auto',route:'server-auto',model:'civweave-server-auto-v1'};
    if(profile==='interactive')return{provider:'server-auto',route:'server-auto',model:'civweave-server-auto-v1',maxTokens:4096,temperature:.2};
    return null;
  },
  async generate(request){
    generateCalls.push(request);
    assert.equal(request.purpose,'living-school-training-data-research-fallback-v260','Only the model-derived research fallback should generate in this fixture.');
    assert.equal(request.config.provider,'server-auto','Research fallback must preserve the selected server-auto provider.');
    assert.equal(request.config.route,'server-auto','Research fallback must preserve the selected server-auto route.');
    return{
      status:'success',
      outputJson:{
        summary:'A cautious introduction to manifestation as a goal-setting and reflection practice.',
        notes:[
          {title:'Intent and attention',use:'core',content:'Treat manifestation as a structured way to clarify intentions, direct attention, and choose actions rather than as proof that thoughts control external events.',uncertainty:'Claims of supernatural causation require external evidence.'},
          {title:'From intention to action',use:'example',content:'Translate an intention into observable steps, feedback, and revision before applying the skill to a web-app project.',uncertainty:'Implementation details should be verified against current technical documentation.'}
        ]
      },
      actual:{provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'}
    };
  }
};
const sandbox={
  console,
  URL,
  setTimeout,
  clearTimeout,
  globalThis:null,
  __core:core,
  __knowledge:{async searchDownloadedKnowledge(){return[]},async stageMissingSupplementalForQuery(){return{attempted:0,stored:0,cached:0,failed:0,errors:[]}}},
  CivweaveFamilyAILoaderV105:{async ensure(){}},
  CivweaveModelRuntime:runtime
};
sandbox.globalThis=sandbox;
vm.runInNewContext(transformed,sandbox,{filename:path});

const packet=await sandbox.__livingSchoolResearchTestApi.researchCapability('principles of manifestation and using the skill to create a web app',{force:true});
assert.equal(packet.mode,'model-derived-unverified');
assert.equal(packet.provider,'cloudflare-workers-ai');
assert.equal(packet.model,'@cf/zai-org/glm-4.7-flash');
assert.equal(packet.sources.length,2);
assert.ok(packet.sources.every(source=>source.sourceType==='model-training-knowledge'));
assert.ok(packet.sources.every(source=>source.provenance==='selected-model-training-data'));
assert.ok(packet.sources.every(source=>source.verified===false&&source.liveFetched===false&&!source.url));
assert.equal(generateCalls.length,1,'The selected AI fallback should make one successful model call.');
assert.equal(state.research.mode,'model-derived-unverified');
assert.equal(state.research.sourceCount,2);
assert.ok(!persistRows.some(row=>row.type==='living-school-research-unavailable'),'Successful selected-AI fallback must not persist research-unavailable.');


const localState={sources:[],research:null},localEvents=[];
let supplementalDownloaded=false,topicRecoveryCalls=0,unexpectedModelCalls=0;
const localSandbox={
  ...sandbox,
  __core:{...core,state(){return localState},persist(type,payload){localEvents.push({type,payload});return payload}},
  __knowledge:{
    async searchDownloadedKnowledge(){
      if(!supplementalDownloaded)return[];
      return[{title:'Major Arcana',articleTitle:'Major Arcana',canonicalUrl:'https://en.wikipedia.org/wiki/Major_Arcana',schoolSlug:'philosophy-and-religion',schoolName:'School of Philosophy and Religion',notes:'The Major Arcana are twenty-two named cards in a tarot deck. The Fool, Magician and High Priestess are examples. Many tarot decks distinguish the Major Arcana from the four-suited Minor Arcana. These symbols and correspondences vary between tarot traditions, so named meanings need to be compared against a specified deck and tradition. An instructional source can explain the visual symbolism and the way the cards are arranged.'}];
    },
    async stageMissingSupplementalForQuery(query){
      topicRecoveryCalls++;
      assert.match(query,/arcana/i);
      supplementalDownloaded=true;
      return{attempted:1,stored:1,cached:0,failed:0,errors:[]};
    }
  },
  document:{documentElement:{dataset:{livingSchoolGenerationActive:'true'}},querySelector:()=>null},
  CivweaveModelRuntime:{
    readSharedConfig(profile){return profile==='agentic'?{model:'server-auto',provider:'server-auto'}:null},
    async generate(){unexpectedModelCalls++;throw new Error('Model must not run when downloaded subject sources are usable.')}
  }
};
localSandbox.globalThis=localSandbox;
vm.runInNewContext(transformed,localSandbox,{filename:path});
const localPacket=await localSandbox.__livingSchoolResearchTestApi.researchCapability('Understand the Major and Minor Arcana and elemental correspondences',{force:true});
assert.equal(localPacket.mode,'local-downloaded');
assert.equal(localPacket.sources.length,1);
assert.equal(localPacket.sources[0].url,'https://en.wikipedia.org/wiki/Major_Arcana');
assert.equal(localPacket.sources[0].provenance,'knowledge-school-downloaded');
assert.equal(topicRecoveryCalls,1);
assert.equal(unexpectedModelCalls,0);
assert.ok(localEvents.some(event=>event.type==='living-school-subject-source-recovery'&&event.payload.downloaded===1));
assert.equal(localState.research.sourceCount,1);

console.log('Living School selected-AI research fallback and catalog-backed local gap recovery checks passed.');
