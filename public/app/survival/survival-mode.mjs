// Canonical Survival Mode decision contract. No camera inference, AI runtime, network,
// diagnosis, or resource allocation is performed by this module.
export const SURVIVAL_SCHEMA='civweave.survival-assessment.v1';

export const CONCERNS=Object.freeze([
  Object.freeze({id:'immediate-danger',label:'Fire, smoke, gas odor, flooding, collapse, or other immediate danger',priority:'emergency',query:'emergency evacuation hazard safety',step:'If possible without adding risk, move away from the suspected danger, warn others, and contact local emergency services. Do not re-enter or investigate an unsafe area.',caution:'A phone photograph cannot verify that an area is safe.'}),
  Object.freeze({id:'electricity',label:'Possible electrical danger, exposed wiring, or water near power',priority:'emergency',query:'electrical safety flooding exposed wires',step:'Stay away from exposed wiring, wet electrical equipment, and potentially energized water. Contact emergency services or a qualified utility professional as appropriate.',caution:'Do not touch electrical equipment or attempt a repair in hazardous conditions.'}),
  Object.freeze({id:'injury',label:'Someone may be seriously injured or ill',priority:'emergency',query:'emergency first aid urgent injury response',step:'Contact local emergency services for a serious or life-threatening condition. Follow dispatcher instructions; give first aid only when you can do so safely.',caution:'This guide cannot diagnose injury, illness, or determine whether emergency care is unnecessary.'}),
  Object.freeze({id:'exposure',label:'Unsafe temperature, severe weather, or lack of protective shelter',priority:'urgent',query:'emergency shelter hypothermia heat illness weather safety',step:'Seek a safer sheltered location and protect yourself from environmental exposure. Do not take an uncertain route into greater danger.',caution:'Weather, building conditions, and local hazards are not being monitored live.'}),
  Object.freeze({id:'water',label:'No confirmed safe drinking water',priority:'urgent',query:'emergency drinking water safety treatment contamination',step:'Check available sealed or otherwise confirmed potable water first. Do not assume clear-looking water is safe; treatment depends on the type of contamination.',caution:'Boiling does not make chemically contaminated water safe.'}),
  Object.freeze({id:'shelter',label:'Shelter or building appears damaged',priority:'urgent',query:'storm damage unsafe building shelter assessment',step:'Avoid entering or staying in a building with possible structural, gas, flood, or electrical hazards. Seek an established safe shelter or qualified help.',caution:'Visual inspection cannot establish structural safety.'}),
  Object.freeze({id:'lost',label:'Lost, stranded, or unsure about a safe route',priority:'urgent',query:'lost outdoors emergency navigation search rescue',step:'Avoid moving deeper into unfamiliar or dangerous terrain. Assess immediate hazards, preserve communication power, and contact rescuers if needed.',caution:'Cached maps cannot confirm current route, weather, or access conditions.'}),
  Object.freeze({id:'plant',label:'Unknown plant, mushroom, berry, or possible wild food',priority:'caution',query:'plant identification diagnostic characteristics poisonous lookalikes',step:'Do not eat or consume an unidentified organism. Compare multiple identifying features and dangerous lookalikes against trustworthy field references; request qualified local identification.',caution:'A photograph and apparent resemblance are not sufficient to establish identification or edibility; some lookalikes are lethal.'}),
  Object.freeze({id:'pipe',label:'Broken pipe, leak, or damaged household equipment',priority:'caution',query:'household plumbing leak water shutoff repair safety',step:'Check first for electricity, gas, structural hazards, or contaminated water. If safe and you know its location, consider using the water shutoff; consult a qualified repair reference before working.',caution:'A photograph cannot establish the pipe material, contents, or safe repair procedure.'}),
  Object.freeze({id:'supplies',label:'Need to inventory supplies or plan next actions',priority:'planning',query:'emergency preparedness water food shelter supply checklist',step:'Identify immediate safety needs, then record verified supplies, useful tools, constraints, and communication options. Reassess if conditions change.',caution:'Only resources the user actually reports are included in this assessment.'})
]);

const byId=new Map(CONCERNS.map(row=>[row.id,row]));
const clean=(value,max=500)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().replace(/\s+/g,' ').slice(0,max);

export function planAssessment(input={}){
  const values=Array.isArray(input?.concerns)?input.concerns:[];
  const reportedConcerns=[...new Set(values.map(value=>clean(value,90)).filter(value=>byId.has(value)))];
  const resources=Array.isArray(input?.resources)?input.resources:[];
  const reportedResources=[...new Set(resources.map(value=>clean(value,90)).filter(Boolean))].slice(0,24);
  const primary=CONCERNS.find(row=>reportedConcerns.includes(row.id))||null;
  return Object.freeze({
    schema:SURVIVAL_SCHEMA,
    priority:primary?.priority||'unassessed',
    primaryConcern:primary?.id||null,
    reportedConcerns,
    reportedResources,
    photoStatus:input?.photoAttached===true?'not-analyzed':'not-provided',
    diagnosis:null,
    nextStep:primary?.step||'Check for immediate danger, serious injuries, unsafe exposure, and safe exit options before making a plan. Select only conditions you can actually report.',
    caution:primary?.caution||'No hazards were assessed. Missing information is not evidence that your surroundings are safe.',
    sourceQuery:primary?.query||'emergency assessment basic safety checklist',
    provenance:'user-reported conditions only; no vision or medical inference'
  });
}
export function buildReferenceQuery(input={}){
  const concerns=Array.isArray(input?.concerns)?input.concerns:[];
  return CONCERNS.find(row=>concerns.includes(row.id))?.query||'emergency preparedness safety assessment';
}
function verifiedUrl(value){
  try{const url=new URL(clean(value,2000));return ['https:','http:'].includes(url.protocol)?url.href:''}catch{return''}
}
// Produces transparent excerpts, never a claim that a full verified source is installed.
export function normalizeReferenceCards(rows=[],tier='foundation'){
  const result=[],seen=new Set();
  for(const row of Array.isArray(rows)?rows:[]){
    const title=clean(row?.title||row?.articleTitle,240);
    const excerpt=clean(row?.notes||row?.snippet||row?.passage,2800);
    if(!title||!excerpt)continue;
    const url=verifiedUrl(row?.canonicalUrl||row?.canonical_url||row?.url);
    const key=(url||title).toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);
    result.push(Object.freeze({
      title,excerpt,url,school:clean(row?.schoolName||row?.school_name||row?.schoolSlug||row?.school_slug||'Downloaded library',150),
      license:clean(row?.license,100),revision:clean(row?.revision,100),
      source:clean(row?.source,160),key:clean(row?.key,200),
      tier:clean(tier,35),availability:'offline-excerpt',
      verifiedIdentification:false
    }));
    if(result.length>=12)break;
  }
  return result;
}


// Canonical ICM-ready handoff. Media, EXIF, coordinates and untrusted model output
// never become verified observations in this deterministic v1 packet.
export const FIELD_PACKET_SCHEMA='civweave.survival-field-packet.v1';
export function verificationChecklist(input={}){
  const concerns=Array.isArray(input?.concerns)?input.concerns:[];
  const checklist=[
    'Check again for immediate hazards, injuries, exits, and changes to your surroundings.',
    'Separate firsthand observations from suggestions, assumptions and unverified claims.'
  ];
  if(concerns.includes('plant')){
    checklist.push('Document the leaf arrangement, stem, flowers or fruit, and habitat.');
    checklist.push('Compare toxic lookalikes using independent regional field references; one image is not enough.');
    checklist.push('Do not eat or consume a plant, mushroom or berry based on this tool or source excerpts.');
  }
  if(concerns.includes('pipe')){
    checklist.push('Check for electrical, gas, structural or contaminated-water hazards before inspecting damage.');
    checklist.push('Verify isolation and repair steps using the relevant manual or a qualified professional.');
  }
  checklist.push('Missing or conflicting information stays unknown.');
  return Object.freeze(checklist);
}
export function buildFieldPacket(input={},referenceRows=[]){
  const priority=planAssessment(input);
  const notes=Array.isArray(input?.observations)?input.observations:[];
  const userReported=[...new Set(notes.map(value=>clean(value,350)).filter(Boolean))].slice(0,20);
  const accepted=['title','excerpt','url','school','license','revision','source','tier','availability','verifiedIdentification'];
  const references=normalizeReferenceCards(referenceRows).map(card=>Object.fromEntries(accepted.map(key=>[key,card[key]])));
  const unknowns=['unverified-surroundings','live-environmental-conditions'];
  if(priority.photoStatus==='not-analyzed')unknowns.push('visual-identification-not-performed');
  if(priority.reportedConcerns.includes('plant'))unknowns.push('edibility-and-lookalikes-unverified');
  return Object.freeze({
    schema:FIELD_PACKET_SCHEMA,
    mode:'survival',
    authority:'deterministic',
    priority,
    observations:{userReported,aiInferred:[],confirmedFromImage:[]},
    photo:{status:priority.photoStatus,bytesIncluded:false,analyzed:false},
    references,
    unknowns,
    verification:{status:'requires-human-check',prompts:verificationChecklist(input)},
    privacy:{exportRequiresAction:true,persistedToDevice:false,publishedToGuild:false,includesLocation:false},
    handoff:{target:'shared-guide-capability',automatic:false,runtimeWorkflowEnabled:false},
    generatedClaims:{identity:null,edibility:null,diagnosis:null,clearance:null}
  });
}
