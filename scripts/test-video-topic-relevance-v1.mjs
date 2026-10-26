import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
// Exact title, creator and empty description of the catalog record observed in
// the live audit. Keep the small regression fixture if a later atlas removes it.
const electronics={video_id:'1tzeOmNkzlE',url:'https://youtube.com/watch?v=1tzeOmNkzlE',title:'UNIT-4 I ONE SHOT I Digital Electronics & IC Technology I Electronics Engineering I by Vimal sir',creator:'GateWay Classes',catalog_description:'',school_slug:'technology',source_datasets:['massive-yt-edu-queue']};
const noteTopic='Create a digital note. Complete this work unit using technology: open the note editor, type READY, and save the note.';
const noteVideo={url:'https://www.youtube.com/watch?v=noteDEMO001',title:'Write and save a note in the note editor',description:'Open a note editor, enter text, and save your note.',source:'user-selected'};
globalThis.fetch=async input=>Response.json(String(input).includes('youtube-availability-current')?{
  schema:'civweave.youtube-availability-index.v1',status:'current',expires_at:'2099-01-01T00:00:00Z',eligible_video_ids:['1tzeOmNkzlE'],
}:{schema:'civweave.video-learning-atlas.lookup.v1',records:[electronics]});
const media=await import(`../public/app/video-learning-contract-v1.mjs?topic-relevance=${Date.now()}`);

test('digital note workflow and technology labels cannot select the real electronics/IC lecture',async()=>{
  assert.equal(media.mediaMatchesTopic(electronics,noteTopic),false);
  const selected=await media.resolveRelevantVideo(noteTopic,{schoolSlug:'technology'});
  assert.equal(selected.source,'required-fallback');assert.equal(selected.score,0,'A school/category boost must not manufacture a subject match.');
});

test('a matching creator name or incidental description cannot replace a distinctive title/topic anchor',()=>{
  assert.equal(media.mediaMatchesTopic({...electronics,creator:'Note Editor Save Tutorial'},noteTopic),false,'Creator identity is not evidence that an electronics lecture teaches note-taking.');
  assert.equal(media.mediaMatchesTopic({...electronics,catalog_description:'Open a note editor and save a note alongside the lecture.'},noteTopic),false,'Incidental workflow wording must not override the actual lecture subject.');
});

test('genuine note tutorials, single-subject electronics lessons, and the explicit fallback remain supported',()=>{
  assert.equal(media.mediaMatchesTopic(noteVideo,noteTopic),true);
  assert.equal(media.mediaMatchesTopic(electronics,'Learn digital electronics'),true);
  assert.equal(media.mediaMatchesTopic({url:media.FALLBACK_VIDEO_URL},'No catalog topic'),true,'Preserve the explicit canonical fallback contract without inventing relevance.');
});

async function taskFixture(t,videos,{contractAvailable=true}={}){
  const state={quests:[{id:'accepted-note',title:'Create a digital note',objective:noteTopic,status:'completed',review:{state:'accepted',requestId:'accepted-quest-review'},tasks:videos.map((video,index)=>({id:`note-task-${index}`,title:'Open the note editor and save the note',description:'Type READY and retain the saved note.',status:'completed',proofs:[{id:`proof-${index}`,value:'The saved note contains READY.'}],review:{state:'accepted',requestId:`accepted-task-review-${index}`},video,videoContract:{revision:'cerbanimo-video-task-contract-v1.3-subject-recheck',required:1}}))}],receipts:[{id:'accepted-receipt',kind:'quest-accepted'}]};
  const before=JSON.stringify(state),dom=new JSDOM(`<main id="rc-app">${state.quests[0].tasks.map(task=>`<article class="cq144-task" data-task-id="${task.id}"><header><h4>${task.title}</h4><span>COMPLETED · ACCEPTED</span></header><p class="proof">The saved note contains READY.</p></article>`).join('')}</main>`,{url:'https://civweave.test/app/realm-console-v140.html?system=cerbanimo&embed=1&persistentShell=1',runScripts:'outside-only'}),{window}=dom;
  const observers=[],NativeObserver=window.MutationObserver;let writes=0;
  window.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);observers.push(this)}};
  window.CivweaveCerbanimoQuestV144={readState:()=>structuredClone(state),writeState(){writes++;throw new Error('Display admission must not rewrite accepted work.')}};
  window.__loadVideoContract=()=>contractAvailable?Promise.resolve(media):Promise.reject(new Error('Video relevance module unavailable.'));
  t.after(async()=>{for(const observer of observers)observer.disconnect();await new Promise(resolve=>setImmediate(resolve));window.close()});
  window.eval(read('public/app/cerbanimo-video-task-contract-v1.mjs').replace('import(CONTRACT)','__loadVideoContract()'));
  await window.CerbanimoVideoTaskContractV1.reconcile();await new Promise(resolve=>setImmediate(resolve));
  return{window,state,before,writes:()=>writes};
}

test('display admission hides persisted automatic and falsely attributed electronics clips without rewriting accepted work',async t=>{
  const h=await taskFixture(t,[
    {...electronics,source:'civweave-video-atlas',reason:'Matched the local Video Learning Atlas (12 relevance points).'},
    {...electronics,source:'user-selected',creator:'Note Editor Save Tutorial',reason:'Matched the local Video Learning Atlas (12 relevance points).'},
    {...electronics,source:''},
  ]);
  assert.equal(h.window.document.querySelectorAll('iframe').length,0,'Saved URL validity and a user-selected source claim must not bypass subject admission.');
  const notices=[...h.window.document.querySelectorAll('[data-video-contract] [role="status"]')];assert.equal(notices.length,3);
  assert.ok(notices.every(node=>/not.*match|not.*verified|unavailable/i.test(node.textContent)));
  assert.equal(JSON.stringify(h.state),h.before);assert.equal(h.writes(),0);
  assert.equal(h.window.document.querySelectorAll('.proof').length,3);assert.equal(h.window.document.querySelectorAll('header span').length,3);
});

test('display admission preserves a relevant custom companion and renders the fallback as an honest missing match',async t=>{
  const h=await taskFixture(t,[noteVideo,{url:media.FALLBACK_VIDEO_URL,title:'Fallback video companion',source:'required-fallback',score:0,reason:'No sufficiently relevant video candidate was available.'}]);
  assert.equal(h.window.document.querySelectorAll('iframe').length,1);
  assert.match(h.window.document.querySelector('iframe').src,/noteDEMO001/);
  const fallback=h.window.document.querySelectorAll('[data-video-contract]')[1];assert.match(fallback.textContent,/no relevant.*video|no.*match/i);assert.equal(fallback.querySelector('iframe'),null);
  assert.equal(JSON.stringify(h.state),h.before);assert.equal(h.writes(),0);
});

test('unavailable admission code does not assert a mismatch or load an unchecked saved player',async t=>{
  const h=await taskFixture(t,[{...electronics,source:'civweave-video-atlas'}],{contractAvailable:false});
  assert.equal(h.window.document.querySelector('iframe'),null);
  assert.match(h.window.document.querySelector('[role="status"]').textContent,/could not.*check|unavailable/i);
  assert.doesNotMatch(h.window.document.querySelector('[role="status"]').textContent,/does not match/i);
  assert.equal(JSON.stringify(h.state),h.before);assert.equal(h.writes(),0);
});
