import {appendGuildReportAction} from './starling-daily-report-v1.mjs';
import {createStarlingReportProducerVerifier} from './starling-report-producers-v1.mjs';

/**
 * Called only after the canonical Guild cloud AI router receives an actual
 * successful HTTP generation response. This signs bounded activity metadata;
 * no prompts, output content, auth tokens, or fabricated neuron balances.
 *
 * It never invokes AI, spends neurons, authorizes a producer, or claims tasks.
 */
const id=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,180}$/.test(value);
const clean=(value,max=100)=>typeof value==='string'?value.trim().slice(0,max):'';
export async function recordStarlingCloudGeneration({mesh,request,session,response,model='',now=()=>new Date()}={}){
  const guildId=clean(session?.guildId,180),purpose=clean(request?.purpose,100);
  if(!id(guildId)||guildId!==request?.guildId||!/^starling-collective-cloud-[a-z0-9-]+-v\d+$/.test(purpose))
    return Object.freeze({recorded:false,reason:'not-an-authorized-starling-cloud-operation'});
  if(response?.ok!==true||!mesh?.deviceId)
    return Object.freeze({recorded:false,reason:'no-confirmed-cloud-result-or-device'});
  const requestId=clean(request.requestId,80);
  if(requestId&&!/^[A-Za-z0-9_-]{1,80}$/.test(requestId))
    return Object.freeze({recorded:false,reason:'invalid-request-id'});
  const charged=Number(response?.usage?.chargedNeurons);
  const usage=Number.isFinite(charged)&&charged>=0&&Number.isInteger(charged)
    ?' · '+charged+' recorded neurons':' · neuron usage not supplied';
  const selected=clean(model,120)||'selected cloud model';
  const verifier=createStarlingReportProducerVerifier({mesh,guildId});
  const result=await appendGuildReportAction({
    mesh,guildId,source:'cloud-ai',action:'inference',status:'completed',
    actor:'Starling cloud model',
    summary:('Guild cloud generation finished using '+selected+usage).slice(0,340),
    referenceId:requestId,idempotencyKey:requestId?('cloud_'+requestId):'',
    now,verifyProducer:verifier
  });
  return Object.freeze({recorded:true,guildId,eventId:result.id,source:'cloud-ai'});
}
