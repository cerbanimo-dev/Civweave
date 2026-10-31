import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app/guide-capability-passover-v1.js',import.meta.url),'utf8');
const prefix='civweave.guide-capability-passover.v1';
function fixture(){
  const item={id:'saved-quest',kind:'weave-plan',state:'review',plan:{id:'saved-quest',schema:'civweave.intention-weave.v1',title:'PRIVATE TITLE',sourceConversation:['PRIVATE TRANSCRIPT'],authoring:{receipt:{artifactRevision:2}},state:'review',paths:[]}};
  const storage=new Map([['civweave.intentions.v127',JSON.stringify([item])]]),events=[],opened=[],submitted=[];
  const context={console,Date,Math,Set,document:{readyState:'loading',documentElement:{dataset:{}},getElementById:()=>null,createElement:()=>({}),head:{append(){}}},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))},addEventListener(){},dispatchEvent:event=>events.push(event),CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},requestAnimationFrame:()=>0,setTimeout:()=>0,clearTimeout(){},CivweaveGuideChatSurfaceV350:{open:args=>{opened.push(args);return true},switchGuide:()=>true,submitText:async(...args)=>{submitted.push(args);return true}},CivweaveModelRuntime:{generate:()=>{throw new Error('Reference handoff must not infer.')}}};
  context.globalThis=context;vm.runInNewContext(source,context);
  const api=context.CivweaveGuideCapabilityPassoverV1;
  return{context,storage,events,opened,submitted,api,offer:options=>api.offerArtifactReference({sourceSystem:'civweave',targetSystem:'living-school',ownerSystem:'civweave',artifactClass:'weave',artifactRef:'saved-quest',artifactRevision:2,consent:{declared:true},...options}),accept:offer=>api.acceptArtifactReference({sourceSystem:offer.sourceSystem,id:offer.id,targetSystem:offer.targetSystem,artifactRef:offer.artifactRef,artifactRevision:offer.artifactRevision,confirmed:true})};
}

test('reference passover persists only canonical identifiers and declared consent, then opens the destination without resubmission',async()=>{
  const b=fixture(),result=b.offer({sourceText:'PRIVATE TEXT',history:['PRIVATE HISTORY'],context:{secret:'PRIVATE CONTEXT'}});assert.equal(result.ok,true,result.error);const offer=result.offer;
  assert.equal(offer.state,'offered');assert.equal(offer.resubmit,false);assert.equal(offer.artifactClass,'weave');assert.equal(offer.targetArtifactClass,'curriculum');assert.equal(offer.ownerSystem,'civweave');assert.equal(offer.artifactRevision,2);assert.doesNotMatch(JSON.stringify(offer),/PRIVATE|sourceText|history|secret/);
  const accepted=await b.accept(offer);assert.equal(accepted.ok,true,accepted.error);assert.equal(accepted.offer.state,'transferred-reference');assert.equal(accepted.offer.materialized,false);assert.equal(accepted.offer.destinationValidation,'required');assert.equal(b.submitted.length,0);assert.equal(b.opened.length,1);assert.equal(b.opened[0].guide,'living-school');
  assert.doesNotMatch(JSON.stringify(b.events),/PRIVATE/);assert.equal(b.storage.has('civweave.realm-inbox.v1'),false);
  assert.equal((await b.accept(offer)).unchanged,true);assert.equal(b.opened.length,1);
});

test('only an existing exact source reference and canonical distinct destination can be offered',()=>{
  const b=fixture();
  for(const args of [{artifactRef:'missing'},{artifactRevision:1},{ownerSystem:'living-school'},{artifactClass:'curriculum'},{sourceSystem:'unknown'},{targetSystem:'unknown'},{targetSystem:'civweave'},{targetArtifactClass:'quest'},{consent:{declared:false}}]){
    const result=b.offer(args);assert.equal(result.ok,false,JSON.stringify(args));
  }
  assert.equal(b.storage.size,1);assert.equal(b.opened.length,0);assert.equal(b.submitted.length,0);
});

test('reference acceptance validates the saved offer, explicit consent and current source revision before navigation',async()=>{
  const b=fixture(),offer=b.offer().offer,base={sourceSystem:'civweave',id:offer.id,targetSystem:'living-school',artifactRef:'saved-quest',artifactRevision:2,confirmed:true};
  for(const change of [{confirmed:false},{id:'other-offer'},{targetSystem:'cerbanimo'},{artifactRef:'other-quest'},{artifactRevision:3}])assert.equal((await b.api.acceptArtifactReference({...base,...change})).ok,false);
  const rows=JSON.parse(b.storage.get('civweave.intentions.v127'));rows[0].plan.authoring.receipt.artifactRevision=3;b.storage.set('civweave.intentions.v127',JSON.stringify(rows));assert.equal((await b.api.acceptArtifactReference(base)).ok,false);assert.equal(b.opened.length,0);assert.equal(b.submitted.length,0);
});

test('the existing text-request passover retains its explicit resubmission behavior',async()=>{
  const b=fixture();b.storage.set(prefix+'.civweave',JSON.stringify({id:'text-offer',sourceSystem:'civweave',targetSystem:'living-school',sourceText:'Create a Learning Journey',acceptedAt:null}));
  assert.equal(await b.api.acceptOffer('civweave','text-offer'),true);assert.equal(b.submitted.length,1);assert.equal(b.submitted[0][0],'Create a Learning Journey');
});

test('reference reads discard unexpected private fields and failed destination opens do not claim transfer',async()=>{
  const b=fixture(),offer=b.offer().offer,key=prefix+'.reference.civweave',stored=JSON.parse(b.storage.get(key));stored.sourceText='PRIVATE INJECTED TRANSCRIPT';stored.context={secret:'PRIVATE SECRET'};b.storage.set(key,JSON.stringify(stored));
  assert.doesNotMatch(JSON.stringify(b.api.readArtifactReferenceOffer('civweave')),/PRIVATE|sourceText|context/);
  b.context.CivweaveGuideChatSurfaceV350.open=()=>false;const result=await b.accept(offer);assert.equal(result.ok,false);assert.equal(b.api.readArtifactReferenceOffer('civweave').state,'offered');assert.equal(b.submitted.length,0);assert.doesNotMatch(JSON.stringify(b.events),/PRIVATE/);
});
