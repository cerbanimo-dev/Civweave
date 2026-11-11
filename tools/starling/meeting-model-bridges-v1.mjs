/**
 * Starling meeting bridge v1.
 * Provider output is a PRIVATE proposal, never permission to speak.
 * Host must own grants, secrets, and participant membership.
 */
const MAX_CONTEXT=24;
const MAX_TEXT=8000;
const limited=(v,n=MAX_TEXT)=>typeof v==='string'?v.slice(0,n):'';
const allowedRoles=new Set(['system','user','assistant']);
const fail=(code,message)=>Object.assign(new Error(message),{code});
export function normalizeMeetingContext(events=[],participantId){
  if(!Array.isArray(events))throw fail('BAD_CONTEXT','Events must be an array.');
  return events.filter(e=>e&&typeof e==='object'&&
    (e.visibility==='public'||(e.visibility==='participant'&&e.recipientId===participantId))&&
    allowedRoles.has(e.role)&&typeof e.text==='string')
    .slice(-MAX_CONTEXT).map(e=>({role:e.role,content:limited(e.text)}));
}
function authorize(request){
  if(!request||typeof request!=='object'||!request.meetingId||!request.participantId)
    throw fail('BAD_REQUEST','Meeting and participant IDs are required.');
  if(request.grant?.meetingId!==request.meetingId||
     request.grant?.participantId!==request.participantId||
     request.grant?.capability!=='propose'||
     !Number.isFinite(request.grant.expiresAt)||
     request.grant.expiresAt<=Date.now())
    throw fail('NOT_AUTHORIZED','A current meeting-scoped proposal grant is required.');
  if(request.silent===true)throw fail('SILENT','Participant is not scheduled to generate.');
}
function validateEndpoint(provider,urlText){
  const u=new URL(urlText);
  if(u.username||u.password||u.hash||u.search)throw fail('BAD_ENDPOINT','Endpoint cannot include credentials, fragments or query.');
  if(provider==='openai' && (u.origin!=='https://api.openai.com'||u.pathname!=='/v1/chat/completions'))
    throw fail('BAD_ENDPOINT','OpenAI must use its approved API endpoint.');
  if(provider==='gemini' && (u.origin!=='https://generativelanguage.googleapis.com'||u.pathname!=='/v1beta/models'))
    throw fail('BAD_ENDPOINT','Gemini must use its approved API endpoint.');
  if(provider==='local' && (u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||
      !['/api/chat','/v1/chat/completions'].includes(u.pathname)))
    throw fail('BAD_ENDPOINT','Local endpoints must use loopback HTTP with an approved API path.');
  return u.toString();
}
const MODEL=/^[a-zA-Z0-9][a-zA-Z0-9._:+/-]{0,127}$/;
function configFor(provider,config){
  if(!['openai','gemini','local'].includes(provider))throw fail('BAD_PROVIDER','Unsupported provider.');
  if(!config||typeof config!=='object'||!MODEL.test(config.model||''))
    throw fail('BAD_MODEL','An explicit model is required.');
  if(provider!=='local' && (config.externalConsent!==true||!config.apiKey))
    throw fail('CONSENT_REQUIRED','Cloud providers require explicit consent and a server-side API key.');
  const defaults={openai:'https://api.openai.com/v1/chat/completions',
    gemini:'https://generativelanguage.googleapis.com/v1beta/models',
    local:'http://127.0.0.1:11434/api/chat'};
  const endpoint=validateEndpoint(provider,config.endpoint||defaults[provider]);
  return {model:config.model,endpoint,apiKey:config.apiKey};
}
function makePayload(provider,config,messages){
  if(provider==='gemini'){
    const system=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
    const contents=messages.filter(m=>m.role!=='system').map(m=>({
      role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
    return {url:config.endpoint+'/'+encodeURIComponent(config.model)+':generateContent',
      headers:{'x-goog-api-key':config.apiKey},
      body:{contents, ...(system?{systemInstruction:{parts:[{text:system}]}}:{})}};
  }
  if(provider==='local'&&new URL(config.endpoint).pathname==='/api/chat')
    return {url:config.endpoint,headers:{},body:{model:config.model,messages,stream:false}};
  return {url:config.endpoint,headers:config.apiKey?{Authorization:'Bearer '+config.apiKey}:{},
    body:{model:config.model,messages,stream:false}};
}
function unpack(provider,data){
  if(provider==='gemini')return data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
  return data?.message?.content??data?.choices?.[0]?.message?.content??'';
}
/**
 * Invoke only after the trusted host checks identity and issues a short-lived
 * proposal grant. Grant validation here is defense-in-depth, not authentication.
 */
export async function proposeMeetingTurn(request,{fetchImpl=globalThis.fetch,timeoutMs=20000,signal,verifyProposalGrant}={}){
  authorize(request);
  if(typeof verifyProposalGrant!=='function'||await verifyProposalGrant(request.grant,request)!==true)
    throw fail('NOT_AUTHORIZED','Trusted host must verify the proposal grant.');
  if(signal?.aborted)throw fail('MODEL_CANCELLED','Proposal was cancelled.');
  const provider=request.provider;
  const cfg=configFor(provider,request.config);
  const context=normalizeMeetingContext(request.events,request.participantId);
  const prompt=limited(request.prompt);
  if(!prompt.trim())throw fail('EMPTY_PROMPT','A directed prompt is required.');
  const messages=[{role:'system',content:'You are a meeting participant. Draft one concise proposal only. Do not claim to have spoken, executed actions or changed the meeting.'},
    ...context,{role:'user',content:prompt}];
  const payload=makePayload(provider,cfg,messages);
  if(typeof fetchImpl!=='function')throw fail('NO_TRANSPORT','Fetch transport unavailable.');
  const controller=new AbortController();
  const bounded=Math.max(100,Math.min(60000,Number(timeoutMs)||20000));
  const abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(),bounded);
  try{
    const response=await fetchImpl(payload.url,{
      method:'POST',redirect:'error',headers:{'Content-Type':'application/json',...payload.headers},
      body:JSON.stringify(payload.body),signal:controller.signal});
    if(!response.ok)throw fail('PROVIDER_ERROR','Model provider returned HTTP '+response.status);
    const data=await response.json();
    const text=limited(unpack(provider,data));
    if(!text.trim())throw fail('EMPTY_RESPONSE','Model returned no visible content.');
    return {kind:'speech_proposal',meetingId:request.meetingId,participantId:request.participantId,
      provider,model:cfg.model,text,requiresSpeechGrant:true};
  }catch(error){
    if(signal?.aborted)throw fail('MODEL_CANCELLED','Proposal was cancelled.');
    if(controller.signal.aborted)throw fail('MODEL_TIMEOUT','Model request timed out.');
    throw error;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
/** Thread 2 alone emits this token, after verifying meeting state and permissions. */
export async function acceptSpeechProposal(proposal,speechGrant,{verifySpeechGrant}={}){
  if(proposal?.kind!=='speech_proposal'||proposal.requiresSpeechGrant!==true||
     speechGrant?.capability!=='speak'||speechGrant?.meetingId!==proposal.meetingId||
     speechGrant?.participantId!==proposal.participantId||
     !Number.isFinite(speechGrant.expiresAt)||speechGrant.expiresAt<=Date.now())
    throw fail('SPEECH_DENIED','An active, matching controller-issued speech grant is required.');
  if(typeof verifySpeechGrant!=='function'||await verifySpeechGrant(speechGrant,proposal)!==true)
    throw fail('SPEECH_DENIED','Trusted controller must verify and consume speech grant.');
  return {kind:'authorized_speech',meetingId:proposal.meetingId,
    participantId:proposal.participantId,text:proposal.text,grantId:speechGrant.id||null};
}
