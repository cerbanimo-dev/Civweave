import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorldweaver} from '../public/app/shared/worldweaver-core-v1.mjs';
import {normalizeScreenContent,renderWorldScreen,resolveScreenSource} from '../public/app/shared/worldweaver-screen-v1.mjs';

let n=0;
const model={kind:'model',principalId:'model:kami',modelId:'qwen3.5:4b',personaRef:'starling:kami',verified:true};
const human={kind:'human',principalId:'human:owner',verified:true};
const runtime={kind:'runtime',principalId:'world-renderer',verified:true};
const make=()=>createWorldweaver({id:()=>`screen-${++n}`,clock:()=> '2026-10-30T08:00:00Z',
  authorize:({actor,command})=>actor.verified && (actor.kind==='human'||
    (actor.kind==='model'&&['rig-npc','queue-actions','create-screen'].includes(command.type))||
    (actor.kind==='runtime'&&['report-action','provisioned'].includes(command.type)))});
const image={kind:'image',source:{assetId:'gallery:manual-image-1'},title:'Created artwork',alt:'Abstract poster'};
const video={kind:'video',source:{assetId:'creator:generated-video-2'},title:'Animated explainer'};
const site={kind:'website',source:{url:'https://example.org/articles/lesson'},title:'Learning resource'};
function setup(){
 const world=make();
 const space=world.dispatch({type:'create',guide:'moss',title:'Test workshop'},human).instance;
 const screen=world.dispatch({type:'create-screen',instanceId:space.id,title:'Workshop wall',aspectRatio:'16:9'},human).screen;
 const npc=world.dispatch({type:'rig-npc',instanceId:space.id,name:'Kami',personaRef:model.personaRef,modelId:model.modelId,pilotPrompt:'Explain and exhibit learning projects.',capabilities:['observe','speak','cast-screen','clear-screen']},model).npc;
 return {world,space,screen,npc};
}
test('media grammar supports generated/uploaded assets and ordinary HTTPS websites',()=>{
 assert.equal(normalizeScreenContent(image).source.assetId,'gallery:manual-image-1');
 assert.equal(normalizeScreenContent(video).kind,'video');
 assert.equal(normalizeScreenContent(site).source.url,'https://example.org/articles/lesson');
 assert.throws(()=>normalizeScreenContent({...site,source:{url:'javascript:alert(1)'}}),/https/i);
 assert.throws(()=>normalizeScreenContent({...site,source:{url:'http://example.org'}}),/https/i);
 assert.throws(()=>normalizeScreenContent({...site,source:{url:'https://localhost/admin'}}),/local|host|address/i);
 assert.throws(()=>normalizeScreenContent({...site,source:{url:'https://127.0.0.1/'}}),/local|host|address/i);
 assert.throws(()=>normalizeScreenContent({...site,source:{url:'https://192.168.0.8/private'}}),/private|address|host/i);
 assert.throws(()=>normalizeScreenContent({...site,source:{url:'https://user:pass@example.org'}}),/credential/i);
 assert.throws(()=>normalizeScreenContent({...site,source:{url:'https://example.org/#foo'}}),/fragment/i);
 assert.throws(()=>normalizeScreenContent({...site,source:{url:'https://example.org:8443/'}}),/port/i);
 assert.throws(()=>normalizeScreenContent({...site,html:'<script/>'}),/Unsupported field/i);
 assert.throws(()=>normalizeScreenContent({kind:'website',source:{assetId:'creator:html'}}),/website/i);
});
test('screen objects belong to their instance and can be created by model with externally checked grant',()=>{
 const w=make(); const a=w.dispatch({type:'create',guide:'rook',title:'Display studio'},human).instance;
 const b=w.dispatch({type:'create',guide:'merlin',title:'Debate room'},human).instance;
 const x=w.dispatch({type:'create-screen',instanceId:a.id,title:'Showcase',aspectRatio:'portrait'},model).screen;
 assert.equal(x.status,'blank');assert.equal(x.aspectRatio,'portrait');assert.equal(x.instanceId,a.id);
 assert.equal(w.snapshot().screens.length,1);
 assert.throws(()=>w.dispatch({type:'create-screen',instanceId:b.id,title:'Other',aspectRatio:'giant'},human),/aspect/i);
 assert.throws(()=>w.dispatch({type:'create-screen',instanceId:a.id,title:'Bad',html:'<iframe src=x>'},human),/Unsupported field/);
});
test('human can cast approved content directly, and clear it while preserving history',()=>{
 const {world,screen}=setup();
 const one=world.dispatch({type:'cast-screen',screenId:screen.id,content:image},human);
 assert.equal(one.screen.current.kind,'image');
 assert.equal(one.screen.current.source.assetId,image.source.assetId);
 assert.equal(one.screen.current.presenter.kind,'human');
 assert.equal(one.screen.revision,1);
 const two=world.dispatch({type:'cast-screen',screenId:screen.id,content:site},human);
 assert.equal(two.screen.current.kind,'website');
 assert.equal(two.screen.revision,2);
 assert.equal(world.snapshot().screenHistory.length,2);
 const three=world.dispatch({type:'clear-screen',screenId:screen.id},human);
 assert.equal(three.screen.current,null);
 assert.equal(three.screen.revision,3);
});
test('model queues media to screen, a trusted runtime applies it; URLs require human approval',()=>{
 const {world,screen,npc}=setup();
 const first=world.dispatch({type:'queue-actions',npcId:npc.id,actions:[
   {tool:'cast-screen',args:{screenId:screen.id,content:image}},
   {tool:'speak',args:{text:'Here is our artwork.'}}
 ]},model).intents;
 assert.equal(first.length,2); assert.equal(first[0].status,'queued');
 assert.equal(world.snapshot().screens[0].current,null);
 world.dispatch({type:'report-action',intentId:first[0].id,outcome:'succeeded'},runtime);
 assert.equal(world.snapshot().screens[0].current.source.assetId,image.source.assetId);
 assert.equal(world.snapshot().screens[0].current.presenter.kind,'model');
 const more=world.dispatch({type:'queue-actions',npcId:npc.id,actions:[{tool:'cast-screen',args:{screenId:screen.id,content:site}}]},model).intents[0];
 assert.equal(more.status,'review-required');
 assert.throws(()=>world.dispatch({type:'report-action',intentId:more.id,outcome:'succeeded'},runtime),/review|queued/i);
 world.dispatch({type:'approve-cast',intentId:more.id},human);
 assert.equal(world.snapshot().intents.find(x=>x.id===more.id).status,'queued');
 world.dispatch({type:'report-action',intentId:more.id,outcome:'succeeded'},runtime);
 assert.equal(world.snapshot().screens[0].current.kind,'website');
});
test('model remote video and image URLs require human approval; rejected displays never appear',()=>{
 const {world,screen,npc}=setup();
 const remote={kind:'video',source:{url:'https://cdn.example.org/clip.mp4'},title:'Example clip'};
 const intent=world.dispatch({type:'queue-actions',npcId:npc.id,actions:[{tool:'cast-screen',args:{screenId:screen.id,content:remote}}]},model).intents[0];
 assert.equal(intent.status,'review-required');
 world.dispatch({type:'reject-cast',intentId:intent.id,reason:'Needs verification'},human);
 assert.equal(world.snapshot().screens[0].current,null);
 assert.throws(()=>world.dispatch({type:'report-action',intentId:intent.id,outcome:'succeeded'},runtime),/queued/i);
});
test('model may not present in another world; a failed renderer cannot alter existing content',()=>{
 const {world,screen,npc}=setup();
 const other=world.dispatch({type:'create',guide:'rook',title:'Other shop'},human).instance;
 const outside=world.dispatch({type:'create-screen',instanceId:other.id,title:'Other screen'},human).screen;
 assert.throws(()=>world.dispatch({type:'queue-actions',npcId:npc.id,actions:[{tool:'cast-screen',args:{screenId:outside.id,content:image}}]},model),/instance|world/i);
 const i=world.dispatch({type:'queue-actions',npcId:npc.id,actions:[{tool:'cast-screen',args:{screenId:screen.id,content:video}}]},model).intents[0];
 world.dispatch({type:'report-action',intentId:i.id,outcome:'failed',summary:'Video not available'},runtime);
 assert.equal(world.snapshot().screens[0].current,null);
 assert.equal(world.snapshot().intents.find(x=>x.id===i.id).status,'failed');
});
test('stale out-of-order model casts cannot overwrite newer human presentation',()=>{
 const {world,screen,npc}=setup();
 const i=world.dispatch({type:'queue-actions',npcId:npc.id,actions:[{tool:'cast-screen',args:{screenId:screen.id,content:image}}]},model).intents[0];
 world.dispatch({type:'cast-screen',screenId:screen.id,content:video},human);
 assert.throws(()=>world.dispatch({type:'report-action',intentId:i.id,outcome:'succeeded'},runtime),/stale|revision/i);
 assert.equal(world.snapshot().screens[0].current.kind,'video');
});
test('screen DOM projection restricts websites to sandboxed iframes with fallback links',()=>{
 assert.throws(()=>resolveScreenSource(image,()=>undefined),/resolve|asset/i);
 const resolved=resolveScreenSource(image,(id)=>({assetId:id,url:'/app/assets/starling/kami.svg',kind:'image'}));
 assert.equal(resolved.url,'/app/assets/starling/kami.svg');
 const iframe=renderWorldScreen(site,{documentRef:null});
 assert.equal(iframe.kind,'website');
 assert.equal(iframe.url,'https://example.org/articles/lesson');
 assert.equal(iframe.sandbox,'allow-scripts allow-forms');
 const screenSource=readFileSync(new URL('../public/app/shared/worldweaver-screen-v1.mjs',import.meta.url),'utf8');
 assert.match(screenSource,/referrerpolicy|referrerPolicy/);
 assert.match(screenSource,/sandbox/);
 assert.doesNotMatch(screenSource,/allow-same-origin/);
});
test('the standalone screen lab has accessible buttons and only shared Worldweaver owners',()=>{
 const html=readFileSync(new URL('../public/app/tools/worldweaver-screen-lab.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/app/tools/worldweaver-screen-lab-v1.mjs',import.meta.url),'utf8');
 assert.match(html,/Worldweaver Screen Lab/);
 assert.match(html,/aria-live="polite"/);
 assert.match(html,/Image/);assert.match(html,/Video/);assert.match(html,/Website/);
 assert.match(js,/createWorldweaver/);
 assert.match(js,/renderWorldScreen/);
});
