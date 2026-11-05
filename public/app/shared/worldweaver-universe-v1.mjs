/**
 * The Commons Between — a provider-neutral Civweave universe blueprint.
 *
 * This module composes existing Worldweaver capabilities. It does not create a
 * second simulation authority, start inference, provision OpenSimulator, spend
 * compute, publish canon, cast votes, or execute purchases.
 */
import {SPACE_GUIDES} from './worldweaver-core-v1.mjs';
import {LEGACY_VISUAL_DISTRICTS} from './worldweaver-visual-scene-v1.mjs';
import {WORLD_LAYERS,WORLD_SEED_COUNT} from './worldweaver-story-seeds-v1.mjs';
import {CONVERGENCE_MILESTONES} from './worldweaver-convergence-cast-v1.mjs';

export const UNIVERSE_SCHEMA='civweave.worldweaver-universe.v1';
export const COMMONS_BETWEEN_ID='commons-between';

const copy=value=>JSON.parse(JSON.stringify(value));
const freezeDeep=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);
    for(const child of Object.values(value))freezeDeep(child);
  }
  return value;
};

const rooms=[
  {
    id:'starling-commons',
    guide:'merlin',
    title:'Starling Commons',
    description:'Shared arrival hall for conversation, orientation, proposals, meetings and human-reviewed collective coordination.',
    stations:[
      {stationType:'display',title:'Commons Board',instructions:'Present reviewed Guild context, current Quests and signed activity summaries. Do not display private material without authorization.'},
      {stationType:'debate',title:'Talking Circle',instructions:'Host attributed discussion with explicit speaker identity and human control of binding decisions.'}
    ],
    screens:[{title:'Commons Screen',aspectRatio:'16:9'}]
  },
  {
    id:'living-school',
    guide:'moss',
    title:'Living School',
    description:'Learning district for explanation, practice, assessment, curiosity and portable workshops.',
    stations:[
      {stationType:'explanation',title:'Orientation Grove',instructions:'Explain a topic using concrete examples, multiple representations and an explicit path back to source material.'},
      {stationType:'practice',title:'Practice Garden',instructions:'Offer bounded practice with feedback. Practice results do not become credentials unless the Living School owner verifies them.'},
      {stationType:'demonstration',title:'Demo Bench',instructions:'Demonstrate reviewed tools or concepts without claiming that external actions ran unless a trusted adapter reports success.'}
    ],
    screens:[{title:'Learning Screen',aspectRatio:'16:9'}]
  },
  {
    id:'quest-forge',
    guide:'kamiya',
    title:'Quest Forge',
    description:'Hands-on making district where intentions become rehearsable tasks, evidence and reviewed Quest progress.',
    stations:[
      {stationType:'explanation',title:'Quest Briefing',instructions:'Show the current task, constraints and owner. Keep narrative improvisation separate from accepted Quest completion.'},
      {stationType:'practice',title:'Tool Rehearsal',instructions:'Rehearse a bounded task before execution. The rehearsal is not proof that the real task completed.'},
      {stationType:'assessment',title:'Evidence Table',instructions:'Inspect submitted evidence and route it to the canonical Quest owner for acceptance or rejection.'}
    ],
    screens:[{title:'Quest Screen',aspectRatio:'16:9'}]
  },
  {
    id:'fellowfare-hall',
    guide:'rook',
    title:'FellowFare Hall',
    description:'Creator and resource district for demonstrations, listings and human-authorized exchange entry points.',
    stations:[
      {stationType:'display',title:'Creator Arcade',instructions:'Display approved creator work and existing listing references. No checkout, escrow or inventory mutation occurs inside Worldweaver.'},
      {stationType:'demonstration',title:'Workshop Window',instructions:'Demonstrate how a tool, object or service works using reviewed media and bounded actions.'}
    ],
    screens:[{title:'Creator Screen',aspectRatio:'16:9'}]
  },
  {
    id:'convergence-stage',
    guide:'merlin',
    title:'Convergence Stage',
    description:'Private-to-public performance and encounter space for Team Cerbanimo, the Starling Collective and author-reviewed fictional casts.',
    stations:[
      {stationType:'display',title:'Stage Screen',instructions:'Show rights-cleared, reviewed production material. Draft improvisation does not rewrite book canon.'},
      {stationType:'debate',title:'Encounter Floor',instructions:'Run attributed encounters and scene work. Preserve separate character identities and explicit human authority over canon.'}
    ],
    screens:[{title:'Convergence Screen',aspectRatio:'16:9'}]
  }
];

export const COMMONS_BETWEEN=freezeDeep({
  schema:UNIVERSE_SCHEMA,
  id:COMMONS_BETWEEN_ID,
  title:'The Commons Between',
  version:1,
  status:'staging-blueprint',
  premise:'A persistent social universe where humans and bounded AI pilots meet, learn, make, trade references, govern through the proper owners, and improvise story conflicts without turning narrative events into unverified real-world claims.',
  authority:{
    manifest:'civweave.worldweaver.v1',
    multiplayerTarget:'OpenSimulator/DreamGrid-compatible trusted provider adapter',
    preview:'local-renderer and shared 2D/3D Worldweaver projections',
    rule:'One canonical Worldweaver state feeds every renderer; providers may render state but do not become a second source of truth.'
  },
  rooms,
  topology:{
    source:'public/app/shared/worldweaver-visual-scene-v1.mjs',
    geometryStatus:'provisional-until-verified-provider-import',
    districts:LEGACY_VISUAL_DISTRICTS.map(row=>({id:row.id,name:row.name}))
  },
  storyPortals:{
    source:'public/app/shared/worldweaver-story-seeds-v1.mjs',
    count:WORLD_SEED_COUNT,
    layers:Object.fromEntries(Object.entries(WORLD_LAYERS).map(([id,row])=>[id,{title:row.title,count:row.count}])),
    mode:'opt-in-gated-portals',
    rule:'Entering a story world creates or joins an authorized session. Story outcomes are session narrative until the owning canon or Quest system explicitly accepts them.'
  },
  convergence:{
    source:'public/app/shared/worldweaver-convergence-cast-v1.mjs',
    milestones:[...CONVERGENCE_MILESTONES],
    canonAuthority:'author-review'
  },
  pve:{
    mode:'storyline-pve-improv',
    goal:'AI pilots and humans collaboratively play against world problems, hazards, puzzles and social conflicts rather than treating each other as default enemies.',
    defaultPilotCapabilities:['observe','inspect','speak','move','demonstrate','present','facilitate'],
    forbiddenAuthorities:['purchase','cast-vote','publish','admin','execute-code','unrestricted-http'],
    receipts:'Only the trusted runtime may report external action success. Narrative success is not a tool receipt.'
  }
});

const validGuild=value=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,180}$/.test(value);

/**
 * Materialize the blueprint as draft Worldweaver rooms.
 *
 * The caller supplies the canonical Worldweaver owner and authenticated human.
 * This deliberately stops before request-provision/provisioned; a trusted host
 * must verify the renderer and provider before any room becomes live.
 */
export function buildCommonsBetween({worldweaver,actor,guildId=null}={}){
  if(!worldweaver||typeof worldweaver.dispatch!=='function'||typeof worldweaver.snapshot!=='function')
    throw new TypeError('Canonical Worldweaver owner required.');
  if(!actor||actor.kind!=='human'||typeof actor.principalId!=='string')
    throw new TypeError('Authenticated human actor required.');
  if(guildId!==null&&!validGuild(guildId))throw new TypeError('Invalid Guild ID.');

  const scope=guildId?'guild-map':'standalone';
  const built=[];
  for(const spec of COMMONS_BETWEEN.rooms){
    const command={
      type:'create',
      guide:spec.guide,
      title:spec.title,
      description:spec.description,
      scope
    };
    if(guildId)command.guildId=guildId;
    const instance=worldweaver.dispatch(command,actor).instance;
    for(const station of spec.stations){
      worldweaver.dispatch({
        type:'add-station',
        instanceId:instance.id,
        stationType:station.stationType,
        title:station.title,
        instructions:station.instructions
      },actor);
    }
    const screenIds=[];
    for(const screen of spec.screens){
      const created=worldweaver.dispatch({
        type:'create-screen',
        instanceId:instance.id,
        title:screen.title,
        aspectRatio:screen.aspectRatio
      },actor).screen;
      screenIds.push(created.id);
    }
    built.push({
      roomId:spec.id,
      instanceId:instance.id,
      guide:spec.guide,
      kind:SPACE_GUIDES[spec.guide],
      screenIds
    });
  }
  return freezeDeep({
    schema:UNIVERSE_SCHEMA,
    universeId:COMMONS_BETWEEN_ID,
    status:'draft',
    provisioning:'not-requested',
    scope,
    guildId:guildId||null,
    rooms:built,
    snapshot:copy(worldweaver.snapshot())
  });
}
