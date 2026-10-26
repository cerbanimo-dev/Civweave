import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const read=path=>readFileSync(new URL(`../public/app/${path}`,import.meta.url),'utf8');
const consolePath='/app/anarchadia-console-v139.html';
const owners=[
  {name:'governance',path:'anarchadia-governance-v145.html',script:'anarchadia-governance-v145.js',button:'[data-action="back"]',source:'anarchadia-governance-v145'},
  {name:'workbench',path:'services/anarchadia/workbench.html',button:'#cabinet-workbench-return',source:'anarchadia-workbench-v144'},
  {name:'Quest Passport',path:'services/anarchadia/workbench.html',script:'services/anarchadia/civweave-quest-path-v266.js',button:'[data-quest-passport]',source:'anarchadia-quest-path-v266'}
];

// The DOM and handlers are the actual native sources. Only module dependencies
// unrelated to returning, and the browser navigation boundary, are substituted.
async function fixture(t,owner,{query='',embedded=false,parentOwner=false}={}){
  const dom=new JSDOM(read(owner.path),{url:`https://civweave.test/app/${owner.path}${query}`,runScripts:'outside-only'}),{window}=dom;
  t.after(()=>window.close());
  Object.defineProperty(window.document,'readyState',{value:'complete',configurable:true});
  const navigations=[],parentCalls=[],alerts=[];
  let current=new URL(window.location.href);
  const navigate=(method,value)=>{const url=new URL(value,current);navigations.push({method,url});current=url};
  const location={
    get href(){return current.href},set href(value){navigate('href',value)},
    get origin(){return current.origin},get pathname(){return current.pathname},get search(){return current.search},
    get hash(){return current.hash},set hash(value){current.hash=value},
    assign:value=>navigate('assign',value),replace:value=>navigate('replace',value)
  };
  const governanceState=()=>({changeSets:[],ballots:[],consents:[],dissents:[],trustedNodes:[],nodeOutcomes:[],executionPackets:[],credentials:[],groups:[],authorizations:[]});
  const sandbox={
    document:window.document,location,URL,URLSearchParams,Blob,console,
    history:{replaceState:(_state,_title,value)=>{current=new URL(value,current)}},
    navigator:{},localStorage:window.localStorage,structuredClone,
    CustomEvent:window.CustomEvent,Event:window.Event,
    addEventListener:window.addEventListener.bind(window),removeEventListener:window.removeEventListener.bind(window),dispatchEvent:window.dispatchEvent.bind(window),
    queueMicrotask,setTimeout:()=>0,clearTimeout:()=>{},
    alert:value=>alerts.push(String(value)),prompt:()=>'',confirm:()=>false,
    newGovernanceState:governanceState,normalizeGovernanceState:value=>value,loadGovernanceState:async()=>null
  };
  sandbox.window=sandbox;sandbox.self=sandbox;
  sandbox.parent=embedded?{}:sandbox;sandbox.top=sandbox.parent;
  if(parentOwner)sandbox.parent.CivweavePersistentSystemShellV1={navigate:(...args)=>{parentCalls.push(JSON.parse(JSON.stringify(args)));return true}};
  const context=vm.createContext(sandbox);
  if(owner.name==='Quest Passport')window.localStorage.setItem('civweave.working-campus.v1',JSON.stringify({plan:{id:'native-return-quest',state:'active',paths:[{id:'governance-path',realm:'anarchadia',title:'Record the charter',steps:['Record a charter draft.'],status:'ready'}]}}));
  if(owner.script){
    const source=read(owner.script);
    if(owner.name==='governance'){
      const executable=source.replace(/^import\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];\s*/gm,'');
      await vm.runInContext(`(async()=>{${executable}\n})()`,context,{filename:owner.script});
    }else vm.runInContext(source,context,{filename:owner.script});
  }else{
    for(const script of window.document.querySelectorAll('script:not([src]):not([type="module"])'))vm.runInContext(script.textContent,context,{filename:owner.path});
  }
  const button=window.document.querySelector(owner.button);
  assert.ok(button,`${owner.name} must expose its real return control.`);
  button.click();
  await Promise.resolve();
  assert.deepEqual(alerts,[],`${owner.name} return must not be swallowed by an error handler.`);
  return{navigations,parentCalls};
}

for(const owner of owners){
  test(`${owner.name} returns through the persistent parent without navigating its child`,async t=>{
    const result=await fixture(t,owner,{query:'?installed=1&embed=1&persistentShell=1&feature=stale&system=cerbanimo',embedded:true,parentOwner:true});
    assert.deepEqual(result.parentCalls,[['anarchadia',{replace:true,source:owner.source}]]);
    assert.equal(result.navigations.length,0,'The parent owns the expected frame URL and must navigate it itself.');
  });

  for(const scenario of [
    {name:'top-level installed',query:'?installed=1&feature=stale&system=cerbanimo',expected:{cabinet:'1',installed:'1'}},
    {name:'top-level uninstalled',query:'?feature=stale&system=cerbanimo',expected:{cabinet:'1'}},
    {name:'legacy persistent child',query:'?installed=1&embed=1&persistentShell=1&feature=stale&system=cerbanimo',embedded:true,expected:{cabinet:'1',installed:'1',embed:'1',persistentShell:'1'}},
    {name:'legacy embedded child',query:'?embed=1&feature=stale&system=cerbanimo',embedded:true,expected:{cabinet:'1',embed:'1'}}
  ]){
    test(`${owner.name} ${scenario.name} fallback retains only its incoming shell flags`,async t=>{
      const result=await fixture(t,owner,scenario);
      assert.deepEqual(result.parentCalls,[]);
      assert.equal(result.navigations.length,1);
      const [{url}]=result.navigations;
      assert.equal(url.origin,'https://civweave.test');
      assert.equal(url.pathname,consolePath);
      assert.equal(url.hash,'');
      assert.deepEqual(Object.fromEntries(url.searchParams),scenario.expected,'Return must not force an embedded frame or replay stale feature/system context.');
    });
  }
}
