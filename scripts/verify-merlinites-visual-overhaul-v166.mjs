import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const shell = read('public/app/family-shell-v104.js');
const shellCss = read('public/app/family-shell-v104.css');
const shellFix = read('public/app/merlinites-shell-fix-v166.css');
const profiles = JSON.parse(read('public/app/assets/ai/profiles.json'));

const expectedOrder = "['commonweave','living-school','cerbanimo','fellowfare','anarchadia']";
assert(shell.includes(`const SYSTEM_ORDER=${expectedOrder}`), 'Global realm order is not fixed.');
assert(shell.includes('SYSTEM_ORDER.map'), 'The global dock is not rendering all five realm positions.');
assert(!shell.includes("filter(([id])=>id!==current)"), 'The active realm is still being removed from the dock.');
assert(shell.includes('data-cwf-chat'), 'The Weaveling top-rail control is missing.');
assert(shell.includes('/app/merlinites-shell-fix-v166.css?v=merlinites-r2'), 'The compact top-rail correction is not loaded.');
assert(shell.includes("dataset.visualShell='merlinites-r1'"), 'The visual shell identity is not merlinites.');

const expectedArtifacts = {
  weaveling: 'weaveling-compass.png',
  moss: 'moss-acorn.png',
  kamiya: 'kamiya-gift.png',
  rook: 'rook-coin-button.png',
  merlin: 'merlin-hat.png'
};
for (const profile of profiles.profiles) {
  const expected = expectedArtifacts[profile.id];
  assert(expected, `Unexpected AI profile ${profile.id}.`);
  assert(profile.artifact.endsWith(expected), `${profile.id} does not point to the expected artifact.`);
  assert(shell.includes(`/app/${profile.artifact}`), `${profile.id} artifact is not used by the global shell.`);
  assert(fs.existsSync(path.join(root, 'public/app', profile.artifact)), `${profile.id} artifact file is missing.`);
  assert(fs.existsSync(path.join(root, 'public/app', profile.sprite)), `${profile.id} avatar file is missing.`);
}

for (const token of [
  'html[data-system="commonweave"]',
  'html[data-system="cerbanimo"]',
  'html[data-commonweave-system="living-school"]',
  'html[data-commonweave-system="fellowfare"]',
  'html[data-commonweave-system="anarchadia"]'
]) {
  assert(shellCss.includes(token), `Missing realm-defining CSS for ${token}.`);
}

assert(shellFix.includes('grid-template-columns:36px minmax(0,1fr) auto 36px 38px'), 'Top rail does not reserve separate Weaveling and settings controls.');
assert(shellFix.includes('.cwf104-chat'), 'Top-rail Weaveling styling is missing.');
assert(shellFix.includes('#gc153-launcher') && shellFix.includes('[data-weaveling-launcher]'), 'Legacy bottom Weaveling launchers are not hidden.');
assert(shellFix.includes('aspect-ratio:auto!important') && shellFix.includes('.ffc144-rook-form button'), 'Rook send control can still expand into the mobile workbench.');
assert(shellFix.includes('.ls-room{position:relative!important') && shellFix.includes('.ls-recovery'), 'Living School lacks its visible mobile stage or startup recovery treatment.');
assert(shell.includes('removeLegacyLaunchers') && shell.includes('restoreChatControl'), 'Family shell does not remove legacy launchers and restore the icon-only chat control.');
assert(!shell.includes("button.textContent='Talk to Commonweave'"), 'Family shell still replaces the chat icon with collision-prone text.');
assert(shell.includes('async function ensureSettings()') && shell.includes('SETTINGS_SCRIPTS'), 'Settings do not use the bounded settings-only loader.');
assert(shell.includes('CommonweaveCodeRailsV169') && shell.includes('canGenerate:false'), 'Local code rails capability boundary is missing.');
assert(shell.includes('machine-readable test') && shell.includes('imported LLM'), 'Local validation and imported-generation boundaries are not explained.');

for (const file of [
  'public/app/realm-console-v140.html',
  'public/app/cabinets/living-school/index.html',
  'public/app/fellowfare-cabinet-v144.html',
  'public/app/anarchadia-console-v139.html'
]) {
  const html = read(file);
  assert(html.includes('/app/family-shell-v104.css?v=merlinites-r1'), `${file} is not cache-busting the merlinites shell CSS.`);
  assert(html.includes('/app/family-shell-v104.js?v=merlinites-r1'), `${file} is not cache-busting the merlinites shell JS.`);
}

const sandbox={
  console,
  URLSearchParams,
  TextEncoder,
  location:{search:'?system=cerbanimo',pathname:'/app/realm-console-v140.html',assign(){}},
  localStorage:{getItem(){return null},setItem(){}},
  document:{readyState:'loading'},
  addEventListener(){},
  setInterval(){},
  globalThis:null
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(shell,sandbox);
const validator=sandbox.CommonweaveCodeRailsV169;
assert(validator?.canGenerate===false, 'The onboard code rails runtime claims generation authority.');
const descriptive=validator.validate({code:'const garden = true;',language:'javascript',criteria:['The garden feature works.']});
assert(descriptive.status==='review'&&!descriptive.verified, 'Descriptive rails were incorrectly treated as deterministic proof.');
const deterministic=validator.validate({code:'const garden = true;',language:'javascript',criteria:[{label:'Declare garden',type:'required-pattern',pattern:'const\\s+garden'}]});
assert(deterministic.status==='pass'&&deterministic.verified, 'Machine-readable rails do not produce a deterministic pass.');
const unsafe=validator.validate({code:'eval("garden")',language:'javascript',criteria:[{label:'Small source',type:'max-bytes',maxBytes:200}]});
assert(unsafe.status==='fail'&&!unsafe.verified, 'Forbidden dynamic code was not rejected.');

const oldName = ['S','ol'].join('');
const oldSlug = oldName.toLowerCase();
for (const [label, source] of Object.entries({shell, shellCss, shellFix})) {
  assert(!source.includes(`${oldSlug}-shell`), `${label} still contains the retired shell path.`);
  assert(!source.includes(`${oldSlug}-semantic`), `${label} still contains the retired semantic path.`);
  assert(!source.includes(`--${oldSlug}-`), `${label} still contains a retired custom property.`);
  assert(!source.includes(`${oldName} visual overhaul`), `${label} still contains the retired visual title.`);
}

const textRoots=['.github','docs','public','scripts'];
const pathPattern=new RegExp(`(^|[-_.])${oldSlug}([-_.]|$)`,'i');
const contentPattern=new RegExp([
  `${oldSlug}-(?:r[0-9]|shell|semantic|visual)`,
  `Commonweave${oldName}`,
  `--${oldSlug}-`,
  `\\b${oldName}\\s+(?:visual|semantic|planning|shell|overhaul)\\b`,
  `commonweave[.:]${oldSlug}-`,
  `__${oldSlug}Semantic`,
  `${oldSlug}Feedback`
].join('|'),'i');
const ignoredExtensions=new Set(['.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.ttf','.otf','.onnx','.wasm','.zip','.pdf','.mp4','.mp3','.wav']);
const violations=[];
function inspectTree(relative){
  const absolute=path.join(root,relative);
  if(!fs.existsSync(absolute))return;
  for(const entry of fs.readdirSync(absolute,{withFileTypes:true})){
    const child=path.join(relative,entry.name);
    if(entry.isDirectory()){inspectTree(child);continue}
    if(pathPattern.test(entry.name)){violations.push(`${child}: retired name in path`);continue}
    if(ignoredExtensions.has(path.extname(entry.name).toLowerCase()))continue;
    let value='';try{value=fs.readFileSync(path.join(root,child),'utf8')}catch{continue}
    if(value.includes('\u0000'))continue;
    if(contentPattern.test(value))violations.push(`${child}: retired subsystem marker in content`);
  }
}
for(const directory of textRoots)inspectTree(directory);
assert(violations.length===0,`Retired subsystem name remains:\n${violations.slice(0,30).join('\n')}`);

console.log('merlinites visual overhaul v166 verified with mobile recovery and local code rails boundaries.');
