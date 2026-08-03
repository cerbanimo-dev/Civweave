(()=>{
'use strict';

const INTENTIONS_KEY='commonweave.intentions.v127';
const PLAN_SCHEMA='commonweave.intention-weave.v1';
const EXPLICIT_PLAN_TRIGGER=/\b(plan|roadmap|routine|program|curriculum|pathway|steps|practice schedule|daily practice|weekly practice|reviewable weave|set (?:an )?intention)\b|\bteach me\b|\bhelp me learn\b|\bcreate (?:me )?(?:a )?plan\b/i;
const WISH_TRIGGER=/\b(i want|i wish|my wish|my goal|we want|we wish|let'?s|help me)\b[\s\S]{0,80}\b(make|build|create|learn|start|organize|find|change|improve|design|develop)\b/i;
const RETRY_TRIGGER=/\b(retry|try again|one more time|rebuild|build that again|redo)\b/i;

const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const clean=value=>String(value==null?'':value).trim();
const lower=value=>clean(value).toLowerCase();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const has=(text,pattern)=>pattern.test(text);

function dispatchChanged(items){
  try{dispatchEvent(new CustomEvent('commonweave:intentions-changed',{detail:{items}}))}catch{}
}

function userTurns(history,text){
  const turns=(Array.isArray(history)?history:[])
    .filter(item=>item?.role==='user')
    .map(item=>clean(item.text||item.content))
    .filter(Boolean);
  const latest=clean(text);
  if(latest&&turns.at(-1)!==latest)turns.push(latest);
  return turns.slice(-16);
}

function detectSignals(transcript){
  const text=lower(transcript);
  return{
    learning:has(text,/\b(learn|teach|understand|study|practice|skill|curriculum|lesson|research|explain)\b/),
    doing:has(text,/\b(build|make|create|design|develop|implement|prototype|repair|fix|ship|practice|organize|launch)\b/),
    material:has(text,/\b(material|resource|suppl|tool|equipment|space|transport|storage|food|meal|budget|money|inventory|borrow|buy|trade)\b/),
    collective:has(text,/\b(friend|friends|team|peer|group|community|neighbor|network|together|shared|collaborat)\b/),
    governance:has(text,/\b(agreement|consent|boundary|rule|policy|decision|approval|responsibilit|proposal|vote|automation)\b/),
    food:has(text,/\b(food|meal|dinner|garden|pantry|produce|kitchen|farm|hungry)\b/),
    game:has(text,/\b(game|gameplay|player|playable|level design|game design|video game|tabletop)\b/),
    timeLoop:has(text,/\b(time loop|time looper|looping time|reset(?:s|ting)? time|repeated timeline|timeline loop)\b/),
    timeTravel:has(text,/\b(time travel|time traveler|time traveller|chrononaut|alternate timeline|future self|past self)\b/)
  };
}

function meaningfulPriorWish(turns){
  return turns.slice(0,-1).some(turn=>WISH_TRIGGER.test(turn)||/\b(my goal|my wish|i want|we want|let'?s make|let'?s build)\b/i.test(turn));
}

function currentSystem(context={}){
  return clean(context?.currentContext?.systemId||context?.guide?.system||context?.routingAnswer?.system||'commonweave');
}

function shouldCreate({text,history,context,force=false}={}){
  if(force)return true;
  if(currentSystem(context)!=='commonweave')return false;
  const value=clean(text);
  if(!value)return false;
  if(EXPLICIT_PLAN_TRIGGER.test(value)||WISH_TRIGGER.test(value))return true;
  const turns=userTurns(history,value);
  return RETRY_TRIGGER.test(value)&&meaningfulPriorWish(turns);
}

function titleFor(turns,signals){
  if(signals.game&&signals.timeLoop&&signals.timeTravel)return'Build a game where a time looper faces a time traveler';
  if(signals.game)return'Prototype the game concept as a playable vertical slice';
  if(signals.collective&&signals.food)return'Launch a small shared-food pilot';
  const candidate=turns.find(turn=>WISH_TRIGGER.test(turn))||turns.at(-1)||'Move this intention forward';
  return candidate
    .replace(/^(okay|ok|so|please)\s+/i,'')
    .replace(/^(i want|i wish|we want|we wish|let'?s|help me)\s+(to\s+)?/i,'')
    .replace(/[.!?]+$/,'')
    .trim()||'Move this intention forward';
}

function outcomeFor(signals){
  if(signals.game&&signals.timeLoop&&signals.timeTravel){
    return'Create a playable vertical slice where the looper and traveler have mechanically different relationships to time, one complete loop can be played, and at least one consequence persists across a reset.';
  }
  if(signals.game)return'Create a playable vertical slice that proves the core decision, feedback loop, and emotional promise before the project expands.';
  if(signals.collective&&signals.food)return'Run one maintainable shared-food cycle with explicit roles, concrete logistics, and a review date.';
  return'Turn the stated wish into an editable route with visible evidence of progress and a clear next checkpoint.';
}

function learningPath(signals){
  if(signals.game){
    return{
      id:uid('learning'),
      type:'learning',
      realm:'living-school',
      title:signals.timeLoop&&signals.timeTravel?'Define the temporal rules and dramatic collision':'Define the game’s core rule and player experience',
      purpose:signals.timeLoop&&signals.timeTravel
        ?'Make the looper and traveler mechanically distinct by defining what each remembers, changes, risks, and cannot control.'
        :'Turn the concept into explicit design rules before lore and content multiply.',
      steps:signals.timeLoop&&signals.timeTravel?[
        'Define the looper in one sentence: what resets, what persists, and what ends a loop.',
        'Define the traveler in one sentence: how they cross time and what they cannot change.',
        'Map the first encounter from both characters’ perspectives.',
        'Choose one consequence that survives a reset and forces a strategy change.'
      ]:[
        'State the player fantasy and central decision in one sentence each.',
        'Define the smallest repeatable gameplay loop.',
        'List what persists between attempts.',
        'Choose the emotion the vertical slice should leave behind.'
      ],
      completionCriteria:'Another person can explain what the player repeatedly does, why the two roles differ, and why one choice matters.',
      evidence:['One-page rules sheet','Core-loop diagram','First-encounter beat map','Three player-comprehension questions'],
      status:'draft'
    };
  }
  if(signals.collective&&signals.food){
    return{
      id:uid('learning'),
      type:'learning',
      realm:'living-school',
      title:'Learn the minimum skills for the first food cycle',
      purpose:'Identify only the safety, logistics, coordination, or preservation knowledge required by the selected pilot.',
      steps:['Choose the first pilot and list its knowledge risks.','Assign one learning question to each participant.','Practice the highest-risk skill before launch.'],
      completionCriteria:'The group can safely run one cycle and knows what still needs expert help.',
      evidence:['Shared skill map','Practice run','Safety and escalation checklist'],
      status:'draft'
    };
  }
  return{
    id:uid('learning'),
    type:'learning',
    realm:'living-school',
    title:'Learn what the intention requires',
    purpose:'Convert uncertainty into a compact learning progression tied to a real task.',
    steps:['Name the real-world task the learning should unlock.','Separate what is already known from what must be practiced.','Complete one guided example.','Demonstrate the skill on a fresh example.'],
    completionCriteria:'The skill can be demonstrated independently in the intended context.',
    evidence:['Guided example','Fresh demonstration','Remaining-uncertainty note'],
    status:'draft'
  };
}

function skilledPath(signals){
  if(signals.game){
    return{
      id:uid('skilled'),
      type:'skilled-labor',
      realm:'cerbanimo',
      title:signals.timeLoop&&signals.timeTravel?'Build the first playable loop and timeline collision':'Build the first playable vertical slice',
      purpose:'Turn the rules into a small playable artifact before art, lore, and scope multiply.',
      steps:signals.timeLoop&&signals.timeTravel?[
        'Prototype one room or encounter that resets in under three minutes.',
        'Implement one visible carryover for the looper.',
        'Introduce the traveler as an interruption that changes one expected event.',
        'Add one choice whose consequence remains legible after reset.',
        'Run three playtests focused on whether players understand who can change what in time.'
      ]:[
        'Prototype the smallest complete gameplay loop.',
        'Add one meaningful choice and immediate feedback.',
        'Create a beginning, playable middle, and stopping point.',
        'Run three playtests and revise the most confusing rule.'
      ],
      completionCriteria:'A player can complete the slice, explain the core loop, and identify why one choice mattered.',
      evidence:['Playable build','Capture of one complete run','Three playtest notes','Revision log'],
      status:'draft'
    };
  }
  if(signals.collective&&signals.food){
    return{
      id:uid('skilled'),
      type:'skilled-labor',
      realm:'cerbanimo',
      title:'Run the first shared-food cycle',
      purpose:'Build the smallest operational version that can prove the group will maintain it.',
      steps:['Select one pilot.','Name owners for setup, coordination, and maintenance.','Run one complete cycle with a small group.','Review failures and decide whether to repeat, revise, or stop.'],
      completionCriteria:'One complete cycle occurs with named responsibilities and a documented next decision.',
      evidence:['Pilot checklist','Participation record','Inventory or photo notes','Post-cycle review'],
      status:'draft'
    };
  }
  return{
    id:uid('skilled'),
    type:'skilled-labor',
    realm:'cerbanimo',
    title:'Turn the intention into practiced work',
    purpose:'Create checkpoints and visible proof rather than leaving the intention at reflection.',
    steps:['Define the smallest observable result.','Create a short checkpoint sequence.','Complete the first checkpoint with available tools.','Review evidence and revise the remaining quest.'],
    completionCriteria:'A visible result exists and the next checkpoint is based on evidence.',
    evidence:['Starting-state record','Checkpoint evidence','Completion or revision note'],
    status:'draft'
  };
}

function materialPath(signals){
  if(!signals.material)return null;
  return{
    id:uid('material'),
    type:'material-acquirement',
    realm:'fellowfare',
    title:signals.food?'Secure the food, tools, transport, and storage for the first cycle':'Acquire the missing resources',
    purpose:'Turn vague needs into fair, specific requests and offers.',
    steps:['List required quantities and acceptable conditions.','Mark what can be borrowed, traded, purchased, repaired, or substituted.','Create one precise need card.','Confirm logistics, ownership, and return conditions.'],
    completionCriteria:'The next work checkpoint has the required resources with clear logistics and ownership.',
    evidence:['Needs-and-offers map','Confirmed source list','Pickup or return record'],
    status:'draft'
  };
}

function governanceLayer(signals){
  if(!(signals.governance||signals.collective))return null;
  return{
    realm:'anarchadia',
    title:'Participation and consent agreement',
    purpose:'Clarify who is affected, what participation asks, and how commitments can be revised or left.',
    agreements:[
      'State the shared purpose in one sentence.',
      'Name roles and realistic time commitments.',
      'Use explicit consent for spending, publishing, voting, or assigning work.',
      'Provide an objection and exit path.',
      'Set a review date.'
    ],
    reviewQuestion:'Who must explicitly agree before this intention becomes active?',
    status:'draft'
  };
}

function buildPlan({text,history,context={}}={}){
  const turns=userTurns(history,text);
  const transcript=turns.join('\n');
  const signals=detectSignals(transcript);
  const paths=[];
  if(signals.learning||signals.game||signals.food)paths.push(learningPath(signals));
  if(signals.doing||signals.game||EXPLICIT_PLAN_TRIGGER.test(clean(text)))paths.push(skilledPath(signals));
  const material=materialPath(signals);
  if(material)paths.push(material);
  if(!paths.length)paths.push(learningPath(signals),skilledPath(signals));
  const createdAt=new Date().toISOString();
  return{
    schema:PLAN_SCHEMA,
    id:uid('weave'),
    title:titleFor(turns,signals),
    wish:turns.find(turn=>WISH_TRIGGER.test(turn))||turns[0]||clean(text),
    latestRequest:clean(text),
    outcome:outcomeFor(signals),
    state:'review',
    createdAt,
    updatedAt:createdAt,
    sourceConversation:turns,
    signals,
    assumptions:[
      signals.game?'The first milestone is a playable proof of the temporal mechanic, not a complete game.':'The latest request asks for a reviewable route rather than another reflective response.',
      signals.collective?'The people involved can revise roles and commitments before activation.':'The route remains editable before activation.',
      'Progress evidence is for reflection and adjustment, not for proving personal worth.'
    ],
    paths:paths.slice(0,3),
    governance:governanceLayer(signals),
    requiresExplicitActivation:true,
    reviewOptions:['Revise the governing intention','Remove or reorder a path','Edit assumptions or completion criteria','Activate only after the weave feels usable'],
    routing:{system:'commonweave',room:context?.routingAnswer?.room||'commonweave.quad',mode:'Plan'}
  };
}

function savedItems(){
  const value=parse(localStorage.getItem(INTENTIONS_KEY),[]);
  return Array.isArray(value)?value:[];
}

function persist(plan){
  const items=savedItems();
  const fingerprint=lower(`${plan.title}|${plan.wish}`).slice(0,500);
  const duplicate=items.find(item=>item?.kind==='weave-plan'&&item?.fingerprint===fingerprint&&item?.state!=='completed');
  const now=new Date().toISOString();
  if(duplicate){
    plan.id=duplicate.id;
    plan.createdAt=duplicate.plan?.createdAt||duplicate.createdAt||plan.createdAt;
    plan.updatedAt=now;
    duplicate.plan=plan;
    duplicate.text=plan.title;
    duplicate.state='review';
    duplicate.done=false;
    duplicate.updatedAt=now;
    localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items.slice(0,100)));
    dispatchChanged(items);
    return duplicate;
  }
  const item={
    id:plan.id,
    kind:'weave-plan',
    fingerprint,
    text:plan.title,
    state:'review',
    done:false,
    createdAt:plan.createdAt,
    updatedAt:plan.updatedAt,
    plan
  };
  items.unshift(item);
  localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items.slice(0,100)));
  dispatchChanged(items);
  return item;
}

function restore(plan){
  if(!plan?.id)return null;
  const items=savedItems();
  const existing=items.find(item=>item?.id===plan.id||item?.plan?.id===plan.id);
  if(existing)return existing;
  const restored=structuredClone(plan);
  restored.state=restored.state||'review';
  const item={
    id:restored.id,
    kind:'weave-plan',
    fingerprint:lower(`${restored.title}|${restored.wish}`).slice(0,500),
    text:restored.title||'Restored intention weave',
    state:restored.state,
    done:false,
    createdAt:restored.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    plan:restored
  };
  items.unshift(item);
  localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items.slice(0,100)));
  dispatchChanged(items);
  return item;
}

function format(plan){
  const paths=(plan.paths||[]).map((path,index)=>[
    `${index+1}. ${path.title} · ${path.realm}`,
    path.purpose,
    `First step: ${path.steps?.[0]||'Define the first checkpoint.'}`,
    `Completion: ${path.completionCriteria||'Define visible completion evidence.'}`
  ].join('\n')).join('\n\n');
  const governance=plan.governance?`\n\nConsent layer · ${plan.governance.realm}\n${plan.governance.purpose}`:'';
  return[
    `I built and saved a reviewable weave for “${plan.title}.”`,
    '',
    'Governing outcome',
    plan.outcome,
    '',
    paths,
    governance,
    '',
    'The weave is in REVIEW. Inspect, revise, or explicitly activate it with the controls below.'
  ].join('\n').trim();
}

function maybeCreate({text,history,context,force=false}={}){
  if(!shouldCreate({text,history,context,force}))return null;
  const built=buildPlan({text,history,context});
  const item=persist(built);
  const plan=item.plan;
  const approvalGate={
    kind:'intention-activation',
    planId:item.id,
    state:item.state||'review',
    required:true,
    actions:['review','revise','activate']
  };
  return{
    item,
    plan,
    response:{
      answer:format(plan),
      choice:{mode:'Plan',system:'commonweave',room:plan.routing.room,nextAction:'Review, revise, or activate the saved weave.'},
      assumptions:plan.assumptions,
      requiresConsent:true,
      confidence:.97,
      approvalGate
    }
  };
}

globalThis.CommonweaveIntentionPlanner={
  schema:PLAN_SCHEMA,
  triggers:{explicit:EXPLICIT_PLAN_TRIGGER,wish:WISH_TRIGGER,retry:RETRY_TRIGGER},
  shouldCreate,
  buildPlan,
  maybeCreate,
  persist,
  restore,
  format
};
})();