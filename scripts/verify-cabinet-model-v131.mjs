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

// Physical cabinet calibration remains valid source material for marketing and visual production.
const calibration=await read('public/app/cabinet-calibration-v131.js');
assert(calibration.includes('--screen-clip'),'cabinet calibration source does not apply clip masks');
assert(calibration.includes('--control-x'),'cabinet calibration source does not apply measured controls');
const calibrationCss=await read('public/app/cabinet-calibration-v131.css');
assert(calibrationCss.includes('clip-path:var(--screen-clip)'),'cabinet mask source CSS missing');

// The installed family now uses the universal hub settings implementation everywhere.
const universalSettings=await read('public/app/minilm-model-settings-v138.js');
for(const required of [
  'Gemini API key',
  'gemini-3.5-flash-lite',
  'https://generativelanguage.googleapis.com/v1beta',
  'antigravity',
  'saveSessionSecret',
  'detectCapabilities',
  'sessionStorage',
  'UNIVERSAL AI SETTINGS'
])assert(universalSettings.includes(required),`universal model setup is missing ${required}`);
assert(!universalSettings.includes('localStorage.setItem("commonweave-model-session"'),'session API key is written to localStorage');
assert(universalSettings.includes('agenticEnabled'),'Antigravity agentic profile toggle missing');

const family=await read('public/app/family-shell-v104.js');
assert(family.includes('CommonweaveModelSettingsV133?.open?.()'),'family shell does not open universal AI settings');
assert(family.includes('[data-ai-settings]')&&family.includes('[data-capability="commonweave.model-setup"]'),'realm-specific settings are not intercepted');

const worker=await read('public/service-worker.js');
const cacheRevision=worker.match(/CACHE_REVISION='([^']+)'/)?.[1]||'';
assert(cacheRevision==='fullscreen-family-r34','service worker is not using the full-screen family cache revision');
for(const required of ['minilm-model-settings-v138.js','model-settings-v133.css','commonweave-model-runtime.js'])assert(worker.includes(required),`service worker does not precache ${required}`);
for(const marketingOnly of ['cabinet-calibration-v131.js','model-settings-v131.js','cabinet-shells-v129.json'])assert(!worker.includes(marketingOnly),`marketing-only or retired settings asset is still installed: ${marketingOnly}`);

console.log(JSON.stringify({ok:true,systems:systems.length,marketingCabinetControls:systems.length*5,anarchadiaMask:'dipped-polygon',geminiKeyStorage:'session-only',agenticProfile:'antigravity',installedSettings:'universal-v138',cabinetCalibration:'repository-only',cacheRevision},null,2));
