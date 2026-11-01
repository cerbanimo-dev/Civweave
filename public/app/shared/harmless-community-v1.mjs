/** Optional Guild-signed HARMLESS discussion using Civweave's existing object mesh.
 * Group consent is explicit. Entries use unique IDs and revision 1; no update,
 * remove, or republish method is exposed. Signed provenance is a DEVICE, not
 * proof of model sentience, authorship, human Guild membership, or votes.
 */
export const HARMLESS_MESH_KIND='civweave.harmless-post.v1';
export const HARMLESS_MESH_SCHEMA='civweave.harmless-post.v1';
const words=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const guild=value=>{const id=words(value,181);if(!/^[A-Za-z0-9:_-]{1,180}$/.test(id))throw new TypeError('Invalid Guild ID.');return id};
function field(v,n,max){if(typeof v!=='string'||!v.trim()||v.trim().length>max||(/[\r\n]/.test(v)&&n!=='body'))throw new TypeError('Invalid '+n+'.');return v.trim()}
function person(v){return field(v,'personaId',40)}
const normalize=(o)=>{
 const p=o?.payload;
 if(o?.kind!==HARMLESS_MESH_KIND||o.revision!==1||p?.schema!==HARMLESS_MESH_SCHEMA||
    p.guildId===undefined||!p.guildId||p.postId!==o.id||p.authorDeviceId!==o.origin?.nodeId||
    o.consent!=='group'||!Array.isArray(o.audience)||o.audience.length!==1||
    o.audience[0]!=='guild:'+p.guildId||!Number.isFinite(Date.parse(p.at))||
    !Number.isFinite(Date.parse(o.createdAt)))return null;
 try{
  return Object.freeze({id:p.postId,guildId:guild(p.guildId),name:field(p.name,'name',40),
    subject:field(p.subject,'subject',120),body:field(p.body,'body',4000),
    personaId:person(p.personaId),at:p.at,source:p.source==='local-model'?'local-model':'human',
    signerId:o.origin.nodeId,signatureHash:o.revisionHash,deviceSigned:true});
 }catch{return null}
};
export function createHarmlessCommunity({
 mesh,verifyReader,verifyWriter,newId=()=>crypto.randomUUID(),clock=()=>new Date().toISOString()
}={}){
 if(!mesh||typeof mesh.createObject!=='function'||typeof mesh.validateObject!=='function')
   throw new TypeError('The Civweave signed object mesh is required.');
 const canRead=id=>typeof verifyReader==='function'&&verifyReader(id)===true;
 const canWrite=id=>typeof verifyWriter==='function'&&verifyWriter(id)===true;
 async function read({guildId,limit=300}={}){
  const gid=guild(guildId);
  if(!canRead(gid))throw new Error('Guild read authorization is required.');
  const records=await mesh.listObjects();const posts=[];
  for(const object of Array.isArray(records)?records:[]){
   if(object?.kind!==HARMLESS_MESH_KIND||object.payload?.guildId!==gid)continue;
   const normalized=normalize(object);
   if(!normalized||normalized.guildId!==gid||(await mesh.validateObject(object))?.ok!==true)continue;
   posts.push(normalized);
  }
  posts.sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
  return Object.freeze(posts.slice(-Math.min(300,Math.max(1,Number.isInteger(limit)?limit:300))));
 }
 async function append({guildId,name,subject,body,personaId='local-model',source='human'}={}){
  const gid=guild(guildId);
  if(!canWrite(gid))throw new Error('Guild write authorization is required.');
  const id='harmless-post:'+gid+':'+newId();
  if(!/^harmless-post:[A-Za-z0-9:_-]{1,180}:[A-Za-z0-9_-]{1,100}$/.test(id))
    throw new TypeError('Invalid HARMLESS entry ID.');
  if(await mesh.getObject?.(id))throw new Error('HARMLESS entry ID collision; earlier post preserved.');
  const authorDeviceId=await mesh.deviceId(),at=clock();
  if(!Number.isFinite(Date.parse(at)))throw new TypeError('Invalid timestamp.');
  return mesh.createObject({
   id,revision:1,kind:HARMLESS_MESH_KIND,
   purpose:'Append-only Guild-visible fictional writing. Not an AI identity, verified claim or human vote.',
   consent:'group',audience:['guild:'+gid],publish:true,priority:35,
   payload:{schema:HARMLESS_MESH_SCHEMA,postId:id,guildId:gid,authorDeviceId,
    personaId:person(personaId),name:field(name,'name',40),
    subject:field(subject,'subject',120),body:field(body,'body',4000),
    at,source:source==='local-model'?'local-model':'human'}
  });
 }
 return Object.freeze({read,append});
}
