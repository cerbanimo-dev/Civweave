(()=>{
'use strict';
const INTENTIONS_KEY='commonweave.intentions.v127';
const PLAN_SCHEMA='commonweave.intention-weave.v1';
const PLAN_TRIGGER=/\b(plan|roadmap|routine|program|curriculum|pathway|steps|practice schedule|daily practice|weekly practice)\b|\bteach me\b|\bhelp me learn\b|\bbuild me\b|\bmake me\b|\bcreate (?:me )?(?:a )?plan\b/i;
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const clean=value=>String(value==null?'':value).trim();
const lower=value=>clean(value).toLowerCase();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const has=(text,pattern)=>pattern.test(text);

function userTurns(history,text){
  const turns=(Array.isArray(history)?history:[]).filter(item=>item?.role==='user').map(item=>clean(item.text||item.content)).filter(Boolean);
  const latest=clean(text);
  if(latest&&turns.at(-1)!==latest)turns.push(latest);
  return turns.slice(-12);
}
function detectSignals(transcript){
  const text=lower(transcript);
  return {
    selfLove:has(text,/self[- ]?(love|compassion|kindness|acceptance)|love myself|care for myself|caring for myself/),
    boundaries:has(text,/boundar|not being touched|touch(?:ed|ing)?|physical contact|personal space|clear intentions|permission|consent/),
    communication:has(text,/clear communication|mislead|transparent|hard[- ]to[- ]process|emotional struggle|peer|honest communication|clarity/),
    learning:has(text,/learn|teach|understand|study|practice|skill|curriculum|lesson|reflect/),
    doing:has(text,/build|make|create|plan|routine|daily|weekly|practice|script|rehearse|check[- ]?in|habit|do|implement/),
    material:has(text,/material|resource|suppl|tool|equipment|space|transport|storage|food source|garden|pantry|boards|trailer|money|budget/),
    collective:has(text,/friend|peer|group|community|neighbor|network|mutual aid|together|shared/),
    governance:has(text,/agreement|consent|boundary|touch|peer|group|community|rule|policy|decision|approval|responsibilit/),
    food:has(text,/food|garden|pantry|grow|produce|meal|kitchen|farm/)
  };
}
function titleFor(turns,signals){
  if(signals.selfLove)return 'Build a practice of self-love, clear boundaries, and protected connection';
  if(signals.collective&&signals.food)return 'Create a mutual-aid and local-food pilot with trusted peers';
  const last=turns.at(-1)||'Move this intention forward';
  return last.replace(/^(build|make|create|give|show)\s+me\s+(a\s+)?plan\s+(to|for)?\s*/i,'').replace(/[.!?]+$/,'').trim()||'Move this intention forward';
}
function outcomeFor(signals){
  if(signals.selfLove)return 'Develop a repeatable way to care for yourself, communicate physical and emotional boundaries clearly, and recognize relationships that respect those boundaries.';
  if(signals.collective&&signals.food)return 'Launch one maintainable mutual-aid food pilot with explicit roles, trusted exchange conditions, and a review date.';
  return 'Turn the stated wish into a usable sequence with visible evidence of progress and an editable route.';
}
function learningPath(signals){
  if(signals.selfLove){
    return {
      id:uid('learning'),type:'learning',realm:'living-school',title:'Learn self-compassion and boundary literacy',
      purpose:'Build language and recognition skills for self-kindness, consent, physical boundaries, emotional capacity, and clear peer communication.',
      steps:[
        'Notice one recurring self-critical thought and rewrite it as a factual, non-punishing observation.',
        'Learn the difference between a preference, a boundary, a request, consent, and a consequence.',
        'Identify bodily and emotional signals that indicate comfort, uncertainty, pressure, or overload.',
        'Study one clear-communication pattern: observation, need, boundary, request, and response.'
      ],
      completionCriteria:'You can describe your needs without insulting yourself, state a boundary in plain language, and distinguish explicit consent from assumption or pressure.',
      evidence:['A one-page self-compassion and boundary reference','Three written examples of clear boundary language','A short reflection on what respectful peer communication feels like'],status:'draft'
    };
  }
  if(signals.collective&&signals.food){
    return {
      id:uid('learning'),type:'learning',realm:'living-school',title:'Learn the minimum skills for the food pilot',
      purpose:'Identify only the food-safety, growing, preservation, organizing, or cooperative skills required by the selected pilot.',
      steps:['Choose the first pilot and list its knowledge risks.','Assign one learning question to each participant.','Practice the highest-risk skill before launch.'],
      completionCriteria:'The group can safely run the pilot for one cycle and knows which questions still need expert help.',
      evidence:['A shared skill map','One completed practice run','A short safety and escalation checklist'],status:'draft'
    };
  }
  return {
    id:uid('learning'),type:'learning',realm:'living-school',title:'Learn what the intention requires',purpose:'Convert uncertainty into a compact learning progression tied to a real task.',
    steps:['Name the real-world task the learning should unlock.','Separate what is already known from what must be practiced.','Complete one guided example.','Demonstrate the skill on a fresh example.'],
    completionCriteria:'The skill can be demonstrated independently in the intended context.',evidence:['A completed practice example','A fresh demonstration','A note describing remaining uncertainty'],status:'draft'
  };
}
function skilledPath(signals){
  if(signals.selfLove){
    return {
      id:uid('skilled'),type:'skilled-labor',realm:'cerbanimo',title:'Practice self-care and boundary communication',
      purpose:'Turn reflection into repeatable actions that can be rehearsed, observed, and revised without treating emotional growth as a productivity contest.',
      steps:[
        'Create a five-minute daily check-in: body state, emotional capacity, current need, and one kind action.',
        'Draft three boundary scripts: declining touch, asking for clear intentions, and pausing an emotionally difficult conversation.',
        'Rehearse each script alone or with a trusted person who has agreed to practice respectfully.',
        'Run a weekly review that records what protected your energy and what created pressure.'
      ],
      completionCriteria:'You can use at least one boundary script in a real or rehearsed situation and recover from the interaction without abandoning your stated need.',
      evidence:['Seven brief self-check-ins','Three boundary scripts','One rehearsal or real-use reflection','One weekly adjustment'],status:'draft'
    };
  }
  if(signals.collective&&signals.food){
    return {
      id:uid('skilled'),type:'skilled-labor',realm:'cerbanimo',title:'Launch one local-food mutual-aid pilot',
      purpose:'Build the smallest physical or operational version that can prove the group will maintain it.',
      steps:['Select one pilot: produce exchange, shared pantry, buying club, garden plot, or meal rotation.','Name an owner for setup, coordination, and maintenance.','Run one complete cycle with a deliberately small participant group.','Review failures and decide whether to repeat, revise, or stop.'],
      completionCriteria:'One complete pilot cycle occurs with named responsibilities and a documented decision about the next cycle.',
      evidence:['Pilot checklist','Participation record','Photos or inventory notes','Post-cycle review'],status:'draft'
    };
  }
  return {
    id:uid('skilled'),type:'skilled-labor',realm:'cerbanimo',title:'Turn the intention into practiced work',purpose:'Create a quest with checkpoints and visible proof rather than leaving the intention at the level of reflection.',
    steps:['Define the smallest observable result.','Create a short sequence of checkpoints.','Complete the first checkpoint with available tools.','Review evidence and revise the remaining quest.'],
    completionCriteria:'A visible result exists and the next checkpoint is based on evidence rather than guesswork.',evidence:['Starting-state record','Checkpoint evidence','Completion or revision note'],status:'draft'
  };
}
function materialPath(signals){
  if(!signals.material)return null;
  if(signals.collective&&signals.food){
    return {
      id:uid('material'),type:'material-acquirement',realm:'fellowfare',title:'Map food sources, tools, transport, and storage',
      purpose:'Make needs and offers specific enough for fair matching without treating goodwill as infinite capacity.',
      steps:['List available food sources, spaces, tools, transport, storage, and labor.','Separate donations, borrowing, purchase, and reciprocal exchange.','State quantity, condition, timing, pickup, return, and trust requirements.','Match the first pilot only, not every future need.'],
      completionCriteria:'The first pilot has the required materials and every borrowed or shared resource has an explicit return or maintenance agreement.',
      evidence:['Needs-and-offers map','Confirmed source list','Borrowing or exchange agreements'],status:'draft'
    };
  }
  return {
    id:uid('material'),type:'material-acquirement',realm:'fellowfare',title:'Acquire the missing resources',purpose:'Turn vague material needs into fair, specific requests and offers.',
    steps:['List required quantities and acceptable conditions.','Mark what can be borrowed, traded, purchased, repaired, or substituted.','Publish or share one precise need card.','Confirm logistics and return conditions before accepting.'],
    completionCriteria:'The next work checkpoint has the required materials with clear ownership and logistics.',evidence:['Need cards','Confirmed matches','Pickup or return record'],status:'draft'
  };
}
function governanceLayer(signals){
  if(!(signals.governance||signals.collective))return null;
  if(signals.selfLove){
    return {
      realm:'anarchadia',title:'Personal consent and peer-communication agreements',
      purpose:'Protect agency while making relational expectations understandable to trusted peers.',
      agreements:[
        'Physical touch requires explicit, current consent; familiarity does not substitute for permission.',
        'Intentions are stated plainly before emotionally or physically intimate interaction.',
        'Either person may pause a conversation when emotional processing exceeds their capacity.',
        'Confusion, misleading information, or changing expectations are surfaced directly rather than left as social tests.',
        'A boundary does not require punishment, debate, or a complete explanation to be valid.'
      ],
      reviewQuestion:'Which agreements belong only to you, and which should be explicitly shared with peers?',status:'draft'
    };
  }
  return {
    realm:'anarchadia',title:'Participation and consent agreement',purpose:'Clarify who is affected, what participation asks, and how people can revise or leave commitments.',
    agreements:['State the shared purpose in one sentence.','Name roles and realistic time commitments.','Use explicit consent for spending, publishing, voting, or assigning work.','Provide an objection and exit path.','Set a review date.'],
    reviewQuestion:'Who must explicitly agree before the first pilot becomes active?',status:'draft'
  };
}
function buildPlan({text,history,context={}}){
  const turns=userTurns(history,text),transcript=turns.join('\n'),signals=detectSignals(transcript),paths=[];
  if(signals.learning||signals.selfLove||signals.food)paths.push(learningPath(signals));
  if(signals.doing||PLAN_TRIGGER.test(text)||signals.selfLove)paths.push(skilledPath(signals));
  const material=materialPath(signals);if(material)paths.push(material);
  if(!paths.length)paths.push(learningPath(signals),skilledPath(signals));
  const selected=paths.slice(0,3),title=titleFor(turns,signals),createdAt=new Date().toISOString();
  return {
    schema:PLAN_SCHEMA,id:uid('weave'),title,wish:turns[0]||clean(text),latestRequest:clean(text),outcome:outcomeFor(signals),state:'review',createdAt,updatedAt:createdAt,
    sourceConversation:turns,assumptions:[
      signals.selfLove?'The plan treats self-love as a learnable and practicable relationship with yourself, not a demand to feel positive at all times.':'The latest request asks for a reviewable plan rather than another reflective response.',
      signals.boundaries?'Physical and relational boundaries are treated as safety and agency requirements.':'The person can revise the route before activation.',
      'Progress evidence is for reflection and adjustment, not for proving personal worth.'
    ],
    paths:selected,governance:governanceLayer(signals),requiresExplicitActivation:true,
    reviewOptions:['Revise the governing intention','Remove a path','Move a path earlier or later','Edit assumptions or completion criteria','Activate only after the plan feels usable'],
    routing:{system:'commonweave',room:context?.routingAnswer?.room||'commonweave.quad',mode:'Plan'}
  };
}
function persist(plan){
  const saved=parse(localStorage.getItem(INTENTIONS_KEY),[]),items=Array.isArray(saved)?saved:[];
  const fingerprint=lower(`${plan.title}|${plan.wish}`).slice(0,500);
  const duplicate=items.find(item=>item?.kind==='weave-plan'&&item?.fingerprint===fingerprint&&item?.state!=='completed');
  if(duplicate){duplicate.plan=plan;duplicate.text=plan.title;duplicate.state='review';duplicate.updatedAt=new Date().toISOString();localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items));return duplicate}
  const item={id:plan.id,kind:'weave-plan',fingerprint,text:plan.title,state:'review',done:false,createdAt:plan.createdAt,updatedAt:plan.updatedAt,plan};
  items.unshift(item);localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items.slice(0,100)));return item;
}
function format(plan){
  const pathText=plan.paths.map((path,index)=>`${index+1}. ${path.title} · ${path.realm}\n${path.purpose}\nFirst step: ${path.steps[0]}`).join('\n\n');
  const governance=plan.governance?`\n\nConsent layer · ${plan.governance.realm}\n${plan.governance.purpose}\nReview question: ${plan.governance.reviewQuestion}`:'';
  return `You asked for a plan, so I turned the conversation into a reviewable weave instead of another reflection.\n\nGoverning intention\n${plan.outcome}\n\n${pathText}${governance}\n\nThis plan is saved in Intentions as REVIEW, not active. You can remove or reorder paths and revise assumptions before activation.`;
}
function maybeCreate({text,history,context}={}){
  if(!PLAN_TRIGGER.test(clean(text)))return null;
  const plan=buildPlan({text,history,context});persist(plan);
  return {
    plan,
    response:{answer:format(plan),choice:{mode:'Plan',system:'commonweave',room:plan.routing.room,nextAction:'Open Intentions, review the weave, remove or reorder paths, and explicitly activate it when it feels usable.'},assumptions:plan.assumptions,requiresConsent:true,confidence:.96}
  };
}
globalThis.CommonweaveIntentionPlanner={schema:PLAN_SCHEMA,trigger:PLAN_TRIGGER,buildPlan,maybeCreate,persist,format};
})();
