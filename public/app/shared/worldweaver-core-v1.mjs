import {validateAvatarPlan} from './worldweaver-avatar-v1.mjs';
import {normalizeScreenContent} from './worldweaver-screen-v1.mjs';

/**
 * Worldweaver microspace manifest and NPC-pilot proposal owner.
 * No rendering, inference, script execution, payments, or governance authority.
 * Consumers must authenticate principals and provide a capability authorizer.
 * Snapshots can be stored in the canonical object mesh; future world adapters
 * must independently validate and acknowledge all queued tool intents.
 */
export const WORLDWEAVER_SCHEMA='civweave.worldweaver.v1';
export const SPACE_GUIDES=Object.freeze({
  moss:'learning-workshop',
  kamiya:'task-training',
  rook:'creator-shop',
  merlin:'convention'
});
const LINK_TYPES=Object.freeze({
  'learning-workshop':'learning-path',
  'task-training':'quest-task',
  'creator-shop':'fellowfare-listing',
  'convention':'governance-ballot'
});
const STATIONS=Object.freeze({
  'learning-workshop':['explanation','practice','assessment','demonstration'],
  'task-training':['explanation','practice','assessment','demonstration'],
  'creator-shop':['display','demonstration'],
  'convention':['debate','ballot','display']
});
export const NPC_TOOLS=Object.freeze(['observe','inspect','speak','move','demonstrate','build','present','facilitate','cast-screen','clear-screen']);
const BOUND_ID=/^[A-Za-z0-9][A-Za-z0-9:_./-]{0,179}$/;
const clean=(v,max=240)=>typeof v==='string'?v.trim().slice(0,max):'';
const copy=v=>JSON.parse(JSON.stringify(v));
const ref=(v,label='Reference')=>{
  const x=clean(v,180);
  if(!BOUND_ID.test(x))throw new TypeError(label+' must be a bounded identifier.');
  return x;
};
const required=(v,label,max=240)=>{
  const x=clean(v,max);
  if(!x)throw new TypeError(label+' is required.');
  return x;
};
const fields=(obj,allowed)=>{
  if(!obj||typeof obj!=='object'||Array.isArray(obj))throw new TypeError('Command must be an object.');
  const unsupported=Object.keys(obj).filter(k=>!allowed.includes(k));
  if(unsupported.length)throw new TypeError('Unsupported field: '+unsupported.join(', '));
};
const appearanceRef=(value)=>{
  const x=clean(value,180);
  if(/^\/app\/assets\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.(?:svg|png|jpg|webp)$/.test(x))return x;
  return ref(x,'Appearance');
};
const empty=()=>({schema:WORLDWEAVER_SCHEMA,revision:0,instances:[],stations:[],links:[],npcs:[],avatarProposals:[],screens:[],screenHistory:[],intents:[],debateTurns:[],journal:[]});

/**
 * All dispatches are manifest transitions, not external actions.
 * authorize({actor, command, instance}) MUST verify upstream authenticated
 * identity, ownership, guide rights, budget and Guild membership as appropriate.
 * A boolean from a UI or untrusted model is not evidence of authorization.
 */
export function createWorldweaver({authorize,id=()=>crypto.randomUUID(),clock=()=>new Date().toISOString(),initialState}={}){
  if(typeof authorize!=='function')throw new TypeError('A trusted authorization adapter is mandatory.');
  let state=initialState?copy(initialState):empty();
  if(state.schema!==WORLDWEAVER_SCHEMA||!Array.isArray(state.instances)||!Array.isArray(state.journal))
    throw new TypeError('Invalid Worldweaver snapshot.');
  // Older v1 snapshots lacked avatar proposals. Preserve those instances.
  if(state.avatarProposals===undefined)state.avatarProposals=[];
  if(!Array.isArray(state.avatarProposals))throw new TypeError('Invalid avatar proposal history.');
  if(state.screens===undefined)state.screens=[];
  if(state.screenHistory===undefined)state.screenHistory=[];
  if(!Array.isArray(state.screens)||!Array.isArray(state.screenHistory))
    throw new TypeError('Invalid screen history or manifests.');
  const nextId=()=>ref(String(id()),'Generated ID');
  const findInstance=key=>{
    const row=state.instances.find(x=>x.id===key);
    if(!row)throw new RangeError('Unknown instance.');
    return row;
  };
  const screenById=key=>{
    const screen=state.screens.find(x=>x.id===key);
    if(!screen)throw new RangeError('Unknown screen.');
    return screen;
  };
  function updateScreen(screen,content,actor,at){
    screen.current=content?{...content,presenter:{kind:actor.kind,principalId:actor.principalId},shownAt:at}:null;
    screen.status=content?'presenting':'blank';
    screen.revision+=1;
    screen.updatedAt=at;
    state.screenHistory.push({id:nextId(),screenId:screen.id,instanceId:screen.instanceId,
      revision:screen.revision,kind:content?.kind||'clear',presenterKind:actor.kind,at});
    if(state.screenHistory.length>200)state.screenHistory.shift();
  };
  function dispatch(command,actor){
    if(!command||typeof command.type!=='string')throw new TypeError('Command type required.');
    const instance=command.instanceId?state.instances.find(x=>x.id===command.instanceId):undefined;
    if(!actor||!ref(actor.principalId,'Principal')||authorize({actor,command,instance})!==true)
      throw new Error('Unauthorized Worldweaver action.');
    if(command.instanceId&&!instance)throw new RangeError('Unknown instance.');
    const eventTime=clock();
    let receipt={type:command.type};
    switch(command.type){
      case 'create':{
        fields(command,['type','guide','title','description','scope','guildId']);
        const guide=clean(command.guide,32),kind=SPACE_GUIDES[guide];
        if(!kind)throw new TypeError('Unknown guide.');
        const scope=command.scope||'standalone';
        if(!['standalone','guild-map'].includes(scope))throw new TypeError('Invalid scope.');
        const guildId=scope==='guild-map'?ref(command.guildId,'Guild ID'):null;
        const row={id:nextId(),guide,kind,title:required(command.title,'Title',120),description:clean(command.description,1800),
          scope,guildId,status:'draft',createdBy:actor.principalId,createdAt:eventTime,world:null};
        state.instances.push(row);
        receipt.instance=copy(row);
        break;
      }
      case 'create-screen':{
        fields(command,['type','instanceId','title','aspectRatio']);
        if(instance.status==='archived')throw new Error('Archived worlds cannot create screens.');
        if(!['16:9','4:3','portrait','square'].includes(command.aspectRatio||'16:9'))
          throw new TypeError('Unsupported screen aspect ratio.');
        if(state.screens.filter(x=>x.instanceId===instance.id).length>=12)
          throw new Error('This instance has reached its screen limit.');
        const screen={id:nextId(),instanceId:instance.id,title:required(command.title,'Screen title',100),
          aspectRatio:command.aspectRatio||'16:9',createdBy:actor.principalId,
          status:'blank',revision:0,current:null,createdAt:eventTime,updatedAt:eventTime};
        state.screens.push(screen);receipt.screen=copy(screen);
        break;
      }
      case 'cast-screen':{
        fields(command,['type','screenId','content']);
        if(actor.kind!=='human')throw new Error('Model pilots must queue screen casts as tool intents.');
        const screen=screenById(command.screenId);
        if(findInstance(screen.instanceId).status==='archived')throw new Error('Archived instance screen.');
        updateScreen(screen,normalizeScreenContent(command.content),actor,eventTime);
        receipt.screen=copy(screen);
        break;
      }
      case 'clear-screen':{
        fields(command,['type','screenId']);
        if(actor.kind!=='human')throw new Error('Model pilots must queue screen clears as tool intents.');
        const screen=screenById(command.screenId);
        if(findInstance(screen.instanceId).status==='archived')throw new Error('Archived instance screen.');
        updateScreen(screen,null,actor,eventTime);
        receipt.screen=copy(screen);
        break;
      }
      case 'cancel-cast':{
        fields(command,['type','intentId']);
        if(actor.kind!=='human')throw new Error('Human review required to cancel pending casts.');
        const intent=state.intents.find(x=>x.id===command.intentId);
        if(!intent||!['cast-screen','clear-screen'].includes(intent.tool))throw new RangeError('Unknown screen cast intent.');
        if(!['queued','review-required'].includes(intent.status))throw new Error('Only pending screen casts can be cancelled.');
        intent.status='cancelled';intent.reviewedBy=actor.principalId;intent.reviewedAt=eventTime;
        receipt.intent=copy(intent);
        break;
      }
      case 'approve-cast':
      case 'reject-cast':{
        fields(command,command.type==='approve-cast'?['type','intentId']:['type','intentId','reason']);
        if(actor.kind!=='human')throw new Error('External media review requires a human.');
        const intent=state.intents.find(x=>x.id===command.intentId);
        if(!intent||intent.tool!=='cast-screen')throw new RangeError('Unknown screen cast request.');
        if(intent.status!=='review-required')throw new Error('This cast does not require review.');
        if(command.type==='approve-cast'){
          const screen=screenById(intent.args.screenId);
          if(screen.revision!==intent.expectedScreenRevision)throw new Error('Stale screen cast revision.');
          intent.status='queued';intent.reviewedBy=actor.principalId;intent.reviewedAt=eventTime;
        }else{
          const reason=required(command.reason,'Review reason',500);
          intent.status='rejected';intent.reviewReason=reason;
          intent.reviewedBy=actor.principalId;intent.reviewedAt=eventTime;
        }
        receipt.intent=copy(intent);
        break;
      }
      case 'add-station':{
        fields(command,['type','instanceId','stationType','title','instructions']);
        if(!STATIONS[instance.kind].includes(command.stationType))throw new TypeError('Station type not supported in this space.');
        if(instance.status==='archived')throw new Error('Cannot edit archived instance.');
        const row={id:nextId(),instanceId:instance.id,stationType:command.stationType,
          title:required(command.title,'Station title',120),instructions:required(command.instructions,'Instructions',3000),
          creator:actor.principalId};
        state.stations.push(row);
        receipt.station=copy(row);
        break;
      }
      case 'link':{
        fields(command,['type','instanceId','refType','refId']);
        if(command.refType!==LINK_TYPES[instance.kind])throw new TypeError('Reference type not supported in this space.');
        const link={id:nextId(),instanceId:instance.id,refType:command.refType,
          refId:ref(command.refId),authoritative:false,linkedBy:actor.principalId};
        if(state.links.some(x=>x.instanceId===instance.id&&x.refType===link.refType&&x.refId===link.refId))
          throw new Error('Reference is already linked.');
        state.links.push(link); receipt.link=copy(link);
        break;
      }
      case 'request-provision':{
        fields(command,['type','instanceId']);
        if(actor.kind!=='human')throw new Error('Human approval required for provisioning.');
        if(instance.status!=='draft')throw new Error('Only a draft can request provisioning.');
        instance.status='provision-requested';
        receipt.instance=copy(instance);
        break;
      }
      case 'provisioned':{
        fields(command,['type','instanceId','backend','worldRef']);
        if(actor.kind!=='runtime')throw new Error('Only a trusted runtime may report provisioned worlds.');
        if(instance.status!=='provision-requested')throw new Error('No provisioning request is pending.');
        if(!['local-renderer','opensim','overte','genie'].includes(command.backend))throw new TypeError('Unknown world backend.');
        instance.world={backend:command.backend,worldRef:ref(command.worldRef),provisionedAt:eventTime};
        instance.status='live';receipt.instance=copy(instance);
        break;
      }
      case 'rig-npc':{
        fields(command,['type','instanceId','modelId','pilotPrincipalId','name','pilotPrompt','appearanceRef','personaRef','capabilities']);
        if(instance.status==='archived')throw new Error('Cannot rig archived instance.');
        const modelId=ref(command.modelId,'Model ID');
        if(actor.kind==='model'&&actor.modelId!==modelId)throw new Error('A model may only rig its own model.');
        const pilotPrincipalId=actor.kind==='model'?actor.principalId:ref(command.pilotPrincipalId,'Pilot principal');
        if(actor.kind==='model'&&command.personaRef&&actor.personaRef!==command.personaRef)
          throw new Error('Model cannot impersonate another persona.');
        if(!Array.isArray(command.capabilities)&&command.capabilities!==undefined)throw new TypeError('Capabilities must be an array.');
        const caps=command.capabilities||['observe','speak','move'];
        if(caps.length>NPC_TOOLS.length||!caps.length||new Set(caps).size!==caps.length||caps.some(x=>!NPC_TOOLS.includes(x)))
          throw new TypeError('Invalid NPC capabilities.');
        const npc={id:nextId(),instanceId:instance.id,modelId,pilotPrincipalId,name:required(command.name,'NPC name',100),
          pilotPrompt:required(command.pilotPrompt,'NPC pilot prompt',5000),
          appearanceRef:command.appearanceRef?appearanceRef(command.appearanceRef):null,
          personaRef:command.personaRef?ref(command.personaRef,'Persona'):null,
          avatarProposalId:null,avatarBackendRef:null,
          capabilities:[...caps],status:'ready',createdBy:actor.principalId,createdAt:eventTime};
        state.npcs.push(npc);receipt.npc=copy(npc);
        break;
      }
      case 'propose-avatar':{
        fields(command,['type','npcId','plan']);
        if(actor.kind!=='model')throw new Error('Only an authenticated model pilot can propose its avatar.');
        const npc=state.npcs.find(x=>x.id===command.npcId);
        if(!npc)throw new RangeError('Unknown NPC.');
        if(actor.principalId!==npc.pilotPrincipalId||actor.modelId!==npc.modelId
          ||(npc.personaRef&&actor.personaRef!==npc.personaRef))
          throw new Error('NPC pilot identity mismatch.');
        const world=findInstance(npc.instanceId);
        if(world.status==='archived')throw new Error('Cannot rig an archived avatar.');
        if(state.avatarProposals.some(x=>x.npcId===npc.id&&x.status==='pending-review'))
          throw new Error('Resolve the pending avatar review before proposing another.');
        if(state.avatarProposals.length>=1000||state.avatarProposals.filter(x=>x.npcId===npc.id).length>=12)
          throw new Error('Avatar proposal history limit reached.');
        const proposal={id:nextId(),npcId:npc.id,instanceId:npc.instanceId,
          referenceAsset:npc.appearanceRef,plan:validateAvatarPlan(command.plan),
          status:'pending-review',proposedBy:actor.principalId,createdAt:eventTime};
        state.avatarProposals.push(proposal);receipt.proposal=copy(proposal);
        break;
      }
      case 'approve-avatar':
      case 'reject-avatar':{
        fields(command,command.type==='approve-avatar'?['type','proposalId']:['type','proposalId','reason']);
        if(actor.kind!=='human')throw new Error('Human avatar review required.');
        const proposal=state.avatarProposals.find(x=>x.id===command.proposalId);
        if(!proposal)throw new RangeError('Unknown avatar proposal.');
        if(proposal.status!=='pending-review')throw new Error('Avatar proposal is not pending review.');
        proposal.status=command.type==='approve-avatar'?'approved':'rejected';
        proposal.reviewedBy=actor.principalId;proposal.reviewedAt=eventTime;
        if(proposal.status==='rejected')proposal.reviewReason=required(command.reason,'Review reason',500);
        receipt.proposal=copy(proposal);
        break;
      }
      case 'apply-avatar':{
        fields(command,['type','proposalId','backendRef']);
        if(actor.kind!=='runtime')throw new Error('Trusted renderer required to apply an avatar.');
        const proposal=state.avatarProposals.find(x=>x.id===command.proposalId);
        if(!proposal)throw new RangeError('Unknown avatar proposal.');
        if(proposal.status!=='approved')throw new Error('Avatar proposal must be approved before application.');
        const npc=state.npcs.find(x=>x.id===proposal.npcId);
        if(!npc)throw new RangeError('NPC no longer exists.');
        const world=findInstance(npc.instanceId);
        if(world.status==='archived')throw new Error('Cannot apply avatar to archived world.');
        proposal.status='applied';proposal.appliedAt=eventTime;
        npc.avatarProposalId=proposal.id;npc.avatarBackendRef=ref(command.backendRef,'Avatar backend reference');
        receipt.proposal=copy(proposal);receipt.npc=copy(npc);
        break;
      }
      case 'queue-actions':{
        fields(command,['type','npcId','actions']);
        if(actor.kind!=='model')throw new Error('Only a bound model pilot may queue NPC actions.');
        const npc=state.npcs.find(x=>x.id===command.npcId);
        if(!npc)throw new RangeError('Unknown NPC.');
        if(actor.principalId!==npc.pilotPrincipalId||actor.modelId!==npc.modelId)
          throw new Error('Model identity does not match this NPC pilot.');
        const world=findInstance(npc.instanceId);
        if(world.status==='archived')throw new Error('Archived worlds cannot accept actions.');
        if(!Array.isArray(command.actions)||command.actions.length<1||command.actions.length>3)
          throw new TypeError('One to three NPC actions may be batched.');
        const intents=command.actions.map(action=>{
          fields(action,['tool','args']);
          if(!npc.capabilities.includes(action.tool))throw new Error('NPC tool is not allowed: '+String(action.tool));
          let args=action.args??{};
          if(!args||typeof args!=='object'||Array.isArray(args)||JSON.stringify(args).length>2000)
            throw new TypeError('NPC action arguments must be bounded structured data.');
          let expectedScreenRevision=null,needsReview=false;
          if(action.tool==='cast-screen'||action.tool==='clear-screen'){
            fields(args,action.tool==='cast-screen'?['screenId','content']:['screenId']);
            const screen=screenById(args.screenId);
            if(screen.instanceId!==npc.instanceId)throw new Error('NPC cannot cast into another world instance.');
            expectedScreenRevision=screen.revision;
            if(action.tool==='cast-screen'){
              const content=normalizeScreenContent(args.content);
              needsReview=Boolean(content.source.url);
              args={screenId:screen.id,content};
            }else args={screenId:screen.id};
          }
          return {id:nextId(),npcId:npc.id,instanceId:npc.instanceId,tool:action.tool,
            args:copy(args),expectedScreenRevision,status:needsReview?'review-required':'queued',createdAt:eventTime};
        });
        state.intents.push(...intents);
        receipt.intents=copy(intents);
        break;
      }
      case 'report-action':{
        fields(command,['type','intentId','outcome','summary']);
        if(actor.kind!=='runtime')throw new Error('Only a trusted runtime can report action execution.');
        const intent=state.intents.find(x=>x.id===command.intentId);
        if(!intent)throw new RangeError('Unknown action intent.');
        if(intent.status!=='queued')throw new Error('Action not queued or already resolved.');
        if(!['succeeded','failed'].includes(command.outcome))throw new TypeError('Invalid action outcome.');
        let targetScreen=null;
        if(intent.tool==='cast-screen'||intent.tool==='clear-screen'){
          targetScreen=screenById(intent.args.screenId);
          if(targetScreen.revision!==intent.expectedScreenRevision)
            throw new Error('Stale screen revision; this cast cannot overwrite newer content.');
        }
        if(command.outcome==='succeeded'&&targetScreen){
          const npc=state.npcs.find(x=>x.id===intent.npcId);
          if(!npc)throw new RangeError('NPC pilot no longer exists.');
          const pilot={kind:'model',principalId:npc.pilotPrincipalId};
          updateScreen(targetScreen,intent.tool==='cast-screen'?intent.args.content:null,pilot,eventTime);
          receipt.screen=copy(targetScreen);
        }
        intent.status=command.outcome;intent.resolvedAt=eventTime;
        intent.summary=clean(command.summary,500);
        receipt.intent=copy(intent);
        break;
      }
      case 'debate-turn':{
        fields(command,['type','instanceId','topic','statement']);
        if(instance.kind!=='convention')throw new Error('Debate turns require a convention.');
        const row={id:nextId(),instanceId:instance.id,topic:required(command.topic,'Topic',160),
          statement:required(command.statement,'Statement',2400),speakerId:actor.principalId,
          speakerKind:actor.kind,createdAt:eventTime};
        state.debateTurns.push(row);receipt.debateTurn=copy(row);
        break;
      }
      default:throw new TypeError('Unsupported command: '+command.type);
    }
    state.revision+=1;
    state.journal.push({revision:state.revision,time:eventTime,command:command.type,principalId:actor.principalId,
      instanceId:command.instanceId||receipt.instance?.id||null});
    if(state.journal.length>1000)state.journal.shift();
    receipt.revision=state.revision;
    return copy(receipt);
  }
  return Object.freeze({dispatch,snapshot:()=>copy(state)});
}
