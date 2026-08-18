const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
const list=value=>Array.isArray(value)?value:[];

export const C2PA_SOURCE_TYPES=Object.freeze({
  empty:'http://c2pa.org/digitalsourcetype/empty',
  digitalCapture:'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture',
  digitalCreation:'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCreation',
  humanEdits:'http://cv.iptc.org/newscodes/digitalsourcetype/humanEdits',
  trainedAlgorithmicMedia:'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
  compositeWithTrainedAlgorithmicMedia:'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia',
  algorithmicallyEnhanced:'http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicallyEnhanced',
});

const SKIP_TYPES=new Set(['session.checkpoint','artifact.export']);
const isCapture=type=>['audio.record','video.record','image.capture','screen.capture'].includes(type);
const actorKind=event=>clean(event?.actor?.kind,40).toLowerCase();
const eventType=event=>clean(event?.type,120).toLowerCase();
const isExternal=event=>actorKind(event)==='external'||eventType(event)==='media.import'||eventType(event).startsWith('external.');
const isAi=event=>actorKind(event)==='civweave-ai'||eventType(event).startsWith('ai.');
const isHuman=event=>actorKind(event)==='human';
const isDeterministic=event=>actorKind(event)==='deterministic';

function softwareAgent(software={}){const name=clean(software.name,120)||'Civweave Creator Suite',version=clean(software.version,80);return Object.freeze(version?{name,version}:{name})}
function publicReceipt(receipt={}){return Object.freeze({schema:'civweave.creation-receipt-summary.v1',sessionId:clean(receipt.sessionId,240),mediaType:clean(receipt.mediaType,60),artifactType:clean(receipt.artifactType,120),eventCount:Math.max(0,Number(receipt.eventCount)||0),headHash:clean(receipt.headHash,128),origin:clean(receipt.origin,40)||'unknown',aiUsed:Boolean(receipt.aiUsed),finalizedAt:clean(receipt.finalizedAt,80),receiptHash:clean(receipt.receiptHash,128)})}
function firstSourceType(events=[]){const first=events.find(event=>!SKIP_TYPES.has(eventType(event)));if(!first)return C2PA_SOURCE_TYPES.empty;const type=eventType(first);if(isCapture(type))return C2PA_SOURCE_TYPES.digitalCapture;if(isAi(first))return C2PA_SOURCE_TYPES.trainedAlgorithmicMedia;if(isHuman(first))return C2PA_SOURCE_TYPES.digitalCreation;return C2PA_SOURCE_TYPES.empty}
function editAction(event,agent,ingredientId=''){
  const type=eventType(event);if(!type||SKIP_TYPES.has(type))return null;
  if(isExternal(event))return Object.freeze({action:'c2pa.placed',softwareAgent:agent,parameters:Object.freeze({ingredientRef:ingredientId,relationship:'componentOf'})});
  if(isAi(event))return Object.freeze({action:'c2pa.edited',softwareAgent:agent,digitalSourceType:C2PA_SOURCE_TYPES.compositeWithTrainedAlgorithmicMedia});
  if(isHuman(event))return Object.freeze({action:'c2pa.edited',softwareAgent:agent,digitalSourceType:C2PA_SOURCE_TYPES.humanEdits});
  if(isDeterministic(event))return Object.freeze({action:'c2pa.edited',softwareAgent:agent,digitalSourceType:C2PA_SOURCE_TYPES.algorithmicallyEnhanced});
  return Object.freeze({action:'c2pa.edited',softwareAgent:agent});
}
function ingredientFor(event){const seq=Math.max(0,Number(event?.seq)||0);return Object.freeze({ingredientId:`ingredient:event-${seq||'unknown'}`,relationship:'componentOf',origin:'unknown',sourceEventType:eventType(event)||'external.unknown',sourceEventSeq:seq||null,requiresAssetBinding:true,privateSourceMetadataExcluded:true})}

export function buildC2paManifestIntent({receipt={},packet={},software={}}={}){
  if(receipt?.schema!=='civweave.creation-receipt-summary.v1')throw new TypeError('A compact Civweave creation receipt is required.');
  if(packet?.schema!=='civweave.creation-packet.v1')throw new TypeError('A verified Civweave creation packet is required.');
  if(clean(receipt.sessionId,240)!==clean(packet.sessionId,240)||clean(receipt.headHash,128)!==clean(packet.headHash,128))throw new Error('C2PA export intent requires a packet matching the finalized Civweave receipt.');
  const events=list(packet.events).slice(0,4096),agent=softwareAgent(software),substantive=events.filter(event=>!SKIP_TYPES.has(eventType(event))),first=substantive[0]||null,firstSeq=Number(first?.seq)||0,ingredients=[],ingredientBySeq=new Map();
  for(const event of substantive){if(!isExternal(event))continue;const ingredient=ingredientFor(event);ingredients.push(ingredient);ingredientBySeq.set(Number(event?.seq)||0,ingredient.ingredientId)}
  const actions=[Object.freeze({action:'c2pa.created',softwareAgent:agent,digitalSourceType:firstSourceType(events)})];
  for(const event of substantive){if(Number(event?.seq)||0===firstSeq&&!isExternal(event))continue;const action=editAction(event,agent,ingredientBySeq.get(Number(event?.seq)||0)||'');if(action)actions.push(action);if(actions.length>=256)break}
  return Object.freeze({
    schema:'civweave.c2pa-manifest-intent.v1',version:1,targetSpecification:'C2PA 2.4',credentialState:'unsigned-intent',requiresC2paSigner:true,requiresHardBinding:true,requiresEmbeddedOrSupportedExternalManifest:true,verifiableCredential:false,
    claimGenerator:Object.freeze({name:agent.name,version:agent.version||null}),actionsAssertion:'c2pa.actions.v2',actions:Object.freeze(actions),ingredients:Object.freeze(ingredients),publicReceipt:publicReceipt(receipt),
    privateDataExcluded:true,privateFieldsExcluded:Object.freeze(['creation packet event payloads','draft text','prompts','model outputs','actor identifiers','provider/model/request identifiers','per-event timestamps','local filenames','local content digests']),
    signerNote:'This object is only an input contract for vetted C2PA tooling. It is not a Content Credential until a C2PA signer creates a standard manifest, applies the asset hard binding, signs the claim, and embeds or links the resulting manifest using a supported C2PA method.',
  });
}
