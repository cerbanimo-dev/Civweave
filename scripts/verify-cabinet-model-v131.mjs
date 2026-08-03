import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const shells=JSON.parse(await read('public/app/shared/cabinet-shells-v129.json'));
const systems=['commonweave','living-school','cerbanimo','fellowfare','anarchadia'];
assert(shells.version==='1.0.31','cabinet shell version mismatch');
for(const id of systems){
  const shell=shells.systems?.[id];
  assert(shell,`missing cabinet shell ${id}`);
  assert(shell.kind==='projected-cabinet-v2',`${id} is not using calibrated cabinet v2`);
  assert(Array.isArray(shell.controls)&&shell.controls.length===5,`${id} does not have five measured controls`);
  assert(new Set(shell.controls.map(control=>control.system)).size===5,`${id} control systems are not unique`);
  for(const control of shell.controls){
    assert(Number(control.x)>10&&Number(control.x)<90,`${id} control x out of bounds`);
    assert(Number(control.y)>80&&Number(control.y)<97,`${id} control y out of bounds`);
    assert(Number(control.size)>=7&&Number(control.size)<=15,`${id} control size out of bounds`);
  }
  const screen=shell.screen||{};
  assert(Number(screen.x)>5&&Number(screen.x)<25,`${id} screen x out of bounds`);
  assert(Number(screen.y)>15&&Number(screen.y)<35,`${id} screen y out of bounds`);
  assert(Number(screen.width)>60&&Number(screen.width)<85,`${id} screen width out of bounds`);
  assert(Number(screen.height)>50&&Number(screen.height)<66,`${id} screen height out of bounds`);
  assert(typeof screen.clip==='string'&&screen.clip.length>8,`${id} has no screen clip mask`);
}
const anarchadia=shells.systems.anarchadia.screen;
assert(anarchadia.clip.startsWith('polygon('),'Anarchadia does not use a polygon bezel mask');
assert(anarchadia.clip.includes('17% 3.2%')&&anarchadia.clip.includes('83% 3.2%'),'Anarchadia top dip was lost');
assert(Number(anarchadia.contentTop)>=3,'Anarchadia content does not clear its dipped top border');

const html=await read('public/app/lite-v129.html');
for(const required of [
  '/app/shared/commonweave-model-runtime.js',
  '/app/cabinet-calibration-v131.css',
  '/app/cabinet-calibration-v131.js',
  '/app/model-settings-v131.css',
  '/app/model-settings-v131.js'
])assert(html.includes(required),`Lite entry is missing ${required}`);
assert(html.indexOf('commonweave-model-runtime.js')<html.indexOf('model-settings-v131.js'),'model runtime loads after settings UI');
assert(html.indexOf('lite-v129-core.js')<html.indexOf('cabinet-calibration-v131.js'),'cabinet calibration loads before core functions exist');
assert(html.indexOf('lite-v129-native.js')<html.indexOf('model-settings-v131.js'),'model settings override loads before native renderer exists');
assert(html.indexOf('model-settings-v131.js')<html.indexOf('lite-v129-app.js'),'model settings loads after app mount');

const calibration=await read('public/app/cabinet-calibration-v131.js');
assert(calibration.includes('--screen-clip'),'cabinet calibration does not apply clip masks');
assert(calibration.includes('--control-x'),'cabinet calibration does not apply measured controls');
const calibrationCss=await read('public/app/cabinet-calibration-v131.css');
assert(calibrationCss.includes('clip-path:var(--screen-clip)'),'cabinet mask CSS missing');

const modelSettings=await read('public/app/model-settings-v131.js');
for(const required of [
  'Gemini API key',
  'gemini-3.5-flash-lite',
  'https://generativelanguage.googleapis.com/v1beta',
  'antigravity',
  'saveSessionSecret',
  'detectCapabilities',
  'sessionStorage'
])assert(modelSettings.includes(required),`model setup is missing ${required}`);
assert(!modelSettings.includes('localStorage.setItem("commonweave-model-session"'),'session API key is written to localStorage');
assert(modelSettings.includes('agenticEnabled'),'Antigravity agentic profile toggle missing');
assert(modelSettings.includes('permission failure falls back')||modelSettings.includes('Permission failure falls back'),'Antigravity fallback is not explained to users');

const worker=await read('public/service-worker.js');
const cacheRevision=worker.match(/CACHE_REVISION='([^']+)'/)?.[1]||'';
assert(cacheRevision&&cacheRevision!=='cabinet-r2','service worker cache revision was not advanced beyond the original cabinet cache');
for(const required of ['cabinet-calibration-v131.js','model-settings-v131.js','commonweave-model-runtime.js'])assert(worker.includes(required),`service worker does not precache ${required}`);

console.log(JSON.stringify({ok:true,systems:systems.length,measuredControls:systems.length*5,anarchadiaMask:'dipped-polygon',geminiKeyStorage:'session-only',agenticProfile:'antigravity',cacheRevision},null,2));
