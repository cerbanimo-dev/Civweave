import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const html=fs.readFileSync(new URL('../public/app/persistent-system-shell-v1.html',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('../public/app/persistent-system-shell-v1.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../public/service-worker-v203.js',import.meta.url),'utf8');
assert.match(worker,/cerbanimo-first-frame-v1/, 'Registered installed worker bytes must advance when the boot-critical HTML and integrity manifest change.');
const launch=html.match(/<script id="cw-persistent-first-frame-rescue-v1">([\s\S]*?)<\/script>/)?.[1];
assert.ok(launch,'Independent shell first-frame launch must be included inline in the HTML.');

function harness({system='cerbanimo',valid=true,redirect=false,actualSystem=system,query=''}={}){
  const handlers={},timers=[],children=[],nodes={};
  const element=(type='div')=>({type,style:{},dataset:{},hidden:false,children:[],textContent:'',append(...items){this.children.push(...items)},replaceChildren(...items){this.children=[...items]},addEventListener(type,fn){(this.handlers||= {})[type]=fn}});
  const frame=element('iframe'),loading=element(),error=element();
  loading.hidden=false;error.dataset.open='0';
  frame.contentDocument={body:{},documentElement:{dataset:{civweaveSystem:actualSystem}},contentType:valid?'text/html':'text/plain',readyState:'complete'};
  frame.contentWindow={location:{href:'about:blank',pathname:'about:blank'}};
  Object.defineProperty(frame,'src',{get(){return frame._src},set(value){frame._src=value;frame.contentWindow.location.href=redirect?'https://evil.test/elsewhere':value;frame.contentWindow.location.pathname=new URL(frame.contentWindow.location.href).pathname;}});
  const context={URL,URLSearchParams,
    location:{href:'https://civweave-staging.pages.dev/app/persistent-system-shell-v1.html?system='+system+query,origin:'https://civweave-staging.pages.dev',search:'?system='+system+query,reload(){nodes.reloaded=true}},
    document:{getElementById:id=>({'cw-persistent-system-stage':frame,'cw-persistent-system-loading':loading,'cw-persistent-system-error':error})[id],createElement:element,documentElement:{dataset:{}}},
    setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout:()=>{},
  };
  vm.runInNewContext(launch,context);
  return {context,frame,loading,error,timers,nodes,handlers,children};
}

test('all five systems start without external JavaScript or DOMContentLoaded',()=>{
  for(const system of ['civweave','living-school','cerbanimo','fellowfare','anarchadia']){
    const h=harness({system});
    assert.match(h.frame.src,/embed=1/);
    assert.match(h.frame.src,/persistentShell=1/);
    assert.equal(new URL(h.frame.src).pathname,
      {civweave:'/app/working-campus-v440.html','living-school':'/app/cabinets/living-school/index.html',
       cerbanimo:'/app/realm-console-v140.html',fellowfare:'/app/fellowfare-cabinet-v144.html',
       anarchadia:'/app/anarchadia-console-v139.html'}[system]);
    assert.equal(h.frame.dataset.cwBootstrapHref,h.frame.src);
  }
});

test('Quest lineage survives the persistent shell first-frame and runtime routes for every subsystem',()=>{
  const runtimeContext={URL,URLSearchParams,location:{origin:'https://civweave-staging.pages.dev'},document:{readyState:'loading',addEventListener(){}},addEventListener(){}};
  vm.runInNewContext(runtime,runtimeContext);const owner=runtimeContext.CivweavePersistentSystemShellV1;
  for(const system of ['living-school','cerbanimo','fellowfare','anarchadia']){
    const options={weave:'qa-weave',path:'qa-path'},h=harness({system,query:'&'+new URLSearchParams(options)});
    for(const url of [new URL(h.frame.src),owner.contentUrl(system,options),owner.shellUrl(system,options)]){assert.equal(url.searchParams.get('weave'),'qa-weave');assert.equal(url.searchParams.get('path'),'qa-path');}
    assert.equal(h.frame.src,owner.contentUrl(system,options).href);
  }
});

test('Guild Quest submission remains in the persistent shell through a fixed bounded native destination',()=>{
  const context={URL,URLSearchParams,location:{origin:'https://civweave-staging.pages.dev'},document:{readyState:'loading',addEventListener(){}},addEventListener(){}};vm.runInNewContext(runtime,context);const owner=context.CivweavePersistentSystemShellV1;
  const options={nativePage:'guild-quests',submitQuest:'qa-quest:42'},h=harness({system:'civweave',query:'&'+new URLSearchParams(options)}),target=new URL(h.frame.src);
  assert.equal(target.pathname,'/app/civweave-guild-quest-v1.html');assert.equal(target.searchParams.get('submitQuest'),'qa-quest:42');assert.equal(h.frame.src,owner.contentUrl('civweave',options).href);assert.equal(owner.shellUrl('civweave',options).searchParams.get('submitQuest'),'qa-quest:42');h.frame.handlers.load();assert.equal(h.context.CivweaveShellRescueV1.validDocument(),true);
  for(const submitQuest of ['https://evil.test/','<script>','x'.repeat(181)]){const invalid=harness({system:'civweave',query:'&'+new URLSearchParams({nativePage:'guild-quests',submitQuest})});assert.equal(new URL(invalid.frame.src).searchParams.has('submitQuest'),false);assert.equal(new URL(invalid.frame.src).pathname,'/app/civweave-guild-quest-v1.html');}
  assert.equal(owner.contentUrl('anarchadia',options).pathname,'/app/anarchadia-console-v139.html');
});

test('healthy embedded HTML hides startup overlay without shared runtime',()=>{
  const h=harness();h.frame.handlers.load();
  assert.equal(h.loading.hidden,true);
  assert.equal(h.error.dataset.open,'0');
  assert.equal(h.context.document.documentElement.dataset.cwFirstFrame,'embedded-ready');
});

test('independent first-frame boot restores allowlisted native pages with the same exact runtime target',()=>{
  const runtimeContext={URL,URLSearchParams,location:{origin:'https://civweave-staging.pages.dev',href:'https://civweave-staging.pages.dev/app/persistent-system-shell-v1.html'},document:{readyState:'loading',addEventListener(){}},addEventListener(){}};
  vm.runInNewContext(runtime,runtimeContext);
  const owner=runtimeContext.CivweavePersistentSystemShellV1;
  for(const options of [{nativePage:'governance',proposal:'qa & approval'},{nativePage:'workbench',nativeRoute:'charter',weave:'qa-weave',path:'qa-path'}]){
    const query='&'+new URLSearchParams(options),h=harness({system:'anarchadia',query});
    assert.equal(h.frame.src,owner.contentUrl('anarchadia',options).href,'Independent boot and shared owner must produce the exact same native target.');
    assert.notEqual(new URL(h.frame.src).pathname,'/app/anarchadia-console-v139.html');
    h.frame.handlers.load();assert.equal(h.context.CivweaveShellRescueV1.validDocument(),true);assert.equal(h.loading.hidden,true);
  }
  const h=harness({system:'anarchadia',query:'&nativePage=https%3A%2F%2Fevil.test%2F'});
  assert.equal(new URL(h.frame.src).pathname,'/app/anarchadia-console-v139.html');
});

test('independent Governance tab boot matches the parent and defaults untrusted values to Overview',()=>{
  const context={URL,URLSearchParams,location:{origin:'https://civweave-staging.pages.dev',href:'https://civweave-staging.pages.dev/app/persistent-system-shell-v1.html'},document:{readyState:'loading',addEventListener(){}},addEventListener(){}};
  vm.runInNewContext(runtime,context);const owner=context.CivweavePersistentSystemShellV1;
  for(const nativeRoute of ['overview','identity','changes','ballots','federation','execution','unknown','javascript:alert(1)','__proto__','charter']){
    const options={nativePage:'governance',nativeRoute,proposal:'qa & review',feature:'receipts'},h=harness({system:'anarchadia',query:'&'+new URLSearchParams(options)}),target=new URL(h.frame.src),expected=['overview','identity','changes','ballots','federation','execution'].includes(nativeRoute)?nativeRoute:'overview';
    assert.equal(h.frame.src,owner.contentUrl('anarchadia',options).href);assert.equal(target.hash,`#${expected}`);assert.equal(target.searchParams.get('proposal'),'qa & review');assert.equal(target.searchParams.get('feature'),'receipts');
    h.frame.handlers.load();assert.equal(h.loading.hidden,true);assert.equal(h.context.CivweaveShellRescueV1.validDocument(),true);
  }
});

for(const options of [
    {system:'fellowfare',hash:'market'},
    {system:'fellowfare',hash:'orders',view:'open'},
    {system:'anarchadia',query:'&nativePage=governance&nativeRoute=ballots&proposal=qa-proposal',hash:'execution'},
    {system:'anarchadia',query:'&nativePage=workbench&nativeRoute=charter&weave=qa-weave&path=qa-path',hash:'readiness',view:'proof'}
  ])test(`independent rescue accepts ${options.system} native view #${options.hash}`,()=>{
    const h=harness(options),actual=new URL(h.frame.src);actual.hash=options.hash;if(options.view)actual.searchParams.set('view',options.view);
    h.frame.src=actual.href;h.frame.handlers.load();
    assert.equal(h.context.CivweaveShellRescueV1.validDocument(),true,'A native startup hash or view must not be mistaken for a failed frame.');
    assert.equal(h.loading.hidden,true);assert.equal(h.error.dataset.open,'0');
});

test('independent rescue rejects changed native launch identity while allowing native views',()=>{
  const options={system:'anarchadia',query:'&nativePage=workbench&nativeRoute=charter&weave=qa-weave&path=qa-path'};
  for(const mutate of [
    url=>url.hostname='foreign.test',
    url=>url.pathname='/app/anarchadia-console-v139.html',
    url=>url.searchParams.set('embed','0'),
    url=>url.searchParams.delete('persistentShell'),
    url=>url.searchParams.set('installed','0'),
    url=>url.searchParams.set('weave','stale-weave'),
    url=>url.searchParams.set('path','stale-path'),
    url=>url.searchParams.set('feature','stale-feature')
  ]){
    const h=harness(options),actual=new URL(h.frame.src);mutate(actual);actual.hash='readiness';actual.searchParams.set('view','proof');h.frame.src=actual.href;
    assert.equal(h.context.CivweaveShellRescueV1.validDocument(),false,'View changes must not hide a changed origin, canonical route, launch flag or requested artifact.');
    h.frame.handlers.load();assert.equal(h.error.dataset.open,'1');
  }
});

test('Living School directory redirects are healthy in the independent first-frame rescue',()=>{
  const h=harness({system:'living-school'});
  h.frame.src=h.frame.src.replace('index.html','');
  h.frame.handlers.load();
  assert.equal(h.loading.hidden,true);
  assert.equal(h.error.dataset.open,'0');
  assert.equal(h.context.CivweaveShellRescueV1.validDocument(),true);
});

test('recovery diagnostics follow the currently requested frame after system navigation',()=>{
  const h=harness({system:'cerbanimo'});
  const next=new URL('/app/cabinets/living-school/index.html?cabinet=1&installed=1&embed=1&persistentShell=1',h.context.location.origin).href;
  h.frame.dataset.cwExpectedHref=next;
  h.frame.src=next.replace('index.html','');
  h.frame.contentDocument.documentElement.dataset.civweaveSystem='living-school';
  assert.equal(h.context.CivweaveShellRescueV1.validDocument(),true,'healthy current frames must not be compared with the initial Cerbanimo target');
  h.context.CivweaveShellRescueV1.fail('Current navigation timed out.');
  assert.equal(h.error.children[2].children[1].href,next);
  assert.match(h.error.children[3].textContent,/System: living-school/);
});

test('non-HTML and redirected responses expose recovery, never false success',()=>{
  for(const options of [{valid:false},{redirect:true},{actualSystem:'fellowfare'}]){
    const h=harness(options);h.frame.handlers.load();
    assert.equal(h.loading.hidden,true);
    assert.equal(h.error.dataset.open,'1');
    assert.match(h.error.children[0].textContent,/System launch failed/);
    const actions=h.error.children[2];
    assert.equal(actions.children.length,2);
    assert.match(actions.children[1].href,/embed=1/);
    actions.children[0].handlers.click();
    assert.equal(h.nodes.reloaded,true);
  }
});

test('independent watchdog makes indefinitely stalled startup recoverable',()=>{
  const h=harness({valid:false});
  assert.equal(h.loading.hidden,false);
  assert.equal(h.timers.some(x=>x.ms===8000),true);
  h.timers.find(x=>x.ms===8000).fn();
  assert.equal(h.error.dataset.open,'1');
  assert.match(h.error.children[1].textContent,/did not respond/);
});

test('persistent runtime adopts preloaded frame and validates its content type',()=>{
  new Function(runtime);
  assert.match(runtime,/host\?\.dataset\.cwBootstrapHref===target\.href/);
  assert.match(runtime,/watchChildInteractive\(\{token,expectedHref:target\.href\}\)/);
  assert.match(runtime,/doc\.contentType==='text\/html'/);
  assert.match(runtime,/doc\.documentElement\.dataset\.civweaveSystem===current/);
  assert.match(runtime,/if\(!childReadyEnough\(host,expectedHref\)\)return/);
  assert.match(runtime,/CivweaveShellRescueV1\?\.fail/);
  assert.match(runtime,/host\.src=target\.href/);
});
