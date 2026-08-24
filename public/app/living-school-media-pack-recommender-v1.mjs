import media from'./open-learning-media-cache-v1.mjs?v=open-media-cache-v1';
import sourcePacks from'./learning-source-pack-runtime-v1.mjs?v=unified-source-packs-v1';

const REVISION='living-school-media-pack-recommender-v1.5-download-state-dedupe';
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const STOP=new Set(['about','after','again','also','basic','basics','beginner','build','building','capability','complete','course','create','creating','curriculum','foundation','foundations','guide','guided','intro','introduction','learn','learning','lesson','module','practice','practical','skill','skills','study','teach','teaching','through','using','vocabulary','with','your']);
const PACK_RULES=Object.freeze({
  'general-knowledge':['general knowledge','history','geography','science','mathematics','civics','health','philosophy'],
  'digital-ai-literacy':['ai','artificial intelligence','prompt','prompting','coding','programming','algorithm','computer','digital','llm','software'],
  'practical-life':['money','budget','finance','cooking','food safety','health','wellness','statistics','everyday life'],
  'maker-creative':['art','drawing','design','photography','video','creative','visual'],
  'civic-media-literacy':['civics','government','rights','law','media literacy','fact checking','evidence','climate'],
  'deep-science':['biology','physics','chemistry','astronomy','climate','science'],
  'humanities-culture':['history','culture','philosophy','ethics','geography','society','art'],
  'tarot-symbolic-practice':['tarot','tarot cards','major arcana','minor arcana','arcana','card reading','divination','cartomancy','symbolism','rider waite','rider-waite','marseille tarot'],
  'mind-body-practice':['mindfulness','meditation','breathing','attention','contemplative','self reflection','wellness'],
  'relationships-care':['parenting','gentle parenting','caregiving','child development','communication','conflict','active listening','relationships','family care'],
  'garden-nature':['urban agriculture','agriculture','community garden','gardening','garden','farming','farm','crop','crops','food growing','plant care','plants','soil','vegetable garden','growing food','horticulture','irrigation'],
  'career-enterprise':['career','workplace','resume','interview','business','entrepreneurship','small business','self employment','finance','communication'],
  'music-performance':['music','music theory','performance','rhythm','melody','instrument','singing'],
  'language-communication':['language learning','second language','vocabulary','grammar','listening','speaking','communication'],
  'systems-decision-making':['systems thinking','logic','decision','reasoning','statistics','probability','critical thinking'],
  'home-independence':['home maintenance','home repair','budgeting','cooking','food safety','wellness','emergency preparedness','independent living'],
  'hands-on-maker':['electronics','circuits','woodworking','sewing','textiles','repair','maker','fabrication'],
  'environment-resilience':['climate','environment','emergency preparedness','disaster','resilience','geography','health'],
  'visual-storytelling':['drawing','design','photography','video','cinematography','visual art','storytelling'],
  'society-rights':['civics','rights','law','government','society','history','democracy'],
  'technology-builder':['computer','coding','programming','electronics','algorithm','software','ai','digital']
});
const PACK_TOPICS=Object.freeze({
  'tarot-symbolic-practice':['tarot-symbolism','mythology-folklore','philosophy-ethics','arts-culture'],
  'mind-body-practice':['meditation-mindfulness','health-wellness','philosophy-ethics'],
  'relationships-care':['communication-conflict','parenting-caregiving','health-wellness','critical-thinking'],
  'garden-nature':['gardening-plants','biology-life','climate-environment'],
  'career-enterprise':['career-work-skills','entrepreneurship-small-business','personal-finance','communication-conflict'],
  'music-performance':['music-performance','arts-culture'],
  'language-communication':['language-learning','communication-conflict'],
  'systems-decision-making':['logical-frameworks','critical-thinking','statistics-data-literacy','mathematics-foundations'],
  'home-independence':['home-maintenance','cooking-food-safety','personal-finance','health-wellness','emergency-preparedness'],
  'hands-on-maker':['electronics-basics','woodworking-basics','sewing-textiles','drawing-design'],
  'environment-resilience':['climate-environment','earth-geography','emergency-preparedness','health-wellness'],
  'visual-storytelling':['drawing-design','photography-video','arts-culture'],
  'society-rights':['civics-society','law-rights-basics','world-history','critical-thinking'],
  'technology-builder':['computing-basics','vibe-coding','pseudocoding','electronics-basics','prompt-engineering']
});
const TOPIC_SCHOOL_FALLBACK=Object.freeze({
  'tarot-symbolism':'philosophy-and-religion','mythology-folklore':'history','meditation-mindfulness':'philosophy-and-religion','communication-conflict':'society-and-social-sciences','parenting-caregiving':'people','gardening-plants':'everyday-life','career-work-skills':'everyday-life','entrepreneurship-small-business':'everyday-life','music-performance':'arts','language-learning':'people','home-maintenance':'everyday-life','emergency-preparedness':'everyday-life','electronics-basics':'technology','woodworking-basics':'everyday-life','sewing-textiles':'arts','drawing-design':'arts','photography-video':'arts','statistics-data-literacy':'mathematics','climate-environment':'science','law-rights-basics':'society-and-social-sciences','personal-finance':'everyday-life','cooking-food-safety':'everyday-life','critical-thinking':'philosophy-and-religion','logical-frameworks':'philosophy-and-religion','vibe-coding':'technology','prompt-engineering':'technology','pseudocoding':'technology','computing-basics':'technology','world-history':'history','earth-geography':'geography','civics-society':'society-and-social-sciences','biology-life':'science','physics-foundations':'science','chemistry-foundations':'science','astronomy-space':'science','mathematics-foundations':'mathematics','arts-culture':'arts','health-wellness':'health-medicine-and-disease','philosophy-ethics':'philosophy-and-religion'
});

function words(value){return clean(value,18000).toLowerCase().split(/[^a-z0-9]+/).filter(word=>word.length>3&&!STOP.has(word))}
function phraseScore(hay,phrase){const value=clean(phrase,180).toLowerCase();if(!value)return 0;if(hay.includes(value))return value.includes(' ')?12:7;return 0}
function packScore(pack,query,lookup){
  const hay=clean(query,8000).toLowerCase();
  const queryWords=new Set(words(query));
  let score=0;
  for(const hint of PACK_RULES[pack.slug]||[])score+=phraseScore(hay,hint);
  const packText=`${pack.name||''} ${pack.description||''}`.toLowerCase();
  for(const word of queryWords)if(packText.includes(word))score+=3;
  for(const slug of pack.topics||[]){
    const meta=lookup?.topic_meta?.[slug]||{};
    const topicText=[meta.name,...(meta.hints||[]),...(meta.aliases||[]),...(meta.concepts||[])].filter(Boolean).join(' ').toLowerCase();
    for(const word of queryWords)if(topicText.includes(word))score+=4;
    for(const hint of meta.hints||[])score+=phraseScore(hay,hint);
  }
  return score;
}
function prettySlug(slug){return slug.split('-').map(value=>value[0]?.toUpperCase()+value.slice(1)).join(' ')}
function pendingPack(slug,lookup){
  const topics=PACK_TOPICS[slug]||[];
  const seeded=topics.filter(topic=>Array.isArray(lookup?.topics?.[topic])&&lookup.topics[topic].length);
  return{slug,name:prettySlug(slug),description:'Expanded subject learning pack. Foundation articles and video-link atlases can be staged now; rights-cleared local video files fill in as the media catalog harvests them.',topics,available:seeded.length>0,coverage:topics.length?seeded.length/topics.length:0,kind:'extension',catalogPending:true,seededTopics:seeded.length};
}
function fallbackPackRows(lookup){return Object.keys(PACK_RULES).map(slug=>pendingPack(slug,lookup))}
function sourceSchoolSlugs(pack,lookup){return[...new Set((pack.topics||[]).map(topic=>lookup?.topic_meta?.[topic]?.school_slug||TOPIC_SCHOOL_FALLBACK[topic]).filter(Boolean))]}

async function annotateDownloadState(recommendations){
  let status=[];
  try{status=await sourcePacks.learningSourcePackStatus()}catch(error){console.warn('[Living School pack status]',error);return recommendations.map(pack=>({...pack,alreadyDownloaded:false,partiallyDownloaded:false}))}
  const bySlug=new Map((Array.isArray(status)?status:[]).map(row=>[row.school_slug,row]));
  return recommendations.map(pack=>{
    const slugs=Array.isArray(pack.sourceSchoolSlugs)?pack.sourceSchoolSlugs:[];
    const states=slugs.map(slug=>bySlug.get(slug)).filter(Boolean);
    const alreadyDownloaded=Boolean(slugs.length&&states.length===slugs.length&&states.every(row=>row.current===true));
    const partiallyDownloaded=Boolean(!alreadyDownloaded&&states.some(row=>row.staged===true||row.articleCurrent===true||row.videoCurrent===true||Number(row.supplementalCached||0)>0));
    return{...pack,alreadyDownloaded,partiallyDownloaded};
  });
}

export async function recommendMediaPacks(query,{limit=3}={}){
  let lookup=null;try{lookup=await media.loadLookup()}catch{}
  const rows=Array.isArray(lookup?.packs)&&lookup.packs.length?[...lookup.packs]:fallbackPackRows(lookup);
  const known=new Set(rows.map(pack=>pack.slug));
  for(const slug of Object.keys(PACK_RULES))if(!known.has(slug))rows.push(pendingPack(slug,lookup));
  return rows.map(pack=>({...pack,sourceSchoolSlugs:sourceSchoolSlugs(pack,lookup),score:packScore(pack,query,lookup)})).filter(pack=>pack.score>0).sort((a,b)=>b.score-a.score||Number(b.coverage||0)-Number(a.coverage||0)).slice(0,Math.max(1,limit));
}

export async function downloadMediaPack(packSlug,{limitPerTopic=1,pinned=false,onProgress}={}){
  const lookup=await media.loadLookup();
  const published=(lookup?.packs||[]).find(item=>item?.slug===packSlug);
  const pack=published||pendingPack(packSlug,lookup);
  if(!Array.isArray(pack.topics)||!pack.topics.length)throw new Error('Unknown learning pack.');
  const schoolSlugs=sourceSchoolSlugs(pack,lookup);
  if(!schoolSlugs.length)throw new Error('This learning pack has no article/video-link school mapping yet.');
  const sourceResult=await sourcePacks.stageLearningSourcePacks(schoolSlugs,{topicSlugs:pack.topics,onProgress});
  const results={},mediaErrors=[];
  for(const topicSlug of pack.topics){try{results[topicSlug]=await media.prefetchTopic(topicSlug,{limit:limitPerTopic,pinned})}catch(error){results[topicSlug]=[];mediaErrors.push({topicSlug,error:error?.message||String(error)})}}
  const flat=Object.values(results).flat(),cached=flat.filter(item=>item?.ok).length;
  if(!sourceResult?.current&&!cached)throw new Error('No article/video-link source pack or downloadable video could be staged for this subject.');
  return{pack:{...pack,sourceSchoolSlugs:schoolSlugs},sourceResult,results,cached,pending:Boolean(pack.catalogPending),mediaErrors};
}

function button(label,action,primary=false){const node=document.createElement('button');node.type='button';node.textContent=label;node.style.cssText=`border:1px solid currentColor;border-radius:999px;padding:9px 13px;background:${primary?'rgba(255,255,255,.12)':'transparent'};color:inherit;font:inherit;font-weight:700;`;node.addEventListener('click',action);return node}
function packLabel(pack){const schools=pack.sourceSchoolSlugs?.length||0;if(pack.catalogPending&&!pack.available)return`${pack.name} · source pack ready`;if(pack.catalogPending)return`${pack.name} · source pack + partial local video`;return`${pack.name}${schools?` · ${schools} source school${schools===1?'':'s'}`:''}`}
function packCopy(pack){const node=document.createElement('div');const title=document.createElement('b');title.textContent=packLabel(pack);const br=document.createElement('br');const detail=document.createElement('small');detail.textContent=`${clean(pack.description||'',420)} ${pack.sourceSchoolSlugs?.length?'Articles and matched video links download together.':''}`.trim();node.append(title,br,detail);return node}
function progressLabel(progress){if(progress?.lane==='articles')return progress.phase==='verifying'?'Verifying articles…':'Downloading articles…';if(progress?.lane==='video-links')return progress.phase==='verifying'?'Verifying video links…':progress.phase==='sidecar'?'Updating video metadata…':'Downloading video links…';if(progress?.lane==='supplemental-articles')return`Adding ${clean(progress.record?.title,42)||'gap article'}…`;return'Downloading pack…'}

export async function offerMediaPacksBeforeCurriculum(query,{limit=3}={}){
  const recommendations=await annotateDownloadState(await recommendMediaPacks(query,{limit}));
  const pendingRecommendations=recommendations.filter(pack=>!pack.alreadyDownloaded);
  try{dispatchEvent(new CustomEvent('civweave:living-school-media-pack-recommendations',{detail:{revision:REVISION,query:clean(query,2000),recommendations}}))}catch{}
  if(typeof document==='undefined'||!pendingRecommendations.length)return{recommendations,shown:false,skippedAlreadyDownloaded:recommendations.filter(pack=>pack.alreadyDownloaded).map(pack=>pack.slug)};
  const existing=document.querySelector('[data-living-school-media-pack-offer]');if(existing)existing.remove();
  const dialog=document.createElement('dialog');dialog.dataset.livingSchoolMediaPackOffer=REVISION;dialog.style.cssText='max-width:min(92vw,620px);border:1px solid currentColor;border-radius:20px;padding:0;background:#102f25;color:#f3f2df;box-shadow:0 24px 80px rgba(0,0,0,.45);';
  const body=document.createElement('div');body.style.cssText='display:grid;gap:14px;padding:20px;';
  const title=document.createElement('strong');title.textContent='Recommended learning packs';title.style.cssText='font-size:1.15rem;';body.append(title);
  const copyNode=document.createElement('p');copyNode.textContent='Before Moss builds this curriculum, you can seed the matching local source packs. Packs already saved and current on this device are skipped automatically. Remaining packs save verified foundation articles and their Video Learning Atlas together, then add targeted gap articles and rights-cleared local video files when available. This is optional and resumable.';copyNode.style.cssText='margin:0;line-height:1.45;';body.append(copyNode);
  const list=document.createElement('div');list.style.cssText='display:grid;gap:9px;';body.append(list);
  let resolver=null;const done=new Promise(resolve=>{resolver=resolve});
  for(const pack of pendingRecommendations){
    const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.2);border-radius:14px;';
    row.append(packCopy(pack));
    const canStage=Boolean(pack.sourceSchoolSlugs?.length);
    const action=button(canStage?(pack.partiallyDownloaded?'Finish pack':'Download pack'):'Mapping pending',async()=>{if(!canStage)return;action.disabled=true;action.textContent='Starting…';try{const result=await downloadMediaPack(pack.slug,{limitPerTopic:1,onProgress:progress=>{action.textContent=progressLabel(progress)}});const source=result.sourceResult;action.textContent=`Saved ${source.videoLinks||0} links + ${source.supplementalCached||0} gaps${result.cached?` + ${result.cached} video${result.cached===1?'':'s'}`:''}`;action.title=result.mediaErrors?.length?'Some optional direct video files were unavailable; articles and video links are still saved.':''}catch(error){action.textContent='Unavailable';action.title=error.message}},true);if(!canStage)action.disabled=true;row.append(action);list.append(row);
  }
  const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;';
  const continueButton=button('Continue to curriculum',()=>{dialog.close();resolver?.({recommendations,shown:true});},true);actions.append(continueButton);body.append(actions);dialog.append(body);document.body.append(dialog);
  dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();resolver?.({recommendations,shown:true})},{once:true});dialog.addEventListener('close',()=>setTimeout(()=>dialog.remove(),0),{once:true});
  try{dialog.showModal()}catch{return{recommendations,shown:false}}
  return done;
}

const api=Object.freeze({revision:REVISION,recommendMediaPacks,downloadMediaPack,offerMediaPacksBeforeCurriculum});
globalThis.CivweaveLivingSchoolMediaPackRecommenderV1=api;
export default api;
