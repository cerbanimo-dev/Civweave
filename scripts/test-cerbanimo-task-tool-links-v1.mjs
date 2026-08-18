import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {toolsForTask,toolHref} from '../public/app/cerbanimo-task-tool-links-v1.mjs';

const quest={id:'quest:private-42'};
const kinds=task=>toolsForTask(quest,{id:'task:1',status:'ready',...task}).map(row=>row.kind);

assert.deepEqual(kinds({title:'Draft the launch proposal'}),['text']);
assert.deepEqual(kinds({title:'Write 500 words about what you learned'}),['text'],'strong text-production verbs should work without a file-type noun');
assert.deepEqual(kinds({title:'Record the podcast introduction'}),['audio']);
assert.deepEqual(kinds({title:'Mix and master the finished take'}),['audio'],'strong audio-production verbs should work without an audio noun');
assert.deepEqual(kinds({title:'Edit the launch video'}),['video']);
assert.deepEqual(kinds({title:'Film yourself demonstrating the technique'}),['video'],'strong video-production verbs should work without a video noun');
assert.deepEqual(kinds({title:'Write the script and record the voiceover'}),['text','audio']);
assert.deepEqual(kinds({title:'Watch the required video'}),[],'passive video consumption must not expose the Video Creator');
assert.deepEqual(kinds({title:'Review the article'}),[],'passive review must not expose the Text Creator');
assert.deepEqual(kinds({title:'Research podcast formats'}),[],'research about a medium is not a media deliverable');
assert.deepEqual(kinds({title:'Listen to the recording'}),[],'passive listening must not expose the Audio Creator');
assert.deepEqual(kinds({title:'Revise the article'}),['text']);
assert.deepEqual(kinds({title:'Draft the memo',status:'completed'}),[],'completed work should not receive a creation shortcut');
assert.deepEqual(kinds({title:'Collect references',creatorTools:['text']}),['text'],'explicit Creator tool hints remain available for future task producers');

const href=toolHref('video',quest.id,'task:private-7');
assert.match(href,/^\/creator-suite\/\?tool=video/);
assert.match(href,/quest=quest%3Aprivate-42/);
assert.match(href,/task=task%3Aprivate-7/);
assert.equal(href.includes('launch'),false,'task wording must not be copied into Creator Suite URLs');
assert.throws(()=>toolHref('image',quest.id,'task:1'),/Unsupported Creator Suite task tool/);

const consoleHtml=await fs.readFile(new URL('../public/app/realm-console-v140.html',import.meta.url),'utf8');
assert.match(consoleHtml,/cerbanimo-task-tool-links-v1\.mjs/,'Cerbanimo must load the task tool-link enhancer');
const suiteSource=await fs.readFile(new URL('../public/creator-suite/creator-suite-v1.js',import.meta.url),'utf8');
assert.match(suiteSource,/params\.get\(['"]tool['"]\)/,'Creator Suite must read the linked tool request');
assert.match(suiteSource,/select\(launch\.tool\)/,'Creator Suite must open the requested Text, Audio, or Video tool');
assert.match(suiteSource,/getLaunchContext:launchContext/,'Creator Suite must expose the non-content launch context');
const linkSource=await fs.readFile(new URL('../public/app/cerbanimo-task-tool-links-v1.mjs',import.meta.url),'utf8');
assert.doesNotMatch(linkSource,/setInterval\(/,'task tool links must not create a polling loop');
assert.match(linkSource,/data-cq-task-tool/,'links must be attached to the existing task footer rather than creating a second task surface');

console.log('Cerbanimo task cards expose privacy-bounded Creator Suite links only for actionable deliverables.');
