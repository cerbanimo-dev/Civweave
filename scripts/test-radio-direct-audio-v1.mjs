import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createHash, webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';

const read = name => readFile(new URL(`../public/app/${name}`, import.meta.url), 'utf8');
const sources = await Promise.all(['system-radio-agent-v233.js', 'radio-safe-stations-v1.js', 'radio-track-suggestions-v240.js'].map(read));
const record = (id, overrides = {}) => ({candidate_id:id,title:`Track ${id}`,artist:'QA musician',source_url:`https://ccmixter.org/files/qa/${id}`,license:{spdx:'CC-BY',label:'CC BY 3.0',url:'https://creativecommons.org/licenses/by/3.0/',evidence:'source page',redistribution:true},attribution:{creator:'QA musician',source_title:`Track ${id}`},files:[{url:`/downloads/hub-media/open-music/audio/${id}.mp3`,mime:'audio/mpeg',bytes:4}],playlist_matches:[{playlist_id:'civweave'},{playlist_id:'fellowfare'}],download_enabled:true,mesh_redistributable:true,explicit:false,...overrides});
async function setup({safe=false, records=[record('one'),record('two')],failAudio=false,extensions=true,childFirst=false,legacyMode=''}={}) {
  const dom=new JSDOM('<!doctype html><html data-civweave-system="civweave" data-persistent-system="civweave"><head></head><body></body></html>',{url:'https://civweave.test/app/persistent-system-shell-v1.html?system=civweave&installed=1',runScripts:'outside-only'});
  const w=dom.window,calls=[],store=new Map();let plays=0,pauses=0;
  w.Response=Response;w.Blob=Blob;w.AbortController=AbortController;
  Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});
  w.URL.createObjectURL=()=> 'blob:qa-local-audio';w.URL.revokeObjectURL=()=>{};
  w.fetch=async (url,options={})=>{calls.push({url:String(url),options});if(String(url).includes('lazy-manifest.json'))return Response.json({schema:'civweave.open-music-lazy-manifest.v1',entries:[]});if(String(url).includes('catalog.json'))return Response.json({records});if(failAudio)throw new Error('QA offline');return new Response(new Uint8Array([73,68,51,4]),{headers:{'content-type':'audio/mpeg'}})};
  const cache={match:async key=>store.get(String(key))?.clone(),put:async(key,response)=>{store.set(String(key),response.clone())},delete:async key=>store.delete(String(key))};
  w.caches={open:async()=>cache};
  w.HTMLMediaElement.prototype.play=function(){plays++;this.dispatchEvent(new w.Event('play'));return Promise.resolve()};
  w.HTMLMediaElement.prototype.pause=function(){pauses++;this.dispatchEvent(new w.Event('pause'))};
  w.HTMLMediaElement.prototype.load=function(){};
  if(safe)w.localStorage.setItem('civweave.safe-mode.v1',JSON.stringify({enabled:true}));
  if(legacyMode)w.localStorage.setItem('civweave.radio.content-mode.v1',legacyMode);
  let child=null;
  if(childFirst){const frame=w.document.createElement('iframe');w.document.body.append(frame);child=frame.contentWindow;for(const source of sources)child.eval(source)}
  for(const source of (extensions?sources:[sources[0]]))w.eval(source);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const api=w.CivweaveRadioStationSurfaceV1;
  const settle=()=>new Promise(resolve=>setTimeout(resolve,15));
  return{w,dom,api,calls,store,settle,child,get plays(){return plays},get pauses(){return pauses}};
}

test('radio opens direct music without fetching media or autoplay; extensions leave its single audio owner intact',async t=>{
  const x=await setup();t.after(()=>x.dom.window.close());
  assert.equal(x.api.mode(),'direct');assert.equal(x.calls.length,0);
  x.api.open();await x.settle();
  assert.equal(x.w.document.querySelectorAll('audio').length,1);
  assert.equal(x.plays,0);assert.equal(x.calls.filter(c=>!c.url.includes('catalog.json')&&!c.url.includes('lazy-manifest.json')).length,0);
  assert.match(x.w.document.querySelector('[data-radio-body]').textContent,/Track one/);
  assert.equal(x.w.document.querySelector('[data-radio-persistent-suggestion]'),null);
  assert.equal(x.w.document.querySelector('audio').getAttribute('preload'),'none');
  assert.equal(x.w.document.querySelector('audio').hasAttribute('src'),false);
});

test('explicit track playback, pause, next, seek and volume control the same media element',async t=>{
  const x=await setup();t.after(()=>x.dom.window.close());x.api.open();await x.settle();
  await x.api.playTrack('one');const audio=x.w.document.querySelector('audio');
  assert.match(audio.src,/one\.mp3$/);assert.equal(x.plays,1);
  x.w.document.querySelector('[data-radio-play]').click();assert.ok(x.pauses>=1);
  x.w.document.querySelector('[data-radio-next]').click();await x.settle();assert.match(audio.src,/two\.mp3$/);
  Object.defineProperty(audio,'duration',{value:120,configurable:true});audio.dispatchEvent(new x.w.Event('loadedmetadata'));
  Object.defineProperty(audio,'seekable',{value:{length:1,start:()=>0,end:()=>120},configurable:true});
  const seek=x.w.document.querySelector('[data-radio-seek]');seek.value='42';seek.dispatchEvent(new x.w.Event('input',{bubbles:true}));assert.equal(audio.currentTime,42);
  const volume=x.w.document.querySelector('[data-radio-volume]');volume.value='0.3';volume.dispatchEvent(new x.w.Event('input',{bubbles:true}));assert.equal(audio.volume,0.3);
  x.api.close();x.api.open();assert.equal(x.w.document.querySelector('audio'),audio);
});

test('explicit offline save stores playable audio; cached playback avoids the network; removal clears saved audio',async t=>{
  const x=await setup();t.after(()=>x.dom.window.close());x.api.open();await x.settle();
  await x.api.saveOffline('one');assert.equal(x.store.size,1);
  const requests=x.calls.length;await x.api.playTrack('one');assert.equal(x.calls.length,requests);assert.equal(x.w.document.querySelector('audio').src,'blob:qa-local-audio');
  await x.api.removeOffline('one');assert.equal(x.store.size,0);assert.match(x.w.document.querySelector('[data-radio-status]').textContent,/removed/i);
});

test('download failures remain visible and never claim an offline copy',async t=>{
  const x=await setup({failAudio:true});t.after(()=>x.dom.window.close());x.api.open();await x.settle();
  assert.equal(await x.api.saveOffline('one'),false);assert.equal(x.store.size,0);
  assert.match(x.w.document.querySelector('[data-radio-status]').textContent,/could not save/i);
});

test('unlicensed, disallowed, duplicate, or unsafe records cannot enter direct playback',async t=>{
  const x=await setup({records:[record('one'),record('one'),record('bad',{license:{spdx:'CC-BY-NC',redistribution:true}}),record('explicit',{explicit:true}),record('unknown',{license:{spdx:'CC-BY',redistribution:true,evidence:''}})]});t.after(()=>x.dom.window.close());
  x.api.open();await x.settle();assert.equal(x.api.directTracksFor().length,1);assert.equal(await x.api.playTrack('bad'),false);
  const body=x.w.document.querySelector('[data-radio-body]');assert.match(body.textContent,/CC BY 3.0/);assert.match(body.innerHTML,/creativecommons\.org/);assert.match(body.innerHTML,/ccmixter\.org/);
});

test('S.A.F.E. fails closed for open tracks without a broader safety audit and preserves the existing safe Spotify extension',async t=>{
  const x=await setup({safe:true});t.after(()=>x.dom.window.close());x.api.open();await x.settle();
  assert.equal(x.api.directTracksFor().length,0);assert.equal(await x.api.playTrack('one'),false);
  assert.match(x.w.document.querySelector('[data-radio-body]').textContent,/S\.A\.F\.E\./);
  assert.equal(x.api.setMode('original'),false);x.api.setMode('clean');await x.settle();
  assert.ok(x.w.document.querySelector('[data-radio-safe-station]'));
  assert.equal(x.w.document.querySelectorAll('audio').length,1);assert.equal(x.plays,0);
});

test('switching S.A.F.E. on pauses an unaudited current track and resets direct selection',async t=>{
  const x=await setup();t.after(()=>x.dom.window.close());x.api.open();await x.settle();await x.api.playTrack('one');const before=x.pauses;
  x.w.localStorage.setItem('civweave.safe-mode.v1',JSON.stringify({enabled:true}));x.w.dispatchEvent(new x.w.CustomEvent('civweave:safe-mode-changed'));await x.settle();
  assert.ok(x.pauses>before);assert.equal(x.api.directTracksFor().length,0);assert.equal(x.w.document.querySelector('audio').hasAttribute('src'),false);
});

test('persistent system navigation updates theme and queue while keeping one audio element and current playback',async t=>{
  const x=await setup();t.after(()=>x.dom.window.close());x.api.open();await x.settle();await x.api.playTrack('one');const audio=x.w.document.querySelector('audio');
  x.w.document.documentElement.dataset.civweaveSystem='fellowfare';x.w.dispatchEvent(new x.w.CustomEvent('civweave:system-route-changed',{detail:{system:'fellowfare'}}));await x.settle();
  assert.equal(x.w.document.querySelector('audio'),audio);assert.match(audio.src,/one\.mp3$/);assert.equal(x.w.document.querySelector('[data-radio-system]').textContent,'FellowFare Radio');
  const style=x.w.document.getElementById('cw-radio-station-surface-v1-style').textContent;
  assert.match(style,/background:transparent/);assert.match(style,/--cw-radio-accent/);assert.match(style,/data-radio-embedded/);
});

test('embedded child loaded first waits for the parent owner without creating a launcher or media element',async t=>{
  const x=await setup({childFirst:true});t.after(()=>x.dom.window.close());await x.settle();
  assert.equal(x.child.CivweaveRadioStationSurfaceV1,x.api);
  assert.equal(x.child.CivweaveRadioSafeStationsV1,x.w.CivweaveRadioSafeStationsV1);
  assert.equal(x.child.CivweaveRadioTrackSuggestionsV247,x.w.CivweaveRadioTrackSuggestionsV247);
  assert.equal(x.child.document.querySelectorAll('audio,#cw-radio-station-launcher-v1').length,0);
  assert.equal(x.w.document.querySelectorAll('audio,#cw-radio-station-launcher-v1').length,2);
});

test('an old clean-station preference does not silently replace the new direct music default',async t=>{
  const x=await setup({legacyMode:'clean'});t.after(()=>x.dom.window.close());
  assert.equal(x.api.mode(),'direct');assert.equal(x.w.localStorage.getItem('civweave.radio.content-mode.v1'),'clean');
  x.api.setMode('clean');assert.equal(x.api.mode(),'clean');assert.equal(x.w.localStorage.getItem('civweave.radio.playback-mode.v1'),'clean');
});

test('time updates preserve the attribution DOM and do not repeat status announcements',async t=>{
  const x=await setup();t.after(()=>x.dom.window.close());x.api.open();await x.settle();await x.api.playTrack('one');
  const audio=x.w.document.querySelector('audio'),source=x.w.document.querySelector('[data-radio-current-credits] a'),status=x.w.document.querySelector('[data-radio-status]').firstChild;
  for(let i=0;i<4;i++){audio.currentTime=i;audio.dispatchEvent(new x.w.Event('timeupdate'))}
  assert.equal(x.w.document.querySelector('[data-radio-current-credits] a'),source);assert.equal(x.w.document.querySelector('[data-radio-status]').firstChild,status);
});

test('a corrupt download fails integrity checking and is never cached as a saved recording',async t=>{
  const x=await setup({records:[record('one',{content_hash:'0'.repeat(64)})]});t.after(()=>x.dom.window.close());x.api.open();await x.settle();
  assert.equal(await x.api.saveOffline('one'),false);assert.equal(x.store.size,0);assert.match(x.w.document.querySelector('[data-radio-status]').textContent,/could not save/i);
});

test('a catalog containing no eligible recordings finishes with an explicit empty state',async t=>{
  const x=await setup({records:[record('bad',{license:{spdx:'unknown'}})]});t.after(()=>x.dom.window.close());x.api.open();await x.settle();
  assert.equal(x.api.directTracksFor().length,0);assert.match(x.w.document.querySelector('[data-radio-body]').textContent,/no open recordings/i);assert.doesNotMatch(x.w.document.querySelector('[data-radio-body]').textContent,/loading/i);
});

test('a cache quota failure does not claim that the download was saved',async t=>{
  const x=await setup();t.after(()=>x.dom.window.close());x.api.open();await x.settle();
  x.w.caches={open:async()=>({put:async()=>{throw new Error('Quota exceeded')}})};
  assert.equal(await x.api.saveOffline('one'),false);assert.equal(x.store.size,0);assert.match(x.w.document.querySelector('[data-radio-status]').textContent,/device storage/i);
});

test('packaged starter audio matches its published source hashes, attribution and five-system station mappings',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/downloads/hub-media/open-music/starter-catalog.json',import.meta.url),'utf8'));
  assert.equal(manifest.records.length,3);let bytes=0;
  for(const row of manifest.records){
    const file=row.files[0],data=await readFile(new URL(`../public${file.url}`,import.meta.url));bytes+=data.length;
    assert.equal(data.length,file.bytes);assert.ok(data.length<24*1024*1024);
    assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256);
    assert.equal(row.content_hash,file.sha256);assert.equal(row.license.spdx,'CC-BY');assert.equal(row.license.url,'https://creativecommons.org/licenses/by/3.0/');
    assert.match(row.license.evidence,/Primary ccMixter source page/);assert.match(row.source_download_url,/^https:\/\/ccmixter\.org\/content\//);assert.match(row.attribution.credit_line,/featuring/);assert.equal(row.attribution.changes,'Unmodified source recording.');
    assert.equal(row.explicit,false);assert.notEqual(row.safeAudit,'SAFE-PASS-V1');
  }
  assert.equal(bytes,12044592);
  for(const system of ['civweave','living-school','cerbanimo','fellowfare','anarchadia'])assert.ok(manifest.records.some(row=>row.playlist_matches.some(match=>match.playlist_id===system)),`${system} has a station pick`);
});

test('the real published starter manifest produces three playable choices with the current station pick first in every theme',async t=>{
  const manifest=JSON.parse(await readFile(new URL('../public/downloads/hub-media/open-music/starter-catalog.json',import.meta.url),'utf8'));
  const x=await setup({records:manifest.records});t.after(()=>x.dom.window.close());x.api.open();await x.settle();
  for(const system of ['civweave','living-school','cerbanimo','fellowfare','anarchadia']){
    x.w.document.documentElement.dataset.civweaveSystem=system;x.w.dispatchEvent(new x.w.CustomEvent('civweave:system-route-changed',{detail:{system}}));
    const tracks=x.api.directTracksFor(system);assert.equal(tracks.length,3);assert.ok(tracks[0].systems.includes(system));
    assert.equal(x.w.document.querySelectorAll('[data-radio-track-play]').length,3);
  }
  assert.equal(x.plays,0);assert.equal(x.calls.filter(call=>!call.url.includes('catalog.json')).length,0);
});
