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
    text:clean(payload.text,3500),at:payload.at,
    model:clean(payload.model,200),questId:id(payload.questId)||null,
    signatureHash:clean(object.revisionHash,200),
    signerId:id(object.origin?.nodeId),
    provenance:'founding-device-signed-self-report',
    completionVerified:false
  });
}
export function createCollectiveTurnService({mesh,model,founder}={}){
  if(!mesh||!model||typeof founder!=='function')throw new TypeError('The native mesh, model runtime and Guild founder reader are required.');
  let busy=false;
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
  async function runOneTurn({guildId,personaId,questId='',taskPrompt=''}={}){
    if(busy)throw new Error('A Collective local model turn is already running.');
    busy=true;
    try{
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
        'Propose one concrete, testable next action. State what information is missing and distinguish guesses from verified facts.',
        'Do not claim tools were run, people agreed, sources were searched, or Quest beats were completed.',
        'Do not issue tool commands, spend resources or ask for privileged data.',
        'Stay under 220 words.'
      ].join('\n');
      const messages=[{role:'system',content:system},...prior.map(row=>({role:'assistant',content:row.personaId+': '+row.text.slice(0,1000)})),{role:'user',content:clean(taskPrompt,1200)||'Suggest one useful next action for the Guild, taking previous Collective turns into account.'}];
      const result=await model.generate({purpose:'starling-collective-local-turn-v1',executionProfile:'interactive',config,messages,maxTokens:440,requireExternalConsent:true});
      const text=readableOutput(result);
      if(result?.actual?.provider&& !allowed.has(result.actual.provider))throw new Error('Unexpected nonlocal model completed the request. No Collective turn was saved.');
      const turnId='starling-turn:'+guild+':'+crypto.randomUUID(),at=new Date().toISOString();
      const payload={schema:STARLING_TURN_SCHEMA,turnId,guildId:guild,personaId:person.id,text,at,model:clean(result.actual?.model||config.model,200),questId:id(questId)||null,source:'local-model',completionVerified:false};
      return await mesh.createObject({
        id:turnId,revision:1,kind:STARLING_TURN_KIND,
        purpose:'Signed Starling Collective local-model turn for Guild member review, not verified task completion.',
        consent:'group',audience:['guild:'+guild],publish:true,priority:40,
        payload
      });
    }finally{busy=false}
  }
  return Object.freeze({readTurns,runOneTurn,isBusy:()=>busy});
}
