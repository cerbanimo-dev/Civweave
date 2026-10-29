/**
 * Civweave Starling host protocol. The canonical Guild/Quest owners remain in
 * Civweave; a host only prepares local draft outputs. No arbitrary shell,
 * model URL, filesystem path, claim, publication or token spending action.
 */
export const STARLING_HOST_SCHEMA='civweave.starling-host-job.v1';
export const STARLING_HOSTS=Object.freeze({termux:{origin:'http://127.0.0.1:8767',type:'termux'},android:{type:'android'}});
const ID=/^[A-Za-z0-9:_-]{1,160}$/;
const JOB=/^[0-9a-f]{32}$/;
const PERSONAS=new Set(['kami','aphra','jae','anthony','rosa','sana','kit','farah']);
const MODELS=new Set(['qwen35-4b-native','qwen35-2b-native']);
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
export function validateStarlingJob(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected a Starling job.');
  const {jobId,guildId,personaId,model,intention,brief=''}=input;
  if(!JOB.test(jobId)||!ID.test(guildId)||!PERSONAS.has(personaId)||!MODELS.has(model))throw new TypeError('Invalid job, Guild, persona or approved model.');
  if(typeof intention!=='string'||intention.trim().length<12||intention.length>3000)throw new TypeError('A bounded Guild Intention is required.');
  if(typeof brief!=='string'||brief.length>1200)throw new TypeError('Brief exceeds 1,200 characters.');
  const maxTokens=input.maxTokens??440;
  if(!Number.isSafeInteger(maxTokens)||maxTokens<64||maxTokens>1000)throw new TypeError('Expected 64–1000 output tokens.');
  return Object.freeze({schema:STARLING_HOST_SCHEMA,jobId,guildId,personaId,model,intention:intention.trim(),brief:clean(brief,1200),maxTokens,action:'draft-only'});
}
export function validateStarlingSchedule(input){
  if(!input||!ID.test(input.guildId)||typeof input.enabled!=='boolean')throw new TypeError('Valid Guild and explicit enabled flag required.');
  if(!input.enabled)return Object.freeze({schema:'civweave.starling-host-schedule.v1',guildId:input.guildId,enabled:false});
  const intention=clean(input.intention,3001);
  if(intention.length<12||intention.length>3000||!MODELS.has(input.model))throw new TypeError('A valid intention and local model are required.');
  const intervalMinutes=input.intervalMinutes??60,dailyLimit=input.dailyLimit??4;
  if(!Number.isSafeInteger(intervalMinutes)||intervalMinutes<15||intervalMinutes>1440||!Number.isSafeInteger(dailyLimit)||dailyLimit<1||dailyLimit>12)
    throw new TypeError('Scheduled work must be at least 15 minutes apart and at most 12 turns per day.');
  return Object.freeze({schema:'civweave.starling-host-schedule.v1',guildId:input.guildId,enabled:true,intention,model:input.model,intervalMinutes,dailyLimit,action:'draft-only'});
}
/** Do not read credentials from localStorage; the existing Termux pairing UI
 * provides the token for this browser session. */
export function createStarlingHostTransport({kind,token='',nativePort,fetcher=fetch,timeoutMs=12000}={}){
  if(!STARLING_HOSTS[kind])throw new TypeError('Unsupported Starling host.');
  if(kind==='termux'&&!/^[0-9a-f]{64}$/i.test(token))throw new Error('Pair the Termux Companion before connecting the Starling host.');
  if(kind==='android'&&typeof nativePort?.postMessage!=='function')throw new Error('The trusted Android native bridge is not installed.');
  let serial=0;
  const pending=new Map();
  if(kind==='android'){
    nativePort.onmessage=event=>{
      let message;try{message=JSON.parse(typeof event==='string'?event:event?.data)}catch{return}
      const task=pending.get(message?.id);if(!task)return;
      pending.delete(message.id);clearTimeout(task.timer);
      if(message.ok===true)task.resolve(message.data);
      else task.reject(new Error(clean(message.error,300)||'Native bridge rejected request.'));
    };
  }
  async function request(method,path,body){
    if(!/^\/v1\/starling\/(?:status|jobs(?:\/[0-9a-f]{32}(?:\/cancel)?)?|schedule)$/.test(path))throw new Error('Unsupported host operation.');
    if(!['GET','POST'].includes(method))throw new TypeError('Unsupported method.');
    if(kind==='android'){
      const id=String(++serial);
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Android bridge request timed out.'))},timeoutMs);
        pending.set(id,{resolve,reject,timer});
        try{nativePort.postMessage(JSON.stringify({id,method,path,...(body?{body}:{})}))}catch(error){clearTimeout(timer);pending.delete(id);reject(error)}
      });
    }
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const result=await fetcher(STARLING_HOSTS.termux.origin+path,{
        method,mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal,
        headers:{'X-Civweave-Token':token,...(body?{'Content-Type':'application/json'}:{})},
        ...(body?{body:JSON.stringify(body)}:{})
      });
      const value=await result.json();
      if(!result.ok)throw new Error(clean(value?.error,300)||'Host returned HTTP '+result.status);
      return value;
    }finally{clearTimeout(timer)}
  }
  return Object.freeze({
    kind,
    status:()=>request('GET','/v1/starling/status'),
    submit:job=>request('POST','/v1/starling/jobs',validateStarlingJob(job)),
    listJobs:()=>request('GET','/v1/starling/jobs'),
    job:jobId=>{if(!JOB.test(jobId))throw new TypeError('Invalid job ID.');return request('GET','/v1/starling/jobs/'+jobId)},
    cancel:jobId=>{if(!JOB.test(jobId))throw new TypeError('Invalid job ID.');return request('POST','/v1/starling/jobs/'+jobId+'/cancel')},
    schedule:input=>request('POST','/v1/starling/schedule',validateStarlingSchedule(input))
  });
}
