// Shared Creator Suite bootstrap. Inference remains owned by the existing
// Civweave runtimes; this module only selects and loads their browser scripts.
let localFlight=null,serverFlight=null;
export function currentCreatorLocalSelection(){
  try{const live=globalThis.CivweaveLocalModelDownloadV266?.selection?.();if(live?.active&&live.id)return live;}catch{}
  try{const saved=JSON.parse(localStorage.getItem('civweave.local-ai.selection.v266')||'null');return saved?.active&&saved.id?saved:null;}catch{return null;}
}
export function loadCreatorLocalRuntime(){
  if(globalThis.CivweaveLocalChatRuntimeV295?.generate)return Promise.resolve(globalThis.CivweaveLocalChatRuntimeV295);
  if(localFlight)return localFlight;
  localFlight=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='/app/local-chat-runtime-v295.js?v=1.0.120-local-chat-runtime-v305-moss-core-readiness';
    script.onload=()=>{
      const owner=globalThis.CivweaveLocalChatRuntimeV295;
      if(owner?.generate)resolve(owner);
      else reject(new Error('The local-chat inference runtime did not initialize.'));
    };
    script.onerror=()=>reject(new Error('Could not load the canonical local model runtime.'));
    document.head.append(script);
  }).catch(error=>{localFlight=null;throw error});
  return localFlight;
}
export function loadCreatorServerRuntime(){
  if(globalThis.CivweaveServerAIRouterV301?.handle)return Promise.resolve(globalThis.CivweaveServerAIRouterV301);
  if(serverFlight)return serverFlight;
  const load=src=>new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;script.onload=resolve;
    script.onerror=()=>reject(new Error('Unable to load Guild/Cloudflare routing: '+src));
    document.head.append(script);
  });
  serverFlight=(async()=>{
    if(!globalThis.CivweaveHostNodeSessionV1)await load('/app/host-node-session-v1.js');
    if(!globalThis.CivweaveNodeAIMeshV1)await load('/app/node-ai-mesh-v1.js');
    await load('/app/server-ai-router-v301.js');
    const owner=globalThis.CivweaveServerAIRouterV301;
    if(!owner?.handle)throw new Error('The canonical Guild/Cloudflare inference router did not initialize.');
    return owner;
  })().catch(error=>{serverFlight=null;throw error});
  return serverFlight;
}
