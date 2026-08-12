import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/app/quest-veil-v1.js',import.meta.url),'utf8');
const boundary=fs.readFileSync(new URL('../public/app/install-boundary-v146.js',import.meta.url),'utf8');

assert.match(source,/civweave\.chronicle-ledger\.v1\.1/,'Quest Veil must use the canonical chronicle ledger.');
assert.match(source,/weaveling-quest-veil-writer-v1/,'Quest Veil must identify the dedicated Weaveling writing prompt.');
assert.match(source,/rawEvidenceIncluded:false/,'Quest Veil entries must explicitly record that raw evidence is excluded.');
assert.match(source,/sourceDetailsIncluded:false/,'Quest Veil entries must explicitly record that source details are excluded.');
assert.match(source,/validated-context-stripped-state/,'Quest Veil must derive public fiction from a context-stripped validated state.');
assert.match(boundary,/const QUEST_VEIL='\/app\/quest-veil-v1\.js';/,'Canonical system loader must name the Quest Veil runtime.');
assert.match(boundary,/SYSTEM_EXPERIENCE_SCRIPTS=\[[\s\S]*?QUEST_VEIL,/,'Quest Veil must load on canonical system surfaces.');

const SECRET_TITLE='Project Nightjar private prototype for North Ridge Clinic';
const SECRET_WISH='Build the Nightjar intake system for the private North Ridge Clinic workflow';
const SECRET_PROOF='validator receipt says the private Nightjar prototype passed all checks';
const plan={
  schema:'civweave.intention-weave.v1',
  id:'weave-private-nightjar',
  title:SECRET_TITLE,
  wish:SECRET_WISH,
  outcome:'A private production result exists.',
  state:'completed',
  createdAt:'2026-08-12T00:00:00.000Z',
  updatedAt:'2026-08-12T01:00:00.000Z',
  profile:{constraints:'Do not expose North Ridge Clinic or Nightjar details.'},
  governance:{title:'Private Nightjar consent terms',purpose:'Keep North Ridge Clinic details confidential.'},
  paths:[
    {id:'path-private',realm:'cerbanimo',title:SECRET_TITLE,purpose:'Implement the private Nightjar workflow.',steps:[SECRET_PROOF],status:'completed',proofProgress:{state:'accepted',proofIds:['receipt-secret-1'],reason:SECRET_PROOF}}
  ]
};

const store=new Map([
  ['civweave.working-campus.v1',JSON.stringify({view:'progress',plan})],
  ['civweave.intentions.v127',JSON.stringify([{id:plan.id,kind:'weave-plan',plan}])],
  ['civweave.chronicle-ledger.v1.1',JSON.stringify({schema:'civweave.chronicle-ledger.v1.1',entries:[],updatedAt:plan.updatedAt})]
]);
const writes=[];
let capturedRequest=null;
class CustomEventStub{constructor(type,init={}){this.type=type;this.detail=init.detail}}
const context=vm.createContext({
  console,
  structuredClone:globalThis.structuredClone,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  CustomEvent:CustomEventStub,
  dispatchEvent:()=>true,
  addEventListener:()=>{},
  localStorage:{
    getItem:key=>store.has(key)?store.get(key):null,
    setItem:(key,value)=>{writes.push(key);store.set(key,String(value))},
    removeItem:key=>store.delete(key)
  },
  CivweaveModelRuntime:{
    readSharedConfig:()=>({provider:'bundled',route:'bundled',model:'test-model'}),
    generate:async request=>{
      capturedRequest=request;
      return{
        status:'success',
        actual:{provider:'bundled',model:'test-model'},
        outputJson:{
          title:'A public chronicle',
          story:`The model tried to leak this: ${SECRET_TITLE}.`,
          mapTitle:'A sealed route',
          mapNodes:[
            {symbol:'✦',label:'Threshold',description:'A first abstract waymark.'},
            {symbol:'◇',label:'Crossing',description:'A second abstract waymark.'},
            {symbol:'✧',label:'Gate',description:'A final abstract waymark.'}
          ],
          imageScene:'A symbolic route with no real-world clues.',
          closingLine:'Complete.'
        }
      };
    }
  }
});

vm.runInContext(source,context,{filename:'quest-veil-v1.js'});
const api=context.CivweaveQuestVeilV1;
assert.ok(api,'Quest Veil runtime must install a public API.');
assert.equal(api.KEYS.chronicle,'civweave.chronicle-ledger.v1.1');
assert.equal(api.eligible(plan),true,'Accepted completed plans should be eligible.');

const state=api.veilState(plan);
const stateText=JSON.stringify(state);
for(const secret of [SECRET_TITLE,SECRET_WISH,SECRET_PROOF,'receipt-secret-1','North Ridge Clinic','Nightjar']){
  assert.equal(stateText.includes(secret),false,`Veil State leaked private source text: ${secret}`);
}
assert.equal(state.privacy.rawEvidenceIncluded,false);
assert.equal(state.validation.allAccepted,true);

const result=await api.generateForPlan(plan);
assert.equal(result.status,'created');
assert.ok(capturedRequest,'The Weaveling model harness should be invoked for eligible plans.');
const requestText=JSON.stringify(capturedRequest);
for(const secret of [SECRET_TITLE,SECRET_WISH,SECRET_PROOF,'receipt-secret-1','North Ridge Clinic','Nightjar']){
  assert.equal(requestText.includes(secret),false,`Weaveling writer request leaked private source text: ${secret}`);
}
assert.match(requestText,/Quest Veil writer mode/);
assert.match(requestText,/context-stripped Veil State/);

const ledger=JSON.parse(store.get('civweave.chronicle-ledger.v1.1'));
assert.equal(ledger.schema,'civweave.chronicle-ledger.v1.1');
assert.equal(ledger.entries.length,1);
const entry=ledger.entries[0];
assert.equal(entry.kind,'quest-veil');
assert.equal(entry.schema,'civweave.chronicle-entry.quest-veil.v1');
assert.equal(entry.derived.rawEvidenceIncluded,false);
assert.equal(entry.derived.sourceDetailsIncluded,false);
assert.equal(entry.generation.status,'privacy-fallback','A leaking model output must be replaced by the deterministic privacy fallback.');
const publicText=JSON.stringify({title:entry.title,story:entry.story,public:entry.public});
for(const secret of [SECRET_TITLE,SECRET_WISH,SECRET_PROOF,'receipt-secret-1','North Ridge Clinic','Nightjar']){
  assert.equal(publicText.includes(secret),false,`Chronicle entry leaked private source text: ${secret}`);
}
assert.deepEqual([...new Set(writes)],['civweave.chronicle-ledger.v1.1'],'Quest Veil must not create a second persistence ledger.');
assert.equal(api.safePublicPayload({proofIds:['secret']},plan),false,'Proof identifiers must never pass the public payload guard.');

console.log('Quest Veil v1 privacy, Weaveling prompt, canonical ledger, and loader checks passed.');
