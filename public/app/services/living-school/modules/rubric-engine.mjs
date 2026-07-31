const STOP=new Set("the a an and or but if then this that these those to of in on for from with by as is are was were be been being it its they them their you your we our i me my can could should would may might will do does did have has had about into through across at not no yes".split(/\s+/));
const words=value=>String(value||"").toLowerCase().match(/[a-z0-9][a-z0-9'’-]*/g)||[];
const uniqueMeaningful=value=>[...new Set(words(value).filter(word=>word.length>3&&!STOP.has(word)))];
const normalize=value=>String(value||"").toLowerCase().replace(/[^a-z0-9\s'’-]/g," ").replace(/\s+/g," ").trim();
const sentenceCount=value=>String(value||"").split(/[.!?]+|\n+/).map(item=>item.trim()).filter(item=>item.split(/\s+/).length>=4).length;
const repeatedRatio=tokens=>{if(tokens.length<4)return 0;const counts={};tokens.forEach(token=>counts[token]=(counts[token]||0)+1);return Math.max(...Object.values(counts))/tokens.length};
const ngrams=(tokens,size)=>tokens.slice(0,Math.max(0,tokens.length-size+1)).map((_,index)=>tokens.slice(index,index+size).join(" "));
const overlapRatio=(left,right)=>{const a=new Set(left),b=new Set(right);if(!a.size||!b.size)return 0;let hit=0;a.forEach(item=>{if(b.has(item))hit++});return hit/Math.min(a.size,b.size)};
const roleFor=(item={})=>{
  const text=normalize(`${item.id||""} ${item.label||""} ${item.description||""}`);
  if(/evidence|measure|record|source|proof|observe|indicator/.test(text))return"evidence";
  if(/consequence|impact|result|risk|effect|tradeoff/.test(text))return"consequence";
  if(/action|decision|recommend|propose|next step|response/.test(text))return"action";
  if(/apply|application|scenario|workflow|case/.test(text))return"application";
  return"principle";
};
const roleSignals={
  principle:/\b(principle|because|means|requires|depends|accountability|reason|foundation)\b/i,
  application:/\b(apply|use|workflow|scenario|case|when|would|during|example|implementation)\b/i,
  evidence:/\b(evidence|measure|record|audit|log|source|verify|observe|indicator|receipt|data)\b/i,
  consequence:/\b(consequence|result|impact|risk|therefore|so that|leads|effect|tradeoff|otherwise)\b/i,
  action:/\b(choose|decide|propose|require|create|change|revise|stop|approve|review|next)\b/i,
};

export function detectLowQualityPatterns(prompt,response,cues=[],lessonExcerpt=""){
  const text=normalize(response),promptText=normalize(prompt),tokens=words(response),meaningful=uniqueMeaningful(response);
  const issues=[];
  if(!text)issues.push("The response is blank.");
  if(promptText&&text===promptText)issues.push("The response repeats the question instead of answering it.");
  const promptMeaningful=uniqueMeaningful(prompt),responseMeaningful=uniqueMeaningful(response);
  const promptCopy=overlapRatio(promptMeaningful,responseMeaningful);
  if(promptText&&text.length>20&&promptText.includes(text))issues.push("The response copies a fragment of the prompt without adding an explanation.");
  if(promptMeaningful.length>=5&&promptCopy>.82&&responseMeaningful.length<=promptMeaningful.length+3)issues.push("The response mostly rearranges the prompt instead of developing an answer.");
  if(tokens.length>=8&&repeatedRatio(tokens)>.34)issues.push("The response repeats the same language too heavily to show a clear explanation.");
  const bigrams=ngrams(tokens,2);if(bigrams.length>=8&&repeatedRatio(bigrams)>.24)issues.push("The response repeats the same phrase pattern instead of advancing the explanation.");
  const diversity=tokens.length?new Set(tokens.filter(token=>!STOP.has(token))).size/tokens.length:0;
  if(tokens.length>=18&&diversity<.28)issues.push("The response has too little language variety to demonstrate a developed explanation.");
  if(tokens.length>=6&&sentenceCount(response)===0)issues.push("Use complete explanatory sentences rather than a list of terms.");
  const normalizedCues=cues.map(normalize).filter(Boolean);
  const cueMatches=normalizedCues.filter(cue=>text.includes(cue));
  const connectors=(text.match(/\b(because|therefore|so that|which means|for example|if|when|however|but|evidence|result)\b/g)||[]).length;
  if(normalizedCues.length>=3&&cueMatches.length>=Math.min(3,normalizedCues.length)&&meaningful.length<=cueMatches.length+3)issues.push("Rubric terms are listed without enough explanation or application.");
  if(cueMatches.length>=3&&connectors===0&&sentenceCount(response)<=1)issues.push("The response names rubric concepts without explaining how they connect.");
  if(/\b(lorem ipsum|asdf|qwerty|blah blah|idk|whatever)\b/i.test(response))issues.push("The response contains obvious filler rather than a substantive answer.");
  const reference=uniqueMeaningful(`${prompt} ${lessonExcerpt}`),referenceOverlap=overlapRatio(reference,responseMeaningful);
  if(tokens.length>=20&&reference.length>=5&&referenceOverlap<.08)issues.push("The response is substantial in length but does not appear connected to the prompt or lesson context.");
  return [...new Set(issues)];
}

export function normalizeCriteria(raw=[],fallback=[]){
  const source=Array.isArray(raw)&&raw.length?raw:fallback;
  return source.slice(0,8).map((item,index)=>{
    if(typeof item==="string"){
      const row={id:`criterion-${index+1}`,label:item,description:item,points:2,cues:uniqueMeaningful(item).slice(0,4),examples:[],feedback:`Explain how the response satisfies: ${item}.`};
      return{...row,role:roleFor(row),required:false};
    }
    const label=String(item?.label||item?.description||`Criterion ${index+1}`).slice(0,180);
    const row={id:String(item?.id||`criterion-${index+1}`).slice(0,80),label,description:String(item?.description||label).slice(0,400),points:Math.max(1,Math.min(5,Number(item?.points||2))),cues:(Array.isArray(item?.cues)?item.cues:uniqueMeaningful(label)).map(String).slice(0,8),examples:(Array.isArray(item?.examples)?item.examples:[]).map(String).slice(0,5),feedback:String(item?.feedback||`Strengthen ${label.toLowerCase()} with a concrete explanation.`).slice(0,500),required:Boolean(item?.required)};
    return{...row,role:["principle","application","evidence","consequence","action"].includes(item?.role)?item.role:roleFor(row)};
  });
}

function criterionSignals(criterion,response){
  const text=normalize(response),tokens=uniqueMeaningful(response),cues=(criterion.cues||[]).map(normalize).filter(Boolean);
  const matches=cues.filter(cue=>text.includes(cue)||cue.split(" ").every(part=>tokens.includes(part)));
  const descriptionTokens=uniqueMeaningful(`${criterion.label} ${criterion.description}`);
  const semanticOverlap=descriptionTokens.filter(token=>tokens.includes(token));
  const explanation=/\b(because|therefore|so that|which means|for example|however|but|if|when)\b/i.test(response);
  const roleSignal=(roleSignals[criterion.role]||roleSignals.principle).test(response);
  const concrete=/\b(first|then|before|after|named|specific|record|document|person|team|tool|process|step|reviewer|owner|deadline|metric)\b/i.test(response);
  return{matches,semanticOverlap,explanation,roleSignal,concrete};
}

export function evaluateShortAnswer({prompt,response,criteria=[],minWords=12,maxWords=320,requiredElements=[],lessonExcerpt=""}){
  const text=String(response||"").trim(),tokenList=words(text),wordCount=tokenList.length;
  const normalizedCriteria=normalizeCriteria(criteria,requiredElements);
  const cueList=normalizedCriteria.flatMap(item=>item.cues||[]);
  const qualityIssues=detectLowQualityPatterns(prompt,text,cueList,lessonExcerpt);
  const structural=[];
  if(wordCount<Number(minWords||0))structural.push(`Use at least ${minWords} words.`);
  if(maxWords&&wordCount>maxWords)structural.push(`Use no more than ${maxWords} words.`);
  if(sentenceCount(text)<1&&wordCount>=6)structural.push("Use at least one complete explanatory sentence.");
  const promptTokens=uniqueMeaningful(prompt),responseTokens=uniqueMeaningful(text),lessonTokens=uniqueMeaningful(lessonExcerpt);
  const promptOverlap=promptTokens.filter(token=>responseTokens.includes(token));
  const lessonOverlap=lessonTokens.filter(token=>responseTokens.includes(token));
  if(promptTokens.length&&promptOverlap.length===0&&wordCount>=8)structural.push("The response does not appear to address the question yet.");
  if(lessonTokens.length>=8&&wordCount>=16&&lessonOverlap.length===0)structural.push("Connect the answer to at least one idea or practice from the lesson.");
  const scores=normalizedCriteria.map(criterion=>{
    const signals=criterionSignals(criterion,text),max=criterion.points;
    let ratio=0;
    if(signals.matches.length)ratio=Math.max(ratio,Math.min(.75,signals.matches.length/Math.max(1,Math.min(2,(criterion.cues||[]).length))*.75));
    if(signals.semanticOverlap.length)ratio=Math.max(ratio,Math.min(.62,signals.semanticOverlap.length/Math.max(2,Math.min(4,uniqueMeaningful(criterion.description).length))));
    if(signals.roleSignal)ratio=Math.max(ratio,.35);
    if(signals.explanation&&ratio>.2)ratio+=.2;
    if(signals.concrete&&["application","evidence","action"].includes(criterion.role)&&ratio>.2)ratio+=.15;
    ratio=Math.min(1,ratio);
    if(wordCount>=minWords&&ratio===0&&normalizedCriteria.length===1&&sentenceCount(text)>=2)ratio=.25;
    const earned=Math.round(max*ratio*2)/2;
    const met=earned>=max*.6;
    let feedback=criterion.feedback;
    if(earned>=max*.8)feedback=`The response clearly addresses ${criterion.label.toLowerCase()}.`;
    else if(signals.matches.length&&!signals.explanation)feedback=`You named ${criterion.label.toLowerCase()}, but explain why it matters or how it works in this scenario.`;
    else if(signals.roleSignal&&!signals.concrete&&["application","evidence","action"].includes(criterion.role))feedback=`Add a concrete example, decision, or observable record for ${criterion.label.toLowerCase()}.`;
    return{id:criterion.id,label:criterion.label,description:criterion.description,role:criterion.role,points:max,earned,met,required:criterion.required,feedback,signals:{cueMatches:signals.matches,conceptOverlap:signals.semanticOverlap,explanation:signals.explanation,roleSignal:signals.roleSignal,concrete:signals.concrete}};
  });
  const possible=scores.reduce((sum,item)=>sum+item.points,0)||1;
  let earned=scores.reduce((sum,item)=>sum+item.earned,0);
  const requiredMisses=scores.filter(item=>item.required&&!item.met);
  if(requiredMisses.length)structural.push(`Required criterion not yet demonstrated: ${requiredMisses.map(item=>item.label).join(", ")}.`);
  const hardIssues=[...new Set([...structural,...qualityIssues])];
  if(hardIssues.length)earned=Math.min(earned,possible*.45);
  const ratio=Math.max(0,Math.min(1,earned/possible));
  const nearBoundary=!hardIssues.length&&ratio>=.45&&ratio<.72;
  const lowSignal=scores.some(item=>item.earned>0&&!item.signals.explanation)&&ratio<.8;
  const uncertain=nearBoundary||lowSignal;
  const confidence=hardIssues.length?.92:ratio>=.8&&!uncertain?.82:uncertain?.52:.7;
  return{ok:!hardIssues.length&&ratio>=.6&&!requiredMisses.length,uncertain,needsReview:uncertain&&ratio>=.45,confidence,score:Math.round(ratio*100),points:earned,possible,wordCount,structuralIssues:structural,qualityIssues,criteria:scores,feedback:hardIssues.length?hardIssues.join(" "):ratio>=.8?"The response meets the visible rubric with a clear, applied explanation.":uncertain?"The response shows partial understanding. Revise the weak criteria or request model or human review before treating it as high-stakes evidence.":"Revise the criteria marked below and connect them to the scenario.",lessonExcerpt:String(lessonExcerpt||"").slice(0,2400),authority:"deterministic-rubric-assisted"};
}

export function validateModelEvaluation(value,criteria=[]){
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const expected=new Map(normalizeCriteria(criteria).map(item=>[item.id,item]));
  const rows=Array.isArray(value.criteria)?value.criteria:[];
  if(!rows.length)return null;
  const normalized=[];
  for(const row of rows){
    const id=String(row?.id||""),criterion=expected.get(id);if(!criterion)return null;
    const earned=Number(row.earned);if(!Number.isFinite(earned)||earned<0||earned>criterion.points)return null;
    const feedback=String(row.feedback||"").trim().slice(0,600);if(!feedback)return null;
    normalized.push({id,label:criterion.label,role:criterion.role,points:criterion.points,earned:Math.round(earned*2)/2,met:earned>=criterion.points*.6,feedback});
  }
  if(normalized.length!==expected.size||new Set(normalized.map(item=>item.id)).size!==expected.size)return null;
  const possible=normalized.reduce((sum,item)=>sum+item.points,0)||1,earned=normalized.reduce((sum,item)=>sum+item.earned,0),score=Math.round(earned/possible*100);
  return{ok:score>=60,uncertain:Boolean(value.uncertain),confidence:Math.max(0,Math.min(1,Number(value.confidence||.65))),score,points:earned,possible,criteria:normalized,feedback:String(value.feedback||"").slice(0,1200),authority:"model-assisted-rubric"};
}

export function mergeModelEvaluation(deterministic,model){
  if(!model)return deterministic;
  const hard=[...(deterministic?.structuralIssues||[]),...(deterministic?.qualityIssues||[])];
  if(hard.length)return{...deterministic,modelAdvisory:model,authority:"deterministic-safeguard",feedback:`${deterministic.feedback} A model score was recorded as advisory only because structural safeguards failed.`};
  const rows=new Map((model.criteria||[]).map(item=>[item.id,item]));
  const criteria=(deterministic.criteria||[]).map(item=>{
    const modelRow=rows.get(item.id);if(!modelRow)return item;
    const earned=Math.min(item.points,Math.max(0,modelRow.earned));
    return{...item,earned,met:earned>=item.points*.6,feedback:modelRow.feedback,modelEarned:modelRow.earned};
  });
  const possible=criteria.reduce((sum,item)=>sum+item.points,0)||1,points=criteria.reduce((sum,item)=>sum+item.earned,0),score=Math.round(points/possible*100);
  const disagreement=Math.abs(Number(deterministic.score||0)-Number(model.score||0));
  const uncertain=Boolean(model.uncertain)||Boolean(deterministic.uncertain)||disagreement>=25;
  return{...model,ok:score>=60&&!uncertain,uncertain,needsReview:uncertain,score,points,possible,criteria,deterministicScore:deterministic.score,modelScore:model.score,feedback:[model.feedback,disagreement>=25?"The model and deterministic rubric disagree substantially; preserve this result for review.":""].filter(Boolean).join(" "),authority:"model-assisted-rubric-with-safeguards"};
}
