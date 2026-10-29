import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const ui=readFileSync('public/app/guide-chat-surface-v350.js','utf8');
const fast=readFileSync('public/app/local-ai/native-server-guide-fastpath-v1.js','utf8');
const owner=readFileSync('public/extensions/civweave-weaveling-plan-json-v190.js','utf8');
const campus=readFileSync('public/app/working-campus-v440.html','utf8');
const shell=readFileSync('public/app/persistent-system-shell-v1.js','utf8');
assert.match(campus,/guide-chat-surface-v350\.js\?v=1\.0\.200-interwoven-quest-map/);
assert.match(shell,/guide-chat-surface-v350\.js\?v=1\.0\.200-interwoven-quest-map/);
assert.match(fast,/function plausibleQuestRequest/);
assert.match(fast,/commune\|community/);
assert.match(fast,/export async function captureClippedQuest/);
assert.match(owner,/supportsClippedDraftV1:true/);
assert.match(owner,/INCOMPLETE PRIOR ASSISTANT DRAFT/);
assert.match(ui,/syncClippedQuestCapture\(article,row,messages,index\)/);
assert.match(ui,/Capture as structured Quest/);
assert.match(ui,/CivweaveIntentionUI/);
assert.match(ui,/Partial native generation saved after interruption/);
assert.match(ui,/capturedQuestId/);
assert.match(ui,/await module\.captureClippedQuest/);
assert.match(ui,/approvalGate:result\.response\?\.approvalGate/);

const start=ui.indexOf('function clippedQuestCandidate(');
const end=ui.indexOf('let captureQuestBusy=false;',start);
assert.ok(start>=0&&end>start);
const candidate=vm.runInNewContext(
  `const activeSystem='civweave';const clean=(s,n)=>String(s??'').trim().slice(0,n);
${ui.slice(start,end)}
clippedQuestCandidate;`);
const wish='Help me create a commune starting with a community garden and building infrastructure from there';
const thread=[
  {role:'user',text:wish,id:'msg-original'},
  {role:'assistant',id:'msg-draft',text:'Learning Journey plan: “Commune Starting With A Community Garden”\nStatus: REVIEW. This is only the high-level plan.'}
];
const found=candidate(thread[1],thread,1);
assert.equal(found.original,wish);
assert.match(found.excerpt,/Commune Starting/);
assert.equal(candidate({...thread[1],approvalGate:{kind:'intention-activation'}},thread,1),null,
  'An already saved structured Quest must not show an import action');
assert.equal(candidate({...thread[1],planSnapshot:{paths:[{realm:'cerbanimo'}]}},thread,1),null);
assert.equal(candidate({role:'assistant',text:'What is the weather today?'},thread,1),null);
assert.equal(candidate({role:'assistant',text:'Partial native generation saved after interruption. Making the garden'},thread,1)?.original,wish);
const learning=[
  {role:'user',text:'Teach me how to memorize tarot'},
  {role:'assistant',text:'Learning Journey plan: Tarot Basics\nStatus: REVIEW'}
];
assert.equal(candidate(learning[1],learning,1),null,'Pure Moss learning cannot silently become a cross-realm Quest');
assert.match(fast,/if\(!owner\.explicitProjectIntent/,'Manual capture must verify explicit project intent');
console.log('PASS: Weaveling offers visible, user-initiated Quest capture for clipped commune output and preserves original wish without auto-activation.');
