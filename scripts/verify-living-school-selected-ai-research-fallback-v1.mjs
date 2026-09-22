import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const path='public/app/living-school-local-research-v243.mjs';
const source=fs.readFileSync(path,'utf8');

assert.ok(!source.includes("provider!=='gemini'"),'Living School research fallback must not require Gemini.');
assert.ok(!source.includes('A Gemini interactive profile is not configured for the training-data fallback.'),'Legacy Gemini-only failure remains.');
assert.ok(source.includes("sourceType:'model-training-knowledge'"),'Fallback sources must use provider-neutral model-training provenance.');
assert.ok(source.includes("provenance:'selected-model-training-data'"),'Fallback sources must record selected-model provenance.');
assert.ok(source.includes('Treat every returned note as model-derived and unverified regardless of provider.'),'Provider-neutral fallback safety contract is missing.');

const transformed=source
  .replace("import * as core from './cabinets/living-school/living-school-cleanroom-core-v218.mjs';","const core=globalThis.__core;")
  .replace("import {searchDownloadedKnowledge} from './knowledge-school-runtime-v243.mjs?v=subject-links-v266';","const {searchDownloadedKnowledge}=globalThis.__knowledge;")
  .replace('export async function researchCapability','async function researchCapability')
  +'\nglobalThis.__livingSchoolResearchTestApi={researchCapability};\n';

new vm.Script(transformed,{filename:path});

const state={sources:[],research:null};
const persistRows=[];
const generateCalls=[];
let uid=0;
const core={
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
  __knowledge:{async searchDownloadedKnowledge(){return[]}},
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

console.log('Living School selected-AI research fallback regression checks passed.');
