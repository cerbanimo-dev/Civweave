import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ROOT=new URL('../',import.meta.url);
const radioPath=new URL('public/app/system-radio-agent-v232.js',ROOT);
const orchestratorPath=new URL('public/app/experience-orchestrator-v232.js',ROOT);
const boundaryPath=new URL('public/app/install-boundary-v146.js',ROOT);
const radioSource=fs.readFileSync(radioPath,'utf8');
const orchestratorSource=fs.readFileSync(orchestratorPath,'utf8');
const boundarySource=fs.readFileSync(boundaryPath,'utf8');

class Store {
  constructor(){this.map=new Map()}
  getItem(key){return this.map.has(key)?this.map.get(key):null}
  setItem(key,value){this.map.set(key,String(value))}
  removeItem(key){this.map.delete(key)}
}
const document={
  readyState:'complete',
  documentElement:{dataset:{civweaveSystemRoute:''}},
  body:{dataset:{},append(){}},
  head:{append(){}},
  querySelector(){return null},
  getElementById(){return null},
  addEventListener(){},
  createElement(tag){return{tag,dataset:{},style:{},className:'',setAttribute(){},append(){},addEventListener(){},remove(){},textContent:'',href:'',target:'',rel:'',type:''}}
};
const sandbox={
  console,URL,Date,Math,JSON,Object,Array,Set,Map,Number,String,Boolean,Promise,
  document,
  location:{pathname:'/not-a-system',search:'',hash:''},
  localStorage:new Store(),sessionStorage:new Store(),
  crypto:{randomUUID:()=> 'session-test'},
  CustomEvent:class CustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  addEventListener(){},removeEventListener(){},dispatchEvent(){},setTimeout(){return 1},clearTimeout(){},queueMicrotask(fn){fn()}
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(orchestratorSource,sandbox,{filename:'experience-orchestrator-v232.js'});
vm.runInContext(radioSource,sandbox,{filename:'system-radio-agent-v232.js'});

const radio=sandbox.CivweaveRadioRecommendationAgentV232;
assert.ok(radio,'radio agent runtime must initialize');
const expected={
  anarchadia:{name:'Anarchadia Radio',url:'https://open.spotify.com/playlist/2AsCLZiAPlUYHOcogllTia?si=eb56f112a533471f',copy:'Need an anthem?'},
  cerbanimo:{name:'Cerbanimo Radio',url:'https://open.spotify.com/playlist/1CB3LLMSnuDwD013B1ZY3M?si=53a4a04d7e124ffe',copy:'Pump up the tempo.'},
  'living-school':{name:'Living School Radio',url:'https://open.spotify.com/playlist/2MwmQdjHyRBIu8Wy9iXWUm?si=3050b522d37e432d',copy:'Live and learn.'},
  fellowfare:{name:'Fellowfare Radio',url:'https://open.spotify.com/playlist/1q6YDYRU6hekl2MkHkI2X3?si=65a29df0b33a435c',copy:"Soft Rock for the People's Mall."},
  civweave:{name:'Civweave Radio',url:'https://open.spotify.com/playlist/2BLWIhSfHdbcfG5rP8IqoX?si=erOpH2egRsyWT5HvxRO0tQ',copy:'Thinking big picture? Us too.'}
};
assert.equal(JSON.stringify(Object.keys(radio.registry).sort()),JSON.stringify(Object.keys(expected).sort()),'registry must contain exactly the five canonical systems');
for(const [system,spec] of Object.entries(expected)){
  const entry=radio.registry[system];
  assert.equal(entry.name,spec.name,`${system} radio name drifted`);
  assert.equal(entry.spotifyUrl,spec.url,`${system} Spotify URL drifted`);
  assert.equal(entry.messages[0]?.text,spec.copy,`${system} approved copy drifted`);
  const parsed=new URL(entry.spotifyUrl);
  assert.equal(parsed.protocol,'https:');
  assert.equal(parsed.hostname,'open.spotify.com');
  assert.match(parsed.pathname,/^\/playlist\//);
}
assert.equal(radio.normalizeSystemId('living_school'),'living-school');
assert.equal(radio.normalizeSystemId('commonweave'),'commonweave','Civweave must remain the canonical fifth-system identity');

let agentInput=null;
radio.registerDecisionProvider(async input=>{agentInput=input;return{action:'show',messageVariant:'default',placement:'transition-card',reason:'system_changed'}});
const eligibleContext={
  activeSystem:'cerbanimo',currentRoute:'/app/realm-console-v140.html?system=cerbanimo',route:'/app/realm-console-v140.html?system=cerbanimo',previousSystem:'anarchadia',
  lastPlaylistShown:'',lastTimeShown:'',dismissalState:{dismissedThisSession:false},sessionExposureCount:0,userInteractionState:{interacted:true,critical:false}
};
const decision=await radio.agentDecision(eligibleContext);
assert.equal(decision.action,'show');
assert.equal(agentInput.activeSystem,'cerbanimo');
assert.equal('spotifyUrl' in agentInput,false,'agent input must not receive Spotify URL');
assert.equal('url' in agentInput,false,'agent input must not receive destination URL');
assert.equal(JSON.stringify(agentInput.approvedCopyIds),JSON.stringify(['default']));

radio.registerDecisionProvider(async()=>({action:'show',messageVariant:'invented-copy',placement:'billboard',reason:'attempted_override'}));
const sanitized=await radio.agentDecision({...eligibleContext,activeSystem:'civweave',previousSystem:'cerbanimo'});
assert.equal(sanitized.messageVariant,'default','unapproved copy IDs must be replaced');
assert.equal(sanitized.placement,'toast','unapproved placements must be replaced');

const protectedDecision=await radio.agentDecision({...eligibleContext,activeSystem:'fellowfare',route:'/checkout',currentRoute:'/checkout'});
assert.equal(protectedDecision.action,'suppress');
assert.equal(protectedDecision.reason,'protected_flow');

assert.match(radioSource,/const AUTO_DISMISS_MS=6000;/,'radio surface should live for about six seconds');
assert.match(radioSource,/bottom:max\(14px,env\(safe-area-inset-bottom\)\)/,'radio surface should be pinned to the bottom-right safe area');
assert.match(radioSource,/@keyframes cw-radio-progress-v232/,'radio surface should expose a left-to-right lifetime animation');
assert.match(radioSource,/@keyframes cw-radio-out-v232/,'radio surface should slide out to the right');
assert.match(radioSource,/scheduleAutoDismiss\(card\)/,'rendered radio cards should schedule their own timeout');
assert.doesNotMatch(radioSource,/\[data-placement="transition-card"\]\s*\{[^}]*bottom:50%/,'agent placement must not pull the radio surface away from bottom-right');

assert.match(boundarySource,/const SYSTEM_RADIO_AGENT='\/app\/system-radio-agent-v233\.js'/,'Active shared boundary must retain a system radio runtime.');
assert.match(boundarySource,/SYSTEM_EXPERIENCE_SCRIPTS=\[[^\]]*EXPERIENCE_ORCHESTRATOR[^\]]*SYSTEM_RADIO_AGENT[^\]]*\]/,'Radio must remain a first-class shared experience script even when other extensions are added.');
assert.match(boundarySource,/installSystemExperienceSupport\(\)/);

console.log('Civweave system radio v232 compatibility contract verified.');
