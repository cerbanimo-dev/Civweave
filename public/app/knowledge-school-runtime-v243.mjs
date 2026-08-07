const VERSION='1.0.35-knowledge-school-runtime-v243';
const INSTALLER='/app/knowledge-school-seeds-v1.js?v=local-reader-r2';
const seedCache=new Map();
let installerPromise=null;

const clean=(value,max=6000)=>String(value??'').trim().slice(0,max);
const words=value=>[...new Set(clean(value,1800).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(word=>word.length>=3&&!['the','and','for','with','from','into','that','this','about','make','create','write','learn','each','one'].includes(word)))].sort((a,b)=>b.length-a.length).slice(0,10);

function loadClassicScript(src){return new Promise((resolve,reject)=>{const pathname=new URL(src,location.href).pathname,existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===pathname);if(existing){if(globalThis.CivweaveKnowledgeSchools)return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error(`Could not load ${src}`)),{once:true});return}const script=document.createElement('script');script.src=src;script.async=true;script.addEventListener('load',resolve,{once:true});script.addEventListener('error',()=>reject(new Error(`Could not load ${src}`)),{once:true});document.head.append(script)})}
async function installer(){if(globalThis.CivweaveKnowledgeSchools)return globalThis.CivweaveKnowledgeSchools;if(!installerPromise)installerPromise=loadClassicScript(INSTALLER).then(()=>{if(!globalThis.CivweaveKnowledgeSchools)throw new Error('Knowledge-school storage runtime did not initialize.');return globalThis.CivweaveKnowledgeSchools});return installerPromise}

function u16(view,offset){return view.getUint16(offset,true)}
function u32(view,offset){return view.getUint32(offset,true)}
function findEocd(bytes){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),floor=Math.max(0,bytes.byteLength-65557);for(let offset=bytes.byteLength-22;offset>=floor;offset--)if(u32(view,offset)===0x06054b50)return offset;throw new Error('Downloaded school ZIP has no central directory.')}
function zipEntries(bytes){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),eocd=findEocd(bytes),count=u16(view,eocd+10),start=u32(view,eocd+16),decoder=new TextDecoder(),entries=[];let offset=start;for(let index=0;index<count&&offset+46<=bytes.byteLength;index++){if(u32(view,offset)!==0x02014b50)break;const method=u16(view,offset+10),compressedSize=u32(view,offset+20),uncompressedSize=u32(view,offset+24),nameLength=u16(view,offset+28),extraLength=u16(view,offset+30),commentLength=u16(view,offset+32),localOffset=u32(view,offset+42),name=decoder.decode(bytes.subarray(offset+46,offset+46+nameLength));entries.push({name,method,compressedSize,uncompressedSize,localOffset});offset+=46+nameLength+extraLength+commentLength}return entries}
async function inflateRaw(bytes){if(typeof DecompressionStream!=='function')throw new Error('This browser cannot unpack downloaded knowledge schools offline.');const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));return new Uint8Array(await new Response(stream).arrayBuffer())}
async function extractEntry(zipBytes,entry){const view=new DataView(zipBytes.buffer,zipBytes.byteOffset,zipBytes.byteLength),offset=entry.localOffset;if(u32(view,offset)!==0x04034b50)throw new Error(`Invalid local ZIP header for ${entry.name}.`);const nameLength=u16(view,offset+26),extraLength=u16(view,offset+28),start=offset+30+nameLength+extraLength,compressed=zipBytes.subarray(start,start+entry.compressedSize);if(entry.method===0)return compressed.slice();if(entry.method===8)return inflateRaw(compressed);throw new Error(`Unsupported ZIP compression method ${entry.method}.`)}
async function databaseBytes(slug){if(seedCache.has(slug))return seedCache.get(slug);const promise=(async()=>{const store=await installer(),response=await store.openSeed(slug);if(!response)throw new Error(`Knowledge school ${slug} is not downloaded on this device.`);const zipBytes=new Uint8Array(await response.arrayBuffer()),entry=zipEntries(zipBytes).find(item=>/\.(sqlite|sqlite3|db)$/i.test(item.name)&&item.uncompressedSize>0);if(!entry)throw new Error(`Knowledge school ${slug} contains no SQLite database.`);const bytes=await extractEntry(zipBytes,entry),magic=new TextDecoder('ascii').decode(bytes.subarray(0,16));if(!magic.startsWith('SQLite format 3'))throw new Error(`Knowledge school ${slug} does not contain a valid SQLite 3 database.`);return bytes})();seedCache.set(slug,promise);try{return await promise}catch(error){seedCache.delete(slug);throw error}}

const searchDecoder=new TextDecoder('windows-1252');
const passageDecoder=new TextDecoder('utf-8',{fatal:false});
function scrubPassage(value){return clean(String(value||'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' '),3600)}
function scorePassage(text,tokens){const lower=text.toLowerCase();return tokens.reduce((score,token)=>score+(lower.includes(token)?Math.max(2,Math.min(9,token.length)):0),0)}
function findPassages(bytes,tokens,{limit=12}={}){
  const chunkSize=1024*1024,overlap=4096,hits=[],seenOffsets=new Set();
  for(let offset=0;offset<bytes.length&&hits.length<limit*4;offset+=chunkSize){
    const end=Math.min(bytes.length,offset+chunkSize+overlap),haystack=searchDecoder.decode(bytes.subarray(offset,end)).toLowerCase();
    for(const token of tokens.slice(0,7)){
      let from=0,perToken=0;
      while(perToken<4&&hits.length<limit*4){
        const index=haystack.indexOf(token,from);if(index<0)break;
        const absolute=offset+index,bucket=Math.floor(absolute/512);from=index+Math.max(1,token.length);perToken+=1;
        if(seenOffsets.has(bucket))continue;seenOffsets.add(bucket);hits.push(absolute);
      }
    }
  }
  const passages=[];
  for(const hit of hits){
    const start=Math.max(0,hit-900),end=Math.min(bytes.length,hit+3200),text=scrubPassage(passageDecoder.decode(bytes.subarray(start,end))),score=scorePassage(text,tokens);
    if(score<=0||text.length<120)continue;
    const fingerprint=text.toLowerCase().replace(/[^a-z0-9]+/g,' ').slice(0,180);if(passages.some(item=>item.fingerprint===fingerprint))continue;
    passages.push({text,score,fingerprint});
  }
  return passages.sort((a,b)=>b.score-a.score||b.text.length-a.text.length).slice(0,limit)
}
function schoolPriority(capability,records){const text=capability.toLowerCase(),preferred=[];const add=(...slugs)=>slugs.forEach(slug=>{if(!preferred.includes(slug))preferred.push(slug)});if(/game|story|narrative|character|art|music|film|design|write/.test(text))add('arts','technology');if(/software|code|computer|program|engine|technical|technology/.test(text))add('technology','mathematics','science');if(/time|physics|science|space|energy|biology|chemistry/.test(text))add('science','mathematics','philosophy-and-religion');if(/travel|place|world|country|map|geograph/.test(text))add('geography','history');if(/society|econom|govern|politic|culture|community/.test(text))add('society-and-social-sciences','history','philosophy-and-religion');if(/health|medicine|disease|body/.test(text))add('health-medicine-and-disease','science');if(/person|people|life|biograph/.test(text))add('people','history');for(const record of records)add(record.school_slug);return preferred}

export async function searchDownloadedKnowledge(capability,{limit=10,maxSchools=5}={}){const query=clean(capability,1800),tokens=words(query);if(!tokens.length)return[];const store=await installer(),status=await store.status(),available=status.filter(record=>record.current),bySlug=new Map(available.map(record=>[record.school_slug,record])),slugs=schoolPriority(query,available).filter(slug=>bySlug.has(slug)).slice(0,maxSchools),results=[];for(const slug of slugs){const record=bySlug.get(slug);try{const bytes=await databaseBytes(slug),passages=findPassages(bytes,tokens,{limit:Math.max(6,limit)});for(const passage of passages)results.push({title:`${record.school_name} downloaded reference`,url:'',notes:passage.text,score:passage.score,schoolSlug:slug,schoolName:record.school_name,table:'sqlite-byte-search'})}catch(error){console.warn('[Knowledge School local reader]',slug,error)}if(results.length>=limit*2)break}const seen=new Set();return results.sort((a,b)=>b.score-a.score).filter(item=>{const key=item.notes.toLowerCase().replace(/[^a-z0-9]+/g,' ').slice(0,200);if(seen.has(key))return false;seen.add(key);return true}).slice(0,limit)}

export function clearKnowledgeSchoolDatabaseCache(){seedCache.clear()}
export const version=VERSION;
globalThis.CivweaveKnowledgeSchoolRuntimeV243=Object.freeze({version:VERSION,search:searchDownloadedKnowledge,clear:clearKnowledgeSchoolDatabaseCache,engine:'dependency-free-sqlite-byte-search'});