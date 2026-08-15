import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [classifier,deterministic,shared]=await Promise.all([
  read('public/app/minilm-message-classifier-v348.js'),
  read('public/app/deterministic-mode-v175.js'),
  read('public/app/shared-guide-surface-v236.js')
]);

for(const required of [
  "semanticFirst:true",
  "everyMessage:true",
  "deterministicRulesAfterClassification:true",
  "prewarmPolicy:'first-message-only'",
  "make it easier for me to understand quantum physics",
  "expectedSystem:'living-school'",
  "expectedSpeechAct:'greeting'",
  "rank(api,query,ROUTES",
  "rank(api,query,SPEECH",
  "rank(api,query,POSTURE",
  "resolvePending(api,text,current,pending)",
  "rankCandidates(text,candidates",
  "chooseClarificationDimension(text,dimensions",
  "prepareRequest(args={})",
  "semantic-route-ambiguous",
  "civweave:message-classified"
])assert(classifier.includes(required),`classifier missing ${required}`);

assert(!classifier.includes('substantive=')&&!classifier.includes('wordSet(text).size>=3'),'classifier still gates MiniLM behind a substantive-message heuristic');
assert(classifier.includes('const api=await ensureReady(),query=queryFor'),'classification does not start MiniLM on message demand');
assert(!/install\(\);\s*ensureReady\(/.test(classifier),'MiniLM is prewarmed during classifier installation');

for(const required of [
  "messageInterpretation:'minilm-before-deterministic-rules'",
  "everyMessage:true",
  "prepareSemantic(args={})",
  "const prepared=await prepareSemantic(args||{})",
  "classification?.route?.system",
  "classification?.actionMode==='discuss'",
  "deterministic fallback after semantic classifier"
])assert(deterministic.includes(required),`deterministic mode missing ${required}`);

const prepareIndex=deterministic.indexOf('const prepared=await prepareSemantic(args||{})');
const providerIndex=deterministic.indexOf("currentProvider()==='deterministic'");
assert(prepareIndex>=0&&providerIndex>prepareIndex,'provider/deterministic routing runs before semantic classification');
assert(deterministic.includes("const semantic=globalThis.CivweaveMessageClassifierV348?.routeHint?.(text,system);return semantic||lexicalRoute(text,system)"),'deterministic route does not prefer the semantic hint');

const classifierLoad=shared.indexOf('/app/minilm-message-classifier-v348.js');
const responseLoad=shared.indexOf('/app/minilm-response-router-v347.js');
assert(classifierLoad>=0&&responseLoad>classifierLoad,'shared chat loads response routing before the every-message classifier');
assert(shared.includes("messageClassifier:'minilm-v348-every-message-first'"),'shared guide surface does not advertise the semantic-first contract');

console.log(JSON.stringify({
  ok:true,
  contract:'every message -> MiniLM -> deterministic authority/fallback',
  classifier:'v348',
  regressions:['make-to-understand routes to learning semantics','greetings classified too','discussion separated from execution','clarification answers resume pending intent'],
  prewarm:'first message only, never chat-open/settings-open'
},null,2));
