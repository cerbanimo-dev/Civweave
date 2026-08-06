import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const [guard,index,critical,pwa,relay,loader,bootstrap,paths,interactions]=await Promise.all([
  readFile('public/app/cabinets/living-school/living-school-mutation-guard-v196.js','utf8'),
  readFile('public/app/cabinets/living-school/index.html','utf8'),
  readFile('public/service-worker-critical-v199.js','utf8'),
  readFile('public/app/pwa-v130.js','utf8'),
  readFile('public/app/cabinets/living-school/living-school-two-agent-relay-v165.js','utf8'),
  readFile('public/app/cabinets/living-school/living-school-flat-loader-v213.js','utf8'),
  readFile('public/app/cabinets/living-school/living-school-bootstrap-v194.js','utf8'),
  readFile('public/app/cabinets/living-school/living-school-paths-v213.js','utf8'),
  readFile('public/app/cabinets/living-school/living-school-interactions-v213.js','utf8')
]);
const assert=(value,message)=>{if(!value)throw new Error(message)};

assert(relay.includes('MutationObserver(queuePatch)')&&relay.includes('observe(stage'),'Freeze fixture changed: relay stage observer was not found.');
assert(relay.includes('queuePatch')&&relay.includes('patchReader'),'Freeze fixture changed: relay reader patcher was not found.');
assert(!index.includes('living-school-two-agent-relay-v165.js?v='),'The risky relay still executes during initial HTML boot.');
assert(!index.includes('living-school-workbench-v158.js?v='),'The workbench still races the core module during initial boot.');
assert(index.includes('living-school-flat-loader-v213.js'),'The cache-safe direct-interaction loader is missing.');
assert(index.includes('living-school-interactions-v213.css'),'The direct-interaction styles are missing.');
assert(index.includes('id="actions"')&&index.includes('aria-hidden="true"')&&index.includes('tabindex="-1"')&&index.includes('hidden>☰'),'The unfinished hamburger remains in the active tap path.');
assert(loader.includes("document.addEventListener('commonweave:living-school-ready',loadCore"),'Flat enhancements do not wait for core readiness.');
assert(loader.includes('living-school-paths-v213.js?v=direct-controls-v213'),'The direct path control runtime is missing.');
assert(loader.includes('living-school-interactions-v213.js?v=direct-surfaces-v213'),'The direct workbench interaction runtime is missing.');
assert(!loader.includes('living-school-curriculum-launch-v212.js'),'The stale room-bridge launcher is still being loaded.');
assert(loader.indexOf('living-school-workbench-v158.js')<loader.indexOf('living-school-paths-v213.js'),'Path controls must load after the workbench.');
assert(loader.indexOf('living-school-paths-v213.js')<loader.indexOf('living-school-interactions-v213.js'),'Direct workbench interactions must load after path controls.');
assert(loader.includes('commonweave:living-school-enable-rich-media'),'The relay is not behind an explicit opt-in event.');
assert(loader.indexOf('living-school-mutation-guard-v196.js')<loader.indexOf('living-school-two-agent-relay-v165.js'),'Mutation guard must load before the relay can construct its observer.');
assert(bootstrap.includes("emitReady(reason,currentAttempt)"),'The core no longer emits readiness independently of enhancements.');
assert(critical.includes('/app/cabinets/living-school/living-school-mutation-guard-v196.js'),'Installed package omits the Living School mutation guard.');
assert(critical.includes('/app/cabinets/living-school/living-school-flat-loader-v203.js'),'Installed package omits the retained flat loader fallback.');
assert(pwa.includes('flat-living-school-v203'),'PWA package was not rotated for the flat startup isolation repair.');

assert(paths.includes('living-school-paths-v213-direct-controls'),'Direct Living School path controls are not installed.');
assert(!paths.includes('stopImmediatePropagation'),'Path controls still suppress every later click handler.');
assert(!paths.includes('location.reload()'),'Use path still relies on a full-page reload.');
assert(!paths.includes('LivingSchoolCabinetV151?.setRoom'),'Path actions still route through the stale room writer.');
assert(!paths.includes('[data-lsw-action'),'Path controls still intercept workbench buttons.');
assert(paths.includes("'[data-ls160-use],[data-ls160-view],[data-ls160-generate]'"),'Path controls no longer own exactly the three pathbar buttons.');
assert(paths.includes("document.querySelector?.('#stage')||document.body"),'Path controls are not scoped to the Living School stage.');
assert(paths.includes('function relevantMutation(records)'),'Path controls do not filter self-generated mutations.');
assert(paths.includes("behavior:'auto'"),'View curriculum still requests animated scrolling during a render transition.');
assert(paths.includes('function safeOpenDialog(dialog)'),'Generate curriculum lacks a guarded dialog opening path.');
assert(paths.includes('function runAction(label,action)'),'Path control failures are not isolated from the rest of the app.');

assert(interactions.includes('living-school-interactions-v213-direct-surfaces'),'Direct interaction controller is not installed.');
assert(!interactions.includes('openNative'),'Workbench actions still use room-switch plus synthetic-click routing.');
assert(!interactions.includes('LivingSchoolCabinetV151?.setRoom'),'Direct workbench actions still depend on the cabinet room writer.');
assert(!interactions.includes('.click()'),'Direct workbench actions still synthesize a second click.');
assert(interactions.includes('function openLesson()'),'Open full lesson lacks a direct surface.');
assert(interactions.includes('data-lsi213-lesson-form'),'Lesson evidence does not use the direct form contract.');
assert(interactions.includes('function openAssessment()'),'Assessment lacks a direct surface.');
assert(interactions.includes('function hideUnfinishedMenu()'),'The unfinished hamburger is not actively removed from the interaction path.');
assert(interactions.includes("if(!action||action==='research')return"),'Direct interactions no longer leave research to the research runtime.');

class NativeMutationObserver{
  static instances=[];
  constructor(callback){this.callback=callback;NativeMutationObserver.instances.push(this)}
  observe(){}
  disconnect(){}
  takeRecords(){return[]}
  trigger(records){this.callback(records,this)}
}
const guardSandbox={console,Function,Object,Array,MutationObserver:NativeMutationObserver,LivingSchoolMutationGuardV196:null,globalThis:null};
guardSandbox.globalThis=guardSandbox;
vm.createContext(guardSandbox);
vm.runInContext(guard,guardSandbox,{filename:'living-school-mutation-guard-v196.js'});

const makeTarget=inside=>({nodeType:1,matches:()=>false,closest:selector=>inside&&selector.includes('.lsw-reader')?{}:null});
const selfRecord={target:makeTarget(true),addedNodes:[],removedNodes:[]};
const externalRecord={target:makeTarget(false),addedNodes:[],removedNodes:[]};
const relayCallback=vm.runInContext('(function queuePatch(records){function patchReader(){};patchReader();relayCalls+=records.length})',guardSandbox);
guardSandbox.relayCalls=0;
const relayObserver=new guardSandbox.MutationObserver(relayCallback);
relayObserver.trigger([selfRecord]);
assert(guardSandbox.relayCalls===0,'Reader self-mutation still re-enters queuePatch.');
relayObserver.trigger([externalRecord]);
assert(guardSandbox.relayCalls===1,'External workbench mutations no longer refresh the reader.');

const ordinaryCallback=vm.runInContext('(function ordinary(records){ordinaryCalls+=records.length})',guardSandbox);
guardSandbox.ordinaryCalls=0;
const ordinaryObserver=new guardSandbox.MutationObserver(ordinaryCallback);
ordinaryObserver.trigger([selfRecord]);
assert(guardSandbox.ordinaryCalls===1,'Mutation guard interfered with an unrelated observer.');

const STATE_KEY='commonweave.living-school.cabinet.v151';
const canonical={schema:'living-school-cabinet-v151',room:'map',school:{id:'school-1',title:'Test curriculum',modules:[{id:'module-1',title:'Foundations',objective:'Understand the route',lesson:'Read the lesson.',exercise:'Practice the route.',question:'What evidence shows the route works?'}]},activeModuleId:'module-1',progress:{'module-1':{lessonComplete:false,assessmentPassed:false,attempts:[],evidence:[]}},passport:{learnerId:'learner-1',displayName:'Local learner',xp:0,ledger:[]},events:[]};
const storage=new Map([[STATE_KEY,JSON.stringify(canonical)]]);
const actionsButton={hidden:false,tabIndex:0,setAttribute(name,value){this[name]=value}};
const drawer={hidden:false};
const content={innerHTML:'',querySelector:()=>({focus(){}})};
const dialog={open:false,showModal(){this.open=true},close(){this.open=false}};
const toastNode={hidden:true,textContent:''};
let renders=0;
class TestEvent{constructor(type){this.type=type}}
class TestCustomEvent extends TestEvent{constructor(type,init={}){super(type);this.detail=init.detail}}
const interactionSandbox={
  console,
  JSON,
  Object,
  String,
  Number,
  Math,
  Date,
  Promise,
  FormData:class{},
  Event:TestEvent,
  CustomEvent:TestCustomEvent,
  localStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value))},
  location:{href:'https://example.test/living-school'},
  dispatchEvent:()=>true,
  addEventListener:()=>{},
  setTimeout:()=>1,
  clearTimeout:()=>{},
  requestAnimationFrame:callback=>{callback();return 1},
  queueMicrotask:callback=>callback(),
  document:{
    readyState:'complete',
    documentElement:{dataset:{}},
    addEventListener:()=>{},
    querySelector(selector){
      if(selector==='#actions')return actionsButton;
      if(selector==='#drawer')return drawer;
      if(selector==='#instrument-content')return content;
      if(selector==='#instrument-dialog')return dialog;
      if(selector==='#toast')return toastNode;
      return null;
    }
  },
  LivingSchoolWorkbenchV158:{render(){renders++}},
  LivingSchoolCabinetV151:{modules:{rubric:{evaluateShortAnswer(){return{ok:true,uncertain:false,score:100,feedback:'Good evidence.',authority:'test'}}}}},
  globalThis:null
};
interactionSandbox.globalThis=interactionSandbox;
vm.createContext(interactionSandbox);
vm.runInContext(interactions,interactionSandbox,{filename:'living-school-interactions-v213.js'});
assert(interactionSandbox.LivingSchoolInteractionsV213?.openLesson()===true,'Open full lesson did not open directly.');
assert(dialog.open===true,'Open full lesson did not open the instrument dialog.');
assert(content.innerHTML.includes('data-lsi213-lesson-form'),'Open full lesson did not render the direct lesson form.');
assert(content.innerHTML.includes('Read the lesson.'),'Open full lesson did not render saved lesson content.');
assert(actionsButton.hidden===true&&actionsButton.tabIndex===-1,'The unfinished hamburger remains focusable.');
assert(drawer.hidden===true,'The unfinished drawer remains open.');
assert(renders===0,'Opening a lesson unexpectedly rewrote the workbench.');

console.log(JSON.stringify({ok:true,repair:'flat-living-school-v213-direct-interactions',relayDuringInitialBoot:false,enhancementsAfterCore:true,richMediaOptIn:true,guardBeforeRelay:true,pathControls:{threeButtonsOwned:true,reloadFree:true,roomWriterFree:true,workbenchNotIntercepted:true,stageScoped:true},workbenchActions:{directCurriculum:true,directLesson:true,directAssessment:true,syntheticClicks:false},menu:{deferred:true,hidden:true},selfMutationCallbacks:0,externalMutationCallbacks:1,unrelatedObserversPreserved:true},null,2));
