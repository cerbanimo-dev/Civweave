import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as bridge from '../public/app/services/living-school/modules/cerbanimo-bridge.mjs';
import * as gate from '../public/app/services/living-school/modules/project-gate.mjs';

const outboxKey='civweave.cerbanimo.project-handoff.outbox.v1';
const receiptKey='civweave.cerbanimo.project-receipts.v1';
const saved=new Map(),events=[];
const current={school:{id:'school-qa-temperature',title:'QA Temperature Conversion',capability:'Convert Celsius and Fahrenheit weather readings.'},passport:{id:'learner-qa'},practicum:{id:'practicum-qa-temperature',title:'QA Temperature Log',artifact:'20 C = 68 F; (68 - 32) * 5/9 = 20 C.',proof:'Check reference points and preserve original readings.'},projectGate:gate.defaultProjectGate(),receipts:[]};
saved.set(outboxKey,[{schema:'civweave.cerbanimo.project-request.v1',requestId:'request-legacy-qa',practicum:structuredClone(current.practicum)}]);
let sequence=0;
const context={console,Date,Math,JSON,Object,Array,String,Number,Boolean,RegExp,Promise,Set,Map,bridge,gate,
  state:()=>current,clean:(value,max=12000)=>String(value??'').trim().slice(0,max),copy:structuredClone,
  uid:prefix=>`${prefix}-qa-${++sequence}`,now:()=>new Date().toISOString(),
  persist:name=>events.push(name),toast(){},readJson:(key,fallback)=>saved.get(key)||fallback,writeJson:(key,value)=>{saved.set(key,value);return value},
  OUTBOX_KEY:outboxKey,formFor:target=>target,field:(name,target)=>target[name],
  location:{assign(){}},navigator:{},localStorage:{getItem:()=>null},
};
context.globalThis=context;vm.createContext(context);
const source=(await readFile(new URL('../public/app/cabinets/living-school/living-school-cleanroom-actions-v218.mjs',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replace('export const actions=','const actions=');
vm.runInContext(source+'\nglobalThis.__actions=actions;',context);
const actions=context.__actions;
await actions['create-handoff']();
const request=saved.get(outboxKey)[0];
assert.equal(request.type,'civweave:project-handoff-requested');
assert.equal(request.contractVersion,bridge.CONTRACT_VERSION);
assert.equal(request.requestId,'request-legacy-qa','The current saved legacy request must upgrade without losing its correlation ID.');
assert.equal(request.schoolId,current.school.id);
assert.equal(request.projectRef,current.practicum.id);
assert.equal(request.project.artifact,current.practicum.artifact);
assert.equal(current.projectGate.requestId,request.requestId);
assert.equal(current.projectGate.projectRef,request.projectRef);
assert.equal(current.projectGate.status,'submitted');
assert.equal(gate.canUnlockFinalTest(current.projectGate),false);

const receipt={type:'civweave:project-accepted',contractVersion:bridge.CONTRACT_VERSION,receiptId:'receipt-qa-temperature',requestId:request.requestId,schoolId:request.schoolId,projectRef:request.projectRef,status:'accepted',statusRevision:3,reviewId:'independent-review-qa',evidenceRef:'temperature-log-qa',acceptedAt:new Date().toISOString()};
saved.set(receiptKey,[{...receipt,receiptId:'wrong-receipt',projectRef:'another-practicum'}]);
await assert.rejects(actions['check-cerbanimo-receipt'](),/no.*receipt|no.*update/i);
assert.equal(gate.canUnlockFinalTest(current.projectGate),false);
await assert.rejects(actions['import-receipt']({receiptJson:JSON.stringify({...receipt,schoolId:'another-school'})}),/current|match|unrelated/i);
await assert.rejects(actions['import-receipt']({receiptJson:JSON.stringify({receiptId:'unverified',status:'accepted'})}),/invalid|valid.*receipt/i);

saved.set(receiptKey,[receipt]);
await actions['check-cerbanimo-receipt']();
assert.equal(current.projectGate.status,'accepted');
assert.equal(current.receipts.length,1);
assert.equal(current.receipts[0].reviewId,'independent-review-qa');
assert.equal(gate.canUnlockFinalTest(current.projectGate),true);
await actions['create-handoff']();
assert.equal(current.projectGate.status,'accepted','Reopening an existing request must not erase its authoritative acceptance.');
assert.equal(saved.get(outboxKey).length,1,'Repeated sends must not create duplicate transfers.');
assert.ok(events.includes('cerbanimo-receipt-applied'));
current.final={id:'final-qa-temperature',passed:true,receiptId:receipt.receiptId};
current.credential={credentialId:'credential-qa-temperature',schoolId:current.school.id,receiptId:receipt.receiptId};
const reopened={...receipt,type:'civweave:project-linked',event:'project-linked',receiptId:'receipt-qa-reopened',status:'submitted',statusRevision:4,reviewId:'',evidenceRef:'',acceptedAt:''};
const unseenOlder={...reopened,receiptId:'receipt-qa-old-submitted',statusRevision:2};
saved.set(receiptKey,[unseenOlder,receipt,reopened]);
await actions['check-cerbanimo-receipt']();
assert.equal(current.projectGate.status,'submitted','The latest reopened receipt must supersede accepted state.');
assert.equal(gate.canUnlockFinalTest(current.projectGate),false);
assert.equal(current.final,null,'Reopened work must require fresh final competency.');
assert.equal(current.credential,null,'The previous credential must not remain the active credential.');
const superseded=current.learningHistory.at(-1);
assert.equal(superseded.credential.credentialId,'credential-qa-temperature','The issued artifact must remain in history.');
assert.equal(superseded.credential.status,'superseded');
assert.equal(superseded.invalidatedByReceipt,reopened.receiptId);
await assert.rejects(actions['check-cerbanimo-receipt'](),/no new matching/i,'A repeated check must not fall back to an older unseen receipt.');
current.final={id:'old-final',passed:true,receiptId:receipt.receiptId};
await assert.rejects(actions['issue-credential'](),/accepted|current|matching/i,'The issue action must independently enforce the current accepted receipt.');
const reaccepted={...receipt,receiptId:'receipt-qa-reaccepted',statusRevision:5,reviewId:'independent-review-qa-second'};
saved.set(receiptKey,[receipt,reopened,reaccepted]);
await actions['check-cerbanimo-receipt']();
assert.equal(current.projectGate.status,'accepted');
current.final={id:'stale-final',passed:true,receiptId:receipt.receiptId};
await assert.rejects(actions['issue-credential'](),/matching/i,'Reacceptance must not reuse a final test against an older receipt.');
current.final={id:'fresh-final',passed:true,receiptId:reaccepted.receiptId};
await actions['issue-credential']();
assert.equal(current.credential.receiptId,reaccepted.receiptId);
console.log('PASS Learning practicum handoff: canonical transfer and authoritative receipt matching, reopening supersedes active completion while preserving credentials in history, and reissuance requires a fresh matching final.');
