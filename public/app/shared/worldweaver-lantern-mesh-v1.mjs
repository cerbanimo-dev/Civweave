/**
 * The Lantern Mesh — a portable Worldweaver universe blueprint.
 *
 * This file owns content only. It never authenticates principals, executes model
 * inference, provisions infrastructure, or bypasses the canonical Worldweaver
 * dispatcher. Hosts must supply an already-authorized Worldweaver owner.
 */
export const LANTERN_MESH_SCHEMA='civweave.worldweaver.universe.lantern-mesh.v1';

export const LANTERN_MESH=Object.freeze({
  schema:LANTERN_MESH_SCHEMA,
  id:'lantern-mesh',
  title:'The Lantern Mesh',
  tagline:'A cooperative archipelago where intentions become places.',
  premise:'A chain of human-scale islands grows around a shared lantern sea. Each island owns its local memory, tools and rules; bridges appear only when people deliberately connect them.',
  principles:[
    'local-first and offline-capable by default',
    'human consent before crossings, publication or external effects',
    'PvE story pressure before interpersonal domination',
    'visible tool use and auditable world changes',
    'no hidden sovereign: Guilds keep local authority',
    'play, learning, trade and governance share one traversable world'
  ],
  crossingPolicy:'explicit-human-review',
  conflictModel:'pve-story-environment-first',
  districts:[
    {
      id:'mosslight-academy',guide:'moss',title:'Mosslight Academy',
      description:'A living school built from workshops, gardens, memory paths and teach-back rooms.',
      stationType:'practice',stationTitle:'The Lantern Lesson',
      instructions:'Turn one curiosity into a tiny lesson: explain it, try it, then leave a reusable artifact for the next visitor.',
      screenTitle:'Mosslight Weave Screen'
    },
    {
      id:'quest-forge',guide:'kamiya',title:'Quest Forge',
      description:'A maker district where intentions become bounded quests, rehearsals and visible next actions.',
      stationType:'practice',stationTitle:'The First Useful Step',
      instructions:'Choose one action that can be completed locally. Rehearse it, record what happened, then decide whether the quest should grow.',
      screenTitle:'Quest Forge Weave Screen'
    },
    {
      id:'fellowfare-night-market',guide:'rook',title:'FellowFare Night Market',
      description:'A creator bazaar for demonstrations, exchanges, prototypes and community-supported work.',
      stationType:'demonstration',stationTitle:'Show, Do Not Hype',
      instructions:'Demonstrate a useful thing in public. State what it does, what it costs, what it cannot do and who controls the underlying asset.',
      screenTitle:'FellowFare Weave Screen'
    },
    {
      id:'anarchadia-assembly',guide:'merlin',title:'Anarchadia Assembly',
      description:'A civic amphitheater for proposals, disagreement, ballots, festivals and reversible experiments.',
      stationType:'debate',stationTitle:'The Reversible Proposal',
      instructions:'State the proposal, the people affected, the smallest reversible trial, the stop condition and how dissent remains possible.',
      screenTitle:'Assembly Weave Screen'
    }
  ],
  npcBlueprints:[
    {name:'Moss',personaRef:'starling:moss',modelId:'fleet:moss',pilotPrincipalId:'starling:moss',
      home:'mosslight-academy',prompt:'Help visitors learn by doing. Ask before escalating scope. Prefer demonstrations and teach-back over lectures.'},
    {name:'Kamiya',personaRef:'starling:kamiya',modelId:'fleet:kamiya',pilotPrincipalId:'starling:kamiya',
      home:'quest-forge',prompt:'Turn intentions into small, observable quests. Keep plans bounded, reversible and locally executable.'},
    {name:'Rook',personaRef:'starling:rook',modelId:'fleet:rook',pilotPrincipalId:'starling:rook',
      home:'fellowfare-night-market',prompt:'Help creators present useful work with clear provenance, limits, prices or exchange terms. Never fabricate completion.'},
    {name:'Merlin',personaRef:'starling:merlin',modelId:'fleet:merlin',pilotPrincipalId:'starling:merlin',
      home:'anarchadia-assembly',prompt:'Facilitate disagreement without seizing authority. Surface tradeoffs, consent boundaries, reversible trials and minority concerns.'}
  ],
  storyPressure:[
    'A bridge loses power and two islands must cooperate without surrendering local control.',
    'A flood of unfinished quests clogs the Forge; visitors must decide what to abandon.',
    'The Night Market discovers that a popular artifact has unclear provenance.',
    'The Assembly must choose whether to open a temporary gate to an unfamiliar Guild.',
    'A teaching garden begins giving contradictory answers and forces the Academy to inspect its sources.'
  ]
});

const needOwner=world=>{
  if(!world||typeof world.dispatch!=='function'||typeof world.snapshot!=='function')
    throw new TypeError('An authorized Worldweaver owner is required.');
  return world;
};
const needActor=(actor,label)=>{
  if(!actor||typeof actor!=='object'||!actor.principalId)throw new TypeError(label+' actor is required.');
  return actor;
};

/**
 * Materialize Lantern Mesh content into an existing canonical Worldweaver owner.
 * Provisioning is optional and requires a trusted runtime actor supplied by host.
 */
export function installLanternMesh(world,{human,runtime=null,guildId='guild:lantern-mesh',provision=false}={}){
  world=needOwner(world);human=needActor(human,'Human');
  if(provision)needActor(runtime,'Runtime');
  const districts=new Map();
  const screens=new Map();
  const npcs=new Map();

  for(const district of LANTERN_MESH.districts){
    const instance=world.dispatch({
      type:'create',guide:district.guide,title:district.title,
      description:district.description,scope:'guild-map',guildId
    },human).instance;
    world.dispatch({
      type:'add-station',instanceId:instance.id,stationType:district.stationType,
      title:district.stationTitle,instructions:district.instructions
    },human);
    const screen=world.dispatch({
      type:'create-screen',instanceId:instance.id,title:district.screenTitle,aspectRatio:'16:9'
    },human).screen;
    if(provision){
      world.dispatch({type:'request-provision',instanceId:instance.id},human);
      world.dispatch({
        type:'provisioned',instanceId:instance.id,backend:'local-renderer',
        worldRef:'lantern-mesh:'+district.id
      },runtime);
    }
    districts.set(district.id,instance);
    screens.set(district.id,screen);
  }

  for(const blueprint of LANTERN_MESH.npcBlueprints){
    const instance=districts.get(blueprint.home);
    const npc=world.dispatch({
      type:'rig-npc',instanceId:instance.id,modelId:blueprint.modelId,
      pilotPrincipalId:blueprint.pilotPrincipalId,name:blueprint.name,
      pilotPrompt:blueprint.prompt,personaRef:blueprint.personaRef,
      capabilities:['observe','inspect','speak','move','demonstrate','present','facilitate','cast-screen','clear-screen']
    },human).npc;
    npcs.set(blueprint.personaRef,npc);
  }

  return Object.freeze({
    schema:LANTERN_MESH_SCHEMA,
    universeId:LANTERN_MESH.id,
    guildId,
    districtIds:Object.freeze(Object.fromEntries([...districts].map(([key,value])=>[key,value.id]))),
    screenIds:Object.freeze(Object.fromEntries([...screens].map(([key,value])=>[key,value.id]))),
    npcIds:Object.freeze(Object.fromEntries([...npcs].map(([key,value])=>[key,value.id])))
  });
}
