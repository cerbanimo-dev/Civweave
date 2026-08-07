import * as core from './cabinets/living-school/living-school-cleanroom-core-v218.mjs';
import {searchDownloadedKnowledge} from './knowledge-school-runtime-v243.mjs';

const RESEARCHER='living-school-cleanroom-research-v218.1';
const keyFor=value=>core.clean(value,1200).toLowerCase().replace(/\s+/g,' ').slice(0,500);

function localPacket(capability,rows){
  const key=keyFor(capability),sources=rows.map(row=>({
    id:core.uid('source'),
    title:core.clean(row.title,260)||`${row.schoolName} reference`,
    url:core.clean(row.url,1600),
    quality:'downloaded reference',
    use:'supporting',
    notes:`Downloaded knowledge-school reference. Archive integrity was verified when downloaded; this content is not a live web check.\n\n${core.clean(row.notes,3200)}`,
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
  return{mode:'local-downloaded',summary:`Retrieved ${sources.length} relevant passages from downloaded knowledge schools on this device.`,sources,provider:'local-knowledge-school',model:'cached SQLite + sql.js',flag:'DOWNLOADED LOCAL SOURCES',reason:''};
}

export async function researchCapability(capability,{force=false}={}){
  const normalized=core.clean(capability,1200);
  if(!normalized)throw new Error('Name an observable capability before researching.');
  const s=core.state(),key=keyFor(normalized);
  if(!force&&s.research?.capability===key&&s.research?.mode==='local-downloaded'){
    const sources=(s.sources||[]).filter(source=>source?.researchedBy===RESEARCHER&&source?.researchCapability===key&&source?.provenance==='knowledge-school-downloaded');
    if(sources.length)return{...s.research,sources,reused:true};
  }
  let rows=[];
  try{rows=await searchDownloadedKnowledge(normalized,{limit:10,maxSchools:5})}catch(error){console.warn('[Living School downloaded research]',error)}
  if(!rows.length)return core.researchCapability(normalized,{force});
  const packet=localPacket(normalized,rows),manual=(s.sources||[]).filter(source=>source?.researchedBy!==RESEARCHER);
  s.sources=[...manual,...packet.sources].slice(0,40);
  s.research={capability:key,mode:packet.mode,summary:packet.summary,flag:packet.flag,provider:packet.provider,model:packet.model,reason:'',sourceCount:packet.sources.length,completedAt:core.now()};
  return packet;
}
