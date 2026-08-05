import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const [guard,index,worker,pwa,relay]=await Promise.all([
  readFile('public/app/cabinets/living-school/living-school-mutation-guard-v196.js','utf8'),
  readFile('public/app/cabinets/living-school/index.html','utf8'),
  readFile('public/service-worker-v156.js','utf8'),
  readFile('public/app/pwa-v130.js','utf8'),
  readFile('public/app/cabinets/living-school/living-school-two-agent-relay-v165.js','utf8')
]);
const assert=(value,message)=>{if(!value)throw new Error(message)};

assert(relay.includes('new MutationObserver(queuePatch).observe(stage'),'Freeze fixture changed: relay stage observer was not found.');
assert(relay.includes("reader.querySelector('[data-two-agent-media]')?.remove()"),'Freeze fixture changed: relay media replacement was not found.');
assert(index.indexOf('living-school-two-agent-relay-v165.js')<index.indexOf('living-school-mutation-guard-v196.js'),'Mutation guard must load after the relay defines queuePatch.');
assert(index.indexOf('living-school-mutation-guard-v196.js')<index.indexOf('living-school-research-v162.js'),'Mutation guard must install before DOMContentLoaded boot callbacks run.');
assert(worker.includes('/app/cabinets/living-school/living-school-mutation-guard-v196.js'),'Installed package omits the Living School mutation guard.');
assert(worker.includes("LIVING_SCHOOL_MUTATION_GUARD_REVISION='reader-self-mutation-filter-v196'"),'Worker status omits the mutation guard revision.');
assert(pwa.includes('working-campus-additions-v196-living-school-reader-loop'),'PWA package was not rotated for the freeze repair.');

class NativeMutationObserver{
  static instances=[];
  constructor(callback){this.callback=callback;NativeMutationObserver.instances.push(this)}
  observe(){}
  disconnect(){}
  takeRecords(){return[]}
  trigger(records){this.callback(records,this)}
}
let relayCalls=0,ordinaryCalls=0;
const sandbox={console,Function,Object,Array,MutationObserver:NativeMutationObserver,LivingSchoolMutationGuardV196:null,globalThis:null};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(guard,sandbox,{filename:'living-school-mutation-guard-v196.js'});

const makeTarget=inside=>({nodeType:1,matches:()=>false,closest:selector=>inside&&selector.includes('.lsw-reader')?{}:null});
const selfRecord={target:makeTarget(true),addedNodes:[],removedNodes:[]};
const externalRecord={target:makeTarget(false),addedNodes:[],removedNodes:[]};
const relayCallback=vm.runInContext('(function queuePatch(records){function patchReader(){};patchReader();relayCalls+=records.length})',sandbox);
sandbox.relayCalls=0;
const relayObserver=new sandbox.MutationObserver(relayCallback);
relayObserver.trigger([selfRecord]);
assert(sandbox.relayCalls===0,'Reader self-mutation still re-enters queuePatch.');
relayObserver.trigger([externalRecord]);
assert(sandbox.relayCalls===1,'External workbench mutations no longer refresh the reader.');

const ordinaryCallback=vm.runInContext('(function ordinary(records){ordinaryCalls+=records.length})',sandbox);
sandbox.ordinaryCalls=0;
const ordinaryObserver=new sandbox.MutationObserver(ordinaryCallback);
ordinaryObserver.trigger([selfRecord]);
assert(sandbox.ordinaryCalls===1,'Mutation guard interfered with an unrelated observer.');

console.log(JSON.stringify({ok:true,repair:'living-school-reader-self-mutation-filter',selfMutationCallbacks:0,externalMutationCallbacks:1,unrelatedObserversPreserved:true,package:'v196'},null,2));
