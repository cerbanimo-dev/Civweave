import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const html=fs.readFileSync(new URL('../public/app/persistent-system-shell-v1.html',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('../public/app/persistent-system-shell-v1.js',import.meta.url),'utf8');
const launch=html.match(/<script id="cw-persistent-first-frame-rescue-v1">([\s\S]*?)<\/script>/)?.[1];
assert.ok(launch,'Independent shell first-frame launch must be included inline in the HTML.');

function harness({system='cerbanimo',valid=true,redirect=false}={}){
  const handlers={},timers=[],children=[],nodes={};
  const element=(type='div')=>({type,style:{},dataset:{},hidden:false,children:[],textContent:'',append(...items){this.children.push(...items)},replaceChildren(...items){this.children=[...items]},addEventListener(type,fn){(this.handlers||= {})[type]=fn}});
  const frame=element('iframe'),loading=element(),error=element();
  loading.hidden=false;error.dataset.open='0';
  frame.contentDocument=valid?{body:{},contentType:'text/html',readyState:'complete'}:{body:{},contentType:'text/plain',readyState:'complete'};
  frame.contentWindow={location:{href:'about:blank',pathname:'about:blank'}};
  Object.defineProperty(frame,'src',{get(){return frame._src},set(value){frame._src=value;frame.contentWindow.location.href=redirect?'https://evil.test/elsewhere':value;frame.contentWindow.location.pathname=new URL(frame.contentWindow.location.href).pathname;}});
  const context={URL,URLSearchParams,
    location:{href:'https://civweave-staging.pages.dev/app/persistent-system-shell-v1.html?system='+system,origin:'https://civweave-staging.pages.dev',search:'?system='+system,reload(){nodes.reloaded=true}},
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

test('healthy embedded HTML hides startup overlay without shared runtime',()=>{
  const h=harness();h.frame.handlers.load();
  assert.equal(h.loading.hidden,true);
  assert.equal(h.error.dataset.open,'0');
  assert.equal(h.context.document.documentElement.dataset.cwFirstFrame,'embedded-ready');
});

test('non-HTML and redirected responses expose recovery, never false success',()=>{
  for(const options of [{valid:false},{redirect:true}]){
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
  assert.match(runtime,/if\(!childReadyEnough\(host,expectedHref\)\)return/);
  assert.match(runtime,/CivweaveShellRescueV1\?\.fail/);
  assert.match(runtime,/host\.src=target\.href/);
});
