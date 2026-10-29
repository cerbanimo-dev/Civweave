/**
 * Starling Collective tool interface contract. This is a shared capability
 * registry, not an agent-managed command executor or a second source of
 * Guild/Quest/task authority.
 *
 * "planned" and "migration-pending" are *not* installed. A trusted runtime
 * must explicitly attest installation of adapters before using them.
 */
export const COLLECTIVE_TOOL_SCHEMA='civweave.starling-tool-registry.v1';
const raw=[
 ['aider','Aider','external-adapter','migration-pending','workspace-write',['coding','code-editing'],'Local coding sandbox; port Starling Studio approved-job adapter, preserve preview and diff gates'],
 ['photocraft','PhotoCraft','external-adapter','planned','asset-write',['image-editing','raster-graphics'],'Layered photo editing, masks and PSD workflow'],
 ['vectorcraft','VectorCraft','external-adapter','planned','asset-write',['vector-graphics','svg-editing'],'SVG and vector illustration'],
 ['filmcraft','FilmCraft','external-adapter','planned','asset-write',['video-editing','timed-media'],'Timed images, text and audio; slideshow/video sequencing'],
 ['lightcraft','LightCraft','external-adapter','planned','asset-write',['photo-library','raw-development'],'Photo library and raw development'],
 ['pdfcraft','PdfCraft','external-adapter','planned','asset-write',['pdf-editing'],'PDF reading, annotation and generation'],
 ['cadcraft','CADCraft','native-or-external','planned','workspace-write',['cad-modeling','technical-drawing'],'CAD design and parametric components'],
 ['documents','Documents','native-or-external','planned','asset-write',['document-editing','office-work'],'Open document handling for ordinary business workflows'],
 ['spreadsheets','Spreadsheets','native-or-external','planned','asset-write',['spreadsheet-editing','office-work'],'Calculation and spreadsheet generation'],
 ['presentations','Presentations','native-or-external','planned','asset-write',['presentation-editing','office-work'],'Slide creation and editing']
];
export const COLLECTIVE_TOOL_CATALOG=Object.freeze(raw.map(([id,name,kind,status,risk,capabilities,description])=>Object.freeze({id,name,kind,status,risk,description,capabilities:Object.freeze([...capabilities])})));
const BY_ID=new Map(COLLECTIVE_TOOL_CATALOG.map(x=>[x.id,x]));
const text=value=>typeof value==='string'?value.trim():'';
export function resolveCollectiveTool(id){return BY_ID.get(text(id).toLowerCase())||null;}
export function toolCapabilities(requestedTools=[],{installedTools=[]}={}){
  const installed=new Set(Array.isArray(installedTools)?installedTools:[]);
  const requested=new Set(Array.isArray(requestedTools)?requestedTools:[]);
  return Object.freeze([...new Set(COLLECTIVE_TOOL_CATALOG.filter(t=>installed.has(t.id)&&requested.has(t.id)).flatMap(t=>t.capabilities))]);
}
/** Returns a planning decision only; NO command executes through this function.
 * Authorization MUST come from the trusted existing Civweave permission owner.
 * Request JSON and model-visible tool arguments are never authorization.
 */
export function planCollectiveToolUse({toolId,taskId,guildId,actorId,enabledTools=[],authorization,verifyAuthorization}={}){
  const tool=resolveCollectiveTool(toolId);
  if(!tool)return Object.freeze({allowed:false,reason:'unknown-tool'});
  if(!Array.isArray(enabledTools)||!enabledTools.includes(tool.id))return Object.freeze({allowed:false,reason:'tool-not-installed',toolId:tool.id});
  const context=[taskId,guildId,actorId].map(text);
  if(context.some(v=>!v))return Object.freeze({allowed:false,reason:'missing-trusted-context',toolId:tool.id});
  const [task,guild,actor]=context;
  const scoped=authorization?.scope==='task'
    && authorization?.approved===true
    && authorization.guildId===guild
    && authorization.taskId===task
    && authorization.actorId===actor
    && authorization.toolId===tool.id;
  if(!scoped || typeof verifyAuthorization!=='function'||verifyAuthorization(authorization)!==true)
    return Object.freeze({allowed:false,reason:'unverified-task-authorization',toolId:tool.id});
  return Object.freeze({allowed:true,reason:'authorized-for-trusted-adapter-dispatch',toolId:tool.id,risk:tool.risk,capabilities:tool.capabilities});
}
