import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {executeGuildQuestAction,guildQuestAction,projectGuildQuest} from '../cloudflare/mobile-guild-edge/src/guild-quest-publications-v1.mjs';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const source=await read('public/app/cerbanimo-intention-landscape-v1.js');
const mapSource=await read('public/app/shared/quest-pathway-map-v1.js');
const draft={id:'weave-fixture',kind:'weave-plan',text:'Fictional repair afternoon',state:'review',conversation:['private conversation'],plan:{id:'weave-fixture',schema:'civweave.intention-weave.v1',title:'Fictional repair afternoon',wish:'private original wish',outcome:'Fix the fictional shared stool',profile:{constraints:'private profile'},paths:[{id:'learn',realm:'living-school',title:'Learn the joint',purpose:'Practice safely',steps:['Inspect the fictional joint'],progress:[],evidence:{secret:'private proof'}}]}};
function dependencyDraft(){const raw=structuredClone(draft);raw.plan.paths=[
  {id:'agree',realm:'anarchadia',title:'Agree on shared use',status:'completed',steps:[{id:'agree-note',title:'Record the agreement',status:'accepted',privateNote:'PRIVATE NOTE'}],dependsOn:[]},
  {id:'learn',realm:'living-school',title:'Practise the repair',steps:['Practise a safe fit'],dependsOn:['agree']},
  {id:'gather',realm:'fellowfare',title:'Borrow a clamp',steps:[{id:'borrow',title:'Arrange the loan',dependencies:[{id:'agree-note',privateNote:'PRIVATE REF NOTE'}],evidence:['PRIVATE PROOF']}],dependsOn:['agree']},
  {id:'build',realm:'cerbanimo',title:'Repair the joint',steps:[{id:'fit',title:'Fit the joint',dependencyIds:['borrow'],credential:'PRIVATE CREDENTIAL'}],dependsOn:['learn','gather']},
];raw.plan.dependencyOrder={source:'PRIVATE UNRELATED AUTHORITY',token:'PRIVATE TOKEN'};return raw}
const session={nodeId:'fictional-guild',userId:'fixture-author',origin:'https://fixture-guild.test',token:'fixture-token'};
const guild={id:session.nodeId,displayName:'Fictional Repair Guild',publicOrigin:session.origin};
const flush=()=>new Promise(resolve=>setTimeout(resolve,20));

class MemoryStorage{
  rows=new Map();
  async get(key){return structuredClone(this.rows.get(key))}
  async put(key,value){this.rows.set(key,structuredClone(value))}
  async delete(key){this.rows.delete(key)}
  async list({prefix='',startAfter='',limit=Infinity}={}){return new Map([...this.rows].filter(([key])=>key.startsWith(prefix)&&key>startAfter).sort(([a],[b])=>a.localeCompare(b)).slice(0,limit).map(([key,value])=>[key,structuredClone(value)]))}
  async transaction(run){return run(this)}
}
function fixtureService(){
  const storage=new MemoryStorage();
  return{storage,execute:(userId,action,input,nodeId=session.nodeId)=>executeGuildQuestAction(storage,{userId,nodeId,guildId:session.nodeId},action,input)};
}

async function browser({userId=session.userId,drafts=[draft],service=fixtureService(),rejectPublish=false,rejectList=false,startupQuery='',loggedIn=true,expiresAt=null,nodeId=session.nodeId,clientEnabled=true,ludMode=false,directoryGuild={}}={}){
  const dom=new JSDOM('<!doctype html><html data-system="civweave"><body><main id="rc-app"><div class="rc-shell"><header class="rc-top"></header></div></main></body></html>',{url:'https://civweave.test/app/civweave-guild-quest-v1.html'+startupQuery,runScripts:'outside-only'}),win=dom.window,requests=[];
  win.structuredClone=structuredClone;
  win.TextEncoder=TextEncoder;Object.defineProperty(win.crypto,'subtle',{value:crypto.subtle});
  win.localStorage.setItem('civweave.host-node.selection.v1',JSON.stringify({...guild,id:nodeId,nodeId,origin:session.origin}));
  win.localStorage.setItem('civweave.intentions.v127',JSON.stringify(drafts));
  win.CivweaveHostNodeSessionV1={sessionFor:id=>loggedIn&&(!id||id===nodeId)?{...session,nodeId,userId,expiresAt}:null,ensureSelected:async()=>loggedIn?{...session,nodeId,userId,expiresAt}:null};
  win.fetch=async(input,options={})=>{
    const url=new URL(input,win.location.origin),path=url.pathname;requests.push({url,options});
    if(path==='/api/hub-map-nodes')return{ok:true,json:async()=>({ok:true,schema:'civweave.hub-map-directory.v1',nodes:[{...guild,...directoryGuild,id:nodeId}]})};
    if(path.startsWith('/api/node/quests')){
      assert.equal(options.headers.authorization,`Bearer ${session.token}`);assert.equal(options.headers['x-civweave-node-id'],nodeId);
      if(rejectList&&path==='/api/node/quests')return{ok:false,status:503,json:async()=>({ok:false,error:'Fictional board is unavailable.'})};
      if(path.endsWith('/publish')&&rejectPublish)return{ok:false,status:503,json:async()=>({ok:false,error:'Fictional Guild is temporarily unavailable.'})};
      try{const route=guildQuestAction(new Request(url,{method:options.method||'GET'})),body=options.body?JSON.parse(options.body):{},packet=await service.execute(userId,route.action,{...body,...route.input},nodeId);return{ok:true,json:async()=>packet}}catch(error){return{ok:false,status:error.status||500,json:async()=>({ok:false,error:error.message})}}
    }
    throw new Error(`Unexpected fixture request: ${path}`);
  };
  if(ludMode){win.eval(await read('public/app/content-provenance-v1.js'));win.eval(await read('public/app/lud-mode-v1.js'));win.CivweaveLudModeV1.enable()}
  if(clientEnabled)win.eval(await read('public/app/guild-quest-client-v1.js'));
  win.eval(mapSource);win.eval(source);await flush();
  const click=async selector=>{const control=win.document.querySelector(selector);assert.ok(control,`Missing control ${selector}`);control.click();await flush()};
  return{win,requests,click,close:()=>win.close()};
}

test('private local Quests never appear as published Guild board records',async()=>{
  const b=await browser();try{
    assert.equal(b.win.document.querySelectorAll('[data-quest-index]').length,0);
    assert.match(b.win.document.body.textContent,/0 shared Quests/);
    assert.doesNotMatch(b.win.document.body.textContent,/private original wish|private conversation|private profile/);
    assert.ok(b.win.document.querySelector('[data-quest-action="compose"]'));
  }finally{b.close()}
});

test('submission requires a named Guild preview and explicit final action, then another member reads the hosted record',async()=>{
  const service=fixtureService(),a=await browser({service});let b;
  try{
    await a.click('[data-quest-action="compose"]');
    assert.equal(a.requests.filter(row=>row.options.method==='POST').length,0);
    assert.match(a.win.document.body.textContent,/Fictional Repair Guild/);
    assert.match(a.win.document.body.textContent,/Fictional repair afternoon/);
    assert.match(a.win.document.body.textContent,/Inspect the fictional joint/);
    assert.doesNotMatch(a.win.document.body.textContent,/private original wish|private conversation|private profile|private proof/);
    await a.click('[data-quest-action="publish"]');
    const request=a.requests.find(row=>row.options.method==='POST');assert.ok(request);
    assert.equal(request.url.origin,session.origin);
    assert.equal(request.options.headers.authorization,`Bearer ${session.token}`);
    assert.equal(request.options.headers['x-civweave-node-id'],session.nodeId);
    assert.equal(request.url.searchParams.get('nodeId'),session.nodeId);
    assert.doesNotMatch(request.options.body,/private original wish|private conversation|private profile|private proof/);
    assert.equal(JSON.parse(request.options.body).expectedRevision,0);
    b=await browser({userId:'fictional-second-member',drafts:[],service,nodeId:'fictional-starter-b'});
    await b.click('[data-advance="guild"]');
    assert.match(b.win.document.body.textContent,/Fictional repair afternoon/);
    await b.click('[data-advance="quest"]');
    assert.equal(b.win.document.querySelectorAll('[data-quest-map-lane]').length,4);
    assert.match(b.win.document.body.textContent,/Inspect the fictional joint/);
  }finally{a.close();b?.close()}
});

test('opening a specific map submission previews that exact local Quest and never posts automatically',async()=>{
  const other=structuredClone(draft);other.id=other.plan.id='different-local-quest';other.plan.title='Another local Quest';const b=await browser({drafts:[other,draft]});try{
    assert.equal(b.win.CivweaveGuildQuestTrackerV1.openSubmission(draft.id),true);await flush();assert.equal(b.requests.filter(row=>row.options.method==='POST').length,0);assert.equal(b.win.document.querySelector('[data-quest-draft]').value,draft.id);assert.match(b.win.document.querySelector('.cil-submit-preview').textContent,/Fictional repair afternoon/);assert.doesNotMatch(b.win.document.querySelector('.cil-submit-preview').textContent,/Another local Quest/);
    assert.equal(b.win.CivweaveGuildQuestTrackerV1.openSubmission('missing-quest'),false);assert.equal(b.requests.filter(row=>row.options.method==='POST').length,0);
  }finally{b.close()}
});

test('shared map nodes inspect the actual publication without creating or activating a private Quest',async()=>{
  const service=fixtureService();await service.execute(session.userId,'publish',{quest:draft,expectedRevision:0});const b=await browser({service,userId:'second-reader',drafts:[]});try{
    await b.click('[data-advance="guild"]');await b.click('[data-advance="quest"]');const map=b.win.document.querySelector('[data-quest-pathway-map]');assert.ok(map);assert.match(map.textContent,/Member-reported snapshot/);assert.equal(map.querySelector('[data-quest-map-action="edit"]'),null);await b.click('[data-quest-map-action="inspect"][data-step-index="0"]');assert.match(b.win.document.querySelector('[data-quest-map-selection]').textContent,/Inspect the fictional joint/);assert.equal(JSON.parse(b.win.localStorage.getItem('civweave.intentions.v127')).length,0);assert.equal(b.requests.filter(row=>row.options.method==='POST').length,0);
  }finally{b.close()}
});

test('a map submission URL waits for its actual Guild board and never loops or posts on an unavailable board',async()=>{
  const b=await browser({startupQuery:'?submitQuest='+draft.id,rejectList:true});try{await flush();assert.match(b.win.document.body.textContent,/Fictional board is unavailable/);assert.equal(b.requests.filter(row=>row.url.pathname==='/api/node/quests').length,1);assert.equal(b.requests.some(row=>row.options.method==='POST'),false)}finally{b.close()}
  const ready=await browser({startupQuery:'?submitQuest='+draft.id});try{await flush();assert.equal(ready.win.document.querySelector('[data-quest-draft]')?.value,draft.id);assert.equal(ready.requests.some(row=>row.options.method==='POST'),false);assert.equal(ready.win.CivweaveGuildQuestTrackerV1.openSubmission(draft.id+'x'.repeat(180)),false)}finally{ready.close()}
});

test('failed submissions remain reviewable and are never represented as published',async()=>{
  const b=await browser({rejectPublish:true});try{
    await b.click('[data-quest-action="compose"]');await b.click('[data-quest-action="publish"]');
    assert.match(b.win.document.body.textContent,/Fictional Guild is temporarily unavailable/);
    assert.ok(b.win.document.querySelector('[data-quest-action="publish"]'));
    assert.equal(b.win.document.querySelectorAll('[data-quest-index]').length,0);
  }finally{b.close()}
});

test('Endeavor records are excluded and a different Guild cannot reuse the selected Guild bearer',async()=>{
  const b=await browser({drafts:[{id:'endeavor',kind:'quest',canonicalArtifact:'Endeavor',plan:{title:'Private Endeavor'}}]});try{
    await b.click('[data-quest-action="compose"]');
    assert.doesNotMatch(b.win.document.body.textContent,/Private Endeavor/);
    assert.equal(b.win.document.querySelector('[data-quest-action="publish"]'),null);
    await assert.rejects(b.win.CivweaveGuildQuestsV1.list({id:'different-guild',publicOrigin:'https://other.test'}),/log in|membership/i);
    assert.equal(b.requests.some(row=>row.url.origin==='https://other.test'),false);
  }finally{b.close()}
});

test('the reviewed browser snapshot matches the canonical server privacy projection exactly',async()=>{
  const b=await browser();try{
    const rich=structuredClone(draft);rich.plan.paths[0].steps.push({id:'second-step',title:'Check fit',description:'Try the fictional joint',status:'verified',evidence:['private proof']});rich.plan.paths[0].completionCriteria='The fictional stool is stable';rich.plan.paths[0].progress=[0,0,-1,90];rich.needs=[{title:'Fictional clamps',realm:'fellowfare',status:'open',owner:'PRIVATE PERSON'}];
    for(const input of [draft,rich])assert.equal(JSON.stringify(b.win.CivweaveGuildQuestsV1.preview(input)),JSON.stringify(projectGuildQuest(input)));
    const wrong=structuredClone(draft);wrong.plan.id='different-id';assert.throws(()=>b.win.CivweaveGuildQuestsV1.preview(wrong),/identifiers must match/);
    assert.doesNotMatch(JSON.stringify(b.win.CivweaveGuildQuestsV1.preview(rich)),/private|PRIVATE|evidence|owner/i);
  }finally{b.close()}
});

test('shared Quest projection preserves only bounded identifiers for cross-subsystem and beat dependencies',async()=>{
  const b=await browser();try{
    const raw=dependencyDraft(),client=b.win.CivweaveGuildQuestsV1.preview(raw),server=projectGuildQuest(raw);
    assert.equal(JSON.stringify(client),JSON.stringify(server));
    assert.deepEqual(server.plan.paths.map(path=>path.dependsOn),[[],['agree'],['agree'],['learn','gather']]);
    assert.deepEqual(server.plan.paths[2].steps[0].dependsOn,['agree-note']);assert.deepEqual(server.plan.paths[3].steps[0].dependsOn,['borrow']);
    assert.doesNotMatch(JSON.stringify(client),/PRIVATE|dependencyOrder|evidence|credential|privateNote|token/i);
    const result=await fixtureService().execute(session.userId,'publish',{quest:client,expectedRevision:0});
    assert.deepEqual(result.publication.quest.plan.paths.map(path=>path.dependsOn),[[],['agree'],['agree'],['learn','gather']]);
  }finally{b.close()}
});

test('malformed, oversized or duplicate dependency and node identifiers fail closed in both projections',async()=>{
  const b=await browser();try{
    for(const change of [
      raw=>raw.plan.paths[3].dependsOn=['not an identifier'],
      raw=>raw.plan.paths[3].dependsOn=['x'.repeat(181)],
      raw=>raw.plan.paths[3].dependsOn=Array.from({length:17},(_,i)=>`ref-${i}`),
      raw=>raw.plan.paths[3].dependsOn=['learn','learn'],
      raw=>raw.plan.paths[3].dependsOn=[{privateNote:'missing identifier'}],
      raw=>raw.plan.paths[3].id='agree',
      raw=>raw.plan.paths[3].steps[0].id='agree-note',
      raw=>raw.plan.paths[3].id='<invalid>',
    ]){const raw=dependencyDraft();change(raw);assert.throws(()=>b.win.CivweaveGuildQuestsV1.preview(raw),/identif|dependenc/i);assert.throws(()=>projectGuildQuest(raw),/identif|dependenc/i)}
    assert.equal(b.requests.filter(request=>request.url.pathname.endsWith('/publish')).length,0);
  }finally{b.close()}
});

test('blank steps preserve the correct completion target after the shared snapshot is normalized',async()=>{
  const b=await browser();try{
    const input=structuredClone(draft);input.plan.paths[0].steps=[' ',{title:'',description:''},{id:'completed-step',title:'Done'},'Pending'];input.plan.paths[0].progress=[0,1,2,90];
    const browserSnapshot=b.win.CivweaveGuildQuestsV1.preview(input),serverSnapshot=projectGuildQuest(input);
    assert.equal(JSON.stringify(browserSnapshot),JSON.stringify(serverSnapshot));
    assert.deepEqual(serverSnapshot.plan.paths[0].progress,[0]);
    assert.equal(serverSnapshot.plan.paths[0].steps[0].title,'Done');
    assert.equal(serverSnapshot.plan.paths[0].steps[1],'Pending');
  }finally{b.close()}
});

test('withdrawal requires author confirmation and disappears for another Guild member',async()=>{
  const service=fixtureService(),a=await browser({service});let b;
  try{
    await a.click('[data-quest-action="compose"]');await a.click('[data-quest-action="publish"]');await a.click('[data-advance="guild"]');
    await a.click('[data-quest-action="review-withdraw"]');
    assert.equal(a.requests.filter(row=>row.url.pathname.endsWith('/withdraw')).length,0);
    await a.click('[data-quest-action="withdraw"]');
    const request=a.requests.find(row=>row.url.pathname.endsWith('/withdraw'));assert.equal(JSON.parse(request.options.body).expectedRevision,1);
    assert.equal(a.win.document.querySelectorAll('[data-quest-index]').length,0);
    assert.equal(JSON.parse(a.win.localStorage.getItem('civweave.intentions.v127'))[0].id,draft.id);
    b=await browser({userId:'fictional-second-member',drafts:[],service});await b.click('[data-advance="guild"]');
    assert.equal(b.win.document.querySelectorAll('[data-quest-index]').length,0);
  }finally{a.close();b?.close()}
});

test('stale submissions preserve the reviewed local draft and never replace a newer shared revision',async()=>{
  const service=fixtureService(),initial=await service.execute(session.userId,'publish',{quest:draft,expectedRevision:0});
  const revised=structuredClone(draft);revised.plan.outcome='Local reviewed revision';const b=await browser({service,drafts:[revised]});
  try{
    await b.click('[data-quest-action="compose"]');
    const remote=structuredClone(draft);remote.plan.outcome='Newer remote revision';await service.execute(session.userId,'publish',{quest:remote,expectedRevision:initial.publication.revision});
    await b.click('[data-quest-action="publish"]');
    assert.match(b.win.document.body.textContent,/Refresh before submitting again/);
    assert.match(b.win.document.querySelector('.cil-submit-preview').textContent,/Local reviewed revision/);
    assert.equal((await service.execute(session.userId,'list',{})).quests[0].quest.plan.outcome,'Newer remote revision');
    assert.equal(JSON.parse(b.win.localStorage.getItem('civweave.intentions.v127'))[0].plan.outcome,'Local reviewed revision');
  }finally{b.close()}
});

test('an author can explicitly resubmit a withdrawn Quest after a fresh browser session',async()=>{
  const service=fixtureService(),initial=await service.execute(session.userId,'publish',{quest:draft,expectedRevision:0});await service.execute(session.userId,'withdraw',{id:initial.publication.id,expectedRevision:1});
  const b=await browser({service});try{
    await b.click('[data-quest-action="compose"]');await b.click('[data-quest-action="publish"]');
    const request=b.requests.find(row=>row.options.method==='POST');assert.equal(JSON.parse(request.options.body).expectedRevision,2);
    const board=await service.execute(session.userId,'list',{});assert.equal(board.quests.length,1);assert.equal(board.quests[0].revision,3);
  }finally{b.close()}
});

test('expired and absent Guild sessions expose login without sending member board requests',async()=>{
  for(const options of [{loggedIn:false},{expiresAt:'2000-01-01T00:00:00Z'}]){
    const b=await browser(options);try{
      assert.ok(b.win.document.querySelector('[data-quest-action="login"]'));
      assert.equal(b.win.document.querySelector('[data-quest-action="compose"]'),null);
      assert.equal(b.requests.filter(row=>row.url.pathname.startsWith('/api/node/quests')).length,0);
    }finally{b.close()}
  }
});

test('hostile Quest titles stay inert and shared map completion is explicitly member-reported',async()=>{
  const service=fixtureService(),hostile=structuredClone(draft);hostile.plan.title='<img src=x onerror="globalThis.fixtureXss=true">';hostile.plan.paths[0].progress=[0];
  await service.execute(session.userId,'publish',{quest:hostile,expectedRevision:0});const b=await browser({service,drafts:[]});
  try{
    await b.click('[data-advance="guild"]');assert.match(b.win.document.body.textContent,/<img src=x/);assert.equal(b.win.document.querySelector('img'),null);assert.equal(b.win.fixtureXss,undefined);
    await b.click('[data-advance="quest"]');assert.match(b.win.document.body.textContent,/member-reported/i);assert.doesNotMatch(b.win.document.body.textContent,/proof state/i);
  }finally{b.close()}
});

test('the shared visual map preserves all four subsystem paths and explicitly labels unknown paths',async()=>{
  const service=fixtureService(),four=structuredClone(draft);
  four.plan.paths=[
    {id:'learn',realm:'living-school',title:'Learning',steps:['Practice the joint'],progress:[0],status:'active'},
    {id:'build',realm:'cerbanimo',title:'Building',steps:['Assemble the stool'],progress:[]},
    {id:'supply',realm:'fellowfare',title:'Resources',steps:['Borrow a clamp'],progress:[]},
    {id:'civic',realm:'anarchadia',title:'Agreement',steps:['Review the workshop agreement'],progress:[]},
    {id:'unknown',realm:'orbital-systems',title:'Orbital check',steps:['Check the fictional orbit'],progress:[]},
  ];
  const b=await browser({service,drafts:[four]});try{
    await b.click('[data-quest-action="compose"]');
    assert.match(b.win.document.querySelector('.cil-submit-preview').textContent,/Reported state: review/);
    assert.match(b.win.document.querySelector('.cil-submit-preview').textContent,/1 of 1 steps reported complete/);
    assert.match(b.win.document.querySelector('.cil-submit-preview').textContent,/Anarchadia/);
    assert.match(b.win.document.querySelector('.cil-submit-preview').textContent,/orbital-systems/);
    await b.click('[data-quest-action="publish"]');await b.click('[data-advance="guild"]');await b.click('[data-advance="quest"]');
    for(const [realm,task]of [['living-school','Practice the joint'],['cerbanimo','Assemble the stool'],['fellowfare','Borrow a clamp'],['anarchadia','Review the workshop agreement'],['unassigned','Check the fictional orbit']])assert.match(b.win.document.querySelector(`[data-quest-map-lane="${realm}"]`).textContent,new RegExp(task));
    assert.doesNotMatch(b.win.document.querySelector('[data-quest-map-lane="cerbanimo"]').textContent,/agreement|orbit/);
    assert.match(b.win.document.querySelector('[data-quest-map-lane="unassigned"]').textContent,/orbital-systems/);
  }finally{b.close()}
});

test('Lud packages without the connected client show unavailability and preserve the human-authored discovery gate',async()=>{
  const human={...structuredClone(draft),plan:{...draft.plan,title:'Human fictional Quest'},metadata:{civweaveProvenance:{origin:'human-authored'}}},generated={...structuredClone(draft),id:'ai-fixture',plan:{...draft.plan,title:'AI fictional Quest'},metadata:{civweaveProvenance:{origin:'ai-generated'}}},unknown={...structuredClone(draft),id:'unknown-fixture',plan:{...draft.plan,title:'Unknown fictional Quest'}};
  const b=await browser({clientEnabled:false,ludMode:true,directoryGuild:{sharedIntentions:[human,generated,unknown]}});try{
    assert.match(b.win.document.body.textContent,/Connected Guild Quest board unavailable/);
    assert.equal(b.win.document.querySelector('[data-quest-action="compose"]'),null);
    await b.click('[data-advance="guild"]');
    assert.match(b.win.document.body.textContent,/Human fictional Quest/);assert.doesNotMatch(b.win.document.body.textContent,/AI fictional Quest|Unknown fictional Quest/);
    assert.equal(b.requests.filter(row=>row.url.pathname.startsWith('/api/node/quests')).length,0);
    assert.equal(b.win.CivweaveLudModeV1.aiAllowed(),false);
  }finally{b.close()}
});
