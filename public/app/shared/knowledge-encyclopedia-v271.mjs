import {searchDownloadedKnowledge} from '../knowledge-school-runtime-v243.mjs?v=knowledge-encyclopedia-v271';

const VERSION='1.0.0-knowledge-encyclopedia-v271';
const SYSTEMS=new Set(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
const clean=(value,max=5000)=>String(value??'').trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' ').slice(0,max);

export const PERSONALITY_MATRICES=Object.freeze({
  civweave:Object.freeze({guide:'Weaveling',lens:'connective synthesis',voice:'clear, curious, uncertainty-literate',shape:['core idea','connections across domains','important boundary or uncertainty'],priority:'Show how the fact fits into a larger weave without changing the source facts.'}),
  'living-school':Object.freeze({guide:'Moss',lens:'teaching and understanding',voice:'patient, vivid, scaffolded',shape:['plain-language concept','why it works or matters','small example or mental model','one useful nuance'],priority:'Optimize for comprehension and durable learning, not performance theater.'}),
  cerbanimo:Object.freeze({guide:'Kamiya',lens:'mechanism and making',voice:'inventive, practical, precise',shape:['what it is','how the mechanism works','where it becomes useful','failure point or test'],priority:'Turn knowledge into usable understanding without converting a question into a quest unless the user asked for action.'}),
  fellowfare:Object.freeze({guide:'Rook',lens:'resources, value, and tradeoffs',voice:'wry, warm, grounded',shape:['what it is','what it affords or costs','tradeoffs and constraints','clean practical takeaway'],priority:'Surface value, scarcity, provenance, and tradeoffs when they are genuinely relevant.'}),
  anarchadia:Object.freeze({guide:'Merlin',lens:'systems, assumptions, and agency',voice:'playful, precise, grounded',shape:['core mechanism','assumptions or rules','edge cases or power effects','what remains a choice'],priority:'Make systems legible, distinguish rules from interpretation, and preserve agency.'})
});

const CURRENT_SIGNAL=/\b(today|tonight|right now|currently|latest|newest|breaking|recently|this week|this month|this year|as of|live|real[- ]time|up[- ]to[- ]date)\b/i;
const CURRENT_DOMAIN=/\b(weather|forecast|temperature|headlines?|news|stock price|share price|crypto price|exchange rate|sports? score|standings|polling|election results?|availability|in stock)\b/i;
const CURRENT_ROLE=/\bwho (?:is|are) (?:the )?(?:president|prime minister|governor|mayor|ceo|chief executive|speaker|secretary|chancellor|pope)\b/i;
const ASSISTANT_IDENTITY=/\b(?:who|what) are you\b|\bare you (?:real|alive|sentient|a person)\b/i;
const ACTION_REQUEST=/^\s*(?:can|could|would|will) you\s+(?:build|make|create|design|implement|fix|repair|change|edit|write|send|schedule|install|download|deploy|merge|commit|push|open|delete|remove|add)\b/i;
const KNOWLEDGE_SHAPE=/\?|^\s*(?:what|why|how|who|where|when|which|explain|define|describe|compare|summarize|tell me about|teach me about|give me an overview|help me understand)\b/i;

export function classifyKnowledgeQuestion(value){
  const text=clean(value,4000);
  if(!text)return{eligible:false,reason:'empty'};
  if(ASSISTANT_IDENTITY.test(text))return{eligible:false,reason:'assistant-identity'};
  if(ACTION_REQUEST.test(text))return{eligible:false,reason:'action-request'};
  if(CURRENT_SIGNAL.test(text)||CURRENT_DOMAIN.test(text)||CURRENT_ROLE.test(text))return{eligible:false,reason:'freshness-sensitive'};
  if(!KNOWLEDGE_SHAPE.test(text))return{eligible:false,reason:'not-knowledge-shaped'};
  return{eligible:true,reason:'stable-knowledge'};
}

function sourceRow(row,index){
  const notes=clean(row?.notes,1100);
  if(!notes)return null;
  return{
    id:`local-${index+1}`,
    title:clean(row?.articleTitle||row?.title,280)||`Local reference ${index+1}`,
    school:clean(row?.schoolName,180)||clean(row?.schoolSlug,120)||'Downloaded knowledge school',
    canonicalUrl:clean(row?.canonicalUrl||row?.url,1800),
    passage:notes,
    score:Number.isFinite(Number(row?.score))?Number(row.score):0,
    provenance:'downloaded knowledge school; archive-verified when installed; not live-checked'
  };
}

export async function buildKnowledgeContext(value,system='civweave',{search=searchDownloadedKnowledge,limit=5,maxSchools=12}={}){
  const query=clean(value,4000),classification=classifyKnowledgeQuestion(query),systemId=SYSTEMS.has(system)?system:'civweave',personality=PERSONALITY_MATRICES[systemId];
  if(!classification.eligible)return{mode:'inactive',eligible:false,searched:false,reason:classification.reason,personality};
  try{
    const rows=await search(query,{limit,maxSchools}),sources=(Array.isArray(rows)?rows:[]).map(sourceRow).filter(Boolean).slice(0,limit);
    return{
      mode:sources.length?'local-encyclopedia':'local-encyclopedia-empty',eligible:true,searched:true,reason:sources.length?'matches-found':'no-match',query,
      freshness:'downloaded archive, not current-event verification',personality,sources,
      instructions:sources.length
        ?'Use the local passages as the primary factual context. Synthesize rather than quote at length. Preserve uncertainty and provenance. Personality changes framing, never facts.'
        :'The installed local library was searched but produced no usable passage. Do not pretend that a local source was found.'
    };
  }catch(error){
    return{mode:'local-encyclopedia-unavailable',eligible:true,searched:true,reason:'search-error',query,freshness:'downloaded archive, not current-event verification',personality,sources:[],error:clean(error?.message||error,700),instructions:'Local library search failed. Do not claim retrieval succeeded.'};
  }
}

export const version=VERSION;
export default Object.freeze({version:VERSION,classifyKnowledgeQuestion,buildKnowledgeContext,personalities:PERSONALITY_MATRICES});
