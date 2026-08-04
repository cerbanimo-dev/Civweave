import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const [relay,indexHtml,worker,boundary]=await Promise.all([
  readFile('public/app/cabinets/living-school/living-school-two-agent-relay-v165.js','utf8'),
  readFile('public/app/cabinets/living-school/index.html','utf8'),
  readFile('public/service-worker-v156.js','utf8'),
  readFile('public/app/install-boundary-v146.js','utf8')
]);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
for(const token of ['two-agent-youtube-relay','callAntigravity','google','youtubeId','manual-search','searchPhrase','multipleChoice','shortAnswer','minItems:3'])assert(relay.toLowerCase().includes(token.toLowerCase()),`Relay is missing ${token}.`);
assert(indexHtml.indexOf('living-school-two-agent-relay-v165.js')<indexHtml.indexOf('living-school-research-v162.js'),'The two-agent relay must load before older forge interceptors.');
assert(worker.includes('/app/cabinets/living-school/living-school-two-agent-relay-v165.js'),'Installed package does not patch in the two-agent relay.');
assert(worker.includes("TWO_AGENT_RELAY_REVISION='living-school-two-agent-youtube-v165'"),'Service worker is missing the relay revision.');
assert(boundary.includes("additionsVersion:'v165-living-school-two-agent-youtube'"),'Install boundary did not rotate for the relay.');

class MemoryStorage{
  constructor(seed={}){this.values=new Map(Object.entries(seed))}
  getItem(key){return this.values.has(key)?this.values.get(key):null}
  setItem(key,value){this.values.set(key,String(value))}
  removeItem(key){this.values.delete(key)}
}
const state={schema:'living-school-cabinet-v151',version:2,school:null,sources:[],progress:{},passport:{xp:0,ledger:[]},events:[],settings:{}};
const storage=new MemoryStorage({'commonweave.living-school.cabinet.v151':JSON.stringify(state)});
const document={readyState:'complete',querySelector(){return null},addEventListener(){}};
const sandbox={
  console,Date,Math,URL,JSON,structuredClone,setTimeout,clearTimeout,
  localStorage:storage,sessionStorage:new MemoryStorage(),document,
  location:{href:'https://example.test/app/cabinets/living-school/',origin:'https://example.test',protocol:'https:',pathname:'/app/cabinets/living-school/'},
  MutationObserver:class{observe(){}},StorageEvent:class{},CustomEvent:class{},
  dispatchEvent(){},addEventListener(){},requestAnimationFrame(callback){callback()},fetch:async()=>{throw new Error('Network should not be used by deterministic generation.')},
  globalThis:null
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(relay,sandbox,{filename:'living-school-two-agent-relay-v165.js'});
const api=sandbox.LivingSchoolTwoAgentRelayV165;
assert(api?.generateSchool,'Relay API was not installed.');
const school=await api.generateSchool({modelRoute:'deterministic',count:4,capability:'build a community garden',level:'beginner',mode:'guided',proof:''},state);
assert(school.modules.length===4,'Deterministic fallback did not create the requested module count.');
for(const module of school.modules){
  assert(Array.isArray(module.multipleChoice)&&module.multipleChoice.length>=3,`${module.title} has fewer than three multiple-choice questions.`);
  assert(module.shortAnswer?.prompt,`${module.title} has no short-answer prompt.`);
  assert(!module.media.youtubeUrl,`${module.title} invented a YouTube URL without agentic research.`);
  assert(/youtube/i.test(module.media.searchPhrase),`${module.title} has no canned YouTube search phrase.`);
}
assert(school.generation.relay.agenticAttempted===false,'Deterministic generation incorrectly claims agentic research.');
assert(api.youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')==='dQw4w9WgXcQ','YouTube watch URL validation failed.');
assert(api.youtubeId('https://example.com/watch?v=dQw4w9WgXcQ')==='','Non-YouTube URL passed video validation.');
console.log(JSON.stringify({ok:true,relay:'antigravity-research-to-moss-teaching',agenticVideoRule:'seek-and-open-when-available',offlineFallback:'complete-module-plus-search-phrase',moduleContract:{multipleChoice:3,shortAnswer:1}},null,2));
