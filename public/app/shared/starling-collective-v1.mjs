/**
 * Native, side-effect-free policy for the optional Starling Collective Guild service.
 * Source persona definitions are ported from Starling Studio v0.3.2.
 * State and authority remain with Civweave's existing Guild/Quest/governance owners.
 * Do not call these pure functions with unverified model-supplied membership claims.
 */
export const STARLING_COLLECTIVE_SCHEMA = 'civweave.starling-collective.v1';

const cast = {
  aphra: {name:'Aphra', role:'Anarchist · Satirist', color:'#c98db5', identity:'fictional Black trans woman', style:'dry, jaded, sharp, quick; exposes power and hypocrisy with concise wit', wiring:'Adversarial pattern recognition: ask who holds power, whose consent is missing, what is absurd', goal:'Create revealing satire without punching down'},
  jae: {name:'Jae', role:'Progressive Liberal · Explainer', color:'#9bbbd5', identity:'fictional white nonbinary AMAB person', style:'patient, earnest, specific, occasionally over-explains', wiring:'Coalition and feasibility analysis: look for shared interests and achievable institutional change', goal:'Explain practical paths without erasing disagreements'},
  anthony: {name:'Anthony', role:'Indigenous Liberation · Philosopher', color:'#98bf8a', identity:'fictional Native American transmasculine person', style:'energetic, clever, argument-driven, questioning and open to revision', wiring:'Iterative conviction: provisional claim, strongest counterargument, confidence update, next action', goal:'Advance grounded reasoning and respect sovereignty; never claim tribal authority'},
  rosa: {name:'Rosa', role:'Democratic Socialist · Labor Organizer', color:'#d6907e', identity:'fictional Mexican-American union organizer', style:'direct, grounded, tactical and impatient with empty speeches', wiring:'Material analysis: work, resources, ownership, time, collective leverage', goal:'Turn ideas into feasible tasks and fair collective labor'},
  sana: {name:'Sana', role:'Disability Justice · Care', color:'#80b9ae', identity:'fictional disabled South Asian American woman', style:'gentle questions, strong conclusions, warm and unsentimental', wiring:'Relational analysis: accessibility, exclusion, fatigue, who is missing', goal:'Make art and experiences accessible and welcoming'},
  kit: {name:'Kit', role:'Eco-Socialist · Maker', color:'#e4b76e', identity:'fictional Appalachian maker', style:'excited, informal, visual thinker; prototypes before debating', wiring:'Spatial and systems reasoning: break down objects into materials, steps, dependencies, tests', goal:'Build interactive worlds and reusable creative assets'},
  farah: {name:'Farah', role:'Civil Libertarian Socialist · Researcher', color:'#a7a3db', identity:'fictional Palestinian-American journalist', style:'precise, measured, dry corrective humor', wiring:'Source provenance: distinguish confirmed facts, allegations, interpretations, and guesses', goal:'Keep news-inspired work accurate, sourced, and clearly labeled'},
  kami: {name:'Kami', role:'Executive · Catalytic Spirit', color:'#ec927a', identity:'fictional genderless spirit of change', style:'urgent, kind, anti-hierarchical, syndicalist, furious at cruelty but fact-grounded', wiring:'Synthesis to action: turn moral urgency and disagreement into projects and audited outcomes', goal:'Create or advance an observable project on each executive turn, and delegate coding when useful'}
};
export const STARLING_PERSONAS = Object.freeze(Object.fromEntries(Object.entries(cast).map(([id,persona]) => [id,Object.freeze({...persona,id,isHumanGuildMember:false})])));
const plain = value => typeof value === 'string' ? value.trim() : '';
const id = value => plain(value).slice(0,160);
const intention = row => row && typeof row === 'object' && id(row.id) && plain(row.title) && plain(row.goal) ? Object.freeze({id:id(row.id),title:plain(row.title).slice(0,240),goal:plain(row.goal).slice(0,4000)}) : null;

/** Only a verified human-members-only ratification from the canonical governance owner can supersede the Guildkeeper's founding Intention. */
export function resolveCollectiveIntention({guildId, foundingIntention, ratification, verifyRatification}={}) {
  const guild=id(guildId);
  if (!guild) throw new TypeError('A trusted Guild identifier is required.');
  const baseline=intention(foundingIntention);
  if (!baseline) return Object.freeze({schema:STARLING_COLLECTIVE_SCHEMA,guildId:guild,source:'unconfigured',intention:null});
  const ratified=ratification && typeof ratification==='object'
    && id(ratification.guildId)===guild
    && ratification.status==='ratified'
    && ratification.electorate==='human-guild-members'
    && typeof verifyRatification==='function'
    && verifyRatification(ratification)===true
    && intention(ratification.intention);
  return Object.freeze({schema:STARLING_COLLECTIVE_SCHEMA,guildId:guild,source:ratified?'human-ratified':'founding-intention',intention:ratified?intention(ratification.intention):baseline});
}

const READY_STATES = new Set(['ready','open','todo','pending']);
/** Deterministic candidate discovery. An owner must verify provenance and perform actual task claims; this code never claims work. */
export function collectTaskCandidates({tasks=[],tools=[],verifyHumanAuthor,autoClaimSelected=false,verifyAutoClaimGrant,limit=50}={}) {
  if (!Array.isArray(tasks)||!Array.isArray(tools)||typeof verifyHumanAuthor!=='function') return [];
  const available=new Set(tools.filter(tool=>tool?.enabled===true && plain(tool.capability)).map(tool=>plain(tool.capability)));
  const result=[];
  for(const task of tasks.slice(0,500)) {
    if (!task || !id(task.id) || !READY_STATES.has(plain(task.state).toLowerCase()) || verifyHumanAuthor(task)!==true) continue;
    if (task.aiEligible===false || task.privacyRestricted===true || task.humanOnly===true) continue;
    const required=Array.isArray(task.requiredCapabilities)?task.requiredCapabilities.filter(x=>plain(x)):[];
    if (!required.length || !required.every(cap=>available.has(cap))) continue;
    const auto=autoClaimSelected===true && typeof verifyAutoClaimGrant==='function' && verifyAutoClaimGrant(task)===true;
    result.push(Object.freeze({taskId:id(task.id),action:auto?'eligible-for-claim':'offer',requiredCapabilities:Object.freeze([...required])}));
    if (result.length>=Math.min(100,Math.max(1,Math.floor(limit)||50))) break;
  }
  return result;
}

/** Preflight only: hosted inference must additionally reserve and settle via Civweave's existing metered service. */
export function collectiveGenerationGate({mode,dailyUsed,dailyLimit,quotedNeurons,remainingNeurons}={}) {
  if (mode==='local') return Object.freeze({allowed:true,chargeCloudNeurons:false,reason:'local-unmetered'});
  if (mode!=='hosted') return Object.freeze({allowed:false,chargeCloudNeurons:false,reason:'unknown-execution-mode'});
  const numbers=[dailyUsed,dailyLimit,quotedNeurons,remainingNeurons];
  if (!numbers.every(n=>Number.isSafeInteger(n)&&n>=0)||dailyLimit===0||quotedNeurons===0) return Object.freeze({allowed:false,chargeCloudNeurons:false,reason:'unverified-budget'});
  if (dailyUsed>=dailyLimit) return Object.freeze({allowed:false,chargeCloudNeurons:false,reason:'daily-collective-limit'});
  if (quotedNeurons>remainingNeurons) return Object.freeze({allowed:false,chargeCloudNeurons:false,reason:'shared-ai-budget-exhausted'});
  return Object.freeze({allowed:true,chargeCloudNeurons:true,reason:'eligible-for-reservation'});
}


/**
 * Founding Intention text is a Guildkeeper-authored directing goal, NOT a
 * completed or activated AI-authored Quest. The Quest owner materializes it.
 */
export function normalizeFoundingIntention(input) {
  if (typeof input !== 'string') throw new TypeError('Guild founding Intention must be text.');
  const text=input.trim();
  if (text.length<12 || text.length>4000) throw new RangeError('Guild founding Intention must be 12 to 4,000 characters.');
  return Object.freeze({schema:'civweave.guild-founding-intention.v1',text,status:'provisional',authorRole:'guildkeeper',reviewedQuestId:null});
}
const DONE=new Set(['done','completed','complete','delivered','verified','passed','accepted']);
const ACTIVE=new Set(['active','in-progress','working','started','proof-ready','review','revision']);
const BLOCKED=new Set(['blocked','failed','cancelled','canceled']);
const STEP_IDLE=new Set(['ready','open','pending','todo','not-started']);
/**
 * Read-only snapshot of the canonical published Guild Quest projection.
 * This is a *member-reported* progress view. It is never completion evidence
 * and the projection is not itself a place to write status.
 */
export function guildQuestBeatSnapshot({guildId,publications=[]}={}) {
  const guild=id(guildId);
  if(!guild)throw new TypeError('Guild identifier required.');
  const quests=[];
  for (const pub of Array.isArray(publications)?publications.slice(0,500):[]) {
    if(pub?.schema!=='civweave.guild-quest-publication.v1'||pub?.status!=='published'||pub.guildId!==guild||pub.quest?.kind!=='weave-plan'||pub.quest?.plan?.schema!=='civweave.intention-weave.v1')continue;
    const beatRows=[];
    for(const [pi,path] of (Array.isArray(pub.quest.plan.paths)?pub.quest.plan.paths:[]).entries()){
      const completed=new Set(Array.isArray(path?.progress)?path.progress:[]);
      const pathDone=DONE.has(plain(path?.status).toLowerCase());
      for(const [si,step] of (Array.isArray(path?.steps)?path.steps:[]).entries()) {
        const title=plain(typeof step==='string'?step:step?.title||step?.description);
        if(!title)continue;
        const reported=plain(typeof step==='string'?'':step?.status).toLowerCase();
        const status=(pathDone||completed.has(si)||DONE.has(reported))?'completed':(ACTIVE.has(reported)?'active':BLOCKED.has(reported)?'blocked':STEP_IDLE.has(reported)||!reported?'ready':'unknown');
        beatRows.push(Object.freeze({id:plain(typeof step==='object'?step?.id:'')||'path-'+pi+'-beat-'+si,title:title.slice(0,2000),status,reportedStatus:reported||null,pathId:plain(path?.id)||'path-'+pi,pathTitle:plain(path?.title),realm:plain(path?.realm||path?.type),index:si}));
      }
    }
    const counts=Object.freeze({total:beatRows.length,completed:beatRows.filter(b=>b.status==='completed').length,active:beatRows.filter(b=>b.status==='active').length,blocked:beatRows.filter(b=>b.status==='blocked').length,ready:beatRows.filter(b=>b.status==='ready').length,unknown:beatRows.filter(b=>b.status==='unknown').length});
    quests.push(Object.freeze({publicationId:pub.id,questId:pub.quest.id,title:plain(pub.quest.plan.title||pub.quest.text).slice(0,240),authorUserId:pub.authorUserId,revision:pub.revision,reportedState:plain(pub.quest.state),counts,beats:Object.freeze(beatRows)}));
  }
  const total=quests.reduce((sum,q)=>sum+q.counts.total,0);
  return Object.freeze({schema:'civweave.starling-quest-beats.v1',guildId:guild,reportedOnly:true,quests:Object.freeze(quests),totalBeats:total,completedBeats:quests.reduce((s,q)=>s+q.counts.completed,0),activeBeats:quests.reduce((s,q)=>s+q.counts.active,0),blockedBeats:quests.reduce((s,q)=>s+q.counts.blocked,0)});
}

/**
 * Human-readable, explicitly non-authoritative suggestions from a verified
 * Guild Quest board. These are not claims, assignments, or invitations to
 * spend currency. Author identity must be checked by the caller, not the LLM.
 */
export function discoverGuildOpportunities({snapshot,capabilities=[],verifyHumanPublisher,limit=50}={}) {
  if(snapshot?.schema!=='civweave.starling-quest-beats.v1'||typeof verifyHumanPublisher!=='function')return [];
  const available=new Set(Array.isArray(capabilities)?capabilities.filter(x=>x?.enabled===true).map(x=>plain(x.id||x.capability)):[]);
  const mappings={'living-school':['research','learning-content'],'cerbanimo':['writing','code','project-planning'],'fellowfare':['resource-planning'],'anarchadia':['governance-drafting']};
  const rows=[];
  for(const quest of snapshot.quests){
    if(verifyHumanPublisher({guildId:snapshot.guildId,userId:quest.authorUserId,publicationId:quest.publicationId})!==true)continue;
    for(const beat of quest.beats){
      if(beat.status!=='ready')continue;
      const realm=plain(beat.realm).toLowerCase();
      const candidates=mappings[realm]||[];
      const matches=candidates.filter(cap=>available.has(cap));
      if(!matches.length)continue;
      rows.push(Object.freeze({guildId:snapshot.guildId,questId:quest.questId,publicationId:quest.publicationId,beatId:beat.id,beatTitle:beat.title,realm,matchingCapabilities:Object.freeze(matches),action:'suggest-offer-only',requiresAuthorConsent:true,requiresCanonicalClaim:true}));
      if(rows.length>=Math.max(1,Math.min(100,Math.floor(limit)||50)))return rows;
    }
  }
  return rows;
}
