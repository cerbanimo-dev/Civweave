import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

await import('./verify-e2b-intake-e4b-handoff-v1.mjs');

const shell=await readFile('public/app/persistent-system-shell-v1.html','utf8');
const campus=await readFile('public/app/working-campus-v440.html','utf8');
for(const html of [shell,campus]){
  assert.ok(html.includes('/app/local-ai/gemma4-structured-task-authority-v1.js'),'A canonical campus entry does not load the structured task authority.');
}

console.log('PASS: E4B owns Weaveling intake/routing and structured learning/Quest generation; selected E2B is bypassed for this process.');