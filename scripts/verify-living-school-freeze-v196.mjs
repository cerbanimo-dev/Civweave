import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const [guard,index,critical,pwa,relay,loader,bootstrap,paths,launcher]=await Promise.all([
  readFile('public/app/cabinets/living-school/living-school-mutation-guard-v196.js','utf8'),
  readFile('public/app/cabinets/living-school/index.html','utf8'),
  readFile('public/service-worker-critical-v199.js','utf8'),
  readFile('public/app/pwa-v130.js','utf8'),
  readFile('public/app/cabinets/living-school/living-school-two-agent-relay-v165.js','utf8'),
  readFile('public/app/cabinets/living-school/living-school-flat-loader-v212.js','utf8'),
  readFile('public/app/cabinets/living-school/living-school-bootstrap-v194.js','utf8'),
  readFile('public/app/cabinets/living-school/living-school-paths-v211.js','utf8'),
  readFile('public/app/cabinets/living-school/living-school-curriculum-launch-v212.js','utf8')
]);
const assert=(value,message)=>{if(!value)throw new Error(message)};

assert(relay.includes('new MutationObserver(queuePatch).observe(stage'),'Freeze fixture changed: relay stage observer was not found.');
assert(relay.includes("reader.querySelector('[data-two-agent-media]')?.remove()"),'Freeze fixture changed: relay media replacement was not found.');
assert(!index.includes('living-school-two-agent-relay-v165.js?v='),'The risky relay still executes during initial HTML boot.');
assert(!index.includes('living-school-workbench-v158.js?v='),'The workbench still races the core module during initial boot.');
assert(index.includes('living-school-flat-loader-v212.js'),'The cache-safe curriculum launch loader is missing.');
assert(loader.includes("document.addEventListener('commonweave:living-school-ready',loadCore"),'Flat enhancements do not wait for core readiness.');
assert(loader.includes('living-school-paths-v211.js?v=stable-controls-v211'),'The cache-safe loader does not request the stable path runtime.');
assert(loader.includes('living-school-curriculum-launch-v212.js?v=canonical-state-v212'),'The canonical curriculum launcher is missing.');
assert(loader.indexOf('living-school-curriculum-launch-v212.js')<loader.indexOf('living-school-paths-v211.js'),'The canonical room bridge must install before path controls.');
assert(loader.includes('commonweave:living-school-enable-rich-media'),'The relay is not behind an explicit opt-in event.');
assert(loader.indexOf('living-school-mutation-guard-v196.js')<loader.indexOf('living-school-two-agent-relay-v165.js'),'Mutation guard must load before the relay can construct its observer.');
assert(bootstrap.includes("emitReady(reason,currentAttempt)"),'The core no longer emits readiness independently of enhancements.');
assert(critical.includes('/app/cabinets/living-school/living-school-mutation-guard-v196.js'),'Installed package omits the Living School mutation guard.');
assert(critical.includes('/app/cabinets/living-school/living-school-flat-loader-v203.js'),'Installed package omits the retained flat loader fallback.');
assert(pwa.includes('flat-living-school-v203'),'PWA package was not rotated for the flat startup isolation repair.');

assert(paths.includes('living-school-paths-v160-stable-controls'),'Stable Living School path controls are not installed.');
assert(!paths.includes('stopImmediatePropagation'),'Path controls still suppress every later click handler.');
assert(!paths.includes('location.reload()'),'Use path still relies on a full-page reload.');
assert(!paths.includes('observe(document.documentElement'),'Path controls still observe and repatch the entire document.');
assert(paths.includes("document.querySelector?.('#stage')||document.body"),'Path controls are not scoped to the Living School stage.');
assert(paths.includes('function relevantMutation(records)'),'Path controls do not filter self-generated mutations.');
assert(paths.includes("behavior:'auto'"),'View curriculum still requests animated scrolling during a render transition.');
assert(paths.includes('function safeOpenDialog(dialog)'),'Generate curriculum lacks a guarded dialog opening path.');
assert(paths.includes('function runAction(label,action)'),'Path control failures are not isolated from the rest of the app.');

assert(launcher.includes('function setCanonicalRoom(room)'),'Curriculum launch does not use canonical persisted state.');
assert(launcher.includes('if(setCanonicalRoom(room))return true'),'External room changes can still fall through to the stale cabinet snapshot.');
assert(launcher.includes("setCanonicalRoom('map')"),'View curriculum does not explicitly persist the learning map room.');
assert(launcher.includes('LivingSchoolWorkbenchV158?.render?.()'),'View curriculum does not remount the readable workbench.');
assert(launcher.includes('LivingSchoolPathsV160')&&launcher.includes('paths.viewCurriculum=openCurriculum'),'The public path API is not repaired after loading.');

class NativeMutationObserver{
  static instances=[];
  constructor(callback){this.callback=callback;NativeMutationObserver.instances.push(this)}
  observe(){}
  disconnect(){}
  takeRecords(){return[]}
  trigger(records){this.callback(records,this)}
}
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

const STATE_KEY='commonweave.living-school.cabinet.v151';
const canonical={schema:'living-school-cabinet-v151',room:'desk',school:{id:'school-1',title:'Test curriculum',modules:[{id:'module-1'}]},activeModuleId:'module-1',progress:{}};
const storage=new Map([[STATE_KEY,JSON.stringify(canonical)]]);
const stateEvents=[];
let legacyCalls=0;
let generatorCalls=0;
class TestStorageEvent{constructor(type,init={}){this.type=type;Object.assign(this,init)}}
class TestEvent{constructor(type){this.type=type}}
class TestCustomEvent extends TestEvent{constructor(type,init={}){super(type);this.detail=init.detail}}
const launchSandbox={
  console,
  JSON,
  Object,
  String,
  Promise,
  setTimeout:()=>0,
  clearTimeout:()=>{},
  requestAnimationFrame:callback=>{callback();return 1},
  localStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value))},
  location:{href:'https://example.test/living-school'},
  StorageEvent:TestStorageEvent,
  Event:TestEvent,
  CustomEvent:TestCustomEvent,
  dispatchEvent:event=>{stateEvents.push(event);return true},
  addEventListener:()=>{},
  document:{readyState:'complete',addEventListener:()=>{},querySelector:()=>null},
  LivingSchoolCabinetV151:{setRoom(room){legacyCalls++;storage.set(STATE_KEY,JSON.stringify({schema:'living-school-cabinet-v151',room,school:null}))}},
  LivingSchoolWorkbenchV158:{render(){}},
  LivingSchoolPathsV160:{openGenerator(){generatorCalls++;return true}},
  globalThis:null
};
launchSandbox.globalThis=launchSandbox;
vm.createContext(launchSandbox);
vm.runInContext(launcher,launchSandbox,{filename:'living-school-curriculum-launch-v212.js'});
assert(launchSandbox.LivingSchoolCurriculumLaunchV212?.isInstalled(),'Canonical curriculum bridge did not install.');
launchSandbox.LivingSchoolCabinetV151.setRoom('map');
const launchedState=JSON.parse(storage.get(STATE_KEY));
assert(legacyCalls===0,'View curriculum still invoked the stale cabinet room writer.');
assert(launchedState.room==='map','View curriculum did not persist the map room.');
assert(launchedState.school?.id==='school-1','View curriculum erased the active curriculum.');
assert(stateEvents.some(event=>event.key===STATE_KEY),'Canonical room transition did not synchronize same-page listeners.');
storage.set(STATE_KEY,JSON.stringify({...canonical,school:null}));
assert(launchSandbox.LivingSchoolCurriculumLaunchV212.open()===true,'Missing curriculum did not route to the generator.');
assert(generatorCalls===1,'Missing curriculum failed to open the generator exactly once.');

console.log(JSON.stringify({ok:true,repair:'flat-living-school-v212-curriculum-launch',relayDuringInitialBoot:false,enhancementsAfterCore:true,richMediaOptIn:true,guardBeforeRelay:true,pathControls:{captureSafe:true,reloadFree:true,stageScoped:true,filteredMutations:true,guardedDialog:true},curriculumLaunch:{canonicalState:true,staleWriterBypassed:true,schoolPreserved:true,generatorFallback:true},selfMutationCallbacks:0,externalMutationCallbacks:1,unrelatedObserversPreserved:true},null,2));
