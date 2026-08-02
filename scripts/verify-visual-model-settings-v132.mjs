import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const hub=await read('public/app/loom-v128.html');
const realm=await read('public/app/realm-v128.html');
const settings=await read('public/app/visual-model-settings-v132.js');
const css=await read('public/app/visual-model-settings-v132.css');
const worker=await read('public/service-worker.js');

for(const [name,html] of [['hub',hub],['realm',realm]]){
  assert(html.includes('/app/shared/commonweave-model-runtime.js'),`${name} does not load the shared model runtime`);
  assert(html.includes('/app/visual-model-settings-v132.js?v=gemini-r2'),`${name} does not load the shared Visual settings controller`);
  assert(html.includes('/app/visual-model-settings-v132.css?v=gemini-r2'),`${name} does not load the Visual settings styles`);
  assert(html.indexOf('commonweave-model-runtime.js')<html.indexOf('visual-model-settings-v132.js'),`${name} loads Visual settings before the model runtime`);
}

for(const required of [
  'Gemini API key',
  'Google API endpoint',
  'https://generativelanguage.googleapis.com/v1beta',
  'gemini-3.5-flash-lite',
  'sessionStorage',
  'saveSessionSecret',
  'detectCapabilities',
  'Use Antigravity for agentic and background work',
  "model:'antigravity'",
  '[data-action="settings"],[data-settings]'
])assert(settings.includes(required),`Visual settings is missing ${required}`);

assert(settings.includes("if(!form.geminiEndpoint.value.trim())form.geminiEndpoint.value=GEMINI_ENDPOINT"),'Gemini endpoint is not auto-populated on route selection');
assert(settings.includes("form.geminiEndpoint.value=state.route==='gemini'?(state.endpoint||GEMINI_ENDPOINT):GEMINI_ENDPOINT"),'Gemini endpoint is not pre-filled when the modal opens');
assert(settings.includes("type=\"password\""),'API key input is not masked');
assert(!settings.includes("localStorage.setItem(SESSION_KEY"),'session API key is written to persistent localStorage');
assert(css.includes('.cw-ai-settings-dialog'),'Visual settings styles are missing');
assert(css.includes('.cw-ai-consent input'),'Visual consent checkbox sizing is not normalized');

assert(worker.includes("CACHE_REVISION='visual-ai-r4'"),'service worker cache revision did not rotate');
for(const required of ['visual-model-settings-v132.css','visual-model-settings-v132.js'])assert(worker.includes(required),`service worker does not precache ${required}`);

console.log(JSON.stringify({ok:true,surfaces:['hub','realm'],geminiEndpoint:'https://generativelanguage.googleapis.com/v1beta',keyStorage:'session-only',antigravity:true,cacheRevision:'visual-ai-r4'},null,2));
