import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ROOT=new URL('../',import.meta.url);
const radioSource=fs.readFileSync(new URL('public/app/system-radio-agent-v233.js',ROOT),'utf8');
const boundarySource=fs.readFileSync(new URL('public/app/install-boundary-v146.js',ROOT),'utf8');

class Store {
  constructor(){this.map=new Map()}
  getItem(key){return this.map.has(key)?this.map.get(key):null}
  setItem(key,value){this.map.set(key,String(value))}
  removeItem(key){this.map.delete(key)}
}

const localStorage=new Store();
const sessionStorage=new Store();
const document={
  readyState:'complete',
  documentElement:{dataset:{civweaveSystemRoute:''}},
  body:{append(){}},
  head:{append(){}},
  getElementById(){return null},
  addEventListener(){},
  createElement(){return{dataset:{},classList:{add(){}},setAttribute(){},append(){},addEventListener(){},remove(){},isConnected:true}}
};
const history={pushState(){},replaceState(){}};
const sandbox={
  console,URL,Date,Math,JSON,Object,Array,Set,Map,Number,String,Boolean,Promise,
  document,history,location:{pathname:'/not-a-system',search:'',hash:''},
  localStorage,sessionStorage,
  crypto:{randomUUID:()=> 'radio-v233-test'},
  CustomEvent:class CustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  dispatchEvent(){},addEventListener(){},setTimeout(){return 1},clearTimeout(){},queueMicrotask(fn){fn()}
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(radioSource,sandbox,{filename:'system-radio-agent-v233.js'});

const radio=sandbox.CivweaveRadioRecommendationAgentV233;
assert.ok(radio,'v233 radio runtime must initialize');
assert.equal(sandbox.CivweaveRadioRecommendationAgentV232,radio,'v232 compatibility alias must point to v233 runtime');
assert.equal(radio.revision,'system-radio-agent-v233');

const expectedIds={
  anarchadia:'2AsCLZiAPlUYHOcogllTia',
  cerbanimo:'1CB3LLMSnuDwD013B1ZY3M',
  'living-school':'2MwmQdjHyRBIu8Wy9iXWUm',
  fellowfare:'1q6YDYRU6hekl2MkHkI2X3',
  civweave:'2BLWIhSfHdbcfG5rP8IqoX'
};
assert.deepEqual(Object.keys(radio.registry).sort(),Object.keys(expectedIds).sort());
for(const [system,id] of Object.entries(expectedIds)){
  assert.match(radio.registry[system].spotifyUrl,new RegExp(`/playlist/${id}(?:\\?|$)`),`${system} playlist changed`);
}

const pageContext={
  activeSystem:'cerbanimo',currentRoute:'/app/realm-console-v140.html?room=workshop',route:'/app/realm-console-v140.html?room=workshop',
  previousSystem:'cerbanimo',lastPlaylistShown:'cerbanimo',lastTimeShown:new Date().toISOString(),sessionExposureCount:999,
  snoozeUntil:0,snoozeRemainingMs:0,reason:'page_navigated'
};
const awakeEligibility=radio.eligibility(pageContext);
assert.equal(awakeEligibility.eligible,true,'ordinary page navigation must always be eligible when awake');
assert.equal(awakeEligibility.reason,'page_navigated','ordinary page navigation must retain its navigation reason');

radio.registerDecisionProvider(async()=>({action:'suppress',messageVariant:'default',placement:'toast',reason:'provider_suppress'}));
const forced=await radio.agentDecision(pageContext);
assert.equal(forced.action,'show','presentation provider may not suppress an eligible per-page station ID');

const until=radio.snooze(30*60*1000);
assert.ok(until>Date.now()+29*60*1000,'explicit snooze must last about 30 minutes');
const sleeping=radio.eligibility({...pageContext,snoozeUntil:until,snoozeRemainingMs:until-Date.now()});
assert.equal(sleeping.eligible,false);
assert.equal(sleeping.reason,'user_snoozed');

assert.match(radioSource,/const SNOOZE_MS=30\*60\*1000;/,'snooze must be exactly 30 minutes');
assert.match(radioSource,/SNOOZE_KEY='civweave\.radio\.snooze-until\.v1'/,'snooze must persist across page loads');
assert.doesNotMatch(radioSource,/MAX_SESSION_EXPOSURES/,'session impression cap must stay retired');
assert.doesNotMatch(radioSource,/REENTRY_ELIGIBILITY_MS/,'re-entry cooldown must stay retired');
assert.doesNotMatch(radioSource,/SYSTEM_COOLDOWN_MS/,'per-system cooldown must stay retired');
assert.doesNotMatch(radioSource,/dismissedThisSession/,'session-long dismissal must stay retired');
assert.match(radioSource,/left:max\(14px,env\(safe-area-inset-left\)\)/,'radio must live in the bottom-left safe area');
assert.match(radioSource,/right:auto;/,'radio must explicitly vacate the chat button corner');
assert.match(radioSource,/translate3d\(calc\(-100% - 40px\),0,0\)/,'radio must exit toward the left edge');
assert.match(radioSource,/removeSuggestion\('auto_timeout'\)/,'auto timeout must only hide the current card');
assert.match(radioSource,/dismiss\.addEventListener\('click',[\s\S]*snooze\(SNOOZE_MS\)/,'explicit X must trigger the 30-minute snooze');
assert.match(radioSource,/scheduleEvaluation\('page_navigated',NAVIGATION_DEBOUNCE_MS\)/,'same-document navigation must re-evaluate radio');
assert.match(radioSource,/scheduleEvaluation\(reason,PRESENTATION_DELAY_MS,true\)/,'each new document must force an initial recommendation');

assert.match(boundarySource,/SYSTEM_RADIO_AGENT='\/app\/system-radio-agent-v233\.js'/,'install boundary must load v233');
assert.match(boundarySource,/radioRecommendationRevision:'v233-every-page-30-minute-snooze-bottom-left'/,'boundary metadata must describe the active policy');

console.log('Civweave system radio v233 per-page snooze contract verified.');
