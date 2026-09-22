import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const [orchestratorSource,routerSource]=await Promise.all([
  readFile('public/extensions/civweave-weaveling-plan-json-v190.js','utf8'),
  readFile('public/app/minilm-response-router-v347.js','utf8')
]);

assert.match(routerSource,/if\(request\.__civweaveSkipResponseRouter\|\|internalLivingSchoolRequest\(request\)\)return\{request:\{\.\.\.request,__civweaveSkipResponseRouter:true\},route:null\}/,'The response router must honor an explicit local structured bypass before its server-only artifact gate.');
assert.match(orchestratorSource,/transport:localStructuredTransport\(\),__civweaveSkipResponseRouter:true,__civweaveLocalStructuredPlan:true/,'Weaveling must mark downloaded-local structured Quest requests before they enter the runtime spine.');
assert.match(orchestratorSource,/localStructuredResponseRouterBypass:true/,'Weaveling must expose the local structured routing contract.');

class MemoryStorage{
  constructor(seed={}){this.values=new Map(Object.entries(seed))}
  getItem(key){return this.values.has(key)?this.values.get(key):null}
  setItem(key,value){this.values.set(key,String(value))}
  removeItem(key){this.values.delete(key)}
}

const model='gemma4-e4b-it-litert-web';
const storage=new MemoryStorage({
  'civweave.local-ai.selection.v266':JSON.stringify({active:true,id:model}),
  'civweave.working-campus.v1':JSON.stringify({wish:'',profile:{},plan:null}),
  'civweave.intentions.v127':'[]',
  'civweave.realm-inbox.v1':'[]'
});
let captured=null;
const sandbox={
  console,Date,Math,structuredClone,localStorage:storage,DOMException:globalThis.DOMException,
  CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},dispatchEvent(){return true},globalThis:null
};
sandbox.globalThis=sandbox;
sandbox.CivweaveLocalModelDownloadV266={selection:()=>({active:true,id:model})};
sandbox.CivweaveIntentionPlanner={
  persist(plan){return{id:plan.id,state:'review',plan}},
  activeIntentionTurns(_history,text){return[text]},
  format(plan){return`Review ${plan.title}`}
};
sandbox.CivweaveModelRuntime={
  async generate(request){
    captured=request;
    return{
      status:'success',structured:{requested:true,valid:true,repairAttempts:0},
      actual:{provider:'downloaded-local',model},
      outputJson:{
        title:'Learn manifestation and build an app',
        wish:'Help me learn manifestation and turn it into an app',
        outcome:'Learn the subject critically and turn the useful ideas into a small application.',
        assumptions:['The app should distinguish reflective practices from claims that require evidence.'],
        paths:[{
          type:'learning',realm:'living-school',title:'Study manifestation critically',purpose:'Learn the major practices, psychological mechanisms, and evidence boundaries.',
          steps:['Define the major manifestation practices.','Separate evidence-backed mechanisms from metaphysical claims.','Choose practices worth testing in an app.'],
          completionCriteria:'The Hero can explain what is evidence-backed, uncertain, and purely belief-based.',
          evidence:['Concept map','Evidence notes']
        },{
          type:'skilled-labor',realm:'cerbanimo',title:'Build a manifestation practice app',purpose:'Turn the selected practices into a usable prototype.',
          steps:['Define the smallest user flow.','Implement the prototype.','Test whether the prompts are useful without making unsupported promises.'],
          completionCriteria:'A working prototype supports the chosen reflection and goal-setting flow.',
          evidence:['Prototype','Test notes']
        }],
        governance:{included:false,title:'',purpose:'',agreements:[],reviewQuestion:''},confidence:.9
      }
    };
  }
};
vm.createContext(sandbox);
vm.runInContext(orchestratorSource,sandbox,{filename:'civweave-weaveling-plan-json-v190.js'});

const assistant={
  selectedConfig:()=>({provider:'downloaded-local',route:'downloaded-local',model,externalConsent:false}),
  context:async()=>({currentContext:{systemId:'civweave'},routingAnswer:{room:'civweave.quad'}})
};
const result=await sandbox.CivweaveWeavelingPlanJsonV190.createModelPlan({text:'Help me learn manifestation and turn it into an app',history:[]},assistant);

assert.ok(captured,'The E4B Quest request never reached the model runtime.');
assert.equal(captured.config.provider,'downloaded-local');
assert.equal(captured.config.route,'downloaded-local');
assert.equal(captured.config.model,model);
assert.equal(typeof captured.transport,'function','The local structured transport was not attached.');
assert.equal(captured.__civweaveSkipResponseRouter,true,'The local E4B Quest request was left exposed to the server-only structured artifact gate.');
assert.equal(captured.__civweaveLocalStructuredPlan,true,'The local structured planning marker was not attached.');
assert.notEqual(captured.__civweaveNetworkRequired,true,'The local E4B Quest request was incorrectly marked network-required.');
assert.ok(captured.schema?.properties?.paths,'The JSON schema was not retained for local generation.');
assert.equal(result.provider,'downloaded-local');
assert.equal(result.model,model);
assert.equal(result.plan?.authoring?.mode,'model-structured-json');
assert.equal(result.questAuthoring?.aiGenerated,true);

console.log(JSON.stringify({ok:true,contract:'weaveling-local-structured-e4b-v1',model,provider:'downloaded-local',schema:true,localTransport:true,responseRouterBypass:true,serverArtifactGateSkipped:true},null,2));
