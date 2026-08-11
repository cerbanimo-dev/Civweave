import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ROOT=new URL('../',import.meta.url);
const runtimePath='public/app/cw-skill-market-v1.js';
const bridgePath='public/app/services/fellowfare/skill-market-bridge-v1.js';
const surfacePath='public/app/cw-skill-market-surfaces-v1.js';
for(const path of [runtimePath,bridgePath,surfacePath])assert.ok(fs.existsSync(new URL(path,ROOT)),`${path} is missing`);

class StorageMock{
  constructor(){this.map=new Map()}
  getItem(key){return this.map.has(String(key))?this.map.get(String(key)):null}
  setItem(key,value){this.map.set(String(key),String(value))}
  removeItem(key){this.map.delete(String(key))}
}
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}

const ledger={
  schema:'civweave.reward-ledger.v2',updatedAt:'2026-08-11T22:00:00.000Z',entries:[
    {accountId:'passport:A',assetType:'skill-xp',skillId:'Carpentry',skillName:'Carpentry',amount:20,sourceSystem:'living-school',sourceKind:'learning',sourceId:'module-1',createdAt:'2026-08-11T20:00:00.000Z',hash:'xp-carpentry-learning'},
    {accountId:'passport:A',assetType:'skill-xp',skillId:'Planning',skillName:'Planning',amount:5,sourceSystem:'living-school',sourceKind:'learning',sourceId:'module-1',createdAt:'2026-08-11T20:00:01.000Z',hash:'xp-planning-learning'},
    {accountId:'passport:A',assetType:'acorn',amount:5,sourceSystem:'living-school',sourceKind:'learning',sourceId:'module-1',createdAt:'2026-08-11T20:00:02.000Z',hash:'acorns-learning'},
    {accountId:'passport:A',assetType:'skill-xp',skillId:'Carpentry',skillName:'Carpentry',amount:75,sourceSystem:'cerbanimo',sourceKind:'doing',sourceId:'task-1',validatorIds:['peer:hub-b'],evidenceHash:'sha256:evidence',createdAt:'2026-08-11T21:00:00.000Z',hash:'xp-carpentry-doing'},
    {accountId:'passport:A',assetType:'button',amount:8,sourceSystem:'cerbanimo',sourceKind:'doing',sourceId:'task-1',validatorIds:['peer:hub-b'],evidenceHash:'sha256:evidence',createdAt:'2026-08-11T21:00:01.000Z',hash:'buttons-doing'},
    {accountId:'passport:A',assetType:'button',amount:-3,sourceSystem:'fellowfare',sourceKind:'exchange',sourceId:'trade-1',createdAt:'2026-08-11T21:30:00.000Z',hash:'buttons-spent'},
    {accountId:'passport:A',assetType:'acorn',amount:-2,sourceSystem:'fellowfare',sourceKind:'exchange',sourceId:'trade-1',createdAt:'2026-08-11T21:30:01.000Z',hash:'acorns-spent'},
    {accountId:'passport:B',assetType:'skill-xp',skillId:'Carpentry',skillName:'Carpentry',amount:100,sourceSystem:'cerbanimo',sourceKind:'doing',sourceId:'other-task',createdAt:'2026-08-11T21:40:00.000Z',hash:'other-xp'},
    {accountId:'passport:B',assetType:'button',amount:50,sourceSystem:'cerbanimo',sourceKind:'doing',sourceId:'other-task',createdAt:'2026-08-11T21:40:01.000Z',hash:'other-buttons'}
  ]
};

const slug=value=>String(value||'general-practice').trim().toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'general-practice';
const localStorage=new StorageMock();
const listeners=new Map();
const context={
  console,localStorage,CustomEvent,document:{documentElement:{dataset:{}}},
  CivweaveCanonicalRewardsV2:{skillSlug:slug,readLedger:()=>ledger,verifyLedger:async()=>({ok:true,entryCount:ledger.entries.length,headHash:ledger.entries.at(-1).hash,errors:[]})},
  addEventListener:(name,fn)=>{const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list)},
  dispatchEvent:event=>{for(const fn of listeners.get(event.type)||[])fn(event);return true},
  globalThis:null
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL(runtimePath,ROOT),'utf8'),context,{filename:runtimePath});
const market=context.CivweaveSkillMarketV1;
assert.ok(market,'skill market runtime did not boot');

const snapshot=market.buildSnapshot(ledger,{accountId:'passport:A',calculatedAt:'2026-08-11T22:00:00.000Z'});
assert.equal(snapshot.currentHeld.buttons,5,'current Button wallet should include spending');
assert.equal(snapshot.currentHeld.acorns,3,'current Acorn wallet should include spending');
assert.equal(snapshot.skills.carpentry.validatedButtons,8,'spending Buttons must not erase validated Carpentry Button history');
assert.equal(snapshot.skills.carpentry.validatedAcorns,4,'multi-skill learning Acorns must be allocated by same-source Skill XP share');
assert.equal(snapshot.skills.planning.validatedAcorns,1,'remaining Acorn attribution should stay with Planning');
assert.equal(snapshot.skills.planning.validatedButtons,0,'learning must not invent labor Button history');
assert.equal(snapshot.skills.carpentry.externallyValidatedSources,1,'cross-node evidence should remain visible as a stronger validation source');
assert.equal(snapshot.skills.carpentry.validatedSources,2,'Carpentry should preserve learning and doing source provenance');
assert.equal(snapshot.skills.carpentry.validatedButtons+snapshot.skills.planning.validatedButtons,8,'Button attribution must not double count across skills');
assert.equal(snapshot.skills.carpentry.validatedAcorns+snapshot.skills.planning.validatedAcorns,5,'Acorn attribution must not double count across skills');
assert.equal(market.currencyForIntent('labor'),'button');
assert.equal(market.currencyForIntent('learning'),'acorn');
assert.equal(market.quoteSkill({intent:'labor',skillId:'Carpentry',amount:7}).label,'7 Buttons');
assert.equal(market.quoteSkill({intent:'learning',skillId:'Carpentry',amount:3}).label,'3 Acorns');

const ping=await market.recordPing({accountId:'passport:A',hubId:'hub:north-country',pingedAt:'2026-08-11T22:05:00.000Z'});
assert.equal(ping.integrity,'verified');
assert.equal(ping.skills.carpentry.validatedButtons,8);
assert.equal(market.lastPing('passport:A').pingedAt,'2026-08-11T22:05:00.000Z');
const ad=market.peerAdvertisement(ping,{skills:['Carpentry']});
assert.deepEqual(Object.keys(ad.skills),['carpentry']);
assert.equal(ad.skills.carpentry.validatedAcorns,4);
assert.equal('currentHeld' in ad,false,'peer skill advertisements must not expose the wallet balance');

const bridgeSource=fs.readFileSync(new URL(bridgePath,ROOT),'utf8');
assert.match(bridgeSource,/Labor settles in Buttons/);
assert.match(bridgeSource,/Learning settles in Acorns/);
assert.match(bridgeSource,/wallet balance/);
assert.match(bridgeSource,/providerProof/);
const surfaceSource=fs.readFileSync(new URL(surfacePath,ROOT),'utf8');
assert.match(surfaceSource,/validated Buttons/);
assert.match(surfaceSource,/validated Acorns/);
assert.match(surfaceSource,/ledger ping/);

console.log(JSON.stringify({
  ok:true,
  currentHeld:snapshot.currentHeld,
  carpentry:snapshot.skills.carpentry,
  planning:snapshot.skills.planning,
  laborCurrency:market.currencyForIntent('labor'),
  learningCurrency:market.currencyForIntent('learning'),
  pingedAt:ping.pingedAt
},null,2));
