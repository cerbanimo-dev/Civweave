import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

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

const oldName = ['S','ol'].join('');
const oldSlug = oldName.toLowerCase();
for (const [label, source] of Object.entries({shell, shellFix})) {
  assert(!source.includes(oldName), `${label} still contains the retired display name.`);
  assert(!source.includes(`${oldSlug}-r`), `${label} still contains the retired cache key.`);
  assert(!source.includes(`${oldSlug}-shell`), `${label} still contains the retired shell path.`);
}

console.log('merlinites visual overhaul v166 verified.');
