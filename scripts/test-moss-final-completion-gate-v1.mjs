import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as gate from '../public/app/services/living-school/modules/project-gate.mjs';

const read=name=>readFileSync(new URL(`../public/app/cabinets/living-school/${name}`,import.meta.url),'utf8');
const strip=source=>source.replace(/^import[^\n]*;\r?\n/gm,'').replace(/export (async )?function /g,'$1function ').replace(/export const /g,'const ');
function fixture(){
  const saved=new Map(),context=vm.createContext({console,Date,Math,JSON,Object,Array,String,Number,Boolean,Set,Map,Promise,URL,structuredClone,setTimeout,clearTimeout,gate,
    document:{getElementById:()=>null},localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,String(value))},
    rubric:{evaluateShortAnswer:()=>({ok:true,uncertain:false,score:100,feedback:'Fixture rubric pass.'})},
    CivweaveValidationConfidenceV1:{aggregate:()=>({verifiedPass:true})}
  });
  vm.runInContext(strip(read('living-school-cleanroom-core-v218-base.mjs'))+'\nglobalThis.__core={state,replaceState,finalUnlocked};',context);
  vm.runInContext(strip(read('living-school-cleanroom-actions-v218.mjs'))+'\nglobalThis.__actions=actions;',context);
  context.__core.replaceState({school:{id:'current-school',title:'Conversion course',capability:'Convert temperatures.',modules:[{id:'first'},{id:'second'},{id:'third'}]},progress:Object.fromEntries(['first','second','third'].map(id=>[id,{lessonComplete:true,assessmentPassed:true}])),practicum:{id:'current-practicum',artifact:'A checked conversion worksheet.'},projectGate:{status:'accepted',projectRef:'current-practicum',requestId:'current-request',lastReceipt:{receiptId:'accepted-receipt',status:'accepted',schoolId:'current-school',projectRef:'current-practicum',requestId:'current-request',reviewId:'real-review-id'}},passport:{displayName:'QA learner'}});
  const target={closest:()=>({querySelector:()=>({value:'The fixture has a sufficiently long final explanation that describes the demonstrated capability, the actual evidence, a limitation of the work and how a revision would be verified before making a broader claim.'})})};
  return{state:context.__core.state,unlocked:context.__core.finalUnlocked,evaluate:()=>context.__actions['evaluate-final'](target),issue:()=>context.__actions['issue-credential']()};
}

test('an accepted practicum cannot unlock the final with skipped current modules',async()=>{
  const app=fixture();app.state().progress.second.assessmentPassed=false;
  assert.equal(app.unlocked(),false);await assert.rejects(app.evaluate(),/module.*assessment/i);
  app.state().final={passed:true,receiptId:'accepted-receipt'};await assert.rejects(app.issue(),/module.*assessment/i);
  assert.equal(Boolean(app.state().credential),false);
});
test('progress from another course and truthy legacy values do not complete the current modules',async()=>{
  const app=fixture();app.state().progress={old:{assessmentPassed:true},first:{assessmentPassed:'true'},second:{assessmentPassed:true},third:{assessmentPassed:true}};
  assert.equal(app.unlocked(),false);await assert.rejects(app.evaluate(),/module.*assessment/i);
});
test('empty, anonymous or duplicate current module identities cannot unlock a credential',()=>{
  for(const modules of [[],[{id:''}],[{id:'first'},{id:'first'}]]){const app=fixture();app.state().school.modules=modules;assert.equal(app.unlocked(),false);}
});
test('accepted receipts must belong to this school, practicum and request',async()=>{
  for(const field of ['schoolId','projectRef','requestId']){const app=fixture();app.state().projectGate.lastReceipt[field]='different';assert.equal(app.unlocked(),false);await assert.rejects(app.evaluate(),/receipt/i);}
});
test('the complete course and matching accepted practicum can evaluate and issue once',async()=>{
  const app=fixture();assert.equal(app.unlocked(),true);await app.evaluate();assert.equal(app.state().final.passed,true);
  await app.issue();const id=app.state().credential.credentialId;await app.issue();assert.equal(app.state().credential.credentialId,id);assert.equal(app.state().credential.schoolId,'current-school');
});
test('revoking a module pass after the final evaluation prevents credential issuance',async()=>{
  const app=fixture();await app.evaluate();app.state().progress.third.assessmentPassed=false;
  await assert.rejects(app.issue(),/module.*assessment/i);assert.equal(Boolean(app.state().credential),false);
});
