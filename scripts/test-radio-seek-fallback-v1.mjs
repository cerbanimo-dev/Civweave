import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const source=await readFile(new URL('../public/app/system-radio-agent-v233.js',import.meta.url),'utf8');
const bytes=new Uint8Array([73,68,51,4]);
const sha=createHash('sha256').update(bytes).digest('hex');
const track=id=>({candidate_id:id,title:`Track ${id}`,artist:'QA artist',source_url:`https://ccmixter.org/files/qa/${id}`,license:{spdx:'CC-BY',label:'CC BY 3.0',url:'https://creativecommons.org/licenses/by/3.0/',evidence:'source page',redistribution:true},attribution:{creator:'QA artist'},files:[{url:`/downloads/hub-media/open-music/audio/${id}.mp3`,role:'redistributed-source-download',mime:'audio/mpeg',bytes:bytes.length,sha256:sha}],playlist_matches:[{playlist_id:'civweave'}],download_enabled:true,mesh_redistributable:true,explicit:false});
async function fixture({networkSeekable=false,gated=false,corrupt=false,oversize=false,decodeFailure=false,gateBlobMetadata=false}={}){
  const dom=new JSDOM('<!doctype html><html data-civweave-system="civweave" data-persistent-system="civweave"><head></head><body></body></html>',{url:'https://civweave.test/app/persistent-system-shell-v1.html?system=civweave',runScripts:'outside-only'}),w=dom.window;
  const media=new WeakMap(),fetched=[],created=[],revoked=[],timeSets=[],pendingMetadata=[];let plays=0,writes=0,release;
  const gate=gated?new Promise(resolve=>{release=resolve}):Promise.resolve();
  w.Response=Response;w.Blob=Blob;w.AbortController=AbortController;Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});
  w.URL.createObjectURL=blob=>{const url=`blob:qa-track-${created.length+1}`;created.push({url,blob});return url};w.URL.revokeObjectURL=url=>revoked.push(url);
  w.caches={open:async()=>({match:async()=>null,put:async()=>{writes++},delete:async()=>true})};
  w.fetch=async(url,options={})=>{
    if(String(url).includes('catalog.json'))return Response.json({records:[track('one'),track('two')]});
    fetched.push({url:String(url),options});await gate;
    return new Response(oversize?new Uint8Array([73,68,51,4,5]):corrupt?new Uint8Array([73,68,51,5]):bytes,{headers:{'content-type':'audio/mpeg'}});
  };
  const state=audio=>{if(!media.has(audio))media.set(audio,{time:0,duration:NaN,ready:0,paused:true});return media.get(audio)};
  const prototype=w.HTMLMediaElement.prototype;
  Object.defineProperties(prototype,{
    currentTime:{configurable:true,get(){return state(this).time},set(value){const s=state(this),allowed=s.ready>=1&&(this.src.startsWith('blob:')||networkSeekable);timeSets.push({url:this.src,ready:s.ready,allowed,value});if(allowed){s.time=value;this.dispatchEvent(new w.Event('timeupdate'))}}},
    duration:{configurable:true,get(){return state(this).duration}},readyState:{configurable:true,get(){return state(this).ready}},paused:{configurable:true,get(){return state(this).paused}},
    seekable:{configurable:true,get(){const length=state(this).ready>=1&&(this.src.startsWith('blob:')||networkSeekable)?1:0;return{length,start(){return 0},end(){return 120}}}}
  });
  prototype.load=function(){const s=state(this),src=this.src;s.time=0;s.duration=NaN;s.ready=0;if(!this.hasAttribute('src'))return;const finish=()=>{if(this.src!==src)return;if(decodeFailure&&src.startsWith('blob:')){this.dispatchEvent(new w.Event('error'));return}s.duration=120;s.ready=1;this.dispatchEvent(new w.Event('loadedmetadata'))};if(gateBlobMetadata&&src.startsWith('blob:'))pendingMetadata.push(finish);else setTimeout(finish,5)};
  prototype.play=function(){plays++;state(this).paused=false;this.dispatchEvent(new w.Event('play'));return Promise.resolve()};
  prototype.pause=function(){state(this).paused=true;this.dispatchEvent(new w.Event('pause'))};
  Object.defineProperty(w.document,'readyState',{value:'complete'});w.eval(source);const api=w.CivweaveRadioStationSurfaceV1;
  const settle=()=>new Promise(resolve=>setTimeout(resolve,20));api.open();await settle();await api.playTrack('one');await settle();
  const audio=w.document.querySelector('audio'),seek=w.document.querySelector('[data-radio-seek]');
  const chooseTime=value=>{seek.value=String(value);seek.dispatchEvent(new w.Event('input',{bubbles:true}));seek.dispatchEvent(new w.Event('change',{bubbles:true}))};
  return{dom,w,api,audio,seek,fetched,created,revoked,timeSets,chooseTime,release,releaseMetadata:()=>pendingMetadata.splice(0).forEach(finish=>finish()),settle,get plays(){return plays},get writes(){return writes}};
}

test('an explicit seek on an unseekable paused stream prepares verified memory audio and waits for its metadata',async t=>{
  const x=await fixture();t.after(()=>x.dom.window.close());x.w.document.querySelector('[data-radio-play]').click();assert.equal(x.audio.paused,true);
  assert.equal(x.fetched.length,0);x.chooseTime(42);await x.settle();
  assert.equal(x.fetched.length,1);assert.match(x.audio.src,/^blob:/);assert.equal(x.audio.currentTime,42);
  assert.equal(x.audio.paused,true);assert.equal(x.plays,1,'A paused seek must never autoplay');assert.equal(x.writes,0,'Memory seeking must not save an offline copy');
  assert.ok(x.timeSets.some(row=>row.url.startsWith('blob:')&&row.ready>=1&&row.allowed&&row.value===42));
});

test('a seek while playing resumes only after the prepared track reaches the requested time',async t=>{
  const x=await fixture();t.after(()=>x.dom.window.close());x.chooseTime(85);await x.settle();
  assert.equal(x.audio.currentTime,85);assert.equal(x.plays,2);assert.equal(x.audio.paused,false);assert.equal(x.writes,0);
});

test('repeated seek gestures share one bounded preparation request and apply the latest requested time',async t=>{
  const x=await fixture({gated:true});t.after(()=>x.dom.window.close());x.chooseTime(40);x.chooseTime(90);await x.settle();
  assert.equal(x.fetched.length,1);assert.match(x.w.document.querySelector('[data-radio-status]').textContent,/preparing/i);
  x.release();await x.settle();assert.equal(x.audio.currentTime,90);assert.equal(x.created.length,1);assert.equal(x.writes,0);
});

test('a stream with an existing seekable target uses native seeking without fetching a complete recording',async t=>{
  const x=await fixture({networkSeekable:true});t.after(()=>x.dom.window.close());x.chooseTime(50);await x.settle();
  assert.equal(x.audio.currentTime,50);assert.equal(x.fetched.length,0);assert.equal(x.created.length,0);assert.equal(x.plays,1);
});

for(const option of ['corrupt','oversize'])test(`${option} seek preparation remains visible as a failure and cannot become playable or saved audio`,async t=>{
  const x=await fixture({[option]:true});t.after(()=>x.dom.window.close());x.chooseTime(42);await x.settle();
  assert.equal(x.created.length,0);assert.equal(x.writes,0);assert.match(x.audio.src,/one\.mp3$/);assert.equal(x.audio.paused,true);
  assert.match(x.w.document.querySelector('[data-radio-status]').textContent,/could not seek/i);assert.equal(x.plays,1);
});

test('selecting another track aborts stale seek preparation without replacing the new track or leaking a blob URL',async t=>{
  const x=await fixture({gated:true});t.after(()=>x.dom.window.close());x.chooseTime(60);await x.settle();
  await x.api.playTrack('two');x.release();await x.settle();
  assert.match(x.audio.src,/two\.mp3$/);assert.equal(x.created.length,0);assert.equal(x.writes,0);assert.equal(x.fetched[0].options.signal.aborted,true);
});

test('a failed prepared-audio decode revokes the memory URL and restores the paused stream with a visible failure',async t=>{
  const x=await fixture({decodeFailure:true});t.after(()=>x.dom.window.close());x.chooseTime(30);await x.settle();
  assert.equal(x.created.length,1);assert.deepEqual(x.revoked,[x.created[0].url]);assert.match(x.audio.src,/one\.mp3$/);
  assert.equal(x.audio.paused,true);assert.equal(x.plays,1);assert.equal(x.writes,0);assert.match(x.w.document.querySelector('[data-radio-status]').textContent,/could not seek/i);
});

test('changing tracks while prepared metadata is pending revokes the old URL and cannot resume stale playback',async t=>{
  const x=await fixture({gateBlobMetadata:true});t.after(()=>x.dom.window.close());x.chooseTime(30);await x.settle();assert.equal(x.created.length,1);
  await x.api.playTrack('two');x.releaseMetadata();await x.settle();
  assert.deepEqual(x.revoked,[x.created[0].url]);assert.match(x.audio.src,/two\.mp3$/);assert.equal(x.plays,2);assert.equal(x.audio.currentTime,0);assert.equal(x.writes,0);
});

test('later seeks reuse the prepared memory track instead of downloading or saving it again',async t=>{
  const x=await fixture();t.after(()=>x.dom.window.close());x.chooseTime(30);await x.settle();x.chooseTime(75);await x.settle();
  assert.equal(x.audio.currentTime,75);assert.equal(x.created.length,1);assert.equal(x.fetched.length,1);assert.equal(x.writes,0);
});
