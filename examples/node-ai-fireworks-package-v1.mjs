const DEFAULT_BASE_URL='https://api.fireworks.ai/inference/v1';
const DEFAULT_MODEL='accounts/fireworks/models/deepseek-v4-flash';
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function required(value,label){const text=clean(value,16000);if(!text)throw new TypeError(`${label} is required.`);return text}
function retailFor(service){const billing=service?.billing||{};const declared=Number(billing.referenceRequestCents??billing.flatRequestCents??billing.minimumChargeCents??1);if(!Number.isSafeInteger(declared)||declared<1)throw new TypeError(`Service ${service?.id||'unknown'} must declare a positive reference retail charge.`);const ceiling=Number(billing.maxRequestCents);if(Number.isSafeInteger(ceiling)&&declared>ceiling)throw new RangeError(`Service ${service.id} reference retail charge exceeds its advertised maximum.`);return declared}
function normalizeMessages(request){if(Array.isArray(request?.messages)&&request.messages.length)return request.messages.map(message=>({role:clean(message?.role,40)||'user',content:message?.content??''}));if(clean(request?.prompt,200000))return[{role:'user',content:clean(request.prompt,200000)}];if(typeof request==='string'&&clean(request,200000))return[{role:'user',content:clean(request,200000)}];throw new TypeError('Fireworks reference service requires request.messages, request.prompt, or a string request.')}
function safeBase(value){const url=new URL(clean(value,4000)||DEFAULT_BASE_URL);if(url.protocol!=='https:'&&url.protocol!=='http:')throw new RangeError('FIREWORKS_BASE_URL must use HTTP or HTTPS.');return url.href.replace(/\/$/,'')}
function responseFormat(value){if(value==='json'||value==='json_object')return{type:'json_object'};if(value&&typeof value==='object')return value;return undefined}
function usageFrom(raw){const usage=raw?.usage||{};return{inputTokens:Number(usage.prompt_tokens||0),cachedInputTokens:Number(usage.prompt_tokens_details?.cached_tokens||usage.cached_tokens||0),outputTokens:Number(usage.completion_tokens||0),totalTokens:Number(usage.total_tokens||0)}}
export function createFireworksReferencePackage({manifest,env=process.env,fetchImpl=globalThis.fetch}={}){
  if(!manifest?.nodeId||!Array.isArray(manifest.services))throw new TypeError('A node service manifest is required.');
  if(typeof fetchImpl!=='function')throw new TypeError('A fetch implementation is required.');
  const apiKey=required(env.FIREWORKS_API_KEY,'FIREWORKS_API_KEY');
  const baseUrl=safeBase(env.FIREWORKS_BASE_URL||DEFAULT_BASE_URL);
  const defaultModel=clean(env.FIREWORKS_MODEL,500)||DEFAULT_MODEL;
  const timeoutMs=clamp(Math.round(number(env.FIREWORKS_TIMEOUT_MS,120000)),5000,600000);
  const requestedIds=new Set(clean(env.FIREWORKS_SERVICE_IDS,2000).split(',').map(value=>value.trim()).filter(Boolean));
  const selected=manifest.services.filter(service=>!requestedIds.size||requestedIds.has(service.id));
  if(!selected.length)throw new RangeError('No advertised services match FIREWORKS_SERVICE_IDS.');
  const handlers={};
  for(const service of selected){
    const retailCostCents=retailFor(service);
    handlers[service.id]={
      async quote(){return{maxRetailCostCents:retailCostCents,ttlSeconds:900}},
      async execute({request,requestId,quote}){
        const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
        const model=clean(service?.backend?.model,500)||defaultModel;
        const payload={model,messages:normalizeMessages(request),stream:false,max_tokens:clamp(Math.round(number(request?.maxTokens??request?.max_tokens,2048)),1,16384),temperature:clamp(number(request?.temperature,0.35),0,2)};
        const format=responseFormat(request?.responseFormat??request?.response_format);if(format)payload.response_format=format;
        if(Array.isArray(request?.tools)&&request.tools.length)payload.tools=request.tools;
        if(request?.tool_choice!=null)payload.tool_choice=request.tool_choice;
        try{
          const response=await fetchImpl(`${baseUrl}/chat/completions`,{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json',accept:'application/json','x-civweave-request-id':clean(requestId,180)},body:JSON.stringify(payload),signal:controller.signal});
          const body=await response.json().catch(()=>({}));
          if(!response.ok){const detail=clean(body?.error?.message||body?.error||body?.message,1000);throw Object.assign(new Error(`Fireworks inference returned HTTP ${response.status}${detail?`: ${detail}`:''}.`),{status:502})}
          const message=body?.choices?.[0]?.message||{};
          const output={role:message.role||'assistant',content:message.content??'',toolCalls:message.tool_calls||undefined,reasoning:message.reasoning_content||message.reasoning||undefined,finishReason:body?.choices?.[0]?.finish_reason||null};
          return{output,retailCostCents:Number(quote?.maxRetailCostCents||retailCostCents),usage:usageFrom(body),backend:{provider:'fireworks',model,ownership:'node-operator'},outcome:'completed',operatorReceipt:{provider:'fireworks',requestId:response.headers?.get?.('x-request-id')||response.headers?.get?.('x-fireworks-request-id')||null}};
        }catch(error){if(error?.name==='AbortError')throw Object.assign(new Error('Fireworks inference timed out at the node.'),{status:504});throw error}finally{clearTimeout(timer)}
      }
    };
  }
  return Object.freeze({id:'civweave-fireworks-reference-v1',version:'1.0.70',services:Object.freeze(handlers),metadata:Object.freeze({provider:'fireworks',baseUrl,defaultModel,serviceIds:Object.keys(handlers),credentialSource:'node-environment'})});
}
export function createNodeAiServicePackage(options={}){return createFireworksReferencePackage(options)}
export default createNodeAiServicePackage;
