import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const read=file=>readFileSync(new URL(`../public/app/${file}`,import.meta.url),'utf8');
const source=read('civweave-map-service-v275.js');
const origin='https://civweave.test';
const mapPath='/app/federation-finder-map-v275.html';
const wrapperPath='/app/hub-map-v1.html';
const destination=origin+'/app/persistent-system-shell-v1.html?system=civweave&installed=1';

function locationFor(url,navigations,{throws=false}={}){
  const current=new URL(url);
  const record=(method,value)=>{if(throws)throw new Error('Navigation unavailable');navigations.push({method,url:new URL(value,current).href})};
  return{get href(){return current.href},set href(value){record('href',value)},origin:current.origin,pathname:current.pathname,search:current.search,assign:value=>record('assign',value)};
}

function fixture(t,{standalone=false,wrapperOrigin=origin,wrapperRoute=wrapperPath,mapRoute=mapPath,unownedFrame=false,staleFrame=false,nestedWrapper=false,navigationThrows=false}={}){
  // Use the shipped button and wrapper DOM, with an inert map renderer and
  // recorded locations. Evaluating the complete service mounts its real owner
  // without fetching map data, tiles, or simulating unsupported jsdom navigation.
  const map=new JSDOM(read('federation-finder-map-v275.html'),{url:origin+mapRoute+'?view=hub-nodes'});
  const wrapper=new JSDOM(read('hub-map-v1.html'),{url:wrapperOrigin+wrapperRoute+'?view=map&source=persistent-shell'});
  t.after(()=>{map.window.close();wrapper.window.close()});
  const childNavigations=[],wrapperNavigations=[];
  const child={document:map.window.document,location:locationFor(map.window.location.href,childNavigations,{throws:standalone&&navigationThrows}),localStorage:map.window.localStorage};
  const host={document:wrapper.window.document,location:locationFor(wrapper.window.location.href,wrapperNavigations,{throws:navigationThrows})};
  host.parent=nestedWrapper?{location:locationFor(origin+'/unrelated-host.html',[])}:host;
  const frame=host.document.getElementById('hubMapFrame');
  Object.defineProperty(frame,'contentWindow',{value:staleFrame?{}:child});
  if(unownedFrame)frame.id='unowned-map-frame';
  child.parent=standalone?child:host;child.frameElement=standalone?null:frame;
  vm.runInNewContext(source,{window:child,document:child.document,location:child.location,localStorage:child.localStorage,URL,URLSearchParams,console},{filename:'civweave-map-service-v275.js'});
  return{childNavigations,wrapperNavigations,button:child.document.getElementById('back'),status:child.document.getElementById('status')};
}

test('Guild Map returns its authenticated wrapper to persistent Civweave without loading a campus inside hubMapFrame',t=>{
  const x=fixture(t);x.button.click();
  assert.deepEqual(x.wrapperNavigations,[{method:'assign',url:destination}]);
  assert.deepEqual(x.childNavigations,[],'The map iframe must never navigate to the installed entry or campus');
});

test('the standalone map returns directly to the current persistent Civweave route',t=>{
  const x=fixture(t,{standalone:true});x.button.click();
  assert.deepEqual(x.childNavigations,[{method:'assign',url:destination}]);assert.deepEqual(x.wrapperNavigations,[]);
});

for(const [name,options] of [
  ['foreign wrapper origin',{wrapperOrigin:'https://untrusted.test'}],
  ['unrecognized wrapper route',{wrapperRoute:'/app/working-campus-v440.html'}],
  ['unowned map frame',{unownedFrame:true}],
  ['stale map frame window',{staleFrame:true}],
  ['unrecognized map document',{mapRoute:'/app/unrelated-document.html'}],
  ['nested wrapper without a known top-level host',{nestedWrapper:true}]
])test(`Guild Map rejects ${name} without navigating an ancestor or nesting a campus`,t=>{
  const x=fixture(t,options);x.button.click();
  assert.deepEqual(x.wrapperNavigations,[]);assert.deepEqual(x.childNavigations,[]);
  assert.match(x.status.textContent,/Could not return.*Civweave/);
});

test('failed wrapper navigation stays visible and does not fall back to replacing the map iframe',t=>{
  const x=fixture(t,{navigationThrows:true});x.button.click();
  assert.deepEqual(x.wrapperNavigations,[]);assert.deepEqual(x.childNavigations,[]);
  assert.match(x.status.textContent,/Could not return.*Civweave/);
});
