/** Local draft persistence for the canonical Worldweaver manifest owner.
 * This adapter grants no authenticated, model, Guild, or runtime authority.
 */
import {createWorldweaver, WORLDWEAVER_SCHEMA, NPC_TOOLS} from './worldweaver-core-v1.mjs';

export const WORKSPACE_STORAGE_KEY='civweave.worldweaver.workspace.v1';
export const WORKSPACE_SCHEMA='civweave.worldweaver.workspace.v1';
export const SPACE_TEMPLATES=Object.freeze([
  {guide:'moss',kind:'learning-workshop',label:'Learning workshop',system:'living-school',feature:'path',refType:'learning-path',stationTypes:['explanation','practice','assessment','demonstration'],description:'Turn a Learning Journey into places to explain, practice, and reflect.',color:'#95c57c'},
  {guide:'kamiya',kind:'task-training',label:'Training ground',system:'cerbanimo',feature:'quest',refType:'quest-task',stationTypes:['explanation','practice','assessment','demonstration'],description:'Rehearse an Endeavor with demonstrations and hands-on practice.',color:'#b99aed'},
  {guide:'rook',kind:'creator-shop',label:'Creator shop',system:'fellowfare',feature:'market',refType:'fellowfare-listing',stationTypes:['display','demonstration'],description:'Give existing listings a place for displays and demonstrations.',color:'#efc37a'},
  {guide:'merlin',kind:'convention',label:'Convention hall',system:'anarchadia',feature:'governance',refType:'governance-ballot',stationTypes:['debate','ballot','display'],description:'Gather ideas, share attributed arguments, and connect to governance.',color:'#ed94ba'},
].map(template=>Object.freeze({...template,stationTypes:Object.freeze(template.stationTypes)})));

const TEMPLATES=new Map(SPACE_TEMPLATES.map(template=>[template.guide,template]));
const LOCAL_ACTOR=Object.freeze({kind:'human',principalId:'local-draft-human'});
const PILOT='local-draft-pilot';
const ALLOWED=new Set(['create','add-station','link','rig-npc','debate-turn']);
const ID=/^[A-Za-z0-9][A-Za-z0-9:_./-]{0,179}$/;
const LIMITS=Object.freeze({instances:24,stations:48,links:16,npcs:8,debateTurns:32});
const MAX_BYTES=2_000_000;
const copy=value=>JSON.parse(JSON.stringify(value));
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const text=(value,max,required=true)=>typeof value==='string'&&value.length<=max&&(!required||value.trim().length>0);
const identifier=value=>typeof value==='string'&&ID.test(value);
const time=value=>text(value,64)&&Number.isFinite(Date.parse(value));
const invalid=detail=>{throw new Error(`Invalid local Worldweaver draft data (${detail}). Existing data has been preserved.`)};
const exact=(value,keys,label)=>{
  if(!plain(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))invalid(label);
};

function validateSnapshot(snapshot){
  exact(snapshot,['schema','revision','instances','stations','links','npcs','intents','debateTurns','journal'],'manifest fields');
  if(snapshot.schema!==WORLDWEAVER_SCHEMA||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<0)invalid('schema or revision');
  for(const key of ['instances','stations','links','npcs','intents','debateTurns','journal'])if(!Array.isArray(snapshot[key]))invalid(key);
  if(snapshot.instances.length>LIMITS.instances||snapshot.intents.length||snapshot.journal.length>1000)invalid('record limits or runtime intents');
  const identifiers=new Set(),spaces=new Map();
  const unique=row=>{if(!identifier(row.id)||identifiers.has(row.id))invalid('duplicate or invalid identifier');identifiers.add(row.id)};
  for(const row of snapshot.instances){
    exact(row,['id','guide','kind','title','description','scope','guildId','status','createdBy','createdAt','world'],'space fields');unique(row);
    const template=TEMPLATES.get(row.guide);
    if(!template||row.kind!==template.kind||!text(row.title,120)||!text(row.description,1800,false)||row.scope!=='standalone'||row.guildId!==null||row.status!=='draft'||row.world!==null||row.createdBy!==LOCAL_ACTOR.principalId||!time(row.createdAt))invalid('local draft space');
    spaces.set(row.id,{row,template});
  }
  const parent=row=>{const space=spaces.get(row.instanceId);if(!space)invalid('detached record');return space};
  for(const key of ['stations','links','npcs','debateTurns']){
    if(snapshot[key].length>LIMITS.instances*LIMITS[key])invalid(`${key} limit`);
    const counts=new Map();
    for(const row of snapshot[key]){
      if(!plain(row))invalid(key);
      unique(row);parent(row);
      const count=(counts.get(row.instanceId)||0)+1;counts.set(row.instanceId,count);
      if(count>LIMITS[key])invalid(`${key} per-space limit`);
    }
  }
  for(const row of snapshot.stations){
    exact(row,['id','instanceId','stationType','title','instructions','creator'],'station fields');
    if(!parent(row).template.stationTypes.includes(row.stationType)||!text(row.title,120)||!text(row.instructions,3000)||row.creator!==LOCAL_ACTOR.principalId)invalid('station');
  }
  const links=new Set();
  for(const row of snapshot.links){
    exact(row,['id','instanceId','refType','refId','authoritative','linkedBy'],'reference fields');
    const key=`${row.instanceId}:${row.refType}:${row.refId}`;
    if(row.refType!==parent(row).template.refType||!identifier(row.refId)||row.authoritative!==false||row.linkedBy!==LOCAL_ACTOR.principalId||links.has(key))invalid('reference');
    links.add(key);
  }
  for(const row of snapshot.npcs){
    exact(row,['id','instanceId','modelId','pilotPrincipalId','name','pilotPrompt','appearanceRef','capabilities','status','createdBy','createdAt'],'NPC fields');
    if(!identifier(row.modelId)||row.pilotPrincipalId!==PILOT||!text(row.name,100)||!text(row.pilotPrompt,5000)||(row.appearanceRef!==null&&!identifier(row.appearanceRef))||!Array.isArray(row.capabilities)||!row.capabilities.length||row.capabilities.length>NPC_TOOLS.length||new Set(row.capabilities).size!==row.capabilities.length||row.capabilities.some(tool=>!NPC_TOOLS.includes(tool))||row.status!=='ready'||row.createdBy!==LOCAL_ACTOR.principalId||!time(row.createdAt))invalid('NPC draft configuration');
  }
  for(const row of snapshot.debateTurns){
    exact(row,['id','instanceId','topic','statement','speakerId','speakerKind','createdAt'],'debate fields');
    if(parent(row).row.kind!=='convention'||!text(row.topic,160)||!text(row.statement,2400)||row.speakerId!==LOCAL_ACTOR.principalId||row.speakerKind!=='human'||!time(row.createdAt))invalid('debate note');
  }
  let prior=0;
  for(const row of snapshot.journal){
    exact(row,['revision','time','command','principalId','instanceId'],'journal fields');
    if(!Number.isSafeInteger(row.revision)||row.revision<=prior||row.revision>snapshot.revision||!time(row.time)||!ALLOWED.has(row.command)||row.principalId!==LOCAL_ACTOR.principalId||!spaces.has(row.instanceId))invalid('journal');
    prior=row.revision;
  }
  if(prior!==snapshot.revision||(!snapshot.revision&&snapshot.instances.length))invalid('journal revision');
  return snapshot;
}

function availableStorage(){try{return globalThis.localStorage||null}catch{return null}}

/** Opening is read-only. Only explicit dispatch calls may write device drafts. */
export function createWorkspace({storage=availableStorage(),id,clock}={}){
  let manifest,raw;
  const authorize=({actor,command})=>actor===LOCAL_ACTOR&&ALLOWED.has(command.type);
  const core=initialState=>createWorldweaver({authorize,id,clock,initialState});
  const read=()=>{
    if(!storage||typeof storage.getItem!=='function')return null;
    try{return storage.getItem(WORKSPACE_STORAGE_KEY)}catch{throw new Error('Local draft storage could not be read. Existing data has been preserved.')}
  };
  const parse=serialized=>{
    if(serialized===null)return core().snapshot();
    if(typeof serialized!=='string'||serialized.length>MAX_BYTES)invalid('storage size');
    let envelope;try{envelope=JSON.parse(serialized)}catch{invalid('corrupt JSON')}
    exact(envelope,['schema','snapshot'],'workspace envelope');
    if(envelope.schema!==WORKSPACE_SCHEMA)invalid('workspace schema');
    return validateSnapshot(envelope.snapshot);
  };
  function reload(){
    const nextRaw=read(),next=parse(nextRaw);
    manifest=next;raw=nextRaw;
    return copy(manifest);
  }
  function unchanged(){if(read()!==raw)throw new Error('Worldweaver drafts changed in another tab. Reload drafts before saving again.')}
  function dispatch(input){
    if(!plain(input)||!ALLOWED.has(input.type))throw new Error('This workspace only saves local drafts. World provisioning, Guild actions, and model execution require their authenticated owners.');
    const command={...input};
    if(command.type==='create'){
      if(!TEMPLATES.has(command.guide))throw new TypeError('Choose one of the four space templates.');
      if(command.scope!==undefined&&command.scope!=='standalone'||command.guildId!==undefined)throw new Error('Only standalone local drafts can be created here. Guild Map linking requires its authenticated owner.');
    }else if(!identifier(command.instanceId)||!manifest.instances.some(row=>row.id===command.instanceId))throw new RangeError('Select an existing local draft space.');
    if(command.type==='rig-npc'){
      if(command.pilotPrincipalId!==undefined&&command.pilotPrincipalId!==PILOT)throw new Error('NPCs here use a local draft pilot placeholder. Authenticated pilot binding belongs to the runtime adapter.');
      command.pilotPrincipalId=PILOT;
    }
    if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw new Error('Local storage is unavailable. Your draft could not be saved.');
    unchanged();
    if(command.type==='create'&&manifest.instances.length>=LIMITS.instances)throw new Error('This device workspace has reached its limit of 24 spaces. Export a space before continuing elsewhere.');
    const collection={['add-station']:'stations',link:'links',['rig-npc']:'npcs',['debate-turn']:'debateTurns'}[command.type];
    if(collection&&manifest[collection].filter(row=>row.instanceId===command.instanceId).length>=LIMITS[collection])throw new Error(`This space has reached its ${collection} limit (${LIMITS[collection]}).`);
    const candidate=core(manifest),receipt=candidate.dispatch(command,LOCAL_ACTOR),next=validateSnapshot(candidate.snapshot());
    const serialized=JSON.stringify({schema:WORKSPACE_SCHEMA,snapshot:next});
    if(serialized.length>MAX_BYTES)throw new Error('Local draft storage limit reached. This change has not been saved.');
    // Re-check immediately before the synchronous write; never overwrite an observed newer tab revision.
    unchanged();
    try{storage.setItem(WORKSPACE_STORAGE_KEY,serialized)}catch(error){throw new Error(`Your draft could not be saved to local storage: ${error?.message||'storage unavailable'}`)}
    manifest=next;raw=serialized;
    return receipt;
  }
  function exportInstance(instanceId){
    if(!identifier(instanceId)||!manifest.instances.some(row=>row.id===instanceId))throw new RangeError('Select an existing space to export.');
    const exported={schema:WORLDWEAVER_SCHEMA,revision:manifest.revision};
    exported.instances=manifest.instances.filter(row=>row.id===instanceId);
    for(const key of ['stations','links','npcs','intents','debateTurns','journal'])exported[key]=manifest[key].filter(row=>row.instanceId===instanceId);
    return copy(exported);
  }
  reload();
  return Object.freeze({snapshot:()=>copy(manifest),dispatch,reload,exportInstance});
}
