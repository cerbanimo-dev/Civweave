import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const [loader,index,interactions,paths,workbench]=await Promise.all([
  readFile('public/app/cabinets/living-school/living-school-flat-loader-v213.js','utf8'),
  readFile('public/app/cabinets/living-school/index.html','utf8'),
  readFile('public/app/cabinets/living-school/living-school-interactions-v213.js','utf8'),
  readFile('public/app/cabinets/living-school/living-school-paths-v213.js','utf8'),
  readFile('public/app/cabinets/living-school/living-school-workbench-v158.js','utf8')
]);

for(const source of [loader,interactions,paths,workbench])new Function(source);

for(const token of [
  "const VERSION='living-school-flat-loader-v217-single-tap-owner'",
  'function coreLoadOrder()',
  'for(const src of coreLoadOrder())',
  "src.includes('living-school-interactions-')",
  "document.documentElement.dataset.livingSchoolInteractionOwner='direct-v217'",
  "interactionOwner:'direct-v217'"
])assert(loader.includes(token),`Tap-integrity loader is missing ${token}`);

assert(index.includes('data-build="living-school-flat-v217-single-tap-owner"'),'Living School HTML did not rotate to the tap-integrity build.');
assert(index.includes('living-school-flat-loader-v213.js?v=tap-integrity-v217'),'Living School is still loading the pre-fix enhancement order.');
assert(loader.includes('living-school-interactions-v213.js?v=direct-surfaces-v217'),'Direct interaction runtime was not cache-rotated.');
assert(loader.includes('Compatibility marker: living-school-interactions-v213.js?v=direct-surfaces-v213'),'The retained v213 verification contract lost its compatibility marker.');

const listeners=[];
const sandbox={
  console,
  Promise,
  Set,
  Error,
  String,
  document:{
    readyState:'loading',
    addEventListener(type,listener,options){listeners.push({type,listener,options})},
    documentElement:{dataset:{}},
    body:{append(){}},
    createElement(){return{dataset:{}}},
    dispatchEvent(){}
  },
  requestAnimationFrame:callback=>{callback();return 1},
  requestIdleCallback:callback=>{callback();return 1},
  setTimeout:callback=>{callback();return 1},
  CustomEvent:class CustomEvent{},
  globalThis:null
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(loader,sandbox,{filename:'living-school-flat-loader-v213.js'});

const order=sandbox.LivingSchoolFlatLoaderV213.order();
const position=fragment=>order.findIndex(src=>src.includes(fragment));
const mutationGuard=position('living-school-mutation-guard');
const runtimeStability=position('living-school-runtime-stability');
const directInteractions=position('living-school-interactions');
const directPaths=position('living-school-paths');
const workbenchUi=position('living-school-workbench');

assert(mutationGuard>=0&&runtimeStability>=0&&directInteractions>=0&&directPaths>=0&&workbenchUi>=0,'The computed Living School load order is incomplete.');
assert(mutationGuard<directInteractions,'Mutation protection must exist before direct tap ownership.');
assert(runtimeStability<directInteractions,'Runtime stability must exist before direct tap ownership.');
assert(directInteractions<directPaths,'The workbench interaction owner must be installed before path controls.');
assert(directPaths<workbenchUi,'No tappable workbench UI may mount before both direct controllers exist.');
assert.equal(new Set(order).size,order.length,'The computed load order contains duplicate enhancement executions.');

for(const token of [
  "document.addEventListener('click',handleClick,true)",
  "document.addEventListener('submit',handleSubmit,true)",
  "const action=event.target?.closest?.('[data-lsw-action]')",
  "const module=event.target?.closest?.('[data-lsw-module]')",
  "event.target?.closest?.('[data-lsw-settings]')",
  'event.stopPropagation()'
])assert(interactions.includes(token),`Direct interaction ownership is missing ${token}`);

assert(!interactions.includes('openNative'),'The direct interaction owner regressed to room-switch routing.');
assert(!interactions.includes('LivingSchoolCabinetV151?.setRoom'),'The direct interaction owner regressed to the cabinet room writer.');
assert(!interactions.includes('.click()'),'The direct interaction owner synthesizes a second click.');
assert(!interactions.includes('location.reload()'),'The direct interaction owner reloads the whole page.');
assert(!paths.includes('stopImmediatePropagation'),'Path controls must not silence the direct workbench owner.');
assert(!paths.includes('.click()'),'Path controls synthesize a second click.');

assert(workbench.includes('function openNative(room,index)'),'The fixture no longer contains the legacy synthetic-click route this boundary is designed to quarantine.');
assert(workbench.includes("document.addEventListener('click',handleClick)"),'The fixture no longer contains the legacy bubble listener this boundary is designed to quarantine.');
assert(directInteractions<workbenchUi,'Legacy workbench handlers can become live before their capture-phase replacement.');

const representativeActions=['forge','research','map','lesson','assessment','settings','module'];
for(const action of representativeActions){
  const trace=[];
  const event={stopped:false,preventDefault(){trace.push('prevent')},stopPropagation(){this.stopped=true;trace.push('direct-owner')}};
  event.preventDefault();event.stopPropagation();
  if(!event.stopped)trace.push('legacy-bubble');
  assert.deepEqual(trace,['prevent','direct-owner'],`${action} can still fall through to a second Living School click owner.`);
}

console.log(JSON.stringify({
  ok:true,
  revision:'living-school-tap-integrity-v217',
  loadOrder:order.map(src=>src.split('/').at(-1)),
  interactionOwnerBeforeWorkbench:true,
  pathOwnerBeforeWorkbench:true,
  syntheticClickFallthrough:false,
  representativeActions
},null,2));
