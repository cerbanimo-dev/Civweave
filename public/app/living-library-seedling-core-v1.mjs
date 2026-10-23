const MAX_SOURCE_COUNT=40, MAX_MEDIA_COUNT=28;
export const VERSION='1.0.0-seedling-manual-authoring';
export const STORAGE_KEY='civweave.seedling.learning-journey-draft.v1';
export const OUTBOX_KEY='civweave.seedling.guild-outbox.v1';
const clean=(value,limit=2000)=>String(value??'').trim().slice(0,limit);
export function externalUrl(value){
  try {const url=new URL(clean(value,3000));if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error();return url.href}
  catch{return null}
}
export function youtubeId(value){try{const url=new URL(value);if(url.hostname==='youtu.be')return /^[\w-]{11}$/.test(url.pathname.slice(1))?url.pathname.slice(1):null;if(['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname)){const id=url.searchParams.get('v')||url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/)?.[1];return /^[\w-]{11}$/.test(id||'')?id:null}}catch{}return null}
export function videoEmbed(value){const url=externalUrl(value);if(!url)return null;const id=youtubeId(url);if(id)return 'https://www.youtube-nocookie.com/embed/'+id;try{const u=new URL(url);if(['vimeo.com','www.vimeo.com'].includes(u.hostname)&&/^\/\d{6,12}\/?$/.test(u.pathname))return 'https://player.vimeo.com/video/'+u.pathname.replace(/\//g,'')}catch{}return null}
export function normaliseSource(s={}){const url=externalUrl(s.url);if(!url)throw new Error('Source needs an HTTP(S) URL.');return {id:clean(s.id,120)||'source-'+crypto.randomUUID(),title:clean(s.title,300)||new URL(url).hostname,url,creator:clean(s.creator,250),publisher:clean(s.publisher,250),notes:clean(s.notes,1200),accessedAt:s.accessedAt||new Date().toISOString(),type:['article','book','research','reference','other'].includes(s.type)?s.type:'reference',verified:false}}
export function normaliseMedia(m={}){const url=externalUrl(m.url);if(!url)throw new Error('Media needs an HTTP(S) URL.');const kind=m.kind==='video'?'video':'image';return{id:clean(m.id,120)||'media-'+crypto.randomUUID(),kind,url,title:clean(m.title,250),credit:clean(m.credit,250),rights:clean(m.rights,250),moduleId:clean(m.moduleId,120),offlineAvailable:false}}
export function newDraft(){const timestamp=new Date().toISOString();return{id:'seedling-'+crypto.randomUUID(),title:'',capability:'',level:'beginner',mode:'guided',proof:'',guildId:'',modules:[{id:'module-'+crypto.randomUUID(),title:'',focus:'',outcome:''},{id:'module-'+crypto.randomUUID(),title:'',focus:'',outcome:''},{id:'module-'+crypto.randomUUID(),title:'',focus:'',outcome:''}],sources:[],media:[],createdAt:timestamp,updatedAt:timestamp}}
export function validateDraft(d){
 const errors=[];
 if(clean(d.title,240).length<3)errors.push('Give the Learning Journey a title.');
 if(clean(d.capability,2400).length<8)errors.push('Define a concrete capability or learning goal.');
 if(clean(d.proof,3000).length<8)errors.push('Define observable proof of capability.');
 if(!Array.isArray(d.modules)||d.modules.length<3||d.modules.length>8)errors.push('Living School needs 3–8 modules.');
 else d.modules.forEach((m,i)=>{if(!clean(m.title,220)||!clean(m.focus,900)||!clean(m.outcome,900))errors.push('Module '+(i+1)+' needs title, focus and demonstration.')});
 if(!Array.isArray(d.sources)||d.sources.length>MAX_SOURCE_COUNT)errors.push('Too many sources.');
 if(!Array.isArray(d.media)||d.media.length>MAX_MEDIA_COUNT)errors.push('Too many media references.');
 for(const source of d.sources||[])if(!externalUrl(source.url))errors.push('Invalid source URL.');
 for(const m of d.media||[])if(!externalUrl(m.url))errors.push('Invalid media URL.');
 return errors;
}
export function livingSchoolPlan(d){
 const errors=validateDraft(d);if(errors.length)throw new Error(errors.join(' '));
 const stamp=new Date().toISOString(),id=clean(d.id,140)||'seedling-'+crypto.randomUUID();
 const modules=d.modules.map((m,i)=>({id:'module-plan-'+(i+1),title:clean(m.title,220),focus:clean(m.focus,900),outcome:clean(m.outcome,900)}));
 const outline=modules.map(({title,focus,outcome})=>({title,focus,outcome}));
 return {
  schema:'civweave.learning-journey-plan.v2',
  id:'learning-plan-'+id,
  state:'review',createdAt:d.createdAt||stamp,updatedAt:stamp,approvedAt:null,requiresExplicitApproval:true,
  request:{title:clean(d.title,240),capability:clean(d.capability,2400),level:['beginner','intermediate','advanced'].includes(d.level)?d.level:'beginner',mode:['guided','just-in-time','browse'].includes(d.mode)?d.mode:'guided',proof:clean(d.proof,3000),count:modules.length,outline},
  modules,assumptions:[],authoring:{mode:'manual-source-curated',provider:'human',model:'none',revision:VERSION}
 };
}
export function guildBundle(d){
 const plan=livingSchoolPlan(d);
 return {
  schema:'civweave.seedling.guild-learning-submission.v1',
  id:'submission-'+clean(d.id,140),
  createdAt:new Date().toISOString(),
  title:plan.request.title,sourceSystem:'living-school',kind:'learning-journey-plan',status:'review-requested',
  guildId:clean(d.guildId,180)||null,
  plan,
  sourceCatalog:(d.sources||[]).map(s=>({id:clean(s.id,120),title:clean(s.title,300),url:externalUrl(s.url),creator:clean(s.creator,250),publisher:clean(s.publisher,250),type:clean(s.type,50),notes:clean(s.notes,1200),accessedAt:s.accessedAt||null,verification:'user-curated-unverified'})),
  mediaCatalog:(d.media||[]).map(m=>({id:clean(m.id,120),kind:m.kind==='video'?'video':'image',url:externalUrl(m.url),title:clean(m.title,250),credit:clean(m.credit,250),rights:clean(m.rights,250),moduleId:clean(m.moduleId,120),offlineAvailable:false})),
  userApprovalRequired:true,
  provenance:{schema:'civweave.content-provenance.v1',origin:'human-authored',aiGenerated:false,sourceSystem:'living-school',createdAt:new Date().toISOString()},
  importNote:'Living School must validate, explicitly approve, and materialize this review plan through its canonical engine. This bundle is not a completed curriculum.'
 }
}
export function downloadableJson(data){return JSON.stringify(data,null,2)+'\n'}
