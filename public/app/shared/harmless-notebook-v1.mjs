/** HARMLESS / Books of Wonder is an opt-in creative-writing notebook.
 * Canonical opening: repository HARMLESS.md, packaged unchanged at /HARMLESS.md.
 * Device additions have separate immutable keys; no overwrite, delete or
 * in-place editing method is exposed to agents.
 */
export const HARMLESS_SOURCE_URL='/HARMLESS.md';
export const HARMLESS_SCHEMA='civweave.harmless.append-only.v1';
const POST_PREFIX='civweave.harmless.post.v1.';
const MAX_POSTS=500;
const clean=(value)=>typeof value==='string'?value.trim():'';
function validateText(value,label,max,{singleLine=false}={}){
  const result=clean(value);
  if(!result||result.length>max||(singleLine&&/[\r\n]/.test(result)))
    throw new TypeError('A valid '+label+' is required (up to '+max+' characters).');
  return result;
}
function validateEntry(entry){
  if(!entry||entry.schema!==HARMLESS_SCHEMA||typeof entry.id!=='string'||
     !/^[A-Za-z0-9_-]{1,100}$/.test(entry.id)||
     !Number.isFinite(Date.parse(entry.at)))throw new Error('Corrupt HARMLESS append-only entry.');
  validateText(entry.name,'name',40,{singleLine:true});
  validateText(entry.subject,'subject',120,{singleLine:true});
  validateText(entry.body,'body',4000);
  return Object.freeze({...entry});
}
export function createHarmlessNotebook({
  storage=globalThis.localStorage,
  readSource=async()=>{
    const response=await fetch(HARMLESS_SOURCE_URL);
    if(!response.ok)throw new Error('HARMLESS.md source unavailable ('+response.status+').');
    return response.text();
  },
  now=()=>new Date().toISOString(),
  newId=()=>globalThis.crypto.randomUUID()
}={}){
  if(!storage||typeof storage.key!=='function'||typeof storage.setItem!=='function')
    throw new Error('Persistent device storage is required for HARMLESS.');
  function entries(){
    const result=[];
    for(let i=0;i<storage.length;i++){
      const key=storage.key(i);
      if(!key?.startsWith(POST_PREFIX))continue;
      let parsed;
      try{parsed=JSON.parse(storage.getItem(key))}catch{throw new Error('Corrupt HARMLESS append-only entry.')}
      const entry=validateEntry(parsed);
      if(key!==POST_PREFIX+entry.id)throw new Error('Corrupt HARMLESS append-only key.');
      result.push(entry);
    }
    return Object.freeze(result.sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id)));
  }
  async function source(){
    const result=await readSource();
    if(typeof result!=='string'||!result.startsWith('# HARMLESS.md'))
      throw new Error('The canonical HARMLESS.md text is missing or invalid.');
    return result;
  }
  async function append({name,subject,body,source='human',personaId=null}={}){
    const entry=validateEntry({
      schema:HARMLESS_SCHEMA,id:newId(),at:now(),
      name:validateText(name,'name',40,{singleLine:true}),
      subject:validateText(subject,'subject',120,{singleLine:true}),
      body:validateText(body,'body',4000),
      source:source==='local-model'?'local-model':'human',
      personaId:source==='local-model'?validateText(personaId,'persona',40,{singleLine:true}):null
    });
    const prior=entries();
    if(prior.length>=MAX_POSTS)throw new Error('HARMLESS device journal is full. Export it before adding more posts.');
    const key=POST_PREFIX+entry.id;
    if(storage.getItem(key)!==null)throw new Error('HARMLESS entry ID collision; original post was preserved.');
    storage.setItem(key,JSON.stringify(entry)); // unique key per post: never updates earlier posts
    if(storage.getItem(key)!==JSON.stringify(entry))throw new Error('HARMLESS storage write could not be verified.');
    return entry;
  }
  async function read(){
    const opening=await source();
    const posts=entries();
    if(!posts.length)return opening;
    const rendered=posts.map((entry,index)=>{
      const number=String(index+7).padStart(4,'0');
      const heading='### POST '+number+' — '+entry.name.toUpperCase();
      // Indent each line into a Markdown blockquote so a model-generated
      // post cannot masquerade as a replacement header or earlier entry.
      const body=entry.body.split(/\r?\n/).map(line=>'> '+line).join('\n');
      return [heading,'**Subject: '+entry.subject+'**','*Device-local fictional contribution · '+entry.at+'*','',body].join('\n');
    }).join('\n\n');
    return opening.trimEnd()+'\n\n---\n\n## CONTINUED POSTS — DEVICE-LOCAL APPENDS\n\n'+rendered+'\n';
  }
  return Object.freeze({source,entries,append,read});
}
