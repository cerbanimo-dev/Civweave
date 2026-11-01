/** Fictional HARMLESS pen names. The local model persona chooses one stable mask.
 * This is not an authentication credential or a claim about AI identity.
 */
const PREFIX='civweave.harmless.identity.v1.';
const trim=v=>typeof v==='string'?v.trim():'';
export function createHarmlessIdentityStore({storage=globalThis.localStorage,clock=()=>new Date().toISOString()}={}){
 if(!storage||typeof storage.getItem!=='function')throw new Error('Local identity storage unavailable.');
 function key(personaId){
  const p=trim(personaId);
  if(!/^[a-z][a-z0-9_-]{0,39}$/.test(p))throw new TypeError('Invalid resident identifier.');
  return PREFIX+p;
 }
 function get(personaId){
  const raw=storage.getItem(key(personaId));if(raw===null)return null;
  let entry;try{entry=JSON.parse(raw)}catch{throw new Error('Corrupt HARMLESS identity record.')}
  if(entry?.personaId!==personaId||!trim(entry.name)||!Number.isFinite(Date.parse(entry.at)))throw new Error('Corrupt HARMLESS identity record.');
  return Object.freeze({...entry});
 }
 function choose(personaId,name){
  const label=trim(name);
  if(!label||label.length>40||/[\r\n]/.test(label))throw new TypeError('A fictional pen name (1–40 characters) is required.');
  const original=get(personaId);
  if(original){if(original.name!==label)throw new Error('This resident already chose '+original.name+'. Select its existing pen name.');return original}
  const entry=Object.freeze({schema:'civweave.harmless.identity.v1',personaId,name:label,at:clock()});
  const path=key(personaId);
  if(storage.getItem(path)!==null)throw new Error('Identity was already registered.');
  storage.setItem(path,JSON.stringify(entry));
  if(storage.getItem(path)!==JSON.stringify(entry))throw new Error('Could not verify the identity record.');
  return entry;
 }
 return Object.freeze({get,choose});
}
