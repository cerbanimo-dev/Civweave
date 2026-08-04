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
const shellFix = read('public/app/sol-shell-fix-v166.css');
const profiles = JSON.parse(read('public/app/assets/ai/profiles.json'));

const expectedOrder = "['commonweave','living-school','cerbanimo','fellowfare','anarchadia']";
assert(shell.includes(`const SYSTEM_ORDER=${expectedOrder}`), 'Global realm order is not fixed.');
assert(shell.includes('SYSTEM_ORDER.map'), 'The global dock is not rendering all five realm positions.');
assert(!shell.includes("filter(([id])=>id!==current)"), 'The active realm is still being removed from the dock.');
assert(shell.includes('data-cwf-chat'), 'The Weaveling top-rail control is missing.');
assert(shell.includes("const VISUAL_SHELLS={primary:'merlinites-r1',legacy:'sol-r1'}"), 'The Merlinites/Sol transition identities are missing.');
assert(shell.includes('document.documentElement.dataset.visualShell=VISUAL_SHELLS.primary'), 'Merlinites is not the primary visual-shell identity.');
assert(shell.includes('document.documentElement.dataset.visualShellLegacy=VISUAL_SHELLS.legacy'), 'Sol is not retained as a compatibility identity.');
assert(shell.includes('/app/sol-shell-fix-v166.css?v=sol-r2'), 'The installed Sol compatibility stylesheet is not loaded.');
assert(shell.includes('data-merlinites-shell-v166')&&shell.includes('data-sol-shell-v166'), 'The stylesheet link does not expose both transition names.');

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
  const cssMarker = html.includes('/app/family-shell-v104.css?v=sol-r1') || html.includes('/app/family-shell-v104.css?v=merlinites-r1');
  const jsMarker = html.includes('/app/family-shell-v104.js?v=sol-r1') || html.includes('/app/family-shell-v104.js?v=merlinites-r1');
  assert(cssMarker, `${file} is not cache-busting the transitional visual shell CSS.`);
  assert(jsMarker, `${file} is not cache-busting the transitional visual shell JS.`);
}

console.log('Sol and Merlinites visual overhaul v166 aliases verified.');
