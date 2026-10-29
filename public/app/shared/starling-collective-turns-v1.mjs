import {STARLING_PERSONAS} from './starling-collective-v1.mjs';

/**
 * One native Starling Collective turn owner. The signed object mesh owns
 * persistence/replication and CivweaveModelRuntime owns inference. This
 * module never creates an independent chat database, wallet or Quest store.
 *
 * Founding-device signed self-reports certify device provenance, NOT that an
 * AI independently ran, a task is completed, or a Guild vote is legitimate.
 */
export const STARLING_TURN_KIND='civweave.starling-collective-turn.v1';
export const STARLING_TURN_SCHEMA='civweave.starling-collective-turn.v1';
const clean=(value,max=4000)=>typeof value==='string'?value.trim().slice(0,max):'';
const id=value=>clean(value,180);
const allowed=new Set(['ollama','openai-compatible','downloaded-local']);
const readableOutput=result=>{
  if(result?.status!=='success')throw new Error(clean(result?.error?.message,400)||'Local model generation did not finish successfully.');
  const text=clean(result?.outputText||result?.text||result?.response,3500);
  if(!text)throw new Error('The local model produced no readable turn.');
  return text;
};
function ensureGuildId(value){const guildId=id(value);if(!/^[A-Za-z0-9:_-]{1,180}$/.test(guildId))throw new TypeError('A valid Guild ID is required.');return guildId}
function normalizeTurn(payload,object){
  if(payload?.schema!==STARLING_TURN_SCHEMA||!STARLING_PERSONAS[payload.personaId]||!id(payload.turnId)||!clean(payload.text)||!id(payload.guildId))return null;
  if(!Number.isFinite(Date.parse(payload.at)))return null;
  return Object.freeze({
    id:id(payload.turnId),guildId:id(payload.guildId),personaId:payload.personaId,
    text:clean(payload.text,3500),at:payload.at,brief:clean(payload.brief,1200),
    model:clean(payload.model,200),questId:id(payload.questId)||null,
    signatureHash:clean(object.revisionHash,200),
    signerId:id(object.origin?.nodeId),
    provenance:payload.source==='local-host'?'founding-device-signed-host-draft':'founding-device-signed-self-report',hostBackend:clean(payload.hostBackend,30)||null,
    completionVerified:false
  });
}
export function createCollectiveTurnService({mesh,model,founder}={}){
  if(!mesh||!model||typeof founder!=='function')throw new TypeError('The native mesh, model runtime and Guild founder reader are required.');
  let busy=false,roundBusy=false;
  const roundToken=Object.freeze({});
  async function genesis(guildId){
    const record=await mesh.getObject('guild-genesis:'+guildId);
    const valid=record&&record.kind==='civweave.guild-genesis.v1'
      &&record.payload?.guildId===guildId
      &&id(record.payload?.foundingDeviceId)===id(record.origin?.nodeId)
      &&(await mesh.validateObject(record))?.ok===true;
    if(!valid)throw new Error('No valid signed Guild founding record is available on this device.');
    return record;
  }
  async function readTurns({guildId,verifyReader,limit=100}={}){
    const guild=ensureGuildId(guildId);
    if(typeof verifyReader!=='function'||verifyReader(guild)!==true)throw new Error('Guild read authorization is required.');
    const founding=await genesis(guild),signer=founding.origin.nodeId;
    const rows=await mesh.listObjects(),turns=[];
    for(const object of Array.isArray(rows)?rows:[]){
      if(object?.kind!==STARLING_TURN_KIND||object?.consent!=='group'||!Array.isArray(object.audience)
         ||!object.audience.includes('guild:'+guild)||object.origin?.nodeId!==signer
         ||object.payload?.guildId!==guild||object.payload?.schema!==STARLING_TURN_SCHEMA)continue;
      const validation=await mesh.validateObject(object);if(validation?.ok!==true)continue;
      const entry=normalizeTurn(object.payload,object);if(entry)turns.push(entry);
    }
    turns.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id));
    const max=Math.max(1,Math.min(200,Number.isInteger(limit)?limit:100));
    return Object.freeze(turns.slice(-max));
  }
  async function runOneTurn({guildId,personaId,questId='',taskPrompt='',workMode='conversation'}={},internalToken=null){
    if(busy||(roundBusy&&internalToken!==roundToken))throw new Error('A Collective local model turn is already running.');
    busy=true;
    try{
      if(!['conversation','project','task-draft'].includes(workMode))throw new TypeError('Unsupported Collective work mode.');
      const guild=ensureGuildId(guildId),person=STARLING_PERSONAS[personaId];
      if(!person)throw new TypeError('Choose a known Starling persona.');
      const founding=await genesis(guild),owner=founder();
      if(owner?.guildId!==guild||owner.deviceId!==founding.origin.nodeId||await mesh.deviceId()!==founding.origin.nodeId)throw new Error('Only the Guild founding device may initiate this local Collective run.');
      const goal=clean(founding.payload?.foundingIntention?.text||owner.foundingIntention?.text,3500);
      if(!goal)throw new Error('The Guild founding Intention must be available before the Collective can run.');
      const original=model.readSharedConfig?.('interactive');
      if(!original)throw new Error('Select a local model in Civweave Settings first.');
      const config=model.normalizeConfig?.(original)||original;
      if(!allowed.has(config.provider)||model.endpointLeavesDevice?.(config)!==false)throw new Error('This version of Starling requires local inference; hosted generation and remote model endpoints are not enabled.');
      const prior=await readTurns({guildId:guild,verifyReader:()=>true,limit:6});
      const system=[
        'You are '+person.name+', a fictional member of the Starling Collective. Your role: '+person.role+'.',
        'Working style: '+person.style+'. Reasoning approach: '+person.wiring+'.',
        'The Guildkeeper founding Intention is provisional and not a human-ratified decision: '+goal,
        'Work toward that Intention without claiming to represent human Guild members.',
        workMode==='project'?'Create a concise, actionable new AI project and reply ONLY a valid JSON object with title, outcome and tasks. Each task must include assignee, kind, title and text deliverable. No markdown, preambles or imaginary human participation.':workMode==='task-draft'?'Actually produce the requested written or code-draft deliverable NOW, in useful concrete form. Do not just propose doing it later. This output is a draft for human review, never verified completion.':'Propose one concrete, testable next action. State what information is missing and distinguish guesses from verified facts.',
        'Do not claim tools were run, people agreed, sources were searched, or Quest beats were completed.',
        'Do not issue tool commands, spend resources or ask for privileged data.',
        workMode==='project'?'Keep JSON compact, with 1–4 tasks and no extra explanation.':workMode==='task-draft'?'Deliver useful content within 450 words.':'Stay under 220 words.'
      ].join('\n');
      const messages=[{role:'system',content:system},...prior.map(row=>({role:'assistant',content:row.personaId+': '+row.text.slice(0,1000)})),{role:'user',content:clean(taskPrompt,2600)||'Suggest one useful next action for the Guild, taking previous Collective turns into account.'}];
      const result=await model.generate({purpose:'starling-collective-local-turn-v1',executionProfile:'interactive',config,messages,maxTokens:workMode==='conversation'?440:workMode==='project'?900:1100,requireExternalConsent:true});
      const text=readableOutput(result);
      if(result?.actual?.provider&& !allowed.has(result.actual.provider))throw new Error('Unexpected nonlocal model completed the request. No Collective turn was saved.');
      const turnId='starling-turn:'+guild+':'+crypto.randomUUID(),at=new Date().toISOString();
      const payload={schema:STARLING_TURN_SCHEMA,turnId,guildId:guild,personaId:person.id,text,workMode,brief:clean(taskPrompt,1200),at,model:clean(result.actual?.model||config.model,200),questId:id(questId)||null,source:'local-model',completionVerified:false};
      return await mesh.createObject({
        id:turnId,revision:1,kind:STARLING_TURN_KIND,
        purpose:'Signed Starling Collective local-model turn for Guild member review, not verified task completion.',
        consent:'group',audience:['guild:'+guild],publish:true,priority:40,
        payload
      });
    }finally{busy=false}
  }
  /**
   * A manually initiated bounded deliberation. All turns are persisted before
   * the next actor starts; no simultaneous resident LLM instances are needed.
   * One failed turn stops the round without rolling back previous signed turns.
   */
  async function runRound({guildId,personas=['kami','farah','rosa'],taskPrompt='',onTurn}={}){
    if(busy||roundBusy)throw new Error('A Collective local model turn is already running.');
    if(!Array.isArray(personas)||personas.length<2||personas.length>4||new Set(personas).size!==personas.length
       ||personas.some(key=>!STARLING_PERSONAS[key]))throw new TypeError('Choose two to four distinct Starling personas.');
    roundBusy=true;
    let completed=0;
    try{
      for(const personaId of personas){
        const record=await runOneTurn({guildId,personaId,taskPrompt},roundToken);
        completed++;
        if(typeof onTurn==='function'){try{onTurn(record,completed,personas.length)}catch{}}
      }
      return Object.freeze({schema:'civweave.starling-collective-round.v1',guildId,completed,total:personas.length,status:'recorded',completionVerified:false});
    }finally{roundBusy=false}
  }
  /**
   * On explicit Guildkeeper review/import, attach an external local host draft
   * to the existing signed object-mesh transcript. Host output is NEVER
   * independent execution evidence or a canonical Quest task result.
   */
  async function importHostDraft({guildId,job}={}){
    const guild=ensureGuildId(guildId),founding=await genesis(guild),owner=founder();
    if(owner?.guildId!==guild||owner.deviceId!==founding.origin.nodeId||await mesh.deviceId()!==founding.origin.nodeId)
      throw new Error('Only the Guild founding device may sign an imported local host draft.');
    const valid=job?.schema==='civweave.starling-host-job.v1'
      &&job?.guildId===guild
      &&/^[0-9a-f]{32}$/.test(job.jobId||'')
      &&STARLING_PERSONAS[job.personaId]
      &&job.state==='completed'
      &&['termux','android'].includes(job.backend)
      &&job.reviewRequired===true&&job.claimVerified===false
      &&typeof job.text==='string'&&job.text.trim().length>0&&job.text.length<=6000;
    if(!valid)throw new TypeError('A completed, review-only local host draft for this Guild is required.');
    const objectId='starling-turn:'+guild+':'+job.jobId;
    const existing=await mesh.getObject(objectId);
    if(existing){
      if(existing.kind!==STARLING_TURN_KIND||existing.payload?.guildId!==guild||existing.payload?.personaId!==job.personaId)
        throw new Error('Host draft ID collides with a different Guild mesh object.');
      if((await mesh.validateObject(existing))?.ok!==true)throw new Error('Existing signed host draft could not be verified.');
      return existing;
    }
    const at=new Date().toISOString();
    return mesh.createObject({
      id:objectId,revision:1,kind:STARLING_TURN_KIND,
      purpose:'Guildkeeper-reviewed imported local host draft; no completion or tool authority.',
      consent:'group',audience:['guild:'+guild],publish:true,priority:40,
      payload:{
        schema:STARLING_TURN_SCHEMA,turnId:objectId,guildId:guild,
        personaId:job.personaId,text:job.text.trim().slice(0,3500),brief:'',
        at,model:'local-host:'+job.backend,questId:null,hostBackend:job.backend,
        source:'local-host',completionVerified:false,claimVerified:false,
        hostJobId:job.jobId
      }
    });
  }
  return Object.freeze({readTurns,runOneTurn,runRound,importHostDraft,isBusy:()=>busy||roundBusy});
}
