(()=>{
'use strict';
if(globalThis.CivweaveHumanValidationNeuronsV1)return;

const VERSION='1.0.0';
const SESSION_KEY='civweave.host-capacity.sessions.v1';
const PAYMENT_FIELD='humanValidationNeuronPayment';
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const copy=value=>value==null?value:structuredClone(value);

function ludMode(){return globalThis.CivweaveLudModeV1?.isEnabled?.()===true}
function reward(){return globalThis.CivweaveRewardWeave||null}
function hostSession(){
  const owner=globalThis.CivweaveHostNodeSessionV1;
  try{const direct=owner?.sessionFor?.();if(direct?.origin&&direct?.token&&direct?.nodeId&&direct?.userId)return direct}catch{}
  try{
    const rows=Object.values(parse(sessionStorage.getItem(SESSION_KEY),{})).filter(row=>row?.origin&&row?.token&&row?.nodeId&&row?.userId&&(!row.expiresAt||Date.parse(row.expiresAt)>Date.now()));
    return rows[0]||null;
  }catch{return null}
}
function requireSession(){const session=hostSession();if(!session)throw new Error('Join a Guild before using neuron-funded human validation.');return session}
async function request(path,{method='POST',body=null}={}){
  const session=requireSession(),url=new URL(path,session.origin);url.searchParams.set('nodeId',session.nodeId);
  const response=await fetch(url,{method,cache:'no-store',headers:{accept:'application/json',authorization:`Bearer ${session.token}`,'x-civweave-node-id':session.nodeId,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||payload?.ok===false){const error=new Error(clean(payload?.error||`Guild returned HTTP ${response.status}.`,1200));error.status=response.status;error.payload=payload;throw error}return payload
}
function state(){const weave=reward();if(!weave?.read)throw new Error('Civweave validation ledger is unavailable.');return weave.read()}
function packetById(packetId,current=state()){return current?.validation?.packets?.find(row=>row?.id===packetId)||null}
function submissionFor(packet,current=state()){return current?.validation?.submissions?.find(row=>row?.id===packet?.submissionId)||null}
function projectIdFor(packet,submission){return clean(packet?.projectId||submission?.projectId||submission?.questId||submission?.journeyId||submission?.endeavorId||submission?.subjectId||packet?.subjectId,240)}
function stableRequestId(packet){return clean(`lud-human-validation:${packet?.requestId||packet?.id}`,240)}
function writePayment(packetId,payment){
  const weave=reward(),current=state(),packet=packetById(packetId,current);if(!packet)throw new Error('Validation packet no longer exists.');
  packet[PAYMENT_FIELD]=copy(payment);weave.write(current);try{dispatchEvent(new CustomEvent('civweave:human-validation-neuron-funded',{detail:{packetId,payment:copy(payment)}}))}catch{}return payment
}
async function fundPacket(packetId,{validatorCount=3,projectId=''}={}){
  if(!ludMode())throw new Error('Neuron-funded validation requests are created by Lud Mode users.');
  const current=state(),packet=packetById(clean(packetId,240),current);if(!packet||!['open','verified-awaiting-cross-device'].includes(packet.status))throw new Error('Open validation packet not found.');
  const submission=submissionFor(packet,current),resolvedProject=clean(projectId,240)||projectIdFor(packet,submission);if(!resolvedProject)throw new Error('Validation packet has no project or work identifier.');
  const count=Number(validatorCount);if(![2,3].includes(count))throw new Error('Choose exactly 2 or 3 human validators.');
  const payload=await request('/api/node/human-validation/request',{body:{requestId:stableRequestId(packet),packetId:packet.id,projectId:resolvedProject,validatorCount:count,operatingMode:'lud'}});
  const terms=payload.request||{};
  const payment=Object.freeze({schema:'civweave.human-validation-neuron-payment.v1',requestId:terms.requestId,totalNeurons:Number(terms.totalNeurons||30),validatorCount:Number(terms.validatorCount||count),perValidatorNeurons:Number(terms.perValidatorNeurons||30/count),sourceMode:'lud',nodeId:clean(payload.nodeId||terms.nodeId,180),requesterUserId:clean(payload.userId||terms.requesterUserId,180),createdAt:terms.createdAt||new Date().toISOString(),expiresAt:terms.expiresAt||null,status:terms.status||'open'});
  writePayment(packet.id,payment);return{...payload,payment}
}
async function status(){return request('/api/node/human-validation/status',{method:'GET'})}
async function receiptHash(receipt){
  const source=JSON.stringify(receipt||{}),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));return'sha256:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')
}
async function claimForValidation(validationId){
  if(ludMode())return{claimed:false,reason:'validator-is-lud'};
  const current=state(),receipt=current?.validation?.receipts?.find(row=>row?.id===clean(validationId,240));if(!receipt)return{claimed:false,reason:'receipt-not-found'};
  if(receipt.acceptedForEvidence!==true&&receipt.acceptedForQuorum!==true)return{claimed:false,reason:'receipt-not-accepted'};
  const packet=packetById(receipt.packetId,current),payment=packet?.[PAYMENT_FIELD];if(!payment?.requestId)return{claimed:false,reason:'not-lud-funded'};
  const payload=await request('/api/node/human-validation/claim',{body:{requestId:payment.requestId,receiptId:receipt.id,receiptHash:await receiptHash(receipt),accepted:true,validatorMode:'standard'}});
  try{dispatchEvent(new CustomEvent('civweave:human-validation-neuron-claimed',{detail:{validationId:receipt.id,requestId:payment.requestId,claim:copy(payload.claim),earned:copy(payload.earned)}}))}catch{}
  return{claimed:true,...payload}
}
function paymentForPacket(packetId){return copy(packetById(clean(packetId,240))?.[PAYMENT_FIELD]||null)}
function bind(){
  addEventListener('civweave:validation-labor-awarded',event=>{const id=clean(event?.detail?.validationId||event?.detail?.receiptId,240);if(id)claimForValidation(id).catch(error=>console.warn('[Civweave human validation neurons]',error))});
}
const api=Object.freeze({version:VERSION,paymentField:PAYMENT_FIELD,hostSession,status,fundPacket,claimForValidation,paymentForPacket});
globalThis.CivweaveHumanValidationNeuronsV1=api;bind();
try{dispatchEvent(new CustomEvent('civweave:human-validation-neurons-ready',{detail:{version:VERSION}}))}catch{}
})();
