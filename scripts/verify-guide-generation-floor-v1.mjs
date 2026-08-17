import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const floorPath='public/app/guide-generation-floor-v1.js';
const loaderPath='public/app/shared-guide-surface-v236.js';
for(const path of [floorPath,loaderPath])execFileSync(process.execPath,['--check',path],{stdio:'inherit'});

const floorSource=fs.readFileSync(floorPath,'utf8');
const loaderSource=fs.readFileSync(loaderPath,'utf8');
const registrations=[];
const listeners=new Map();
const context={
  globalThis:null,
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent(){return true},
  addEventListener(type,handler){listeners.set(type,handler)},
  CivweaveFastInteractiveV192:{register(id,hooks,priority){registrations.push({id,hooks,priority});return()=>{}}},
  console,
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(floorSource,context,{filename:floorPath});

const api=context.CivweaveGuideGenerationFloorV1;
assert.ok(api,'guide generation floor API missing');
assert.equal(api.floorTokens,900);
assert.equal(api.styleOnlyLengthClassification,true);
const registration=registrations.find(row=>row.id==='guide-generation-floor-v1');
assert.ok(registration,'guide generation floor middleware was not registered');
assert.equal(registration.priority,-1000,'floor must run after the MiniLM length classifier and other request shaping');

function before(request){
  const out=registration.hooks.before(request);
  return out?.request||out;
}

let request=before({purpose:'civweave-guide-response-v141',config:{maxTokens:96,responseLengthClass:'short'}});
assert.equal(request.config.maxTokens,900,'short guide response was still allowed to truncate below 900 tokens');
assert.equal(request.config.responseLengthClass,'short','length class should remain a style/routing signal');
assert.equal(request.config.generationBudgetFloorTokens,900);

request=before({purpose:'living-school-guide-chat-v350',config:{maxTokens:320,responseLengthClass:'medium'}});
assert.equal(request.config.maxTokens,900,'medium guide response was still capped below the generation floor');

request=before({purpose:'civweave-guide-response-v141',config:{maxTokens:1400,responseLengthClass:'fast'}});
assert.equal(request.config.maxTokens,1400,'generation floor must not reduce a larger route budget');

request=before({purpose:'civweave-guide-response-v141',config:{maxTokens:3072,responseLengthClass:'smart'}});
assert.equal(request.config.maxTokens,3072,'generation floor must preserve smart-tier budgets');

const ordinary={purpose:'background-indexing',config:{maxTokens:96}};
assert.equal(before(ordinary),ordinary,'non-guide generation should not be rewritten');

assert.ok(loaderSource.includes('/app/guide-generation-floor-v1.js?v=1.0.0-floor-900'),'shared guide loader is not delivering the generation floor');
assert.ok(loaderSource.includes("generationFloor:'guide-generation-floor-v1-900-tokens'"),'shared guide loader diagnostics do not expose the 900-token floor');

console.log('PASS guide response length remains a style signal while every guide generation budget has a 900-token floor.');
