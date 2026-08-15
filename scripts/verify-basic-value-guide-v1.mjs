import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const guideSource=read('public/app/civweave-basic-value-v1.js');
const modelSource=read('public/app/civweave-basic-value-model-v1.js');
const fellowfare=read('public/app/services/fellowfare/cabinet.html');
const fellowfareGuide=read('public/app/services/fellowfare/marketplace-v2-value-guide.js');
const fellowfareCss=read('public/app/services/fellowfare/marketplace-v2-value-guide.css');
const living=read('public/app/cabinets/living-school/index.html');
const cerbanimo=read('public/app/realm-console-v140.html');
const offline=JSON.parse(read('public/app/offline-package-v208.json'));

for(const [name,source] of [['basic guide',guideSource],['basic value model contract',modelSource],['FellowFare value guide',fellowfareGuide]])assert.doesNotThrow(()=>new Function(source),`${name} has invalid JavaScript`);

class Storage{constructor(){this.map=new Map()}getItem(key){return this.map.has(String(key))?this.map.get(String(key)):null}setItem(key,value){this.map.set(String(key),String(value))}}
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const entries=[];
const context={console,Storage,localStorage:new Storage(),CustomEvent,addEventListener:()=>{},dispatchEvent:()=>{},queueMicrotask:()=>{},setInterval:()=>0,clearInterval:()=>{},CivweaveCanonicalRewardsV2:{appendEntry:async entry=>{entries.push(entry);return{entry}}},globalThis:null};
context.globalThis=context;vm.createContext(context);vm.runInContext(guideSource,context,{filename:'civweave-basic-value-v1.js'});
const guide=context.CivweaveBasicValueV1;
assert.ok(guide,'basic value guide did not boot');
assert.equal(guide.guide.labor.buttonsPerHour,5);
assert.equal(guide.guide.labor.wageButtonsPerHour,5);
assert.equal(guide.guide.labor.wagePolicy,'uniform-starting-wage');
assert.equal(guide.guide.learning.moduleCompletionAcorns,2);
assert.equal(guide.guide.learning.externalValidationBonusAcorns,2);
assert.equal(guide.guide.learning.validatorContributionAcorns,1);
assert.equal(guide.guide.education.acornsPerHour,100);
assert.equal(guide.guide.education.curriculumMinAcorns,50);
assert.equal(guide.guide.education.curriculumMaxAcorns,500);
assert.deepEqual(JSON.parse(JSON.stringify(guide.guide.symbols)),{button:'🔘',acorn:'🌰'});
assert.equal(guide.laborButtons(1),5);
assert.equal(guide.laborButtons(3.5),17.5);
assert.equal(guide.sumLaborHours({tasks:[{laborWorthHours:2},{laborWorthHours:3.5}]}),5.5);
const serviceWage=guide.baselineFor('service',{tasks:[{laborWorthHours:2},{laborWorthHours:3}]});
assert.equal(serviceWage.buttons,25);
assert.equal(serviceWage.wageButtons,25);
assert.equal(serviceWage.wageRateButtonsPerHour,5);
assert.equal(serviceWage.wagePolicy,'uniform-starting-wage');
assert.match(serviceWage.basis,/every worker/i);
assert.equal(guide.baselineFor('tutoring',{hours:2}).acorns,200);
assert.equal(guide.curriculumAcorns({hours:.25}),50);
assert.equal(guide.curriculumAcorns({hours:10}),500);
assert.equal(guide.curriculumAcorns({hours:2,recommendedAcorns:370}),370);
assert.deepEqual(JSON.parse(JSON.stringify(guide.mentorship('balanced'))),{id:'balanced',label:'Learning + doing',buttons:5,acorns:50});
assert.equal(guide.mentorship('doing-heavy').buttons,15);
assert.equal(guide.mentorship('learning-heavy').acorns,200);
const chart=guide.chartRows().map(row=>`${row.label} ${row.value} ${row.note}`).join('\n');assert.match(chart,/Starting wage/);assert.match(chart,/5 🔘 Buttons \/ hour/);assert.match(chart,/Uniform labor wage for everyone/);assert.match(chart,/100 🌰 Acorns \/ hour/);assert.match(chart,/5 🔘 Buttons \+ 50 🌰 Acorns/);assert.match(chart,/more granular numeric scale/i);
await guide.grantModuleCompletion({moduleId:'module-a'});
await guide.grantExternalValidation({moduleId:'module-a',validationConfidence:{verifiedPass:true,crossDeviceSatisfied:true,passConfidence:.94}});
await guide.grantValidationContribution({moduleId:'module-b',validationId:'receipt-b',validatorId:'model-b',accepted:true});
assert.deepEqual(entries.map(row=>[row.assetType,row.amount,row.sourceKey]),[
 ['acorn',2,'basic-value:module-a:module-complete'],
 ['acorn',2,'basic-value:module-a:external-validation'],
 ['acorn',1,'basic-value:receipt-b:validator:model-b']
]);

const modelContext={console,setInterval:()=>0,globalThis:null};modelContext.globalThis=modelContext;vm.createContext(modelContext);vm.runInContext(modelSource,modelContext,{filename:'civweave-basic-value-model-v1.js'});
const valueModel=modelContext.CivweaveBasicValueModelV1;assert.ok(valueModel);
const schema=valueModel.augmentSchema({type:'object',properties:{tasks:{type:'array',items:{type:'object',properties:{title:{type:'string'}},required:['title']}}}});
assert.ok(schema.properties.tasks.items.properties.laborWorthHours,'task schema lacks laborWorthHours');
assert.ok(schema.properties.tasks.items.required.includes('laborWorthHours'),'task labor estimate is not required');
assert.match(valueModel.promptContract,/automation.*must not discount/i);
assert.match(valueModel.promptContract,/1 human-equivalent labor hour = 5 🔘 Buttons/);
assert.match(valueModel.promptContract,/same.*wage|wage.*everybody/i);
assert.match(valueModel.promptContract,/models estimate.*hours/i);
assert.match(valueModel.promptContract,/100 🌰 Acorns per hour/);
assert.match(valueModel.promptContract,/5 🔘 Buttons \+ 50 🌰 Acorns/);
assert.match(valueModel.promptContract,/more granular numeric scale/i);

for(const token of ['marketplace-v2-value-guide.css?v=basic-value-v1','/app/civweave-basic-value-v1.js?v=basic-value-v1','marketplace-v2-value-guide.js?v=basic-value-v1'])assert.ok(fellowfare.includes(token),`FellowFare does not load ${token}`);
for(const token of ['SHARED BASIC VALUE GUIDE','Starting wage first. Market second.','Human-equivalent labor hours','Use wage/value suggestion','live market','do not alter the 5 🔘/h labor wage','notifyMarketplaceStorage','StorageEvent','serialized=JSON.stringify(market)','50–500 🌰 Acorns'])assert.ok(fellowfareGuide.includes(token),`FellowFare guide is missing ${token}`);
assert.ok(fellowfareCss.includes('.ffv2-value-table'));
for(const shell of [living,cerbanimo])for(const token of ['/app/cw-reward-ledger-v2.js?v=basic-value-v1','/app/civweave-basic-value-v1.js?v=basic-value-v1','/app/cw-reward-receivers-v2.js?v=basic-value-v1','/app/civweave-basic-value-model-v1.js?v=basic-value-v1'])assert.ok(shell.includes(token),`Cross-system shell is missing ${token}`);
for(const path of ['/app/civweave-basic-value-v1.js','/app/civweave-basic-value-model-v1.js'])assert.ok(offline.seeds.includes(path),`Offline core omits ${path}`);

console.log(JSON.stringify({ok:true,schema:guide.schema,labor:'uniform starting wage: 5 🔘 / human-equivalent hour for every worker',learning:'2 🌰 completion + 2 🌰 external validation + 1 🌰 validator contribution',education:'100 🌰/hour; curriculum 50–500 🌰',mentorship:['5 🔘 + 50 🌰','15 🔘','200 🌰'],crossSystem:true,valuationPersists:true},null,2));
