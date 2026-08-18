import {searchSupplementalArticles} from './learning-source-pack-runtime-v1.mjs?v=unified-source-packs-v1';

const VERSION='1.0.37-knowledge-school-runtime-v243-source-pack-gaps';
const INSTALLER='/app/knowledge-school-seeds-v1.js?v=local-reader-r2';
const seedCache=new Map();
let installerPromise=null;

const clean=(value,max=6000)=>String(value??'').trim().slice(0,max);
const words=value=>[...new Set(clean(value,1800).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(word=>word.length>=3&&!['the','and','for','with','from','into','that','this','about','make','create','write','learn','each','one'].includes(word)))].sort((a,b)=>b.length-a.length).slice(0,10);
const validHttp=value=>{try{return['http:','https:'].includes(new URL(value).protocol)}catch{return false}};
const normalizeUrl=value=>{try{const url=new URL(clean(value,2400));url.hash='';return['http:','https:'].includes(url.protocol)?url.href:''}catch{return''}};

function loadClassicScript(src){return new Promise((resolve,reject)=>{const pathname=new URL(src,location.href).pathname,existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===pathname);if(existing){if(globalThis.CivweaveKnowledgeSchools)return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error(`Could not load ${src}`)),{once:true});return}const script=document.createElement('script');script.src=src;script.async=true;script.addEventListener('load',resolve,{once:true});script.addEventListener('error',()=>reject(new Error(`Could not load ${src}`)),{once:true});document.head.append(script)})}
async function installer(){if(globalThis.CivweaveKnowledgeSchools)return globalThis.CivweaveKnowledgeSchools;if(!installerPromise)installerPromise=loadClassicScript(INSTALLER).then(()=>{if(!globalThis.CivweaveKnowledgeSchools)throw new Error('Knowledge-school storage runtime did not initialize.');return globalThis.CivweaveKnowledgeSchools});return installerPromise}

function u16(view,offset){return view.getUint16(offset,true)}
function u32(view,offset){return view.getUint32(offset,true)}
function findEocd(bytes){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),floor=Math.max(0,bytes.byteLength-65557);for(let offset=bytes.byteLength-22;offset>=floor;offset--)if(u32(view,offset)===0x06054b50)return offset;throw new Error('Downloaded school ZIP has no central directory.')}
function zipEntries(bytes){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),eocd=findEocd(bytes),count=u16(view,eocd+10),start=u32(view,eocd+16),decoder=new TextDecoder(),entries=[];let offset=start;for(let index=0;index<count&&offset+46<=bytes.byteLength;index++){if(u32(view,offset)!==0x02014b50)break;const method=u16(view,offset+10),compressedSize=u32(view,offset+20),uncompressedSize=u32(view,offset+24),nameLength=u16(view,offset+28),extraLength=u16(view,offset+30),commentLength=u16(view,offset+32),localOffset=u32(view,offset+42),name=decoder.decode(bytes.subarray(offset+46,offset+46+nameLength));entries.push({name,method,compressedSize,uncompressedSize,localOffset});offset+=46+nameLength+extraLength+commentLength}return entries}
async function inflateRaw(bytes){if(typeof DecompressionStream!=='function')throw new Error('This browser cannot unpack downloaded knowledge schools offline.');const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));return new Uint8Array(await new Response(stream).arrayBuffer())}
async function extractEntry(zipBytes,entry){const view=new DataView(zipBytes.buffer,zipBytes.byteOffset,zipBytes.byteLength),offset=entry.localOffset;if(u32(view,offset)!==0x04034b50)throw new Error(`Invalid local ZIP header for ${entry.name}.`);const nameLength=u16(view,offset+26),extraLength=u16(view,offset+28),start=offset+30+nameLength+extraLength,compressed=zipBytes.subarray(start,start+entry.compressedSize);if(entry.method===0)return compressed.slice();if(entry.method===8)return inflateRaw(compressed);throw new Error(`Unsupported ZIP compression method ${entry.method}.`)}

function collectMetadata(value,out,depth=0){
  if(depth>7||out.length>=5000||value==null)return;
  if(Array.isArray(value)){for(const item of value)collectMetadata(item,out,depth+1);return}
  if(typeof value!=='object')return;
  const title=clean(value.article_title||value.articleTitle||value.page_title||value.pageTitle||value.title||value.name,320);
  const url=normalizeUrl(value.canonical_url||value.canonicalUrl||value.source_url||value.sourceUrl||value.article_url||value.articleUrl||value.url);
  if(title&&url)out.push({title,url});
  for(const child of Object.values(value))if(child&&typeof child==='object')collectMetadata(child,out,depth+1);
}
function parseMetadataText(text){
  const rows=[];
  try{collectMetadata(JSON.parse(text),rows)}catch{
    for(const line of String(text||'').split(/\r?\n/)){
      const trimmed=line.trim();if(!trimmed||(!trimmed.startsWith('{')&&!trimmed.startsWith('[')))continue;
      try{collectMetadata(JSON.parse(trimmed),rows)}catch{}
    }
  }
  const seen=new Set();
  return rows.filter(row=>{const key=normalizeUrl(row.url);if(!key||seen.has(key))return false;seen.add(key);row.url=key;return true}).slice(0,3000);
}
async function extractArticleMetadata(zipBytes,entries){
  const decoder=new TextDecoder('utf-8',{fatal:false}),records=[];
  const candidates=entries.filter(entry=>entry.uncompressedSize>0&&entry.uncompressedSize<=8*1024*1024&&/\.(json|jsonl|ndjson)$/i.test(entry.name)&&/(manifest|source|article|provenance)/i.test(entry.name)).slice(0,12);
  for(const entry of candidates){
    try{records.push(...parseMetadataText(decoder.decode(await extractEntry(zipBytes,entry))))}catch(error){console.warn('[Knowledge School source manifest]',entry.name,error)}
  }
  const seen=new Set();
  return records.filter(row=>{const key=normalizeUrl(row.url);if(!key||seen.has(key))return false;seen.add(key);row.url=key;return true}).slice(0,3000);
}
async function databaseBundle(slug){
  if(seedCache.has(slug))return seedCache.get(slug);
  const promise=(async()=>{
    const store=await installer(),response=await store.openSeed(slug);
    if(!response)throw new Error(`Knowledge school ${slug} is not downloaded on this device.`);
    const zipBytes=new Uint8Array(await response.arrayBuffer()),entries=zipEntries(zipBytes),entry=entries.find(item=>/\.(sqlite|sqlite3|db)$/i.test(item.name)&&item.uncompressedSize>0);
    if(!entry)throw new Error(`Knowledge school ${slug} contains no SQLite database.`);
    const metadata=await extractArticleMetadata(zipBytes,entries),bytes=await extractEntry(zipBytes,entry),magic=new TextDecoder('ascii').decode(bytes.subarray(0,16));
    if(!magic.startsWith('SQLite format 3'))throw new Error(`Knowledge school ${slug} does not contain a valid SQLite 3 database.`);
    return{bytes,metadata};
  })();
  seedCache.set(slug,promise);
  try{return await promise}catch(error){seedCache.delete(slug);throw error}
}

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
    passages.push({text,score,fingerprint,hit});
  }
  return passages.sort((a,b)=>b.score-a.score||b.text.length-a.text.length).slice(0,limit)
}
function titleFromWikipediaUrl(value){
  try{const url=new URL(value),match=url.pathname.match(/\/wiki\/([^/?#]+)/);return match?decodeURIComponent(match[1]).replace(/_/g,' '):''}catch{return''}
}
function canonicalNearHit(bytes,hit,metadata){
  const radius=12288,start=Math.max(0,hit-radius),end=Math.min(bytes.length,hit+radius),text=searchDecoder.decode(bytes.subarray(start,end)),known=new Map(metadata.map(row=>[normalizeUrl(row.url),row]));
  const matches=[];let match;
  const re=/https?:\/\/[^\s"'<>\\\u0000-\u001f]+/gi;
  while((match=re.exec(text))){
    const url=normalizeUrl(match[0].replace(/[),.;\]}]+$/,''));if(!url)continue;
    const row=known.get(url);
    if(metadata.length&&!row)continue;
    if(!metadata.length&&!/\.wikipedia\.org\/wiki\//i.test(url))continue;
    matches.push({url,title:row?.title||titleFromWikipediaUrl(url),distance:Math.abs((start+match.index)-hit)});
  }
  return matches.sort((a,b)=>a.distance-b.distance)[0]||null;
}
function bestMetadataForPassage(text,tokens,metadata){
  const lower=String(text||'').toLowerCase();let best=null;
  for(const row of metadata){
    const title=clean(row.title,320),normalized=title.toLowerCase(),titleTokens=words(title).filter(word=>word.length>=4),exact=normalized.length>=4&&lower.includes(normalized),passageHits=titleTokens.filter(word=>lower.includes(word)).length,queryHits=titleTokens.filter(word=>tokens.includes(word)).length;
    const score=(exact?1000:0)+passageHits*90+queryHits*35;
    if(!exact&&passageHits<2&&!(passageHits>=1&&queryHits>=1))continue;
    if(!best||score>best.score)best={title,url:row.url,score};
  }
  return best;
}
function schoolPriority(capability,records){
  const text=capability.toLowerCase(),preferred=[];const add=(...slugs)=>slugs.forEach(slug=>{if(!preferred.includes(slug))preferred.push(slug)});
  if(/tarot|arcana|cartomancy|divination|rider.?waite|symbol/.test(text))add('philosophy-and-religion','arts','history');
  if(/myth|folklore|legend/.test(text))add('philosophy-and-religion','history','arts');
  if(/meditat|mindful|breath|contemplat/.test(text))add('health-medicine-and-disease','philosophy-and-religion');
  if(/garden|plant|horticult|soil|growing food/.test(text))add('everyday-life','science');
  if(/parent|caregiv|relationship|conflict|communicat|active listen/.test(text))add('society-and-social-sciences','health-medicine-and-disease','people');
  if(/finance|budget|credit|entrepreneur|small business|career|resume|résumé|interview|workplace/.test(text))add('everyday-life','society-and-social-sciences');
  if(/language|vocabulary|grammar|speaking|listening|second.?language/.test(text))add('people','society-and-social-sciences');
  if(/woodwork|sewing|textile|maker|solder|circuit|electronics|repair/.test(text))add('everyday-life','technology','arts');
  if(/emergency|disaster|resilien|prepared/.test(text))add('geography','society-and-social-sciences','health-medicine-and-disease');
  if(/game|story|narrative|character|art|music|film|design|write/.test(text))add('arts','technology');
  if(/software|code|computer|program|engine|technical|technology|prompt|algorithm|pseudocode/.test(text))add('technology','mathematics','science');
  if(/time|physics|science|space|energy|biology|chemistry|climate|environment/.test(text))add('science','mathematics','philosophy-and-religion');
  if(/travel|place|world|country|map|geograph/.test(text))add('geography','history');
  if(/society|econom|govern|politic|culture|community|rights|law/.test(text))add('society-and-social-sciences','history','philosophy-and-religion');
  if(/health|medicine|disease|body|nutrition/.test(text))add('health-medicine-and-disease','science');
  if(/person|people|life|biograph/.test(text))add('people','history');
  for(const record of records)add(record.school_slug);return preferred
}

export async function searchDownloadedKnowledge(capability,{limit=10,maxSchools=5}={}){
  const query=clean(capability,1800),tokens=words(query);if(!tokens.length)return[];
  const store=await installer(),status=await store.status(),available=status.filter(record=>record.current),bySlug=new Map(available.map(record=>[record.school_slug,record])),slugs=schoolPriority(query,available).filter(slug=>bySlug.has(slug)).slice(0,maxSchools),results=[];
  try{
    const supplemental=await searchSupplementalArticles(query,{schoolSlugs:slugs,limit:Math.max(10,limit)});
    for(const row of supplemental)results.push({...row,score:Number(row.score||0)+24});
  }catch(error){console.warn('[Knowledge School supplemental reader]',error)}
  for(const slug of slugs){
    const record=bySlug.get(slug);
    try{
      const bundle=await databaseBundle(slug),passages=findPassages(bundle.bytes,tokens,{limit:Math.max(6,limit)});
      for(const passage of passages){
        const nearby=canonicalNearHit(bundle.bytes,passage.hit,bundle.metadata),matched=nearby||bestMetadataForPassage(passage.text,tokens,bundle.metadata),title=clean(matched?.title,320)||`${record.school_name} downloaded reference`,url=normalizeUrl(matched?.url);
        results.push({title,url,notes:passage.text,score:passage.score,schoolSlug:slug,schoolName:record.school_name,table:'sqlite-byte-search',articleTitle:title,canonicalUrl:url,linkProvenance:url?(nearby?'archive-canonical-near-passage':'archive-manifest-title-match'):'unresolved'});
      }
    }catch(error){console.warn('[Knowledge School local reader]',slug,error)}
    if(results.length>=limit*3)break;
  }
  const seen=new Set();return results.sort((a,b)=>b.score-a.score).filter(item=>{const key=(item.canonicalUrl||item.url||item.notes).toLowerCase().replace(/[^a-z0-9]+/g,' ').slice(0,220);if(seen.has(key))return false;seen.add(key);return true}).slice(0,limit)
}

export function clearKnowledgeSchoolDatabaseCache(){seedCache.clear()}
export const version=VERSION;
globalThis.CivweaveKnowledgeSchoolRuntimeV243=Object.freeze({version:VERSION,search:searchDownloadedKnowledge,clear:clearKnowledgeSchoolDatabaseCache,engine:'dependency-free-sqlite-byte-search+canonical-source-links+supplemental-source-pack'});
