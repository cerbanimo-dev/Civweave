(()=>{
'use strict';

const INTENTIONS_KEY='civweave.intentions.v127';
const PLAN_SCHEMA='civweave.intention-weave.v1';
const EXPLICIT_PLAN_TRIGGER=/\b(plan|roadmap|routine|program|curriculum|pathway|steps|practice schedule|daily practice|weekly practice|reviewable quest|reviewable weave|set (?:an )?intention)\b|\bteach me\b|\bhelp me learn\b|\bcreate (?:me )?(?:a )?plan\b/i;
const WISH_TRIGGER=/\b(i want|i wish|my wish|my goal|we want|we wish|let'?s|help me)\b/i;
const RETRY_TRIGGER=/\b(retry|try again|one more time|rebuild|build that again|redo)\b/i;
const CORRECTION_TRIGGER=/\b(not (?:a|an|the)|instead(?: of)?|rather than|i mean|correction|change (?:it|that)|revise (?:it|that)|scratch that)\b/i;
const DIRECT_INTENTION_TRIGGER=/^(learn|make|build|create|write|start|organize|find|change|improve|design|develop)\b/i;

const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const clean=value=>String(value==null?'':value).trim();
const lower=value=>clean(value).toLowerCase();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const has=(text,pattern)=>pattern.test(text);

function dispatchChanged(items){
  try{dispatchEvent(new CustomEvent('civweave:intentions-changed',{detail:{items}}))}catch{}
}

function userTurns(history,text){
  const turns=(Array.isArray(history)?history:[])
    .filter(item=>item?.role==='user')
    .map(item=>clean(item.text||item.content))
    .filter(Boolean);
  const latest=clean(text);
  if(latest&&turns.at(-1)!==latest)turns.push(latest);
  return turns.slice(-24);
}

function activeIntentionTurns(history,text){
  const turns=userTurns(history,text);
  if(!turns.length)return[];
  const latestIndex=turns.length-1;
  const latest=turns[latestIndex];
  if(WISH_TRIGGER.test(latest)||DIRECT_INTENTION_TRIGGER.test(latest))return[latest];
  if(CORRECTION_TRIGGER.test(latest)){
    for(let index=latestIndex-1;index>=0;index--){
      if(WISH_TRIGGER.test(turns[index])||DIRECT_INTENTION_TRIGGER.test(turns[index])||EXPLICIT_PLAN_TRIGGER.test(turns[index]))return[turns[index],latest];
    }
    return[latest];
  }
  if(RETRY_TRIGGER.test(latest)||EXPLICIT_PLAN_TRIGGER.test(latest)){
    for(let index=latestIndex-1;index>=0;index--){
      if(WISH_TRIGGER.test(turns[index])||DIRECT_INTENTION_TRIGGER.test(turns[index]))return[turns[index],latest];
    }
  }
  return[latest];
}

function detectSignals(transcript){
  const text=lower(transcript);
  const gameDenied=has(text,/\b(?:not|rather than|instead of)\s+(?:a\s+)?(?:video\s+)?game\b/);
  return{
    learning:has(text,/\b(learn|teach|understand|study|practice|skill|curriculum|lesson|research|explain)\b/),
    doing:has(text,/\b(build|make|create|design|develop|implement|prototype|repair|fix|ship|practice|organize|launch|write|draft|publish|open)\b/),
    material:has(text,/\b(material|resource|suppl|tool|equipment|space|transport|storage|food|meal|budget|money|inventory|borrow|buy|trade|land|seed|produce)\b/),
    collective:has(text,/\b(friend|friends|team|peer|group|community|neighbor|network|together|shared|collaborat|partner)\b/),
    governance:has(text,/\b(agreement|consent|boundary|rule|policy|decision|approval|responsibilit|proposal|vote|automation|partnership|role)\b/),
    food:has(text,/\b(food|meal|dinner|garden|pantry|produce|kitchen|farm|restaurant|table)\b/),
    garden:has(text,/\b(garden|farm|produce|grow|growing|harvest)\b/),
    restaurant:has(text,/\b(restaurant|cafe|kitchen|garden[- ]to[- ]table|farm[- ]to[- ]table)\b/),
    game:!gameDenied&&has(text,/\b(game|gameplay|player|playable|level design|game design|video game|tabletop)\b/),
    book:has(text,/\b(book|novel|story|manuscript|fiction|author|write|writing|chapter)\b/),
    selfLove:has(text,/\b(love myself|self[- ]love|self[- ]compassion|self[- ]worth|accept myself|self[- ]acceptance|be kinder to myself)\b/),
    timeLoop:has(text,/\b(time loop|time looper|looping time|reset(?:s|ting)? time|repeated timeline|timeline loop)\b/),
    timeTravel:has(text,/\b(time travel|time traveler|time traveller|time traveling|time travelling|chrononaut|alternate timeline|future self|past self|anomaly eraser)\b/)
  };
}

function meaningfulPriorWish(turns){
  return turns.slice(0,-1).some(turn=>WISH_TRIGGER.test(turn)||DIRECT_INTENTION_TRIGGER.test(turn)||/\b(my goal|my wish|let'?s make|let'?s build)\b/i.test(turn));
}

function currentSystem(context={}){
  return clean(context?.currentContext?.systemId||context?.guide?.system||context?.routingAnswer?.system||'civweave');
}

function shouldCreate({text,history,context,force=false}={}){
  if(force)return true;
  if(currentSystem(context)!=='civweave')return false;
  const value=clean(text);
  if(!value)return false;
  if(EXPLICIT_PLAN_TRIGGER.test(value)||WISH_TRIGGER.test(value)||DIRECT_INTENTION_TRIGGER.test(value)||CORRECTION_TRIGGER.test(value))return true;
  const turns=userTurns(history,value);
  return RETRY_TRIGGER.test(value)&&meaningfulPriorWish(turns);
}

function stripWish(value){
  return clean(value)
    .replace(/^(okay|ok|so|please)\s+/i,'')
    .replace(/^(i want|i wish|we want|we wish|let'?s|help me)\s+(to\s+)?/i,'')
    .replace(/[.!?]+$/,'')
    .trim();
}

function titleFor(turns,signals){
  const latest=turns.at(-1)||'Move this intention forward';
  if(signals.book&&signals.timeLoop&&signals.timeTravel)return'Write a book about a time looper pursued by a time-traveling anomaly eraser';
  if(signals.book)return`Write ${stripWish(latest).replace(/^make\s+/i,'')||'the book'}`;
  if(signals.game&&signals.timeLoop&&signals.timeTravel)return'Build a game where a time looper faces a time traveler';
  if(signals.game)return'Prototype the game concept as a playable vertical slice';
  if(signals.restaurant&&signals.garden)return'Build a garden-to-table restaurant with local garden partners';
  if(signals.selfLove)return'Build a sustainable practice of self-love and self-compassion';
  if(signals.collective&&signals.food)return'Launch a small shared-food pilot';
  return stripWish(latest)||'Move this intention forward';
}

function outcomeFor(signals){
  if(signals.book&&signals.timeLoop&&signals.timeTravel)return'Complete a coherent book manuscript in which the looper, the anomaly eraser, and the rules of time create escalating story consequences rather than game mechanics.';
  if(signals.book)return'Move from premise to outline, draft, revision, and a complete readable manuscript with a sustainable writing cadence.';
  if(signals.game&&signals.timeLoop&&signals.timeTravel)return'Create a playable vertical slice where the looper and traveler have mechanically different relationships to time, one complete loop can be played, and at least one consequence persists across a reset.';
  if(signals.game)return'Create a playable vertical slice that proves the core decision, feedback loop, and emotional promise before the project expands.';
  if(signals.restaurant&&signals.garden)return'Validate one safe, financially legible garden-to-table service cycle using produce from the user’s garden and at least one local garden partner.';
  if(signals.selfLove)return'Develop repeatable practices that increase self-kindness, self-respect, and supportive connection without treating personal worth as something that must be earned.';
  if(signals.collective&&signals.food)return'Run one maintainable shared-food cycle with explicit roles, concrete logistics, and a review date.';
  return'Turn the Quest goal into an editable route with visible evidence of progress and a clear next checkpoint.';
}

function learningPath(signals){
  if(signals.book){
    return{
      id:uid('learning'),type:'learning',realm:'living-school',
      title:'Learn the story craft the manuscript requires',
      purpose:'Research time-loop narrative structure, pursuit tension, character motivation, and rules that remain understandable on the page.',
      steps:['Define what the looper remembers and what the anomaly eraser removes.','Study three comparable stories for structure, not imitation.','Map viewpoint, stakes, escalation, and the reveal sequence.','Write a one-page story-rules document and test it on a reader.'],
      completionCriteria:'The premise, temporal rules, protagonist goal, antagonist pressure, and ending direction can be explained without referring to gameplay.',
      evidence:['Story-rules sheet','Comparable-work notes','Character pressure map','Reader comprehension notes'],status:'draft'
    };
  }
  if(signals.selfLove){
    return{
      id:uid('learning'),type:'learning',realm:'living-school',
      title:'Learn practical self-compassion and self-respect skills',
      purpose:'Replace vague pressure to “love yourself” with learnable practices, realistic language, and support options.',
      steps:['Notice the situations that trigger harsh self-talk without judging the observation.','Learn one evidence-informed self-compassion exercise and one grounding practice.','Separate personal worth from productivity, appearance, approval, and mistakes.','Identify when trusted people or professional support would be useful.'],
      completionCriteria:'The user can recognize one recurring self-critical pattern and use at least two kinder responses that feel believable rather than forced.',
      evidence:['Trigger-and-response note','Two practiced exercises','Support map','Weekly reflection'],status:'draft'
    };
  }
  if(signals.restaurant&&signals.garden){
    return{
      id:uid('learning'),type:'learning',realm:'living-school',
      title:'Research food safety, growing capacity, and restaurant operations',
      purpose:'Learn the legal, agricultural, culinary, and business constraints before investing heavily.',
      steps:['Research local food-service, zoning, licensing, and produce-sourcing rules.','Estimate seasonal yield and menu capacity from the home garden.','Study safe receiving, storage, traceability, and substitution workflows.','Interview or research two garden partners and one small restaurant operator.'],
      completionCriteria:'A source-backed feasibility brief identifies the first legal pilot, seasonal menu limits, and the largest unknowns.',
      evidence:['Regulatory source pack','Yield estimate','Food-safety checklist','Partner interview or research notes'],status:'draft'
    };
  }
  if(signals.game){
    return{
      id:uid('learning'),type:'learning',realm:'living-school',
      title:signals.timeLoop&&signals.timeTravel?'Define the temporal rules and dramatic collision':'Define the game’s core rule and player experience',
      purpose:signals.timeLoop&&signals.timeTravel?'Make the looper and traveler mechanically distinct by defining what each remembers, changes, risks, and cannot control.':'Turn the concept into explicit design rules before lore and content multiply.',
      steps:signals.timeLoop&&signals.timeTravel?['Define the looper in one sentence: what resets, what persists, and what ends a loop.','Define the traveler in one sentence: how they cross time and what they cannot change.','Map the first encounter from both characters’ perspectives.','Choose one consequence that survives a reset and forces a strategy change.']:['State the player fantasy and central decision in one sentence each.','Define the smallest repeatable gameplay loop.','List what persists between attempts.','Choose the emotion the vertical slice should leave behind.'],
      completionCriteria:'Another person can explain what the player repeatedly does, why the two roles differ, and why one choice matters.',
      evidence:['One-page rules sheet','Core-loop diagram','First-encounter beat map','Three player-comprehension questions'],status:'draft'
    };
  }
  if(signals.collective&&signals.food){
    return{
      id:uid('learning'),type:'learning',realm:'living-school',title:'Learn the minimum skills for the first food cycle',
      purpose:'Identify only the safety, logistics, coordination, or preservation knowledge required by the selected pilot.',
      steps:['Choose the first pilot and list its knowledge risks.','Research the highest-risk safety and logistics questions.','Practice the highest-risk skill before launch.'],
      completionCriteria:'The group can safely run one cycle and knows what still needs expert help.',
      evidence:['Shared skill map','Research source pack','Practice run','Safety and escalation checklist'],status:'draft'
    };
  }
  return{
    id:uid('learning'),type:'learning',realm:'living-school',title:'Learn what the intention requires',
    purpose:'Convert uncertainty into a compact, researched learning progression tied to a real task.',
    steps:['Name the real-world task the learning should unlock.','Have Living School research and classify the source set.','Separate what is already known from what must be practiced.','Complete one guided example and one fresh demonstration.'],
    completionCriteria:'The skill can be demonstrated independently in the intended context with the source basis visible.',
    evidence:['Living School source pack','Guided example','Fresh demonstration','Remaining-uncertainty note'],status:'draft'
  };
}

function skilledPath(signals){
  if(signals.book){
    return{
      id:uid('skilled'),type:'skilled-labor',realm:'cerbanimo',title:'Outline, draft, and revise the manuscript',
      purpose:'Turn the premise into pages through bounded drafting quests rather than waiting for the whole book to feel solved.',
      steps:['Write a one-page premise and ending promise.','Build a scene-level outline for the opening movement.','Draft the first chapter without line-editing.','Run a structural review focused on clarity, tension, and character agency.','Repeat in manageable chapter batches until a complete draft exists.'],
      completionCriteria:'A complete manuscript draft exists, the opening establishes the time rules and pursuit, and a revision list is grounded in reader evidence.',
      evidence:['Premise page','Scene outline','Draft chapters','Reader notes','Revision log'],status:'draft'
    };
  }
  if(signals.selfLove){
    return{
      id:uid('skilled'),type:'skilled-labor',realm:'cerbanimo',title:'Practice a small self-respect routine',
      purpose:'Turn insight into gentle, repeatable actions without making perfection another test of worth.',
      steps:['Choose one daily act of care that takes under ten minutes.','Write one believable response to a recurring self-critical thought.','Set one boundary or ask for one form of support.','Review weekly and reduce the plan if it becomes punitive.'],
      completionCriteria:'The routine has been practiced for two weeks, feels supportive more often than coercive, and has a clear revise-or-pause rule.',
      evidence:['Practice log','Boundary or support action','Weekly review','Revised routine'],status:'draft'
    };
  }
  if(signals.restaurant&&signals.garden){
    return{
      id:uid('skilled'),type:'skilled-labor',realm:'cerbanimo',title:'Run the smallest garden-to-table service pilot',
      purpose:'Prove sourcing, preparation, service, cleanup, and customer demand before committing to a full restaurant.',
      steps:['Choose a legally permitted pilot format.','Design one seasonal menu around realistic garden yields.','Run a traceable sourcing and food-safety workflow.','Serve a bounded group and record cost, labor, waste, and feedback.','Decide whether to repeat, revise, partner, or stop.'],
      completionCriteria:'One complete service cycle is documented with safe handling, real costs, partner roles, and a decision for the next pilot.',
      evidence:['Pilot plan','Menu and source map','Service record','Cost and waste sheet','Post-pilot review'],status:'draft'
    };
  }
  if(signals.game){
    return{
      id:uid('skilled'),type:'skilled-labor',realm:'cerbanimo',
      title:signals.timeLoop&&signals.timeTravel?'Build the first playable loop and timeline collision':'Build the first playable vertical slice',
      purpose:'Turn the rules into a small playable artifact before art, lore, and scope multiply.',
      steps:signals.timeLoop&&signals.timeTravel?['Prototype one room or encounter that resets in under three minutes.','Implement one visible carryover for the looper.','Introduce the traveler as an interruption that changes one expected event.','Add one choice whose consequence remains legible after reset.','Run three playtests focused on whether players understand who can change what in time.']:['Prototype the smallest complete gameplay loop.','Add one meaningful choice and immediate feedback.','Create a beginning, playable middle, and stopping point.','Run three playtests and revise the most confusing rule.'],
      completionCriteria:'A player can complete the slice, explain the core loop, and identify why one choice mattered.',
      evidence:['Playable build','Capture of one complete run','Three playtest notes','Revision log'],status:'draft'
    };
  }
  if(signals.collective&&signals.food){
    return{
      id:uid('skilled'),type:'skilled-labor',realm:'cerbanimo',title:'Run the first shared-food cycle',
      purpose:'Build the smallest operational version that can prove the group will maintain it.',
      steps:['Select one pilot.','Name owners for setup, coordination, and maintenance.','Run one complete cycle with a small group.','Review failures and decide whether to repeat, revise, or stop.'],
      completionCriteria:'One complete cycle occurs with named responsibilities and a documented next decision.',
      evidence:['Pilot checklist','Participation record','Inventory or photo notes','Post-cycle review'],status:'draft'
    };
  }
  return{
    id:uid('skilled'),type:'skilled-labor',realm:'cerbanimo',title:'Turn the intention into practiced work',
    purpose:'Create checkpoints and visible proof rather than leaving the intention at reflection.',
    steps:['Define the smallest observable result.','Create a short checkpoint sequence.','Complete the first checkpoint with available tools.','Review evidence and revise the remaining Quest.'],
    completionCriteria:'A visible result exists and the next checkpoint is based on evidence.',
    evidence:['Starting-state record','Checkpoint evidence','Completion or revision note'],status:'draft'
  };
}

function materialPath(signals){
  if(!(signals.material||signals.restaurant||signals.garden))return null;
  return{
    id:uid('material'),type:'material-acquirement',realm:'fellowfare',
    title:signals.restaurant?'Map land, produce, kitchen, equipment, and partner needs':signals.food?'Secure the food, tools, transport, and storage for the first cycle':'Acquire the missing resources',
    purpose:'Turn vague needs into fair, specific requests and offers while separating research from actual commitments.',
    steps:['List required quantities, timing, and acceptable conditions.','Mark what can be grown, borrowed, traded, purchased, repaired, or substituted.','Use agentic research to identify candidate resources and partners.','Confirm availability, cost, logistics, ownership, and return conditions before committing.'],
    completionCriteria:'The next work checkpoint has the required resources with clear logistics, provenance, and ownership.',
    evidence:['Needs-and-offers map','Agent-researched candidate list','Confirmed source list','Pickup or return record'],status:'draft'
  };
}

function governanceLayer(signals){
  if(!(signals.governance||signals.collective||signals.restaurant))return null;
  return{
    realm:'anarchadia',title:'Participation and consent agreement',
    purpose:'Clarify who is affected, what participation asks, and how commitments can be revised or left.',
    agreements:['State the shared purpose in one sentence.','Name roles and realistic time commitments.','Use explicit consent for spending, publishing, voting, or assigning work.','Provide an objection and exit path.','Set a review date.'],
    reviewQuestion:'Who must explicitly agree before this intention becomes active?',status:'draft'
  };
}

function buildPlan({text,history,context={}}={}){
  const turns=activeIntentionTurns(history,text);
  const latestRequest=clean(text)||turns.at(-1)||'';
  const transcript=turns.join('\n');
  const signals=detectSignals(transcript);
  const paths=[];
  if(signals.learning||signals.game||signals.book||signals.food||signals.selfLove)paths.push(learningPath(signals));
  if(signals.doing||signals.game||signals.book||signals.restaurant||signals.selfLove||EXPLICIT_PLAN_TRIGGER.test(latestRequest))paths.push(skilledPath(signals));
  const material=materialPath(signals);if(material)paths.push(material);
  if(!paths.length)paths.push(learningPath(signals),skilledPath(signals));
  const createdAt=new Date().toISOString();
  const wish=[...turns].reverse().find(turn=>WISH_TRIGGER.test(turn)||DIRECT_INTENTION_TRIGGER.test(turn))||turns[0]||latestRequest;
  return{
    schema:PLAN_SCHEMA,id:uid('weave'),title:titleFor(turns,signals),wish,latestRequest,
    outcome:outcomeFor(signals),state:'review',createdAt,updatedAt:createdAt,
    sourceConversation:turns,signals,
    assumptions:[
      signals.book?'The requested artifact is a book or manuscript, not a game.':signals.game?'The first milestone is a playable proof of the mechanic, not a complete game.':'The latest user turn is the governing request for this draft.',
      signals.selfLove?'This is a supportive skill-building route, not a diagnosis or substitute for professional care.':signals.collective?'The people involved can revise roles and commitments before activation.':'The route remains editable before activation.',
      'Progress evidence is for reflection and adjustment, not for proving personal worth.'
    ],
    paths:paths.slice(0,3),governance:governanceLayer(signals),requiresExplicitActivation:true,
    reviewOptions:['Revise the governing intention','Remove or reorder a path','Edit assumptions or completion criteria','Activate only after the Quest feels usable'],
    routing:{system:'civweave',room:context?.routingAnswer?.room||'civweave.quad',mode:'Plan'}
  };
}

function savedItems(){const value=parse(localStorage.getItem(INTENTIONS_KEY),[]);return Array.isArray(value)?value:[]}
function persist(plan){
  const items=savedItems();const fingerprint=lower(`${plan.title}|${plan.wish}`).slice(0,500);
  const duplicate=items.find(item=>item?.kind==='weave-plan'&&item?.fingerprint===fingerprint&&item?.state!=='completed');
  const now=new Date().toISOString();
  if(duplicate){
    plan.id=duplicate.id;plan.createdAt=duplicate.plan?.createdAt||duplicate.createdAt||plan.createdAt;plan.updatedAt=now;
    duplicate.plan=plan;duplicate.text=plan.title;duplicate.state='review';duplicate.done=false;duplicate.updatedAt=now;
    localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items.slice(0,100)));dispatchChanged(items);return duplicate;
  }
  const item={id:plan.id,kind:'weave-plan',fingerprint,text:plan.title,state:'review',done:false,createdAt:plan.createdAt,updatedAt:plan.updatedAt,plan};
  items.unshift(item);localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items.slice(0,100)));dispatchChanged(items);return item;
}

function restore(plan){
  if(!plan?.id)return null;
  const items=savedItems();const existing=items.find(item=>item?.id===plan.id||item?.plan?.id===plan.id);if(existing)return existing;
  const restored=structuredClone(plan);restored.state=restored.state||'review';
  const item={id:restored.id,kind:'weave-plan',fingerprint:lower(`${restored.title}|${restored.wish}`).slice(0,500),text:restored.title||'Restored Quest',state:restored.state,done:false,createdAt:restored.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),plan:restored};
  items.unshift(item);localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items.slice(0,100)));dispatchChanged(items);return item;
}

function format(plan){
  const paths=(plan.paths||[]).map((path,index)=>[`${index+1}. ${path.title} · ${path.realm}`,path.purpose,`First step: ${path.steps?.[0]||'Define the first checkpoint.'}`,`Completion: ${path.completionCriteria||'Define visible completion evidence.'}`].join('\n')).join('\n\n');
  const governance=plan.governance?`\n\nConsent layer · ${plan.governance.realm}\n${plan.governance.purpose}`:'';
  return[`I built and saved a reviewable Quest for “${plan.title}.”`,'','Governing outcome',plan.outcome,'',paths,governance,'','The Quest is in REVIEW. Inspect, revise, or explicitly activate it with the controls below.'].join('\n').trim();
}

function maybeCreate({text,history,context,force=false}={}){
  if(!shouldCreate({text,history,context,force}))return null;
  const built=buildPlan({text,history,context});const item=persist(built);const plan=item.plan;
  const approvalGate={kind:'intention-activation',planId:item.id,state:item.state||'review',required:true,actions:['review','revise','activate']};
  return{item,plan,response:{answer:format(plan),choice:{mode:'Plan',system:'civweave',room:plan.routing.room,nextAction:'Review, revise, or activate the saved Quest.'},assumptions:plan.assumptions,requiresConsent:true,confidence:.97,approvalGate}};
}

globalThis.CivweaveIntentionPlanner={schema:PLAN_SCHEMA,triggers:{explicit:EXPLICIT_PLAN_TRIGGER,wish:WISH_TRIGGER,direct:DIRECT_INTENTION_TRIGGER,retry:RETRY_TRIGGER,correction:CORRECTION_TRIGGER},shouldCreate,activeIntentionTurns,buildPlan,maybeCreate,persist,restore,format};
})();