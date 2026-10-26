import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const source=readFileSync(new URL('../public/app/anarchadia-runtime-stability-v159.js',import.meta.url),'utf8');
const read=name=>readFileSync(new URL(`../public/app/${name}`,import.meta.url),'utf8');
const handoffKey='civweave.active-handoff.v1';
function harness({embedded=true,document}={}){
  const storage=new Map(),assignments=[],navigations=[],clicks=[];
  const context={console,URL,URLSearchParams,structuredClone,
    document:document||{readyState:'loading',scripts:[],addEventListener:(name,handler)=>{if(name==='click')clicks.push(handler)}},addEventListener(){},dispatchEvent(){},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail}},
    location:{origin:'https://civweave-staging.pages.dev',href:`https://civweave-staging.pages.dev/app/anarchadia-console-v139.html?cabinet=1&installed=1${embedded?'&embed=1&persistentShell=1':''}`,search:`?cabinet=1&installed=1${embedded?'&embed=1&persistentShell=1':''}`,assign:url=>assignments.push(url)},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))},
    CivweaveFamilyAILoaderV105:{ensure(){},openChat(){}},
  };
  context.parent=embedded?{CivweavePersistentSystemShellV1:{anarchadiaNativePages:['governance','workbench'],navigate:(system,options)=>{navigations.push({system,options});return true}}}:context;
  vm.createContext(context);vm.runInContext(source,context,{filename:'anarchadia-runtime-stability-v159.js'});
  return{context,storage,assignments,navigations,api:context.AnarchadiaRuntimeStabilityV159,click(selector,dataset){for(const handler of clicks)handler({target:{closest:query=>query===selector?{dataset}:null},preventDefault(){},stopImmediatePropagation(){}})}};
}
function fixture(realm='cerbanimo'){
  const path={id:'qa-work-path',realm,title:'QA note',purpose:'Write a small digital note',steps:['Write alpha','Add beta','Add gamma'],completionCriteria:'The note contains alpha beta gamma.'};
  return{path,plan:{id:'qa-weave',state:'active',wish:'Write a QA note',paths:[path]}};
}

for(const realm of ['cerbanimo','living-school','fellowfare'])test(`Passport ${realm} path delegates to the existing parent shell`,()=>{
  const app=harness(),{plan,path}=fixture(realm);
  assert.equal(app.api.openQuestPath(plan,path),true);
  assert.equal(app.assignments.length,0,'the child must not navigate itself into another shell');
  assert.equal(app.navigations.length,1);assert.equal(app.navigations[0].system,realm);
  assert.equal(app.navigations[0].options.source,'anarchadia-passport');
  const handoff=JSON.parse(app.storage.get(handoffKey));
  assert.equal(handoff.weaveId,plan.id);assert.equal(handoff.pathId,path.id);assert.equal(handoff.target,realm);
});

test('a direct top-level Passport keeps its realm URL and path context fallback',()=>{
  const app=harness({embedded:false}),{plan,path}=fixture();
  assert.equal(app.api.openQuestPath(plan,path),true);assert.equal(app.navigations.length,0);
  const target=new URL(app.assignments[0],app.context.location.origin);
  assert.equal(target.pathname,'/app/realm-console-v140.html');assert.equal(target.searchParams.get('system'),'cerbanimo');
  assert.equal(target.searchParams.get('weave'),plan.id);assert.equal(target.searchParams.get('path'),path.id);
});

test('the saved handoff reaches the real Cerbanimo engine without explicit iframe query parameters',()=>{
  const app=harness(),{plan,path}=fixture();app.api.openQuestPath(plan,path);
  vm.runInContext(read('cerbanimo-quest-engine-v144.js'),app.context,{filename:'cerbanimo-quest-engine-v144.js'});
  vm.runInContext(read('cerbanimo-quest-path-v266.js'),app.context,{filename:'cerbanimo-quest-path-v266.js'});
  const result=app.context.CivweaveCerbanimoQuestPathV266.materialize();
  assert.equal(result.ok,true);assert.equal(result.quest.sourceActionId,`${plan.id}:${path.id}`);
  const quests=app.context.CivweaveCerbanimoQuestV144.readState().quests;
  assert.equal(quests.length,1);assert.deepEqual(Array.from(quests[0].tasks,task=>task.title),path.steps);
  assert.equal(app.context.CivweaveCerbanimoQuestPathV266.materialize().ok,true);
  assert.equal(app.context.CivweaveCerbanimoQuestV144.readState().quests.length,1,'retry remains idempotent');
});

test('an unapproved plan cannot navigate or create a handoff',()=>{
  const app=harness(),{plan,path}=fixture();plan.state='review';
  assert.equal(app.api.openQuestPath(plan,path),false);assert.equal(app.navigations.length,0);assert.equal(app.assignments.length,0);assert.equal(app.storage.has(handoffKey),false);
});

for(const [selector,dataset,page,extra] of [
  ['[data-ag145-open]',{ag145Open:'proposal & approval'},'governance',{proposal:'proposal & approval'}],
  ['[data-anarchadia-workbench]',{anarchadiaWorkbench:'charter'},'workbench',{nativeRoute:'charter'}]
])test(`embedded ${page} delegates to the exact-route parent owner`,()=>{
  const app=harness();app.click(selector,dataset);
  assert.equal(app.assignments.length,0,'The child must not navigate outside the frame launch owned by the parent.');
  assert.equal(app.navigations.length,1);assert.equal(app.navigations[0].system,'anarchadia');
  assert.equal(app.navigations[0].options.nativePage,page);
  for(const [key,value] of Object.entries(extra))assert.equal(app.navigations[0].options[key],value);
});

test('an Anarchadia Passport path delegates its exact Quest and native workbench context',()=>{
  const app=harness(),{plan,path}=fixture('anarchadia');
  assert.equal(app.api.openQuestPath(plan,path),true);assert.equal(app.assignments.length,0);
  const target=app.navigations[0];assert.equal(target.system,'anarchadia');
  assert.equal(target.options.nativePage,'workbench');assert.equal(target.options.nativeRoute,'overview');
  assert.equal(target.options.weave,plan.id);assert.equal(target.options.path,path.id);
  assert.equal(JSON.parse(app.storage.get(handoffKey)).pathId,path.id);
});

test('native page fallback preserves real launch context without inventing embedding for standalone pages',()=>{
  for(const embedded of [true,false]){
    const app=harness({embedded});if(embedded)delete app.context.parent.CivweavePersistentSystemShellV1;
    app.click('[data-ag145-open]',{ag145Open:'proposal & approval'});
    const target=new URL(app.assignments[0],app.context.location.origin);
    assert.equal(target.pathname,'/app/anarchadia-governance-v145.html');assert.equal(target.searchParams.get('proposal'),'proposal & approval');
    assert.equal(target.searchParams.get('installed'),'1');assert.equal(target.searchParams.get('cabinet'),'1');
    assert.equal(target.searchParams.get('embed'),embedded?'1':null);assert.equal(target.searchParams.get('persistentShell'),embedded?'1':null);
  }
});

function shellHarness(){
  const assignments=[],history=[],events=new Map(),host={dataset:{}},loading={hidden:true},error={dataset:{}};
  Object.defineProperty(host,'src',{set(href){assignments.push({href,expected:host.dataset.cwExpectedHref});host._src=href},get(){return host._src}});
  const context={URL,URLSearchParams,location:{origin:'https://civweave.test',href:'https://civweave.test/app/persistent-system-shell-v1.html?system=anarchadia',search:'?system=anarchadia'},
    document:{readyState:'loading',documentElement:{dataset:{}},getElementById:id=>({'cw-persistent-system-stage':host,'cw-persistent-system-loading':loading,'cw-persistent-system-error':error})[id],querySelector:()=>null,addEventListener(){}},
    history:{pushState:(_state,_title,url)=>history.push(url),replaceState:(_state,_title,url)=>history.push(url)},
    localStorage:{setItem(){},getItem:()=>null},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
    addEventListener:(name,handler)=>events.set(name,handler),dispatchEvent(){},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail}}};
  vm.createContext(context);vm.runInContext(read('persistent-system-shell-v1.js'),context);
  return{context,api:context.CivweavePersistentSystemShellV1,host,assignments,history,events};
}

test('the parent launches only fixed native Anarchadia pages and records identity before navigation',()=>{
  const app=shellHarness();
  for(const [nativePage,nativeRoute,pathname] of [['governance','','/app/anarchadia-governance-v145.html'],['workbench','charter','/app/services/anarchadia/workbench.html']]){
    const options={nativePage,nativeRoute,proposal:'qa & consent',weave:'qa-weave',path:'qa-path'};
    assert.equal(app.api.navigate('anarchadia',options),true);
    const launch=app.assignments.at(-1),target=new URL(launch.href);
    assert.equal(launch.expected,launch.href,'Every native launch must establish its exact expected URL before assigning src.');
    assert.equal(target.pathname,pathname);assert.equal(target.searchParams.get('embed'),'1');assert.equal(target.searchParams.get('persistentShell'),'1');assert.equal(target.searchParams.get('installed'),'1');assert.equal(target.searchParams.get('cabinet'),'1');
    const shellUrl=new URL(app.history.at(-1),'https://civweave.test');assert.equal(shellUrl.searchParams.get('nativePage'),nativePage);
    if(nativePage==='governance')assert.equal(target.searchParams.get('proposal'),'qa & consent');
    else{assert.equal(target.hash,'#charter');assert.equal(target.searchParams.get('weave'),'qa-weave');assert.equal(target.searchParams.get('path'),'qa-path')}
  }
  for(const [system,nativePage] of [['cerbanimo','governance'],['anarchadia','https://evil.test/'],['anarchadia','../unlisted']]){
    const target=app.api.contentUrl(system,{nativePage,nativeRoute:'javascript:alert(1)'});
    assert.equal(target.pathname,system==='cerbanimo'?'/app/realm-console-v140.html':'/app/anarchadia-console-v139.html');
    assert.equal(target.hash,'');assert.equal(app.api.shellUrl(system,{nativePage}).searchParams.get('nativePage'),null);
  }
  assert.equal(app.api.contentUrl('anarchadia',{nativePage:'workbench',nativeRoute:'javascript:alert(1)'}).hash,'#workbench');
});

test('native subpages retain strict parent frame identity while allowing local workbench tabs',()=>{
  const source=read('persistent-system-shell-v1.js'),start=source.indexOf('function frameMatchesExpected('),end=source.indexOf('function suppressChildChrome(',start);
  assert.ok(start>=0&&end>start);
  const context={URL,location:{href:'https://civweave.test/app/persistent-system-shell-v1.html'}};
  vm.createContext(context);vm.runInContext(`${source.slice(start,end)}\nglobalThis.matches=frameMatchesExpected;`,context);
  const app=shellHarness();
  for(const options of [{nativePage:'governance',proposal:'qa-proposal'},{nativePage:'workbench',nativeRoute:'charter',weave:'qa-weave',path:'qa-path'}]){
    const expected=app.api.contentUrl('anarchadia',options).href;
    const host=href=>({dataset:{cwExpectedHref:expected},contentWindow:{location:{href}}});
    assert.equal(context.matches(host(expected)),true);
    assert.equal(context.matches(host(expected.replace('.html?','?'))),true,'Pages clean URLs retain the same native frame identity.');
    assert.equal(context.matches(host(`${expected.split('#')[0]}&view=local#readiness`)),true,'Native view changes do not create another chrome owner.');
    for(const actual of [
      expected.replace('civweave.test','foreign.test'),
      expected.replace('embed=1','embed=0'),
      expected.replace('persistentShell=1','persistentShell=0'),
      app.api.contentUrl('anarchadia').href,
      app.api.contentUrl('anarchadia',{nativePage:options.nativePage==='governance'?'workbench':'governance'}).href,
      expected.replace(options.proposal||options.path,'stale-context')
    ])assert.equal(context.matches(host(actual)),false,'A different origin, native page, launch flag, or requested artifact must not be adopted.');
  }
});

test('actual native documents identify Anarchadia before the parent checks readiness',()=>{
  for(const path of ['anarchadia-governance-v145.html','services/anarchadia/workbench.html']){
    const dom=new JSDOM(read(path));
    try{assert.equal(dom.window.document.documentElement.dataset.civweaveSystem,'anarchadia',`${path} must be recognizable before its modules execute.`)}finally{dom.window.close()}
  }
});

test('Passport actions follow the displayed Quest and revoke a retained action when review replaces it',()=>{
  const dom=new JSDOM('<div id="ac-passport-paths"><article class="ac-path-card"></article></div>');
  const app=harness({document:dom.window.document}),old=fixture('cerbanimo'),next=fixture('living-school');
  next.plan.id='next-weave';next.path.id='next-learning';
  app.storage.set('civweave.working-campus.v1',JSON.stringify({plan:old.plan}));
  app.storage.set('civweave.intentions.v127',JSON.stringify([{state:'active',plan:old.plan}]));
  app.api.mountQuestPathActions();
  const oldButton=dom.window.document.querySelector('button');assert.equal(oldButton.textContent,'Open in Cerbanimo');
  app.storage.set('civweave.working-campus.v1',JSON.stringify({plan:next.plan}));
  app.api.mountQuestPathActions();
  const button=dom.window.document.querySelector('button');
  assert.equal(button.textContent,'Open in Living School');button.click();
  assert.equal(app.navigations.at(-1).system,'living-school');
  assert.equal(JSON.parse(app.storage.get(handoffKey)).weaveId,next.plan.id);
  next.plan.state='review';app.storage.set('civweave.working-campus.v1',JSON.stringify({plan:next.plan}));
  app.api.mountQuestPathActions();
  assert.equal(dom.window.document.querySelector('button'),null,'Review cannot expose another active Quest’s destination.');
  button.click();oldButton.click();assert.equal(app.navigations.length,1,'Retained stale controls cannot navigate or write handoffs.');
  dom.window.close();
});
