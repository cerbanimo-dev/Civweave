import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { randomFillSync, webcrypto } from 'node:crypto';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sessionSource=read('public/app/host-node-session-v1.js');
function store(){
  const map=new Map();
  return {getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,String(value)),
    removeItem:key=>map.delete(key),dump:()=>Object.fromEntries(map)};
}
function loadSessionRuntime(){
  const localStorage=store(),sessionStorage=store(),events=[],requests=[];
  const ctx={
    console, URL, URLSearchParams, TextEncoder, TextDecoder, structuredClone, btoa,
    crypto:webcrypto, localStorage, sessionStorage,
    CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
    dispatchEvent:event=>events.push(event),
    fetch:async(url,options)=>{requests.push({url:String(url),options});return {ok:true,status:200,json:async()=>({ok:true,left:true})}}
  };
  vm.createContext(ctx);vm.runInContext(sessionSource,ctx);
  return {api:ctx.CivweaveHostNodeSessionV1,localStorage,sessionStorage,events,requests};
}
const guildA={nodeId:'guild-a-node',userId:'cwres:testing123456789',origin:'https://guild-a.example',token:'A'.repeat(48),seatClass:'community'};
const guildB={nodeId:'guild-b-node',userId:'cwres:testing987654321',origin:'https://guild-b.example',token:'B'.repeat(48),seatClass:'community'};
test('only an authenticated Guild session can be activated; switching changes selected origin and emits canonical event',()=>{
  const h=loadSessionRuntime(),{api}=h;
  assert.throws(()=>api.selectSession({origin:guildA.origin,nodeId:guildA.nodeId}),/logged in/);
  api.setSession(guildA,{quota:{includedRemainingNeurons:600}});
  api.setSession(guildB,{quota:{includedRemainingNeurons:450}});
  const selected=api.selectSession({origin:guildB.origin,nodeId:guildB.nodeId,displayName:'Guild B'});
  assert.equal(selected.origin,guildB.origin);
  assert.equal(api.selectedOrigin(),guildB.origin);
  assert.equal(h.localStorage.dump()['federation-finder.physical-node-endpoint'],guildB.origin);
  assert.equal(JSON.parse(h.localStorage.dump()['civweave.host-node.selection.v1']).nodeId,guildB.nodeId);
  assert.equal(h.events.filter(event=>event.type==='civweave:host-node-selected').length,1);
  assert.throws(()=>api.selectSession({origin:guildA.origin,nodeId:guildB.nodeId}),/does not belong/);
});
test('sign out clears only one Guild session and blocks silent re-login until explicit join',async()=>{
  const h=loadSessionRuntime(),{api}=h;
  api.setSession(guildA);api.setSession(guildB);
  api.selectSession({origin:guildB.origin,nodeId:guildB.nodeId});
  assert.equal(api.signOut(guildB.nodeId),true);
  assert.equal(api.sessionFor(guildB.nodeId),null);
  assert.ok(api.sessionFor(guildA.nodeId));
  assert.equal(api.selectedOrigin(),guildB.origin);
  assert.equal(await api.ensureSelected(),null);
  assert.equal(h.requests.length,0);
  assert.equal(h.events.filter(event=>event.type==='civweave:capacity-session-cleared').length,1);
  assert.equal(api.deselectGuild(),true);
  assert.equal(api.selectedOrigin(),'');
  assert.equal(h.localStorage.getItem('federation-finder.physical-node-endpoint'),null);
  assert.equal(h.localStorage.getItem('civweave.host-node.selection.v1'),null);
});
test('leave Guild requires a currently authenticated session, calls server before clearing local selection, and never removes a Guildkeeper founder',async()=>{
  const h=loadSessionRuntime(),{api}=h;
  api.setSession(guildA);
  api.selectSession({origin:guildA.origin,nodeId:guildA.nodeId});
  const result=await api.leaveGuild(guildA.nodeId);
  assert.equal(result.left,true);
  assert.equal(h.requests.length,1);
  assert.equal(h.requests[0].url,'https://guild-a.example/api/ai/node/session?nodeId=guild-a-node');
  assert.equal(h.requests[0].options.method,'DELETE');
  assert.equal(h.requests[0].options.headers.authorization,'Bearer '+guildA.token);
  assert.equal(api.sessionFor(guildA.nodeId),null);
  assert.equal(api.selectedOrigin(),'');
  api.setSession({...guildA,authMode:'legacy-guildkeeper'});
  await assert.rejects(()=>api.leaveGuild(guildA.nodeId),/Guildkeeper/);
  assert.equal(h.requests.length,1);
});
test('Guild tab uses existing discovery and membership owners, starts collapsed after Guild selection and never mixes permissions',()=>{
  const view=read('public/app/guild-symbol-v1.js');
  const finder=read('public/app/host-node-installer-lobby-v1.js');
  const edge=read('cloudflare/mobile-guild-edge/src/creator-provenance-entry.mjs');
  assert.match(view,/data-cw-guild-ui="discovery"/);
  assert.match(view,/data-cw-guild-ui="selected"/);
  assert.match(view,/data-guild-ui-action="discover"/);
  assert.match(view,/data-guild-ui-action="signout"/);
  assert.match(view,/data-guild-ui-action="leave"/);
  assert.match(view,/data-guild-ui-action="relogin"/);
  assert.match(view,/data-guild-ui-action="inspect"/);
  assert.match(view,/data-cw-guild-manage/);
  assert.match(view,/CivweaveHostNodeSessionV1/);
  assert.match(view,/CivweaveHostNodeInstallerLobbyV1/);
  assert.match(view,/data-cw-guild-invite/);
  assert.match(finder,/inspectOrigin/);
  assert.match(edge,/leaveResident\(/);
  assert.match(edge,/request\.method==='DELETE'/);
  assert.match(edge,/sessionTokenHash\(bearer\(request\)\)/);
  assert.match(edge,/Only the founding Guild owner can manage this Guild/);
});
