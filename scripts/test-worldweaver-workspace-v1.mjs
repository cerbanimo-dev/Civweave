import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkspace, SPACE_TEMPLATES, WORKSPACE_STORAGE_KEY, WORKSPACE_SCHEMA,
} from '../public/app/shared/worldweaver-workspace-v1.mjs';
import {SPACE_GUIDES, WORLDWEAVER_SCHEMA} from '../public/app/shared/worldweaver-core-v1.mjs';

const storageKit=()=>{
  const values=new Map();
  let writes=0;
  return {
    getItem:key=>values.get(key)??null,
    setItem(key,value){writes++;values.set(key,value)},
    values,
    get writes(){return writes},
  };
};
const make=(storage=storageKit())=>{
  let count=0;
  return createWorkspace({storage,id:()=>`draft-${++count}`,clock:()=> '2026-10-30T12:00:00.000Z'});
};
const create=(workspace,guide='moss',title='Practice together')=>workspace.dispatch({type:'create',guide,title}).instance;

test('opening reads only, and unavailable persistence fails only on explicit save',()=>{
  const storage=storageKit(),workspace=make(storage);
  assert.equal(storage.writes,0);
  assert.equal(workspace.snapshot().instances.length,0);
  const unavailable=createWorkspace({storage:null});
  assert.equal(unavailable.snapshot().instances.length,0);
  assert.throws(()=>create(unavailable),/storage|saved|available/i);
  assert.equal(unavailable.snapshot().revision,0);
});

test('the four immutable templates use the canonical core kinds and existing feature destinations',()=>{
  assert.equal(SPACE_TEMPLATES.length,4);
  for(const template of SPACE_TEMPLATES){
    assert.equal(template.kind,SPACE_GUIDES[template.guide]);
    assert.ok(template.system&&template.feature&&template.refType&&template.description&&template.color);
    assert.ok(Object.isFrozen(template));
    assert.ok(Object.isFrozen(template.stationTypes));
  }
  assert.ok(Object.isFrozen(SPACE_TEMPLATES));
});

test('local edits persist canonical manifests and reload without touching other storage',()=>{
  const storage=storageKit();storage.values.set('civweave.private-guide-thread','private');
  const workspace=make(storage),space=create(workspace);
  workspace.dispatch({type:'add-station',instanceId:space.id,stationType:'practice',title:'Try the sequence',instructions:'Arrange the stages.'});
  workspace.dispatch({type:'link',instanceId:space.id,refType:'learning-path',refId:'journey-123'});
  workspace.dispatch({type:'rig-npc',instanceId:space.id,modelId:'qwen3.5:4b',name:'Workshop host',pilotPrompt:'Explain one step at a time.',capabilities:['observe','speak']});
  const saved=JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY));
  assert.equal(saved.schema,WORKSPACE_SCHEMA);
  assert.equal(saved.snapshot.schema,WORLDWEAVER_SCHEMA);
  assert.equal(saved.snapshot.instances[0].status,'draft');
  assert.equal(saved.snapshot.instances[0].world,null);
  assert.equal(saved.snapshot.npcs[0].pilotPrincipalId,'local-draft-pilot');
  assert.deepEqual(make(storage).snapshot(),workspace.snapshot());
  assert.equal(storage.getItem('civweave.private-guide-thread'),'private');
});

test('local editing cannot provision, attest, execute pilots, or claim Guild authority',()=>{
  const storage=storageKit(),workspace=make(storage),space=create(workspace);
  const before=workspace.snapshot(),writes=storage.writes;
  for(const command of [
    {type:'request-provision',instanceId:space.id},
    {type:'provisioned',instanceId:space.id,backend:'opensim',worldRef:'grid-1'},
    {type:'queue-actions',npcId:'npc-1',actions:[{tool:'speak'}]},
    {type:'report-action',intentId:'intent-1',outcome:'succeeded'},
    {type:'create',guide:'moss',title:'Guild',scope:'guild-map',guildId:'guild-1'},
    {type:'create',guide:'moss',title:'Hidden Guild',guildId:'guild-1'},
    {type:'create',guide:'toString',title:'Unknown template'},
    {type:'rig-npc',instanceId:space.id,modelId:'qwen',pilotPrincipalId:'authenticated-person',name:'Host',pilotPrompt:'Speak'},
  ])assert.throws(()=>workspace.dispatch(command));
  assert.deepEqual(workspace.snapshot(),before);
  assert.equal(storage.writes,writes);
});

test('failed persistence does not advance the displayed or saved manifest',()=>{
  const storage=storageKit(),workspace=make(storage);create(workspace);
  const before=workspace.snapshot(),raw=storage.getItem(WORKSPACE_STORAGE_KEY);
  storage.setItem=()=>{throw new Error('Quota exceeded')};
  assert.throws(()=>create(workspace),/saved|quota|storage/i);
  assert.deepEqual(workspace.snapshot(),before);
  assert.equal(storage.getItem(WORKSPACE_STORAGE_KEY),raw);
});

test('stale writers preserve the other tab and can explicitly reload before retrying',()=>{
  const storage=storageKit(),first=make(storage),second=make(storage);
  create(first);
  assert.throws(()=>create(second),/another tab|changed|reload/i);
  assert.equal(second.snapshot().instances.length,0);
  assert.equal(JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY)).snapshot.instances.length,1);
  second.reload();
  assert.deepEqual(second.snapshot(),first.snapshot());
  // A different ID generator models the independent second tab after reload.
  const third=createWorkspace({storage,id:()=> 'tab-two-1'});
  create(third,'rook');
  assert.equal(third.snapshot().instances.length,2);
  assert.throws(()=>create(first),/another tab|changed|reload/i);
});

test('malformed storage is visible and never silently replaced',()=>{
  for(const raw of ['{broken','null',JSON.stringify({schema:WORKSPACE_SCHEMA,snapshot:{schema:WORLDWEAVER_SCHEMA,instances:[],journal:[]}})]){
    const storage=storageKit();storage.values.set(WORKSPACE_STORAGE_KEY,raw);
    assert.throws(()=>make(storage),/invalid|corrupt|read/i);
    assert.equal(storage.getItem(WORKSPACE_STORAGE_KEY),raw);
    assert.equal(storage.writes,0);
  }
});

test('reload preserves current in-memory state when the replacement storage is invalid',()=>{
  const storage=storageKit(),workspace=make(storage);create(workspace);
  const before=workspace.snapshot();storage.values.set(WORKSPACE_STORAGE_KEY,'{broken');
  assert.throws(()=>workspace.reload(),/invalid|corrupt|read/i);
  assert.deepEqual(workspace.snapshot(),before);
});

test('loaded data cannot smuggle live worlds, detached records, duplicate IDs or extra fields',()=>{
  const baseStorage=storageKit(),workspace=make(baseStorage),space=create(workspace);
  workspace.dispatch({type:'add-station',instanceId:space.id,stationType:'practice',title:'Station',instructions:'Try it.'});
  const original=JSON.parse(baseStorage.getItem(WORKSPACE_STORAGE_KEY));
  const mutations=[
    value=>{value.snapshot.instances[0].status='live';value.snapshot.instances[0].world={backend:'opensim',worldRef:'fake'}},
    value=>{value.snapshot.stations[0].instanceId='missing'},
    value=>{value.snapshot.stations[0].id=space.id},
    value=>{value.snapshot.instances[0].accessToken='secret'},
    value=>{value.snapshot.links.push({id:'link-1',instanceId:space.id,refType:'governance-ballot',refId:'ballot-1',authoritative:false,linkedBy:'local-draft-human'})},
    value=>{value.snapshot.revision=-1},
  ];
  for(const mutate of mutations){
    const value=structuredClone(original);mutate(value);
    const storage=storageKit(),raw=JSON.stringify(value);storage.values.set(WORKSPACE_STORAGE_KEY,raw);
    assert.throws(()=>make(storage),/invalid|corrupt|read/i);
    assert.equal(storage.getItem(WORKSPACE_STORAGE_KEY),raw);
  }
});

test('exports include the exact selected space and exclude unrelated records',()=>{
  const workspace=make(),first=create(workspace),second=create(workspace,'rook','Private shop');
  workspace.dispatch({type:'add-station',instanceId:first.id,stationType:'practice',title:'Public station',instructions:'Practice.'});
  workspace.dispatch({type:'link',instanceId:second.id,refType:'fellowfare-listing',refId:'private-listing'});
  const exported=workspace.exportInstance(first.id);
  assert.equal(exported.schema,WORLDWEAVER_SCHEMA);
  assert.deepEqual(exported.instances.map(row=>row.id),[first.id]);
  assert.equal(exported.stations.length,1);
  assert.equal(exported.links.length,0);
  assert.ok(exported.journal.every(row=>row.instanceId===first.id));
  assert.ok(!JSON.stringify(exported).includes('Private shop'));
  assert.throws(()=>workspace.exportInstance('missing'),/unknown|select/i);
  exported.instances[0].title='Changed copy';
  assert.notEqual(workspace.snapshot().instances[0].title,'Changed copy');
});

test('bounded local work rejects a twenty-fifth space without writing or losing earlier spaces',()=>{
  const storage=storageKit(),workspace=make(storage);
  for(let i=0;i<24;i++)create(workspace);
  const writes=storage.writes;
  assert.throws(()=>create(workspace),/limit|24/i);
  assert.equal(workspace.snapshot().instances.length,24);
  assert.equal(storage.writes,writes);
});

test('duplicate generated identifiers fail before a second saved record can overwrite identity',()=>{
  const storage=storageKit(),workspace=createWorkspace({storage,id:()=> 'same-id'});create(workspace);
  const before=workspace.snapshot();
  assert.throws(()=>create(workspace),/identifier|duplicate|invalid/i);
  assert.deepEqual(workspace.snapshot(),before);
  assert.equal(JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY)).snapshot.instances.length,1);
});
