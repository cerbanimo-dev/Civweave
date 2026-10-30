import {validateAvatarPlan} from './worldweaver-avatar-v1.mjs';

export const AVATAR_LAB_BUNDLE='civweave.worldweaver.avatar-lab.v1';
export const AVATAR_LAB_BYTES=32000;
const persona=v=>{if(typeof v!=='string'||!(/^[a-z][a-z0-9-]{0,39}$/).test(v))throw new TypeError('Invalid persona ID.');return v};
function unwrap(input){
  let raw=input;
  if(typeof raw==='string'){
    if(raw.length>AVATAR_LAB_BYTES)throw new TypeError('Avatar import exceeds size limit.');
    try{raw=JSON.parse(raw)}catch{throw new TypeError('Avatar import is not valid JSON.')}
  }
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new TypeError('Avatar import must be a JSON object.');
  if(raw.schema!==undefined){
    if(raw.schema!==AVATAR_LAB_BUNDLE)throw new TypeError('Unknown avatar bundle schema.');
    if(Object.keys(raw).some(k=>!['schema','personaId','plan'].includes(k)))throw new TypeError('Unknown avatar bundle fields.');
    persona(raw.personaId);
    return {personaId:raw.personaId,plan:validateAvatarPlan(raw.plan)};
  }
  return {personaId:null,plan:validateAvatarPlan(raw)};
}
export function parseAvatarImport(input,{expectedPersona}={}){
  const value=unwrap(input);
  if(expectedPersona&&value.personaId&&value.personaId!==persona(expectedPersona))
    throw new TypeError('Avatar bundle is for a different persona.');
  return value.plan;
}
export function serializeAvatarBundle(personaId,plan){
  const bundle={schema:AVATAR_LAB_BUNDLE,personaId:persona(personaId),plan:validateAvatarPlan(plan)};
  const text=JSON.stringify(bundle,null,2);
  if(text.length>AVATAR_LAB_BYTES)throw new TypeError('Avatar bundle exceeds export size limit.');
  return text;
}
/** Save only validated previews, never untrusted or incomplete edits. Fail safely in
 * private browsing/storage-blocked contexts. No cross-persona draft sharing.
 */
export function createAvatarDraftStore(storage,{prefix='civweave.worldweaver.lab.avatar.v1.'}={}){
  const key=id=>prefix+persona(id);
  return Object.freeze({
    read(personaId){
      try{
        const raw=storage?.getItem(key(personaId));
        if(!raw)return {ok:false,reason:'empty'};
        const plan=parseAvatarImport(raw,{expectedPersona:personaId});
        return {ok:true,plan};
      }catch(error){return {ok:false,reason:'unreadable',message:String(error.message||error).slice(0,180)}}
    },
    write(personaId,plan){
      const safe=serializeAvatarBundle(personaId,plan);
      try{
        if(!storage?.setItem)return {ok:false,reason:'unavailable'};
        storage.setItem(key(personaId),safe);
        return {ok:true};
      }catch(error){return {ok:false,reason:'unavailable',message:String(error.message||error).slice(0,180)}}
    },
    clear(personaId){
      try{storage?.removeItem(key(personaId));return {ok:true}}
      catch(error){return {ok:false,reason:'unavailable',message:String(error.message||error).slice(0,180)}}
    }
  });
}
