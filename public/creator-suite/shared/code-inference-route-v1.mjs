// Creator Suite code inference adapter. Routes to existing shared/runtime owners;
 // never implements, replaces or silently downgrades an inference engine.
const DEVICE_ROUTES=new Set(['downloaded-local','generative-local','smollm2','smollm3','qwen']);
const clean=(v,max=240)=>String(v??'').slice(0,max);
export function resolveCodeInferenceRoute(config={},selection=null){
  const provider=clean(config.provider||config.route).trim().toLowerCase();
  const selected=selection?.active===true&&typeof selection.id==='string'&&selection.id.trim()?selection.id.trim():'';
  const useDevice=DEVICE_ROUTES.has(provider)||(provider==='browser'&&Boolean(selected));
  if(provider==='server-auto'||provider==='cloudflare-workers-ai'||provider==='workers-ai')return{kind:'server-auto',model:clean(config.model||'',200),provider};
  if(useDevice){
    if(!selected)throw new Error('No selected downloaded local model. Select and install one in Civweave AI settings before running code generation.');
    return{kind:'downloaded-local',model:selected,provider:'downloaded-local'};
  }
  return{kind:'shared',model:clean(config.model||'',200),provider};
}
export function normalizeCodeInferenceResult(value={},model=''){
  if(value?.status&&value.status!=='success'&&value.status!=='fallback')return{...value,actual:{provider:'downloaded-local',model},outputText:clean(value.outputText||value.text||'',120000)};
  const outputText=typeof value==='string'?value:clean(value?.outputText||value?.text||value?.output||value?.generatedText||value?.message||'',120000);
  if(!outputText&&!value?.outputJson)throw new Error('Downloaded local model returned no text or JSON.');
  return{status:'success',outputText,outputJson:value?.outputJson??null,actual:{provider:'downloaded-local',model},usage:value?.usage||{},fallback:value?.fallback||{used:false}};
}
export async function runCodeInference(config,messages,{selection=null,loadLocal,loadServer,sharedRuntime,onProgress,onToken,context={},maxTokens=2048,signal}={}){
  const route=resolveCodeInferenceRoute(config,selection);
  if(route.kind==='downloaded-local'){
    if(typeof loadLocal!=='function')throw new Error('Canonical downloaded-local runtime loader is missing.');
    const local=await loadLocal();
    if(typeof local?.generate!=='function')throw new Error('Canonical downloaded-local generator is unavailable.');
    const systemPrompt=messages.filter(x=>x.role==='system').map(x=>x.content).join('\n\n');
    const conversation=messages.filter(x=>x.role!=='system');
    const result=await local.generate({systemPrompt,messages:conversation,onProgress,onToken,maxNewTokens:Math.min(4096,Math.max(256,Number(maxTokens)||2048))});
    return normalizeCodeInferenceResult(result,route.model);
  }
  if(route.kind==='server-auto'){
    // Civweave server-auto tries the user's selected device model first, then
    // delegates to paired Guild/Cloudflare only after local execution fails.
    // Server-auto itself is the explicit network-routing selection; a regular
    // downloaded-local selection NEVER falls through to a remote provider.
    if(selection?.active===true&&selection.id&&typeof loadLocal==='function'){
      try{
        const local=await loadLocal();
        if(typeof local?.generate==='function'){
          const result=await local.generate({
            systemPrompt:messages.filter(x=>x.role==='system').map(x=>x.content).join('\n\n'),
            messages:messages.filter(x=>x.role!=='system'),
            onProgress,onToken,maxNewTokens:Math.min(4096,Math.max(256,Number(maxTokens)||2048))
          });
          const normalized=normalizeCodeInferenceResult(result,selection.id);
          if(normalized.status==='success'&&String(normalized.outputText||'').trim())return normalized;
        }
      }catch(error){onProgress?.({phase:'local-unavailable',detail:clean(error?.message,200)});}
    }
    if(typeof loadServer!=='function')throw new Error('Canonical Guild/Cloudflare AI router is unavailable.');
    const server=await loadServer();
    if(!server?.handle)throw new Error('Civweave server AI routing owner did not initialize.');
    const response=await server.handle({purpose:'creator-code-agent-v1',executionProfile:'agentic',taskTier:'complex',messages,responseFormat:'json',config:{...config,maxTokens:Math.max(1024,Math.min(8192,Number(maxTokens)||2048))},context:{creatorSuite:true,mediaType:'code',...context}});
    if(response?.handled!==true||!response.result)throw new Error('Configured Guild/Cloudflare inference route did not handle the request. Verify your selected node and active capacity session.');
    return response.result;
  }
  if(!sharedRuntime?.generate)throw new Error('The shared Civweave model runtime has not loaded.');
  return sharedRuntime.generate({
    purpose:'creator-code-agent-v1',executionProfile:'agentic',taskTier:'complex',requiresTools:false,responseFormat:'json',maxRepairAttempts:1,signal,
    messages,config:{...config,stream:false,maxTokens:Math.max(1024,Math.min(8192,Number(maxTokens)||2048))},
    context:{creatorSuite:true,mediaType:'code',...context}
  });
}
