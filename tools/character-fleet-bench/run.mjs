#!/usr/bin/env node
// Offline-first, one-request-at-a-time character fleet benchmark. Not a new Civweave inference owner.
import {readFile,appendFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {STARLING_PERSONAS} from '../../public/app/shared/starling-collective-v1.mjs';
import {CONVERGENCE_GUIDE_IDS,verifyBookCastPacket} from '../../public/app/shared/worldweaver-convergence-cast-v1.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const hash=s=>createHash('sha256').update(s).digest('hex');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const args=process.argv.slice(2);
function opt(key,def=''){const i=args.indexOf(key);return i<0?def:args[i+1]||def;}
function flag(key){return args.includes(key);}
function positive(key,def){const n=Number(opt(key,String(def)));if(!Number.isSafeInteger(n)||n<1)throw Error(key+' must be a positive integer');return n;}
function guideProfile(profiles,id){return profiles.find(p=>p.id===id);}
function characterPrompt(character,profiles){
  const group=character.id.split(':')[0],p=character.person;
  const policy="This is a private fictional character rehearsal, not a public release or a claim of human authority. No tool use is authorized. Do not assert you ran tools, cast human Guild votes, spent neurons, published content, or completed Quest work. Never use other characters' private thoughts as your own. Separate established canon from hypothetical improvisation.";
  if(group==='starling')return "You are "+p.name+", a fictional Starling persona. Role: "+p.role+". Style: "+p.style+". Reasoning approach: "+p.wiring+". Goal: "+p.goal+". "+policy;
  if(group==='cerbanimo'){
    const guide=guideProfile(profiles,character.id.slice(10));
    if(!guide)throw Error('Missing canonical guide '+character.id);
    return "You portray "+guide.name+", the Civweave guide of "+guide.system+". Role: "+guide.role+". Guide memory belongs only to this theme; no cross-guide private memory is supplied. "+policy;
  }
  if(group==='book')return "You portray "+p.name+" in a private noncanonical rehearsal. Author-supplied casting brief: "+(p.personaBrief||'unspecified')+". Canon rules: "+(p.canonRules||'unspecified')+". Relationships: "+(p.relationships||'unspecified')+". Improvisation: "+(p.interactionRules||'unspecified')+". Only the author can approve new canon. "+policy;
  throw Error('Unsupported character '+character.id);
}
function privateHost(host){return ['127.0.0.1','localhost','[::1]','::1'].includes(host);}
function lanHost(host){if(/^10\.\d+\.\d+\.\d+$/.test(host)||/^192\.168\.\d+\.\d+$/.test(host))return true;const m=/^172\.(\d+)\.\d+\.\d+$/.exec(host);return Boolean(m&&+m[1]>=16&&+m[1]<=31);}
function endpoint(binding,allowLan,allowRemote){
  const url=new URL(binding.endpoint);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('Invalid model endpoint');
  if(!privateHost(url.hostname)&&!(allowLan&&lanHost(url.hostname))&&!allowRemote)throw Error('Non-loopback endpoint requires --allow-lan or --allow-remote');
  if(url.protocol!=='https:'&&!privateHost(url.hostname)&&!lanHost(url.hostname))throw Error('Public model endpoints require HTTPS');
  return new URL(binding.provider==='ollama'?'/api/chat':'/v1/chat/completions',url).href;
}
async function infer(binding,messages,timeout,allowLan,allowRemote){
  const dest=endpoint(binding,allowLan,allowRemote);
  const ollama=binding.provider==='ollama';
  const payload=ollama
    ?{model:binding.model,messages,stream:false,keep_alive:0,options:{temperature:0.25,num_predict:320,seed:42}}
    :{model:binding.model,messages,stream:false,temperature:0.25,max_tokens:320,seed:42};
  const started=performance.now();
  const response=await fetch(dest,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(timeout)});
  const raw=await response.text();
  if(!response.ok)throw Error('HTTP '+response.status+': '+raw.slice(0,280));
  let data;try{data=JSON.parse(raw);}catch{throw Error('Model response was not JSON');}
  const value=ollama?data.message?.content:data.choices?.[0]?.message?.content;
  if(typeof value!=='string'||!value.trim())throw Error('Empty generated response');
  return {text:value.trim(),elapsedMs:Math.round(performance.now()-started),tokens:ollama?(data.eval_count??null):(data.usage?.completion_tokens??null)};
}
export function planCases({questionBank,characters,variants,bindings,questionLimit=20}){
  if(!Number.isInteger(questionLimit)||questionLimit<1||questionLimit>20)throw Error('Invalid question limit');
  const result=[];
  for(const variant of variants)for(const character of characters){
    const binding={...bindings.default,...(bindings.characters?.[character.id]||{})};
    if(!['ollama','openai-compatible'].includes(binding.provider)||typeof binding.model!=='string'||!binding.model.trim()||typeof binding.endpoint!=='string')throw Error('No valid explicit model binding for '+character.id);
    for(const question of questionBank.characters.find(x=>x.id===character.id)?.questions.slice(0,questionLimit)||[]){
      const system=characterPrompt(character,bindings.guideProfiles||[]);
      const prompt=[{role:'system',content:system},{role:'system',content:'Experiment variant '+variant.id+': '+variant.text},{role:'user',content:question.text}];
      result.push({caseId:hash(JSON.stringify({variant:variant.id,character:character.id,question:question.id,model:binding.model,prompt})).slice(0,24),
        variant:variant.id,character:character.id,question:question.id,category:question.category,model:binding.model,provider:binding.provider,binding,prompt});
    }
  }
  return result;
}
export async function loadRoster(bookPacket=null){
  const guides=await json(path.join(HERE,'../../public/app/assets/ai/profiles.json'));
  const roster=[
    ...Object.values(STARLING_PERSONAS).map(person=>({id:'starling:'+person.id,person})),
    ...CONVERGENCE_GUIDE_IDS.map(id=>({id:'cerbanimo:'+id,person:guideProfile(guides.profiles,id)}))
  ];
  if(bookPacket){
    verifyBookCastPacket(bookPacket);
    roster.push(...bookPacket.characters.map(person=>({id:'book:'+person.id,person})));
  }
  return {roster,guideProfiles:guides.profiles};
}
async function main(){
  const data=await json(path.join(HERE,'questions.json'));
  const agentList=await json(path.join(HERE,'agents.json'));
  const variants=await Promise.all(agentList.map(async v=>({...v,text:(await readFile(path.join(HERE,v.file),'utf8')).trim()})));
  const packetPath=opt('--book-packet');
  const packet=packetPath?await json(packetPath):null;
  const {roster,guideProfiles}=await loadRoster(packet);
  const selected=opt('--only').split(',').map(x=>x.trim()).filter(Boolean);
  for(const id of selected)if(!roster.some(x=>x.id===id))throw Error('Character not registered in canonical roster or casting packet: '+id);
  const characters=roster.filter(x=>(!selected.length||selected.includes(x.id))&&data.characters.some(c=>c.id===x.id));
  if(!characters.length)throw Error('No applicable character question banks');
  const configPath=opt('--config');
  const config=configPath?await json(configPath):{default:{provider:'ollama',model:'qwen3.5:4b',endpoint:'http://127.0.0.1:11434'},characters:{}};
  config.guideProfiles=guideProfiles;
  const cases=planCases({questionBank:data,characters,variants,bindings:config,questionLimit:positive('--question-limit',20)});
  const models=[...new Set(cases.map(x=>x.character+' → '+x.model))];
  console.log(JSON.stringify({characters:characters.length,variants:variants.length,questionsPerCharacter:positive('--question-limit',20),cases:cases.length,models},null,2));
  if(!flag('--run')){console.log('PLAN ONLY. Add --run to issue real model calls. Localhost only by default.');return;}
  const out=path.resolve(opt('--out','character-fleet-results.jsonl'));
  await mkdir(path.dirname(out),{recursive:true});
  const completed=new Set();
  if(flag('--resume'))try{
    const prior=await readFile(out,'utf8');
    for(const line of prior.split('\n').filter(Boolean)){try{const row=JSON.parse(line);if(row.status==='success')completed.add(row.caseId);}catch{}}
  }catch(e){if(e.code!=='ENOENT')throw e;}
  const max=positive('--max-cases',cases.length),timeout=positive('--timeout-ms',120000);
  let executed=0,failures=0,skipped=0;
  for(const item of cases){
    if(completed.has(item.caseId)){skipped++;continue;}
    if(executed>=max)break;
    const row={schema:'civweave.character-fleet-result.v1',caseId:item.caseId,variant:item.variant,character:item.character,question:item.question,category:item.category,model:item.model,provider:item.provider,at:new Date().toISOString()};
    try{
      const res=await infer(item.binding,item.prompt,timeout,flag('--allow-lan'),flag('--allow-remote'));
      Object.assign(row,{status:'success',...res});
    }catch(error){
      row.status='error';row.error=String(error?.message||error).slice(0,500);failures++;
    }
    await appendFile(out,JSON.stringify(row)+'\n',{mode:0o600});
    executed++;
    console.log(executed+'/'+Math.min(max,cases.length-skipped)+' '+row.variant+' '+row.character+' '+row.question+' '+row.status);
  }
  console.log(JSON.stringify({out,executed,skipped,failures,note:'No model quality score is inferred; use human review rubric.'}));
  if(failures)process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
