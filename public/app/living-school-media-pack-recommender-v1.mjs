import media from'./open-learning-media-cache-v1.mjs?v=open-media-cache-v1';

const REVISION='living-school-media-pack-recommender-v1.1-expanded';
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
  'garden-nature':['gardening','garden','plant care','plants','soil','vegetable garden','growing food','horticulture'],
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
function fallbackPackRows(){return Object.keys(PACK_RULES).map(slug=>({slug,name:prettySlug(slug),description:'Suggested subject media pack.',topics:[],available:false,kind:'extension'}))}

export async function recommendMediaPacks(query,{limit=3}={}){
  let lookup=null;try{lookup=await media.loadLookup()}catch{}
  const rows=Array.isArray(lookup?.packs)&&lookup.packs.length?[...lookup.packs]:fallbackPackRows();
  const known=new Map(rows.map(pack=>[pack.slug,pack]));
  for(const slug of Object.keys(PACK_RULES))if(!known.has(slug))rows.push({slug,name:prettySlug(slug),description:'This pack is queued for the next Open Learning Media catalog refresh.',topics:[],available:false,kind:'extension',catalogPending:true});
  return rows.map(pack=>({...pack,score:packScore(pack,query,lookup)})).filter(pack=>pack.score>0).sort((a,b)=>b.score-a.score||Number(b.coverage||0)-Number(a.coverage||0)).slice(0,Math.max(1,limit));
}

export async function downloadMediaPack(packSlug,{limitPerTopic=1,pinned=false}={}){
  const lookup=await media.loadLookup();
  const pack=(lookup?.packs||[]).find(item=>item?.slug===packSlug);
  if(!pack||pack.available===false||!Array.isArray(pack.topics)||!pack.topics.length)throw new Error('This media pack is not seeded in the current catalog yet.');
  const results={};for(const topicSlug of pack.topics)results[topicSlug]=await media.prefetchTopic(topicSlug,{limit:limitPerTopic,pinned});
  return results;
}

function button(label,action,primary=false){const node=document.createElement('button');node.type='button';node.textContent=label;node.style.cssText=`border:1px solid currentColor;border-radius:999px;padding:9px 13px;background:${primary?'rgba(255,255,255,.12)':'transparent'};color:inherit;font:inherit;font-weight:700;`;node.addEventListener('click',action);return node}
function packLabel(pack){return`${pack.name}${pack.available===false?' · catalog refresh needed':''}`}
function packCopy(pack){const node=document.createElement('div');const title=document.createElement('b');title.textContent=packLabel(pack);const br=document.createElement('br');const detail=document.createElement('small');detail.textContent=clean(pack.description||'',500);node.append(title,br,detail);return node}

export async function offerMediaPacksBeforeCurriculum(query,{limit=3}={}){
  const recommendations=await recommendMediaPacks(query,{limit});
  try{dispatchEvent(new CustomEvent('civweave:living-school-media-pack-recommendations',{detail:{revision:REVISION,query:clean(query,2000),recommendations}}))}catch{}
  if(typeof document==='undefined'||!recommendations.length)return{recommendations,shown:false};
  const existing=document.querySelector('[data-living-school-media-pack-offer]');if(existing)existing.remove();
  const dialog=document.createElement('dialog');dialog.dataset.livingSchoolMediaPackOffer=REVISION;dialog.style.cssText='max-width:min(92vw,620px);border:1px solid currentColor;border-radius:20px;padding:0;background:#102f25;color:#f3f2df;box-shadow:0 24px 80px rgba(0,0,0,.45);';
  const body=document.createElement('div');body.style.cssText='display:grid;gap:14px;padding:20px;';
  const title=document.createElement('strong');title.textContent='Recommended video packs';title.style.cssText='font-size:1.15rem;';body.append(title);
  const copyNode=document.createElement('p');copyNode.textContent='Before Moss builds this curriculum, you can seed the local video shelf with packs that match the subject. This is optional; if no relevant video survives the relevance gate, Civweave will use the required fallback instead.';copyNode.style.cssText='margin:0;line-height:1.45;';body.append(copyNode);
  const list=document.createElement('div');list.style.cssText='display:grid;gap:9px;';body.append(list);
  let resolver=null;const done=new Promise(resolve=>{resolver=resolve});
  for(const pack of recommendations){
    const row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.2);border-radius:14px;';
    row.append(packCopy(pack));
    const action=button(pack.available===false?'Not seeded':'Download',async()=>{if(pack.available===false)return;action.disabled=true;action.textContent='Downloading…';try{await downloadMediaPack(pack.slug,{limitPerTopic:1});action.textContent='Downloaded'}catch(error){action.textContent='Unavailable';action.title=error.message}},true);if(pack.available===false)action.disabled=true;row.append(action);list.append(row);
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
