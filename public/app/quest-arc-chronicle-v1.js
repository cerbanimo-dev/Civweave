(()=>{
'use strict';
if(globalThis.CivweaveQuestArcChronicleV1)return;

const VERSION='1.0.0';
const SCHEMA='civweave.quest-arc.v1';
const PROJECTION_SCHEMA='civweave.quest-chronicle-projection.v1';
const COMMITMENT_SCHEMA='civweave.sealed-receipt-commitment.v1';
const STORE_KEY='civweave.quest-arc.v1';
const OUTCOMES=Object.freeze(['CLEARED','SETBACK']);
const MODES=Object.freeze(['BEAT','VERSE','BOTH']);
const BEATS=Object.freeze([
  {id:'spark',label:'The Spark',meaning:'An intention, need, curiosity, or problem appears.',kind:'opening'},
  {id:'call',label:'The Call',meaning:'The intention becomes a named Quest with a destination.',kind:'opening'},
  {id:'stakes',label:'The Stakes',meaning:'Why the Quest matters and what success changes.',kind:'preparation'},
  {id:'gate',label:'At the Gate',meaning:'The Quest is paused, uncertain, or not yet committed to.',kind:'optional',optional:true},
  {id:'counsel',label:'Counsel',meaning:'Learning, planning, research, or guidance.',kind:'preparation'},
  {id:'muster',label:'The Muster',meaning:'Gathering tools, materials, skills, permissions, or resources.',kind:'preparation'},
  {id:'fellowship',label:'Fellowship',meaning:'A Party, mentor, Guild, collaborator, or helper joins.',kind:'optional',optional:true},
  {id:'threshold',label:'The Threshold',meaning:'The Hero commits and begins actual work.',kind:'action'},
  {id:'first-trial',label:'The First Trial',meaning:'The first meaningful action against the real problem.',kind:'action'},
  {id:'road-of-trials',label:'The Road of Trials',meaning:'Normal iterative work and repeated Quest actions.',kind:'action'},
  {id:'snare',label:'The Snare',meaning:'An attempt fails, becomes blocked, or exposes an obstacle.',kind:'setback',conditional:true},
  {id:'reforging',label:'Reforging',meaning:'The plan, tools, or approach changes after a setback.',kind:'recovery',conditional:true},
  {id:'deepening',label:'The Deepening',meaning:'Work moves from preliminary progress into the core problem.',kind:'action'},
  {id:'descent',label:'The Descent',meaning:'The most uncertain, demanding, or consequential portion begins.',kind:'action'},
  {id:'ordeal',label:'The Ordeal',meaning:'The decisive attempt, test, delivery, performance, or construction.',kind:'action'},
  {id:'breakthrough',label:'The Breakthrough',meaning:'The central objective is actually achieved.',kind:'completion'},
  {id:'claim',label:'The Claim',meaning:'The result is captured as an artifact, skill, evidence, or output.',kind:'completion'},
  {id:'homeward-road',label:'The Homeward Road',meaning:'Integration, delivery, cleanup, handoff, documentation, or application.',kind:'completion'},
  {id:'reckoning',label:'The Reckoning',meaning:'Validation, reflection, testing, review, and accounting for what happened.',kind:'completion'},
  {id:'gift',label:'The Gift',meaning:'The completed Quest becomes something reusable or shareable.',kind:'terminal',terminal:true},
  {id:'release',label:'The Release',meaning:'The Quest is deliberately closed without its original objective being completed.',kind:'terminal',terminal:true,conditional:true}
]);
const BEAT_BY_ID=new Map(BEATS.map(row=>[row.id,row]));
const clean=(value,max=6000)=>String(value??'').trim().replace(/\r/g,'').slice(0,max);
const now=()=>new Date().toISOString();
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const normalize=value=>Array.isArray(value)?value.map(normalize):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,normalize(value[key])])):value;
const canonical=value=>JSON.stringify(normalize(value));

function beat(value){return BEAT_BY_ID.get(clean(value,80).toLowerCase())||BEAT_BY_ID.get('spark')}
function emptyState(){return{schema:SCHEMA,version:1,quests:{},updatedAt:now()}}
function readState(){try{const raw=parse(localStorage.getItem(STORE_KEY),{});return{...emptyState(),...(raw&&typeof raw==='object'?raw:{}),quests:raw?.quests&&typeof raw.quests==='object'?raw.quests:{}}}catch{return emptyState()}}
function writeState(state){const next={schema:SCHEMA,version:1,quests:state?.quests&&typeof state.quests==='object'?state.quests:{},updatedAt:now()};try{localStorage.setItem(STORE_KEY,JSON.stringify(next))}catch{};try{dispatchEvent(new CustomEvent('civweave:quest-arc-changed',{detail:{updatedAt:next.updatedAt}}))}catch{};return next}
function questState(questId,state=readState()){const id=clean(questId,180);return id&&state.quests[id]?clone(state.quests[id]):null}
function makeHistory(beatId,outcome='CLEARED',reason=''){const row=beat(beatId);return{id:uid('beat'),beatId:row.id,beatName:row.label,outcome:OUTCOMES.includes(outcome)?outcome:'CLEARED',reason:clean(reason,160),at:now()}}
function initializeQuest(quest){const id=clean(quest?.id,180);if(!id)return null;return{questId:id,currentBeatId:'call',resumeBeatId:'',history:[makeHistory('spark','CLEARED','quest-created')],lastSnapshot:{},updatedAt:now()}}
function snapshotQuest(quest){const tasks=Array.isArray(quest?.tasks)?quest.tasks:[],statuses=tasks.map(row=>clean(row?.status,40));return{status:clean(quest?.status,40),taskCount:tasks.length,completed:statuses.filter(value=>value==='completed').length,inProgress:statuses.filter(value=>value==='in-progress').length,proofReady:statuses.filter(value=>value==='proof-ready').length,review:statuses.filter(value=>value==='review').length,revision:statuses.filter(value=>value==='revision').length,objective:Boolean(clean(quest?.objective||quest?.description,20))}}
function suggestedBeat(quest){const snap=snapshotQuest(quest);if(snap.status==='archived')return'release';if(snap.status==='completed')return'gift';if(snap.status==='review')return'reckoning';if(snap.status==='revision'||snap.revision>0)return'reforging';if(snap.taskCount&&snap.completed===snap.taskCount)return'claim';if(snap.review||snap.proofReady)return snap.completed>1?'deepening':'road-of-trials';if(snap.inProgress)return snap.completed?'road-of-trials':'threshold';if(snap.completed>1)return'road-of-trials';if(snap.completed===1)return'first-trial';if(snap.taskCount)return'muster';if(snap.objective)return'stakes';return'call'}
function appendHistory(row,beatId,outcome,reason){const target=beat(beatId);const last=row.history?.[row.history.length-1];if(last?.beatId===target.id&&last?.outcome===outcome)return;row.history=Array.isArray(row.history)?row.history:[];row.history.push(makeHistory(target.id,outcome,reason));row.history=row.history.slice(-120)}
function syncQuest(quest){const id=clean(quest?.id,180);if(!id)return null;const state=readState(),row=state.quests[id]||initializeQuest(quest),previous=row.lastSnapshot||{},next=snapshotQuest(quest),target=suggestedBeat(quest);
  if((next.status==='revision'||next.revision>0)&&previous.status!=='revision'&&!previous.revision){const resume=['threshold','first-trial','road-of-trials','deepening','descent','ordeal'].includes(row.currentBeatId)?row.currentBeatId:'road-of-trials';row.resumeBeatId=resume;appendHistory(row,'snare','SETBACK','revision-requested');row.currentBeatId='reforging'}
  else if(row.currentBeatId==='reforging'&&next.status!=='revision'&&!next.revision&&(next.inProgress||next.proofReady||next.review)){appendHistory(row,'reforging','CLEARED','work-resumed');row.currentBeatId=row.resumeBeatId||target;row.resumeBeatId=''}
  else if(target!==row.currentBeatId){const old=beat(row.currentBeatId);if(!old.terminal)appendHistory(row,old.id,'CLEARED','automatic-progression');row.currentBeatId=target}
  row.lastSnapshot=next;row.updatedAt=now();state.quests[id]=row;writeState(state);return clone(row)}
function syncAll(input){const quests=Array.isArray(input)?input:(Array.isArray(input?.quests)?input.quests:[]);return quests.map(syncQuest).filter(Boolean)}
function advance(questId,event,context={}){const id=clean(questId,180);if(!id)return null;const state=readState(),row=state.quests[id]||{questId:id,currentBeatId:'spark',resumeBeatId:'',history:[],lastSnapshot:{},updatedAt:now()},name=clean(event,80).toUpperCase(),current=row.currentBeatId;
  const direct={QUEST_NAMED:'call',STAKES_SET:'stakes',PAUSED:'gate',COUNSEL_STARTED:'counsel',RESOURCES_READY:'muster',FELLOWSHIP_JOINED:'fellowship',WORK_STARTED:'threshold',FIRST_TRIAL_CLEARED:'first-trial',ITERATION_CLEARED:'road-of-trials',CORE_WORK_STARTED:'deepening',DECISIVE_WORK_STARTED:'descent',ORDEAL_STARTED:'ordeal',OBJECTIVE_MET:'breakthrough',RESULT_CLAIMED:'claim',HANDOFF_STARTED:'homeward-road',REVIEW_STARTED:'reckoning',GIFT_SHARED:'gift',QUEST_RELEASED:'release'};
  if(name==='SETBACK'){row.resumeBeatId=current;appendHistory(row,'snare','SETBACK',context.reason||'setback');row.currentBeatId='reforging'}
  else if(name==='REFORGED'){appendHistory(row,'reforging','CLEARED',context.reason||'reforged');row.currentBeatId=row.resumeBeatId||'road-of-trials';row.resumeBeatId=''}
  else if(direct[name]){appendHistory(row,current,'CLEARED',name.toLowerCase());row.currentBeatId=direct[name]}
  row.updatedAt=now();state.quests[id]=row;writeState(state);return clone(row)}

function deterministicBeatText(beatId,outcome='CLEARED'){const row=beat(beatId);return`${row.label} — ${outcome==='SETBACK'?'Setback':'Cleared'}`}
function publicInput(input={}){const row=beat(input.beatId||input.questBeat);return{publicQuestName:clean(input.publicQuestName||input.questName,180)||'Unnamed Quest',publicQuestBrief:clean(input.publicQuestBrief||input.questBrief,600),questBeat:row.id,beatName:row.label,beatMeaning:row.meaning,outcome:input.outcome==='SETBACK'?'SETBACK':'CLEARED',safeOutcomeHint:clean(input.safeOutcomeHint,280)}}
function versePrompt(input={}){const value=publicInput(input);return`You are the chronicler of a Hero's Quest.\nWrite exactly four short lines describing this moment in the Quest.\n\nQuest: ${value.publicQuestName}\nQuest description: ${value.publicQuestBrief||'No public description was supplied.'}\nQuest Beat: ${value.beatName}\nMeaning of this Beat: ${value.beatMeaning}\nOutcome: ${value.outcome}\nSafe outcome hint: ${value.safeOutcomeHint||'None.'}\n\nRules:\n- Output exactly four lines.\n- Do not add a title, labels, bullets, numbering, or explanation.\n- Keep each line short and easy to understand.\n- Use light mythic or adventurous language.\n- Describe only what the provided information supports.\n- Never invent people, places, actions, evidence, or achievements.\n- Never infer or reveal hidden work details.\n- For CLEARED, show that the Hero has moved through this part of the journey.\n- For SETBACK, acknowledge the obstacle without shame or declaring the whole Quest a failure.\n- Do not promise future success.\n- Do not mention AI, models, prompts, receipts, or Civweave.`}
function validateVerse(value){const text=clean(value,1200).replace(/^```[^\n]*\n?/,'').replace(/```$/,'').trim(),lines=text.split('\n').map(row=>row.trim()).filter(Boolean);if(lines.length!==4)return{ok:false,error:'line-count',lines:[]};if(lines.some(line=>/^\s*(?:[-*•]|\d+[.)]|title\s*:|verse\s*:)/i.test(line)))return{ok:false,error:'label-or-list',lines:[]};if(lines.some(line=>line.length>180))return{ok:false,error:'line-too-long',lines:[]};return{ok:true,lines,text:lines.join('\n')}}
function generatedText(result){if(typeof result==='string')return result;if(typeof result?.outputText==='string')return result.outputText;if(typeof result?.text==='string')return result.text;if(Array.isArray(result?.outputJson?.lines))return result.outputJson.lines.join('\n');if(typeof result?.outputJson?.verse==='string')return result.outputJson.verse;return''}
async function runtimeGenerator(prompt,{retry=false}={}){try{if(globalThis.CivweaveLudModeV1?.isEnabled?.()===true)return null;await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();const runtime=globalThis.CivweaveModelRuntime;if(!runtime?.generate)return null;let config=null;try{config=runtime.readSharedConfig?.('interactive')||null}catch{};if(!config)return null;const request={purpose:'quest-chronicle-verse-low-tier-v1',executionProfile:'interactive',config:{...config,maxTokens:160,temperature:0.55,stream:false,timeoutMs:Math.min(12000,Number(config.timeoutMs)||12000)},context:{complexity:'tiny',requestedTier:'low',publicOnly:true,retry:Boolean(retry)},messages:[{role:'system',content:'Return only a four-line Quest Verse. Use only the supplied public quest metadata. Never infer hidden work details.'},{role:'user',content:prompt}]};const result=await runtime.generate(request);if(!['success','fallback'].includes(result?.status))return null;return generatedText(result)}catch{return null}}
async function generateVerse(input={},options={}){const value=publicInput(input),fallback=deterministicBeatText(value.questBeat,value.outcome),generator=typeof options.generate==='function'?options.generate:runtimeGenerator,prompt=versePrompt(value);for(let attempt=0;attempt<2;attempt++){let output=null;try{output=await generator(attempt?`${prompt}\n\nCorrection: output exactly four non-empty lines and nothing else.`:prompt,{retry:attempt===1,input:value})}catch{}const checked=validateVerse(generatedText(output)||output);if(checked.ok)return{ok:true,kind:'VERSE',text:checked.text,lines:checked.lines,attempts:attempt+1,promptVersion:'quest-chronicle-verse-v1',fallback:false}}return{ok:true,kind:'BEAT',text:fallback,lines:[],attempts:2,promptVersion:'quest-chronicle-verse-v1',fallback:true}}

function bytesToHex(bytes){return[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
function hexToBytes(value){const hex=clean(value,512).toLowerCase();if(!/^[0-9a-f]+$/.test(hex)||hex.length%2)return null;const out=new Uint8Array(hex.length/2);for(let i=0;i<out.length;i++)out[i]=parseInt(hex.slice(i*2,i*2+2),16);return out}
function randomSalt(){if(!globalThis.crypto?.getRandomValues)throw new Error('Secure randomness is unavailable.');const bytes=new Uint8Array(24);globalThis.crypto.getRandomValues(bytes);return bytesToHex(bytes)}
async function digestHex(value){if(!globalThis.crypto?.subtle?.digest)throw new Error('SHA-256 is unavailable.');const bytes=new TextEncoder().encode(value),digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);return bytesToHex(new Uint8Array(digest))}
async function commitSealedReceipt(receipt,{salt}={}){const saltHex=clean(salt,128)||randomSalt();if(!hexToBytes(saltHex))throw new Error('Receipt commitment salt must be hexadecimal.');const digest=await digestHex(`${saltHex}:${canonical(receipt||{})}`);return Object.freeze({schema:COMMITMENT_SCHEMA,algorithm:'SHA-256',canonicalization:'json-stable-v1',salt:saltHex,digest})}
async function verifySealedReceipt(receipt,commitment){if(commitment?.schema!==COMMITMENT_SCHEMA||commitment?.algorithm!=='SHA-256')return false;try{const expected=await commitSealedReceipt(receipt,{salt:commitment.salt});return expected.digest===clean(commitment.digest,128).toLowerCase()}catch{return false}}
function projectReceipt(input={}){const value=publicInput(input),mode=MODES.includes(input.mode)?input.mode:'BOTH',checked=input.verse?validateVerse(Array.isArray(input.verse)?input.verse.join('\n'):input.verse):{ok:false},beatText=deterministicBeatText(value.questBeat,value.outcome),verse=checked.ok?checked.text:'';return Object.freeze({schema:PROJECTION_SCHEMA,kind:'quest-beat-receipt',questId:clean(input.questId,180)||null,publicQuestName:value.publicQuestName,beatId:value.questBeat,beatName:value.beatName,outcome:value.outcome,mode,displayText:mode==='VERSE'?(verse||beatText):mode==='BEAT'?beatText:verse?`${beatText}\n${verse}`:beatText,verse:verse||null,receiptCommitment:input.receiptCommitment&&typeof input.receiptCommitment==='object'?clone(input.receiptCommitment):null,privacy:Object.freeze({sealedReceiptIncluded:false,workSummaryIncluded:false,evidenceIncluded:false,safeOutcomeHintIncluded:false}),createdAt:clean(input.createdAt,80)||now()})}
async function createProjection(input={},options={}){const verseResult=(input.mode||'BOTH')==='BEAT'?null:await generateVerse(input,options);return projectReceipt({...input,verse:verseResult?.kind==='VERSE'?verseResult.text:''})}
function currentBeat(questId){const row=questState(questId);return row?beat(row.currentBeatId):beat('spark')}
function status(){const state=readState();return{version:VERSION,schema:SCHEMA,storeKey:STORE_KEY,questCount:Object.keys(state.quests).length,beats:BEATS.length}}
function syncFromEngine(){try{const engine=globalThis.CivweaveCerbanimoQuestV144,state=engine?.readState?.();if(state?.quests)syncAll(state.quests)}catch{}}
try{addEventListener('cerbanimo:quest-engine-changed',event=>syncAll(event?.detail?.state?.quests||[]))}catch{}
try{addEventListener('civweave:lud-human-quest-created',event=>event?.detail?.quest&&syncQuest(event.detail.quest))}catch{}
if(typeof document!=='undefined'){if(document.readyState==='loading')addEventListener('DOMContentLoaded',syncFromEngine,{once:true});else queueMicrotask(syncFromEngine)}

const api=Object.freeze({VERSION,SCHEMA,PROJECTION_SCHEMA,COMMITMENT_SCHEMA,STORE_KEY,BEATS,OUTCOMES,MODES,beat,readState,questState,currentBeat,suggestedBeat,syncQuest,syncAll,advance,deterministicBeatText,publicInput,versePrompt,validateVerse,generateVerse,commitSealedReceipt,verifySealedReceipt,projectReceipt,createProjection,status});
globalThis.CivweaveQuestArcChronicleV1=api;
try{dispatchEvent(new CustomEvent('civweave:quest-arc-ready',{detail:{version:VERSION,beats:BEATS.length}}))}catch{}
})();