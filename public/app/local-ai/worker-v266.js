'use strict';
const CACHE='civweave-model-generative-v266';
const TRANSFORMERS='/app/vendor/transformers/transformers.min.js';
let hfRuntime=null,tokenizer=null,model=null,loaded=null,loading=null;
const clean=(value,max=200000)=>String(value??'').slice(0,max);
const now=()=>performance.now();
const post=(id,type,payload={})=>self.postMessage({id,type,...payload});
const phase=(id,name,started,detail={})=>post(id,'progress',{progress:{phase:name,elapsedMs:Math.round(now()-started),...detail}});
const artifactFor=(spec,path)=>spec?.artifacts?.find?.(row=>row?.path===path)||null;
const revisionFor=(spec,path)=>artifactFor(spec,path)?.revision||spec.revision;
const remoteUrl=(spec,path)=>`https://huggingface.co/${spec.repo}/resolve/${encodeURIComponent(revisionFor(spec,path))}/${path}`;
function requestUrl(input){try{return typeof input==='string'?input:input?.url||String(input)}catch{return String(input||'')}}
function cacheAdapter(cache,spec){
  const localPrefix=`/models/${spec.repo}/`,repoPrefix=`https://huggingface.co/${spec.repo}/resolve/`;
  const miss=()=>new Response('',{status:404,statusText:'Downloaded model cache miss'});
  const find=async path=>{const hit=await cache.match(remoteUrl(spec,path));return hit?.ok?hit.clone():miss()};
  return{async match(request){const key=requestUrl(request);if(key.startsWith(localPrefix))return find(key.slice(localPrefix.length));if(key.startsWith(repoPrefix)){const rest=key.slice(repoPrefix.length),slash=rest.indexOf('/');if(slash>=0)return find(rest.slice(slash+1))}try{const hit=await cache.match(request);return hit?.ok?hit.clone():undefined}catch{return undefined}},put:(request,response)=>cache.put(request,response)};
}
function friendlyError(error,spec,stage='inference'){
  const raw=String(error?.message||error);
  if(raw.includes('/models/')&&(raw.includes('env.allowRemoteModels=false')||raw.includes('local_files_only=true')))return `Downloaded model cache miss for ${spec?.label||spec?.id||'the selected model'} during ${stage}. Resume this model while online so Civweave can fetch only the missing artifact.`;
  if(/Unexpected end of JSON input|Unexpected token\s*['"]?<|<!doctype|not valid JSON/i.test(raw))return `Downloaded model metadata is missing, truncated, or invalid for ${spec?.label||spec?.id||'the selected model'} during ${stage}. Reopen model settings while online so Civweave can repair only the bad metadata artifact.\n\nTransport detail: ${raw}`;
  if(/Failed to get GPU adapter|WebGPU adapter|no available backend|WebGPU is unavailable/i.test(raw))return `This browser did not provide a usable WebGPU adapter during ${stage}. Civweave can use its CPU/WASM compatibility lane when the request allows it.\n\nBackend detail: ${raw}`;
  if(/shader|device lost|out of memory|allocation|buffer/i.test(raw))return `${spec?.label||spec?.id||'The selected model'} reached a WebGPU/device limit during ${stage}. ${raw}`;
  return raw;
}
async function backendProfile(spec){
  if(spec.device!=='webgpu')return{backend:'wasm',gpu:null};
  if(!self.navigator?.gpu?.requestAdapter)throw new Error('WebGPU is unavailable in this worker.');
  let adapter;try{adapter=await self.navigator.gpu.requestAdapter({powerPreference:'high-performance'})}catch(error){throw new Error(`Failed to get GPU adapter: ${clean(error?.message||error,1000)}`)}
  if(!adapter)throw new Error('Failed to get GPU adapter.');
  const info=adapter.info||{};
  return{backend:'webgpu',gpu:{available:true,shaderF16:Boolean(adapter.features?.has?.('shader-f16')),vendor:clean(info.vendor||'',120),architecture:clean(info.architecture||'',120),device:clean(info.device||'',120),description:clean(info.description||'',180),maxBufferSize:Number(adapter.limits?.maxBufferSize||0),maxStorageBufferBindingSize:Number(adapter.limits?.maxStorageBufferBindingSize||0)}};
}
async function configureRuntime(hf,cache,spec){hf.env.allowLocalModels=true;hf.env.allowRemoteModels=false;hf.env.useBrowserCache=false;hf.env.useCustomCache=true;hf.env.customCache=cacheAdapter(cache,spec);if(hf.env.backends?.onnx?.wasm)hf.env.backends.onnx.wasm.wasmPaths='/app/vendor/transformers/wasm/'}
async function ensure(spec,id){
  const key=`${spec.id}:${spec.device||'wasm'}:${spec.dtype||''}`;
  if(loaded?.key===key&&tokenizer&&model)return{coldStart:false,coldStartMs:0,tokenizerLoadMs:0,modelLoadMs:0,warmupMs:0,backend:loaded.backend,gpu:loaded.gpu};
  if(loading)return loading;
  loading=(async()=>{
    const started=now();phase(id,'loading-runtime',started,{model:spec.id});
    const hf=hfRuntime||(hfRuntime=await import(TRANSFORMERS)),cache=await caches.open(CACHE);await configureRuntime(hf,cache,spec);
    phase(id,'checking-backend',started,{model:spec.id,requestedBackend:spec.device||'wasm'});const profile=await backendProfile(spec);
    phase(id,'loading-tokenizer',started,{model:spec.id,backend:profile.backend,gpu:profile.gpu});const tokenizerStarted=now();
    tokenizer=await hf.AutoTokenizer.from_pretrained(spec.repo,{revision:spec.revision,progress_callback:p=>phase(id,'loading-tokenizer',started,{model:spec.id,backend:profile.backend,...p})});
    const tokenizerLoadMs=Math.round(now()-tokenizerStarted);
    phase(id,'loading-model',started,{model:spec.id,backend:profile.backend});const modelStarted=now();
    model=await hf.AutoModelForCausalLM.from_pretrained(spec.repo,{revision:spec.revision,device:spec.device||profile.backend,dtype:spec.dtype,progress_callback:p=>phase(id,'loading-model',started,{model:spec.id,backend:profile.backend,...p})});
    const modelLoadMs=Math.round(now()-modelStarted);
    phase(id,'warming-model',started,{model:spec.id,backend:profile.backend});const warmStarted=now();
    await model.generate({...tokenizer('a'),max_new_tokens:1,do_sample:false});
    const warmupMs=Math.round(now()-warmStarted),coldStartMs=Math.round(now()-started);
    loaded={key,id:spec.id,repo:spec.repo,revision:spec.revision,backend:profile.backend,dtype:spec.dtype,gpu:profile.gpu};
    const metrics={coldStart:true,coldStartMs,tokenizerLoadMs,modelLoadMs,warmupMs,backend:profile.backend,gpu:profile.gpu};phase(id,'model-ready',started,{model:spec.id,...metrics});return metrics;
  })().catch(error=>{try{model?.dispose?.()}catch{}tokenizer=null;model=null;loaded=null;throw error}).finally(()=>{loading=null});
  return loading;
}
function parseJsonLoose(text){const source=clean(text).replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();for(let start=0;start<source.length;start++){if(source[start]!=='{'&&source[start]!=='[')continue;const open=source[start],close=open==='{'?'}':']';let depth=0,quoted=false,escaped=false;for(let i=start;i<source.length;i++){const c=source[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}if(c==='"'){quoted=true;continue}if(c===open)depth++;else if(c===close&&--depth===0){try{return JSON.parse(source.slice(start,i+1))}catch{break}}}}return null}
const promptTokenCount=inputs=>Number(inputs?.input_ids?.dims?.at?.(-1)||inputs?.input_ids?.tolist?.()?.[0]?.length||0);
const generatedIds=(sequences,count)=>{try{return sequences?.tolist?.()?.[0]?.slice(count)||[]}catch{return[]}};
function contentText(value){if(typeof value==='string')return value;if(Array.isArray(value))return value.map(x=>typeof x==='string'?x:clean(x?.text||x?.content||'',12000)).filter(Boolean).join('\n');return clean(value?.text||value?.content||value||'',24000)}
function normalizeMessages(messages){return(Array.isArray(messages)?messages:[]).map(row=>({role:['system','assistant','user'].includes(String(row?.role))?String(row.role):'user',content:contentText(row?.content??row?.text)})).filter(row=>row.content.trim())}
function chatInputs(rows,thinking){return tokenizer.apply_chat_template(rows,{add_generation_prompt:true,tokenize:true,return_dict:true,enable_thinking:Boolean(thinking)})}
function countChatTokens(rows,thinking){try{return promptTokenCount(chatInputs(rows,thinking))}catch{return Math.max(1,Math.ceil(rows.reduce((n,row)=>n+String(row.role).length+String(row.content).length,0)/3.6))}}
function digest(rows,maxChars=1800){let out='Earlier conversation digest (extractive; newer turns below are authoritative):';for(const row of rows){const line=`\n${row.role}: ${row.content.replace(/\s+/g,' ').trim().slice(0,220)}`;if(out.length+line.length>maxChars)break;out+=line}return out}
function trimContent(row,maxChars){return{...row,content:row.content.length>maxChars?`${row.content.slice(0,Math.max(80,maxChars-24))}\n[context compacted]`:row.content}}
function compactContext(messages,budget,thinking){
  const normalized=normalizeMessages(messages),limit=Math.max(768,Number(budget)||0),before=countChatTokens(normalized,thinking);
  if(!budget||before<=limit)return{messages:normalized,inputTokens:before,originalTokens:before,budget:budget?limit:0,droppedMessages:0,compacted:false};
  const systems=normalized.filter(row=>row.role==='system'),dialogue=normalized.filter(row=>row.role!=='system'),recentCount=6,dropped=dialogue.slice(0,Math.max(0,dialogue.length-recentCount)),recent=dialogue.slice(-recentCount),compiled=[];
  if(systems.length)compiled.push({role:'system',content:systems.map(row=>row.content).join('\n\n').slice(0,7000)});
  if(dropped.length)compiled.push({role:'system',content:digest(dropped)});
  compiled.push(...recent);
  let count=countChatTokens(compiled,thinking);
  while(count>limit&&compiled.length>4){const removable=compiled.findIndex((row,index)=>index>0&&index<compiled.length-2&&row.role!=='system');if(removable<0)break;compiled.splice(removable,1);count=countChatTokens(compiled,thinking)}
  if(count>limit){for(let i=0;i<compiled.length&&count>limit;i++){const row=compiled[i],isLastUser=i===compiled.length-1&&row.role==='user',floor=isLastUser?900:320;if(row.content.length>floor){const ratio=Math.max(.25,limit/count),target=Math.max(floor,Math.floor(row.content.length*ratio));compiled[i]=trimContent(row,target);count=countChatTokens(compiled,thinking)}}}
  if(count>limit&&compiled[0]?.role==='system'){compiled[0]=trimContent(compiled[0],1200);count=countChatTokens(compiled,thinking)}
  while(count>limit&&compiled.length>2){compiled.splice(1,1);count=countChatTokens(compiled,thinking)}
  return{messages:compiled,inputTokens:count,originalTokens:before,budget:limit,droppedMessages:Math.max(0,normalized.length-compiled.length),compacted:true};
}
function openStructure(text){const source=clean(text),stack=[];let quote='',escaped=false;for(let i=0;i<source.length;i++){const c=source[i];if(quote){if(escaped){escaped=false;continue}if(c==='\\'){escaped=true;continue}if(c===quote)quote='';continue}if(c==='"'||c==="'"){quote=c;continue}if(c==='{'||c==='['||c==='(')stack.push(c);else if(c==='}'||c===']'||c===')'){const want=c==='}'?'{':c===']'?'[':'(';if(stack.at(-1)===want)stack.pop()}}const fences=(source.match(/```/g)||[]).length;return Boolean(stack.length||quote||fences%2)}
function eosTokenIds(){const values=[tokenizer?.eos_token_id,model?.config?.eos_token_id,model?.generation_config?.eos_token_id].flat(Infinity).filter(value=>Number.isFinite(Number(value))).map(Number);return new Set(values)}
function makeStreamer(id,requested,timing){if(!hfRuntime?.TextStreamer||!tokenizer)return null;return new hfRuntime.TextStreamer(tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:text=>{const value=clean(text,12000);if(!value)return;timing.decoded+=value;if(requested)post(id,'token',{token:{text:value,index:timing.index++}})},token_callback_function:tokens=>{if(!timing.firstTokenAt)timing.firstTokenAt=now();timing.generatedTokens+=Math.max(1,tokens?.length||1)}})}
async function generate(message,id){
  const spec=message.spec,requestStarted=now(),load=await ensure(spec,id),thinking=Boolean(message.thinking),promptBudget=Number(message.promptTokenBudget||spec.workingContextTokens||0);
  phase(id,'preparing-prompt',requestStarted,{model:spec.id,backend:load.backend,thinking});const prepStarted=now(),context=compactContext(message.messages||[],promptBudget,thinking),inputs=chatInputs(context.messages,thinking);
  const promptPrepareMs=Math.round(now()-prepStarted),promptTokens=promptTokenCount(inputs),window=Number(spec.contextWindowTokens||0),working=Number(spec.workingContextTokens||0),maxNewTokens=Math.max(8,Math.min(4096,Number(message.maxNewTokens||256)));
  if(window&&promptTokens+maxNewTokens>window){const error=new Error(`Prompt is ${promptTokens.toLocaleString()} tokens and asks for ${maxNewTokens.toLocaleString()} output tokens, beyond ${spec.label}'s ${window.toLocaleString()}-token model window.`);error.code='LOCAL_MODEL_CONTEXT_EXCEEDED';throw error}
  if(working&&promptTokens>working)phase(id,'context-warning',requestStarted,{model:spec.id,promptTokens,workingContextTokens:working,contextWindowTokens:window});
  if(context.compacted)phase(id,'context-compacted',requestStarted,{model:spec.id,originalPromptTokens:context.originalTokens,promptTokens,promptTokenBudget:context.budget,droppedMessages:context.droppedMessages,usedMessages:context.messages.length});
  const timing={firstTokenAt:0,generatedTokens:0,index:0,decoded:''},generationStarted=now(),streamer=makeStreamer(id,Boolean(message.stream),timing),temperature=Math.max(.01,Math.min(2,Number(message.temperature??.7)));
  phase(id,'generating',requestStarted,{model:spec.id,backend:load.backend,streaming:Boolean(message.stream),thinking,promptTokens,maxNewTokens,contextWindowTokens:window,workingContextTokens:working,promptTokenBudget:context.budget||working,contextCompacted:context.compacted});
  const options={...inputs,max_new_tokens:maxNewTokens,do_sample:true,temperature,top_k:Number(spec.generation?.topK||20),return_dict_in_generate:true};if(streamer)options.streamer=streamer;
  const output=await model.generate(options),completed=now(),ids=generatedIds(output?.sequences,promptTokens);let text='';try{text=clean(tokenizer.decode(ids,{skip_special_tokens:true})).trim()}catch{}if(!text)text=clean(timing.decoded).trim();
  const tokenCount=ids.length||timing.generatedTokens,generationMs=Math.round(completed-generationStarted),ttftMs=timing.firstTokenAt?Math.round(timing.firstTokenAt-generationStarted):null,decodeMs=Math.max(1,completed-(timing.firstTokenAt||generationStarted)),tokensPerSecond=tokenCount?Number((tokenCount/(decodeMs/1000)).toFixed(2)):0,eos=eosTokenIds(),endedWithEOS=Boolean(ids.length&&eos.has(Number(ids.at(-1)))),margin=Math.max(4,Math.ceil(maxNewTokens*.04)),nearTokenLimit=Boolean(tokenCount>=maxNewTokens-margin&&!endedWithEOS),structurallyIncomplete=openStructure(text);
  return{text,json:parseJsonLoose(text),model:{id:spec.id,repo:spec.repo,revision:spec.revision},backend:load.backend,streamed:Boolean(message.stream&&streamer),streamRequested:Boolean(message.stream),context:{inputTokens:promptTokens,originalTokens:context.originalTokens,promptTokenBudget:context.budget||working,compacted:context.compacted,droppedMessages:context.droppedMessages,usedMessages:context.messages.length},completion:{requestedMaxTokens:maxNewTokens,generatedTokens:tokenCount,nearTokenLimit,completionReason:nearTokenLimit?'length':'stop',endedWithEOS,structurallyIncomplete},metrics:{...load,promptPrepareMs,promptTokens,originalPromptTokens:context.originalTokens,promptTokenBudget:context.budget||working,contextCompacted:context.compacted,droppedMessages:context.droppedMessages,contextWindowTokens:window,workingContextTokens:working,maxNewTokens,thinking,generationMs,ttftMs,generatedTokens:tokenCount,tokensPerSecond,totalMs:Math.round(completed-requestStarted)}};
}
self.addEventListener('message',async event=>{const message=event.data||{},id=message.id;if(!id)return;try{if(message.type==='shutdown'){try{model?.dispose?.()}catch{}tokenizer=null;model=null;loaded=null;post(id,'done',{result:{shutdown:true}});return}if(message.type!=='generate')throw new Error(`Unsupported local-model worker request: ${message.type}`);post(id,'done',{result:await generate(message,id)})}catch(error){post(id,'error',{error:{message:friendlyError(error,message.spec,error?.code==='LOCAL_MODEL_CONTEXT_EXCEEDED'?'context check':'inference'),name:error?.name||'Error',code:error?.code||'LOCAL_MODEL_FAILED',stack:clean(error?.stack,4000)}})}});
