import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateAvatarPlan} from '../public/app/shared/worldweaver-avatar-v1.mjs';
import {createAvatarDraftStore,parseAvatarImport,serializeAvatarBundle,AVATAR_LAB_BYTES} from '../public/app/shared/worldweaver-lab-draft-v1.mjs';
import {LAB_MEDIA_LIMITS,validateLabMediaFile,identifyMediaHeader,createLabMediaLeases,stopLabMedia,probeBrowserVideo} from '../public/app/shared/worldweaver-lab-media-v1.mjs';
import {createWorldweaver} from '../public/app/shared/worldweaver-core-v1.mjs';

const plan={format:'procedural-2d',
 parts:[{id:'body',parent:null,shape:'ellipse',x:0,y:0,width:45,height:55,color:'#445566'}],
 poses:[{name:'idle',rotations:{}}],
 behaviors:[{on:'idle',action:'say',value:'Hello'}]};
const fakeStorage=()=>{
 const x=new Map();
 return {getItem:k=>x.get(k)||null,setItem:(k,v)=>x.set(k,v),removeItem:k=>x.delete(k),size:()=>x.size};
};
test('avatar export/import is lossless and enforces persona isolation',()=>{
 const exported=serializeAvatarBundle('kami',plan);
 assert.deepEqual(parseAvatarImport(exported,{expectedPersona:'kami'}),validateAvatarPlan(plan));
 assert.deepEqual(parseAvatarImport(JSON.stringify(plan)),validateAvatarPlan(plan));
 assert.throws(()=>parseAvatarImport(exported,{expectedPersona:'aphra'}),/different persona/);
 assert.throws(()=>parseAvatarImport('{not JSON'),/valid JSON/);
 assert.throws(()=>parseAvatarImport('a'.repeat(AVATAR_LAB_BYTES+1)),/size/);
 assert.throws(()=>parseAvatarImport(JSON.stringify({schema:'untrusted',plan})),/schema/);
 assert.throws(()=>parseAvatarImport(JSON.stringify({...plan,script:'alert(1)'})),/Unsupported field/);
});
test('saved avatar plans restore by persona; corrupt storage fails closed',()=>{
 const storage=fakeStorage(),drafts=createAvatarDraftStore(storage);
 assert.equal(drafts.read('kami').ok,false);
 assert.equal(drafts.write('kami',plan).ok,true);
 assert.deepEqual(drafts.read('kami').plan,validateAvatarPlan(plan));
 assert.equal(drafts.read('aphra').ok,false);
 storage.setItem('civweave.worldweaver.lab.avatar.v1.kami','<script>');
 assert.equal(drafts.read('kami').ok,false);
 drafts.clear('kami');
 assert.equal(storage.size(),0);
});
test('blocked storage preserves live validation without false saved claims',()=>{
 const drafts=createAvatarDraftStore({getItem(){throw Error('SecurityError')},setItem(){throw Error('QuotaExceeded')},removeItem(){throw Error('SecurityError')}});
 assert.equal(drafts.read('kami').ok,false);
 assert.equal(drafts.write('kami',plan).ok,false);
 assert.equal(drafts.clear('kami').ok,false);
});
const media=(type,head,extra=[])=>new Blob([new Uint8Array([...head,...extra])],{type});
const png=()=>media('image/png',[137,80,78,71,13,10,26,10,...Array(24).fill(0)]);
const jpeg=()=>media('image/jpeg',[255,216,255,224,...Array(28).fill(0)]);
const webm=()=>media('video/webm',[26,69,223,163,...Array(28).fill(0)]);
const mp4=()=>media('video/mp4',[0,0,0,32,102,116,121,112,...Array(24).fill(0)]);
test('real magic bytes rather than file extension or MIME alone gate all formats',async()=>{
 for(const [f,kind] of [[png(),'image'],[jpeg(),'image'],[webm(),'video'],[mp4(),'video']]){
  const info=await validateLabMediaFile(f,kind,{probeImage:async()=>({width:128,height:128}),probeVideo:async()=>({duration:10})});
  assert.equal(info.kind,kind);
 }
 assert.equal(identifyMediaHeader('image/webp',new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80,1,2,3,4])),true);
 await assert.rejects(()=>validateLabMediaFile(media('image/png',[60,115,118,103,32,111,110,108,111,97,100,61,120]),'image',{probeImage:async()=>({width:1,height:1})}),/signature/);
 await assert.rejects(()=>validateLabMediaFile(jpeg(),'video',{probeVideo:async()=>({duration:9})}),/file type/i);
 await assert.rejects(()=>validateLabMediaFile(new Blob([new Uint8Array(100)],{type:'image/svg+xml'}),'image',{probeImage:async()=>({width:10,height:10})}),/type/i);
});
test('decoded media dimensions and video duration are bounded',async()=>{
 await assert.rejects(()=>validateLabMediaFile(png(),'image',{probeImage:async()=>({width:9000,height:100})}),/dimensions/);
 await assert.rejects(()=>validateLabMediaFile(png(),'image',{probeImage:async()=>({width:8192,height:8192})}),/dimensions/);
 await assert.rejects(()=>validateLabMediaFile(webm(),'video',{probeVideo:async()=>({duration:Infinity})}),/duration/);
 await assert.rejects(()=>validateLabMediaFile(webm(),'video',{probeVideo:async()=>({duration:302})}),/duration/);
 await assert.rejects(()=>validateLabMediaFile(png(),'image'),/decoding/i);
 await assert.rejects(()=>validateLabMediaFile(webm(),'video'),/metadata/i);
 const huge={size:LAB_MEDIA_LIMITS.image+1,type:'image/png',slice:()=>png()};
 await assert.rejects(()=>validateLabMediaFile(huge,'image',{probeImage:async()=>({width:10,height:10})}),/size/);
});
test('blob URL leases retain visible and queued content and revoke exactly once',()=>{
 let n=0;const created=[],revoked=[];
 const leases=createLabMediaLeases({urlApi:{createObjectURL:()=>{const value='blob:https://civweave.test/'+(++n);created.push(value);return value},revokeObjectURL:u=>revoked.push(u)}});
 const a=leases.add(png(),'image'),b=leases.add(webm(),'video'),c=leases.add(jpeg(),'image');
 assert.equal(leases.size,3);
 leases.prune([a.assetId,b.assetId]);
 assert.equal(leases.size,2);assert.deepEqual(revoked,[c.url]);
 assert.equal(leases.resolve(a.assetId,'video'),null);
 assert.equal(leases.resolve(a.assetId,'image').url,a.url);
 leases.prune([a.assetId]);assert.deepEqual(revoked,[c.url,b.url]);
 leases.dispose();assert.deepEqual(revoked,[c.url,b.url,a.url]);
 leases.dispose();assert.equal(revoked.length,3);
});
test('clearing a screen shuts down video and third-party iframe resources',()=>{
 const calls=[];
 const video={pause:()=>calls.push('pause'),removeAttribute:k=>calls.push('video:'+k),load:()=>calls.push('load')};
 const frame={removeAttribute:k=>calls.push('iframe:'+k)};
 stopLabMedia({querySelectorAll:selector=>selector==='video'?[video]:[frame]});
 assert.deepEqual(calls,['pause','video:src','load','iframe:src']);
});
test('metadata probe releases temporary URL after success and failure',async()=>{
 let seq=0;const revoked=[],created=[];
 const urlApi={createObjectURL:()=>{const v='blob:https://civweave.test/'+(++seq);created.push(v);return v},revokeObjectURL:v=>revoked.push(v)};
 const node={duration:240,load(){this.onloadedmetadata?.()},pause(){},removeAttribute(){}};
 const result=await probeBrowserVideo(webm(),{documentRef:{createElement:()=>node},urlApi});
 assert.equal(result.duration,240);
 assert.deepEqual(created,revoked);
 const bad={duration:NaN,load(){this.onerror?.()},pause(){},removeAttribute(){}};
 await assert.rejects(()=>probeBrowserVideo(webm(),{documentRef:{createElement:()=>bad},urlApi}),/decode/);
 assert.deepEqual(created,revoked);
});
test('human can cancel queued model cast; duplicate and late acknowledgements fail',()=>{
 let seq=0;
 const human={kind:'human',principalId:'human',verified:true};
 const model={kind:'model',principalId:'pilot',modelId:'qwen:4b',verified:true};
 const runtime={kind:'runtime',principalId:'renderer',verified:true};
 const world=createWorldweaver({id:()=>`hard-${++seq}`,authorize:({actor})=>actor.verified});
 const instance=world.dispatch({type:'create',guide:'rook',title:'Shop'},human).instance;
 const screen=world.dispatch({type:'create-screen',instanceId:instance.id,title:'Wall'},human).screen;
 const npc=world.dispatch({type:'rig-npc',instanceId:instance.id,name:'Presenter',modelId:'qwen:4b',pilotPrompt:'Show designs',capabilities:['cast-screen']},model).npc;
 const request=()=>world.dispatch({type:'queue-actions',npcId:npc.id,actions:[{tool:'cast-screen',args:{screenId:screen.id,content:{kind:'image',source:{assetId:'craft:poster'},title:'Poster'}}}]},model).intents[0];
 const a=request();
 world.dispatch({type:'cancel-cast',intentId:a.id},human);
 assert.throws(()=>world.dispatch({type:'report-action',intentId:a.id,outcome:'succeeded'},runtime),/queued/);
 assert.throws(()=>world.dispatch({type:'cancel-cast',intentId:a.id},human),/pending/);
 const b=request();
 world.dispatch({type:'report-action',intentId:b.id,outcome:'succeeded'},runtime);
 assert.equal(world.snapshot().screens[0].current.kind,'image');
 assert.throws(()=>world.dispatch({type:'cancel-cast',intentId:b.id},human),/pending/);
 assert.throws(()=>world.dispatch({type:'report-action',intentId:b.id,outcome:'succeeded'},runtime),/queued/);
});
test('both lab UIs expose recovery, media review and bounded upload validation',()=>{
 const av=readFileSync(new URL('../public/app/tools/worldweaver-avatar-lab-v1.mjs',import.meta.url),'utf8');
 const screen=readFileSync(new URL('../public/app/tools/worldweaver-screen-lab-v1.mjs',import.meta.url),'utf8');
 const avHTML=readFileSync(new URL('../public/app/tools/worldweaver-avatar-lab.html',import.meta.url),'utf8');
 const screenHTML=readFileSync(new URL('../public/app/tools/worldweaver-screen-lab.html',import.meta.url),'utf8');
 for(const id of ['import','export','revert','draft-status'])assert.ok(avHTML.includes('id="'+id+'"'));
 assert.match(av,/createAvatarDraftStore/);assert.match(av,/serializeAvatarBundle/);
 for(const id of ['cancel','queue','approve','reject','apply'])assert.ok(screenHTML.includes('id="'+id+'"'));
 assert.match(screen,/validateLabMediaFile/);assert.match(screen,/stopLabMedia/);
 assert.match(screen,/leases\.prune/);assert.match(screen,/disposed/);
});
