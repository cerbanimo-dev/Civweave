import {SPACE_GUIDES} from './worldweaver-core-v1.mjs';

export const UNIVERSE_SCHEMA='civweave.worldweaver.universe.v1';

const CANONICAL_SYSTEMS=Object.freeze(['living-school','cerbanimo','fellowfare','anarchadia']);
const ALLOWED_STATIONS=Object.freeze({
  'learning-workshop':Object.freeze(['explanation','practice','assessment','demonstration']),
  'task-training':Object.freeze(['explanation','practice','assessment','demonstration']),
  'creator-shop':Object.freeze(['display','demonstration']),
  'convention':Object.freeze(['debate','ballot','display'])
});
const ID=/^[A-Za-z0-9][A-Za-z0-9:_./-]{0,179}$/;

const deepFreeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);
    for(const child of Object.values(value))deepFreeze(child);
  }
  return value;
};

const finitePoint=(point,label)=>{
  if(!point||typeof point!=='object'||Array.isArray(point))throw new TypeError(label+' must be an object.');
  for(const key of ['x','y','z'])if(!Number.isFinite(point[key]))throw new TypeError(label+' requires finite x/y/z coordinates.');
};

const identifier=(value,label)=>{
  if(typeof value!=='string'||!ID.test(value))throw new TypeError(label+' must be a bounded identifier.');
  return value;
};

export const CIVWEAVE_SEED_UNIVERSE_V1=deepFreeze({
  schema:UNIVERSE_SCHEMA,
  id:'civweave-seed-universe',
  title:'Civweave Seed Universe',
  revision:1,
  description:'A portable four-realm Worldweaver universe with a three-lane intention highway and a governance interchange.',
  nexus:{
    id:'threshold',
    title:'The Threshold',
    description:'Entry point for a Hero carrying an intention into the shared world.',
    position:{x:0,y:0,z:0}
  },
  highway:{
    id:'intention-highway',
    title:'Intention Highway',
    description:'Three parallel realm lanes keep learning, building, and exchange visible together without collapsing their authorities.',
    lanes:[
      {id:'lane:living-school',realmId:'realm:living-school',system:'living-school',label:'Living School',purpose:'learn',offset:-1},
      {id:'lane:cerbanimo',realmId:'realm:cerbanimo',system:'cerbanimo',label:'Cerbanimo',purpose:'build',offset:0},
      {id:'lane:fellowfare',realmId:'realm:fellowfare',system:'fellowfare',label:'FellowFare',purpose:'exchange',offset:1}
    ],
    interchangeRealmId:'realm:anarchadia'
  },
  realms:[
    {
      id:'realm:living-school',
      system:'living-school',
      title:'Living School',
      guide:'moss',
      kind:'learning-workshop',
      description:'A research-first learning realm where paths become practice, assessment, and demonstrated understanding.',
      position:{x:-360,y:0,z:-120},
      stations:[
        {title:'Trailhead',stationType:'explanation',instructions:'Choose or inspect a learning path and make the next learning objective explicit.'},
        {title:'Practice Grove',stationType:'practice',instructions:'Work the skill in a bounded practice space with visible attempts and revisions.'},
        {title:'Proof Gate',stationType:'assessment',instructions:'Check evidence of understanding without pretending activity is mastery.'},
        {title:'Show-What-You-Know Stage',stationType:'demonstration',instructions:'Demonstrate the learned capability through a human-reviewable artifact or performance.'}
      ]
    },
    {
      id:'realm:cerbanimo',
      system:'cerbanimo',
      title:'Cerbanimo',
      guide:'kamiya',
      kind:'task-training',
      description:'The making realm where intentions become plans, quests, tools, prototypes, and verified work.',
      position:{x:0,y:0,z:-420},
      stations:[
        {title:'Intention Deck',stationType:'explanation',instructions:'State the intention, constraints, and success condition before work begins.'},
        {title:'Quest Bench',stationType:'practice',instructions:'Break the intention into executable tasks and perform the smallest useful next action.'},
        {title:'Verification Ramp',stationType:'assessment',instructions:'Compare claimed progress with receipts, tests, or direct human review.'},
        {title:'Launch Pad',stationType:'demonstration',instructions:'Present the working result and the evidence needed for another person to use or verify it.'}
      ]
    },
    {
      id:'realm:fellowfare',
      system:'fellowfare',
      title:'FellowFare',
      guide:'rook',
      kind:'creator-shop',
      description:'The exchange realm for useful work, maker offerings, mutual aid, and transparent value transfer.',
      position:{x:360,y:0,z:-120},
      stations:[
        {title:'Maker Market',stationType:'display',instructions:'Show an offering with provenance, scope, terms, and the human or Guild responsible for it.'},
        {title:'Demo Dock',stationType:'demonstration',instructions:'Demonstrate the offering before exchange when demonstration is practical and safe.'}
      ]
    },
    {
      id:'realm:anarchadia',
      system:'anarchadia',
      title:'Anarchadia',
      guide:'merlin',
      kind:'convention',
      description:'The governance interchange where shared rules, disputes, proposals, and collective decisions become visible.',
      position:{x:0,y:0,z:360},
      stations:[
        {title:'Forum Ring',stationType:'debate',instructions:'State proposals and objections in a shared visible forum without granting speakers unilateral authority.'},
        {title:'Decision Commons',stationType:'ballot',instructions:'Record eligible decisions through the governing authority rather than through simulated UI state.'},
        {title:'Public Ledger Wall',stationType:'display',instructions:'Display current decisions, open questions, and their authoritative references.'}
      ]
    }
  ],
  portals:[
    {id:'portal:threshold:living-school',from:'threshold',to:'realm:living-school',label:'Learn'},
    {id:'portal:threshold:cerbanimo',from:'threshold',to:'realm:cerbanimo',label:'Build'},
    {id:'portal:threshold:fellowfare',from:'threshold',to:'realm:fellowfare',label:'Exchange'},
    {id:'portal:living-school:anarchadia',from:'realm:living-school',to:'realm:anarchadia',label:'Bring learning into governance'},
    {id:'portal:cerbanimo:anarchadia',from:'realm:cerbanimo',to:'realm:anarchadia',label:'Bring plans into governance'},
    {id:'portal:fellowfare:anarchadia',from:'realm:fellowfare',to:'realm:anarchadia',label:'Bring exchange into governance'}
  ]
});

export function validateUniverse(universe){
  if(!universe||typeof universe!=='object'||Array.isArray(universe))throw new TypeError('Universe must be an object.');
  if(universe.schema!==UNIVERSE_SCHEMA)throw new TypeError('Unknown universe schema.');
  identifier(universe.id,'Universe ID');
  if(typeof universe.title!=='string'||!universe.title.trim())throw new TypeError('Universe title is required.');
  if(!Number.isInteger(universe.revision)||universe.revision<1)throw new TypeError('Universe revision must be a positive integer.');
  if(!universe.nexus)throw new TypeError('Universe nexus is required.');
  identifier(universe.nexus.id,'Nexus ID');
  finitePoint(universe.nexus.position,'Nexus position');

  if(!Array.isArray(universe.realms)||universe.realms.length!==4)throw new TypeError('Universe requires exactly four canonical realms.');
  const realmIds=new Set(),systems=new Set();
  for(const realm of universe.realms){
    identifier(realm.id,'Realm ID');
    if(realmIds.has(realm.id))throw new TypeError('Duplicate realm ID.');
    realmIds.add(realm.id);
    if(!CANONICAL_SYSTEMS.includes(realm.system)||systems.has(realm.system))throw new TypeError('Canonical systems must appear exactly once.');
    systems.add(realm.system);
    if(SPACE_GUIDES[realm.guide]!==realm.kind)throw new TypeError('Realm guide/kind mismatch: '+realm.id);
    finitePoint(realm.position,'Realm position');
    if(!Array.isArray(realm.stations)||realm.stations.length<1)throw new TypeError('Realm requires stations: '+realm.id);
    const stationTitles=new Set();
    for(const station of realm.stations){
      if(typeof station.title!=='string'||!station.title.trim()||stationTitles.has(station.title))throw new TypeError('Station titles must be unique and non-empty.');
      stationTitles.add(station.title);
      if(!ALLOWED_STATIONS[realm.kind]?.includes(station.stationType))throw new TypeError('Invalid station type for '+realm.id);
      if(typeof station.instructions!=='string'||!station.instructions.trim())throw new TypeError('Station instructions are required.');
    }
  }
  if(CANONICAL_SYSTEMS.some(system=>!systems.has(system)))throw new TypeError('Missing canonical system.');

  const highway=universe.highway;
  if(!highway||!Array.isArray(highway.lanes)||highway.lanes.length!==3)throw new TypeError('Intention Highway requires exactly three lanes.');
  const laneRealms=new Set();
  for(const lane of highway.lanes){
    identifier(lane.id,'Lane ID');
    if(!realmIds.has(lane.realmId)||laneRealms.has(lane.realmId))throw new TypeError('Highway lanes must reference three distinct realms.');
    laneRealms.add(lane.realmId);
    if(lane.system==='anarchadia')throw new TypeError('Anarchadia is an interchange, not an intention lane.');
  }
  if(!realmIds.has(highway.interchangeRealmId))throw new TypeError('Highway interchange realm does not exist.');
  const interchange=universe.realms.find(realm=>realm.id===highway.interchangeRealmId);
  if(interchange?.system!=='anarchadia')throw new TypeError('Anarchadia must own the highway interchange.');

  if(!Array.isArray(universe.portals)||universe.portals.length<3)throw new TypeError('Universe requires portals.');
  const portalIds=new Set(),nodes=new Set([universe.nexus.id,...realmIds]);
  for(const portal of universe.portals){
    identifier(portal.id,'Portal ID');
    if(portalIds.has(portal.id))throw new TypeError('Duplicate portal ID.');
    portalIds.add(portal.id);
    if(!nodes.has(portal.from)||!nodes.has(portal.to)||portal.from===portal.to)throw new TypeError('Portal endpoints must reference distinct universe nodes.');
  }
  return true;
}

export function createUniverseScene(universe=CIVWEAVE_SEED_UNIVERSE_V1){
  validateUniverse(universe);
  const realms=universe.realms.map(realm=>({
    id:realm.id,
    system:realm.system,
    title:realm.title,
    guide:realm.guide,
    kind:realm.kind,
    position:{...realm.position}
  }));
  return {
    schema:UNIVERSE_SCHEMA,
    universeId:universe.id,
    nexus:{...universe.nexus,position:{...universe.nexus.position}},
    realms,
    highway:{
      id:universe.highway.id,
      title:universe.highway.title,
      lanes:universe.highway.lanes.map(lane=>({...lane})),
      interchangeRealmId:universe.highway.interchangeRealmId
    },
    portals:universe.portals.map(portal=>({...portal}))
  };
}

export function seedUniverse(worldweaver,{
  universe=CIVWEAVE_SEED_UNIVERSE_V1,
  actor,
  scope='standalone',
  guildId
}={}){
  validateUniverse(universe);
  if(!worldweaver||typeof worldweaver.dispatch!=='function'||typeof worldweaver.snapshot!=='function')
    throw new TypeError('A Worldweaver dispatcher is required.');
  if(!actor||typeof actor!=='object')throw new TypeError('A trusted actor is required.');
  if(!['standalone','guild-map'].includes(scope))throw new TypeError('Invalid universe scope.');
  if(scope==='guild-map'&&(typeof guildId!=='string'||!guildId.trim()))throw new TypeError('Guild map universe requires a Guild ID.');

  const instances={};
  for(const realm of universe.realms){
    let snapshot=worldweaver.snapshot();
    let instance=snapshot.instances.find(row=>row.guide===realm.guide&&row.title===realm.title);
    if(!instance){
      const receipt=worldweaver.dispatch({
        type:'create',
        guide:realm.guide,
        title:realm.title,
        description:realm.description,
        scope,
        guildId
      },actor);
      instance=receipt.instance;
    }
    instances[realm.id]=instance.id;

    snapshot=worldweaver.snapshot();
    const existingTitles=new Set(snapshot.stations.filter(row=>row.instanceId===instance.id).map(row=>row.title));
    for(const station of realm.stations){
      if(existingTitles.has(station.title))continue;
      worldweaver.dispatch({
        type:'add-station',
        instanceId:instance.id,
        stationType:station.stationType,
        title:station.title,
        instructions:station.instructions
      },actor);
    }
  }

  return {
    universeId:universe.id,
    revision:universe.revision,
    instances:{...instances},
    scene:createUniverseScene(universe),
    snapshot:worldweaver.snapshot()
  };
}

validateUniverse(CIVWEAVE_SEED_UNIVERSE_V1);
