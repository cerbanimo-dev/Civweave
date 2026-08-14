export const HATE_LEXICON_SCHEMA='civweave.moderation.harm-lexicon.v1';
export const HATE_ASSESSMENT_SCHEMA='civweave.moderation.hate-assessment.v1';
export const DEFAULT_TRIBUNAL_THRESHOLD=0.82;

export const LEXICON_SOURCES=Object.freeze([
  {id:'ldnoobw',name:'List of Dirty, Naughty, Obscene, and Otherwise Bad Words',languages:['en','ja'],license:'CC-BY-4.0',role:'candidate vocabulary only; never sufficient for a hate verdict'},
  {id:'whym-ja',name:'Japanese bad words list for Wikimedia vandalism detection',languages:['ja'],license:'CC0-1.0',role:'candidate vocabulary and spelling seed only; never sufficient for a hate verdict'},
  {id:'civweave-curated',name:'Civweave high-confidence hate overlay',languages:['en','ja'],license:'AGPL-3.0-or-later',role:'explicit target/reason annotations eligible to open a tribunal case'}
]);

const entry=(id,language,term,target,reason,aliases=[],contextDependent=false)=>Object.freeze({
  schema:HATE_LEXICON_SCHEMA,id,language,term,target,reason,aliases:Object.freeze(aliases),contextDependent,
  category:'protected-target-slur',tribunalEligible:true,sourceIds:Object.freeze(['civweave-curated'])
});

// Deliberately small and high precision. Broad profanity lists are candidate sources, not tribunal triggers.
export const GLOBAL_HARM_LEXICON=Object.freeze([
  entry('en-racial-01','en','nigger','race','A severe anti-Black racial slur.', ['nigga']),
  entry('en-racial-02','en','kike','religion/ethnicity','An antisemitic slur targeting Jewish people.'),
  entry('en-racial-03','en','spic','race/ethnicity','An ethnic slur targeting Hispanic or Latino people.'),
  entry('en-racial-04','en','wetback','race/ethnicity','A demeaning ethnic slur commonly targeting Mexican immigrants.'),
  entry('en-racial-05','en','raghead','race/religion','A demeaning slur commonly targeting Arabs, Sikhs, Muslims, or people perceived as such.'),
  entry('en-sexuality-01','en','faggot','sexual orientation','A severe anti-gay slur.', ['fag']),
  entry('en-gender-01','en','tranny','gender identity','A derogatory slur targeting transgender people.'),
  entry('en-disability-01','en','spastic','disability','A derogatory disability-related slur when directed at a person.', [], true),
  entry('ja-racial-01','ja','ニガー','race','黒人を侮辱するために使われる、人種差別的な英語スラーの日本語表記。'),
  entry('ja-ethnic-01','ja','チョン','ethnicity/nationality','韓国人・朝鮮人を侮辱する民族差別語。'),
  entry('ja-ethnic-02','ja','支那','ethnicity/nationality','現代日本語では中国・中国人への侮蔑として使われ得る歴史的呼称。文脈確認が必要。',[],true),
  entry('ja-sexuality-01','ja','ホモ','sexual orientation','同性愛者を侮辱する目的で使われ得る蔑称。文脈確認が必要。',[],true),
  entry('ja-gender-01','ja','オカマ','gender identity/sexual orientation','ゲイ、トランスジェンダー、ジェンダー非典型の人への侮辱として使われ得る語。文脈確認が必要。',[],true)
]);

const ZERO_WIDTH=/[\u200B-\u200D\u2060\uFEFF]/g;
const MARKS=/[\u0300-\u036f]/g;
const SEP=/[\s\p{P}\p{S}_]+/gu;
const LEET=Object.freeze({'0':'o','1':'i','2':'z','3':'e','4':'a','5':'s','6':'g','7':'t','8':'b','9':'g','@':'a','$':'s','!':'i','|':'i','+':'t'});
const CONFUSABLE=Object.freeze({
  'а':'a','е':'e','о':'o','р':'p','с':'c','у':'y','х':'x','і':'i','ј':'j','ѕ':'s',
  'Α':'a','Β':'b','Ε':'e','Ζ':'z','Η':'h','Ι':'i','Κ':'k','Μ':'m','Ν':'n','Ο':'o','Ρ':'p','Τ':'t','Υ':'y','Χ':'x',
  'α':'a','β':'b','ε':'e','ι':'i','κ':'k','ο':'o','ρ':'p','τ':'t','υ':'y','χ':'x'
});
const compact=value=>String(value||'').replace(SEP,'');
const mapChars=(value,map)=>Array.from(value,ch=>map[ch]??ch).join('');
function kataToHira(value){return Array.from(value,ch=>{const n=ch.charCodeAt(0);return n>=0x30A1&&n<=0x30F6?String.fromCharCode(n-0x60):ch}).join('')}

export function normalizeModerationText(input){
  const original=String(input??'');
  const nfkc=original.normalize('NFKC').replace(ZERO_WIDTH,'').toLowerCase();
  const deaccented=nfkc.normalize('NFD').replace(MARKS,'').normalize('NFC');
  const confusable=mapChars(deaccented,CONFUSABLE);
  const leet=mapChars(confusable,LEET);
  const kana=kataToHira(nfkc);
  return Object.freeze({original,nfkc,deaccented,confusable,leet,kana,compact:compact(nfkc),leetCompact:compact(leet),kanaCompact:compact(kana)});
}

function termViews(term){const v=normalizeModerationText(term);return new Set([v.nfkc,v.compact,v.leet,v.leetCompact,v.kana,v.kanaCompact].filter(Boolean))}
function boundedLevenshtein(a,b,max=1){
  a=Array.from(a);b=Array.from(b);if(Math.abs(a.length-b.length)>max)return max+1;
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const cur=[i];let rowMin=cur[0];
    for(let j=1;j<=b.length;j++){cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));rowMin=Math.min(rowMin,cur[j])}
    if(rowMin>max)return max+1;prev=cur;
  }
  return prev[b.length];
}

function candidateScore(textViews,entry,alias){
  const base=alias||entry.term,views=termViews(base);
  for(const t of views){
    if(!t)continue;
    if(textViews.nfkc.includes(t)||textViews.compact.includes(t))return {score:alias?0.94:0.97,method:alias?'explicit-alias':'exact-normalized'};
    if(textViews.leet.includes(t)||textViews.leetCompact.includes(t)||textViews.confusable.includes(t))return {score:alias?0.91:0.93,method:'obfuscation-normalized'};
    if(textViews.kana.includes(t)||textViews.kanaCompact.includes(t))return {score:alias?0.91:0.94,method:'kana-normalized'};
  }
  const needle=compact(normalizeModerationText(base).leetCompact);
  if((entry.language==='en'&&needle.length>=5)||(entry.language==='ja'&&Array.from(needle).length>=3)){
    const hay=textViews.leetCompact;
    const n=Array.from(needle).length,h=Array.from(hay);
    for(let i=0;i<=h.length-Math.max(1,n-1);i++){
      for(const width of [n-1,n,n+1]){if(width<1||i+width>h.length)continue;const slice=h.slice(i,i+width).join('');if(boundedLevenshtein(slice,needle,1)<=1)return {score:entry.contextDependent?0.78:0.84,method:'bounded-fuzzy'}}
    }
  }
  return null;
}

export function detectLexiconMatches(text,{languages=['en','ja']}={}){
  const views=normalizeModerationText(text),allowed=new Set(languages),matches=[];
  for(const row of GLOBAL_HARM_LEXICON){
    if(!allowed.has(row.language))continue;
    let best=candidateScore(views,row,null),matched=row.term;
    for(const alias of row.aliases||[]){const result=candidateScore(views,row,alias);if(result&&(!best||result.score>best.score)){best=result;matched=alias}}
    if(best)matches.push({...row,matched,bestScore:best.score,method:best.method});
  }
  return matches.sort((a,b)=>b.bestScore-a.bestScore);
}

export async function miniLMHateSignal(text,matches,{ranker=null}={}){
  try{
    if(!ranker){
      const adapter=await import('./models/all-minilm-l6-v2/adapter.js');
      const status=await adapter.status();if(!status.ready)return {available:false,score:0,reason:'minilm-not-active'};
      ranker=(q,candidates,options)=>adapter.rank(q,candidates,options);
    }
    const candidates=[
      {id:'targeted-hate',text:'A hostile statement attacking a person or group because of race, ethnicity, nationality, religion, disability, sexual orientation, gender identity, or another protected characteristic.'},
      {id:'quoted-or-discussed',text:'A quotation, educational discussion, counterspeech, news report, or criticism of hateful language rather than an attack.'},
      {id:'ordinary-nonhate',text:'Ordinary conversation, profanity, criticism, or disagreement that is not targeted hate speech.'}
    ];
    const result=await ranker(String(text||''),candidates,{limit:3,cacheKey:'anarchadia-hate-v1'});
    const rows=result?.matches||[],hate=rows.find(x=>x.id==='targeted-hate'),counter=rows.find(x=>x.id==='quoted-or-discussed');
    const h=Number(hate?.score??hate?.similarity??0),c=Number(counter?.score??counter?.similarity??0);
    return {available:true,score:Math.max(0,Math.min(1,0.5+(h-c)/2)),matches:rows,lexiconMatches:matches.length};
  }catch(error){return {available:false,score:0,reason:String(error?.code||error?.message||error)}}
}

export async function assessHateSpeech(text,{languages=['en','ja'],threshold=DEFAULT_TRIBUNAL_THRESHOLD,useMiniLM=true,ranker=null,contextClassifier=null}={}){
  const matches=detectLexiconMatches(text,{languages}),top=matches[0]||null;
  const miniLM=useMiniLM?await miniLMHateSignal(text,matches,{ranker}):{available:false,score:0};
  let contextual=null;
  if(typeof contextClassifier==='function'){
    try{contextual=await contextClassifier({text:String(text||''),matches,task:'distinguish targeted hate from quotation, counterspeech, reclamation, neutral mention, or unrelated profanity'});}catch(error){contextual={available:false,error:String(error?.message||error)}}
  }
  let confidence=top?.bestScore||0;
  if(top?.contextDependent)confidence-=0.08;
  if(miniLM.available)confidence=Math.max(confidence,Math.min(0.98,confidence*0.78+miniLM.score*0.22));
  if(contextual?.available!==false&&Number.isFinite(Number(contextual?.hateConfidence)))confidence=Math.max(confidence,Math.min(0.99,confidence*0.72+Number(contextual.hateConfidence)*0.28));
  if(contextual?.context==='quotation'||contextual?.context==='counterspeech'||contextual?.context==='reclaimed')confidence=Math.max(0,confidence-0.35);
  confidence=Math.max(0,Math.min(1,Number(confidence.toFixed(4))));
  const tribunalEligible=Boolean(top?.tribunalEligible&&confidence>=threshold);
  return {schema:HATE_ASSESSMENT_SCHEMA,version:'1.0.0',confidence,threshold,tribunalEligible,matches,miniLM,contextual,original:String(text||''),normalized:normalizeModerationText(text),decision:tribunalEligible?'open-tribunal-candidate':matches.length?'flag-for-context':'no-hate-signal'};
}
