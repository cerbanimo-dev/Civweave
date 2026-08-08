import * as core from './cabinets/living-school/living-school-cleanroom-core-v218.mjs';
import {searchDownloadedKnowledge} from './knowledge-school-runtime-v243.mjs';

const RESEARCHER='living-school-cleanroom-research-v218.1';
const keyFor=value=>core.clean(value,1200).toLowerCase().replace(/\s+/g,' ').slice(0,500);
const queryWords=value=>[...new Set(keyFor(value).replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(word=>word.length>=4&&!['this','that','with','from','into','before','after','their','what','when','where','should','could','would'].includes(word)))].slice(0,12);
const metadataBoundary=/(?:20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z|https?:\/\/\S+|\b[0-9a-f]{40,}\b|W\/"[^"\n]+"|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d{2}\s+[A-Z][a-z]{2}\s+20\d{2}\s+\d{2}:\d{2}:\d{2}\s+GMT)/gi;

function readableScore(text,tokens){
  const normalized=String(text||'').toLowerCase(),words=normalized.match(/[a-z]{2,}/g)||[];
  if(words.length<18)return-Infinity;
  const relevant=tokens.reduce((score,token)=>score+(normalized.includes(token)?80:0),0);
  const letters=(text.match(/[A-Za-z]/g)||[]).length,odd=(text.match(/[^\x20-\x7E\u00A0-\u024F]/g)||[]).length;
  return relevant+Math.min(words.length,180)+letters/40-odd*12;
}
function sanitizePassage(value,capability){
  const raw=String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\uFFFD]/g,' ');
  const tokens=queryWords(capability),segments=raw.split(metadataBoundary).map(part=>part.replace(/\s+/g,' ').trim()).filter(Boolean);
  let best=segments.sort((a,b)=>readableScore(b,tokens)-readableScore(a,tokens))[0]||raw.replace(/\s+/g,' ').trim();
  best=best.replace(/(?:English Wikipedia|CC BY-SA 4\.0|Wikipedia contributors;?\s*see canonical page history)/gi,' ').replace(/\s+/g,' ').trim();
  if(readableScore(best,tokens)===-Infinity)return'';
  if(best.length>1200){
    let cut=best.slice(0,1200),sentence=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('? '),cut.lastIndexOf('! '));
    if(sentence>520)cut=cut.slice(0,sentence+1);
    else cut=cut.replace(/\s+\S*$/,'');
    best=`${cut.trim()}…`;
  }
  return best;
}
function sanitizeRows(capability,rows){
  const seen=new Set(),cleaned=[];
  for(const row of Array.isArray(rows)?rows:[]){
    const notes=sanitizePassage(row?.notes,capability);if(!notes)continue;
    const fingerprint=notes.toLowerCase().replace(/[^a-z0-9]+/g,' ').slice(0,260);
    if(seen.has(fingerprint))continue;seen.add(fingerprint);
    cleaned.push({...row,notes});
    if(cleaned.length>=10)break;
  }
  return cleaned;
}
function localPacket(capability,rows){
  const key=keyFor(capability),cleanRows=sanitizeRows(capability,rows),sources=cleanRows.map((row,index)=>({
    id:core.uid('source'),
    title:core.clean(row.title,260)||`${row.schoolName||'Knowledge school'} · local passage ${index+1}`,
    url:core.clean(row.url,1600),
    quality:'downloaded reference',
    use:'supporting',
    notes:`Downloaded knowledge-school passage. Archive integrity was verified when downloaded; this content is not a live web check.\n\n${core.clean(row.notes,1400)}`,
    sourceType:'knowledge-school-local',
    at:core.now(),
    researchedBy:RESEARCHER,
    provenance:'knowledge-school-downloaded',
    verified:false,
    liveFetched:false,
    researchCapability:key,
    provenanceFlag:'DOWNLOADED SOURCE · ARCHIVE VERIFIED · NOT LIVE-CHECKED',
    schoolSlug:row.schoolSlug,
    schoolName:row.schoolName,
    table:row.table
  }));
  return{mode:'local-downloaded',summary:`Retrieved ${sources.length} clean, deduplicated passages from downloaded knowledge schools on this device.`,sources,provider:'local-knowledge-school',model:'dependency-free cached SQLite passage search · sanitized passage view',flag:'DOWNLOADED LOCAL SOURCES',reason:''};
}

export async function researchCapability(capability,{force=false}={}){
  const normalized=core.clean(capability,1200);
  if(!normalized)throw new Error('Name an observable capability before researching.');
  const s=core.state(),key=keyFor(normalized);
  if(!force&&s.research?.capability===key&&s.research?.mode==='local-downloaded'){
    const sources=(s.sources||[]).filter(source=>source?.researchedBy===RESEARCHER&&source?.researchCapability===key&&source?.provenance==='knowledge-school-downloaded');
    if(sources.length&&!sources.some(source=>/[\uFFFD\u0000-\u001f]|[0-9a-f]{48,}/i.test(source.notes||'')))return{...s.research,sources,reused:true};
  }
  let rows=[];
  try{rows=await searchDownloadedKnowledge(normalized,{limit:16,maxSchools:5})}catch(error){console.warn('[Living School downloaded research]',error)}
  if(!rows.length)return core.researchCapability(normalized,{force});
  const packet=localPacket(normalized,rows);
  if(!packet.sources.length)return core.researchCapability(normalized,{force});
  const manual=(s.sources||[]).filter(source=>source?.researchedBy!==RESEARCHER);
  s.sources=[...manual,...packet.sources].slice(0,40);
  s.research={capability:key,mode:packet.mode,summary:packet.summary,flag:packet.flag,provider:packet.provider,model:packet.model,reason:'',sourceCount:packet.sources.length,completedAt:core.now()};
  return packet;
}