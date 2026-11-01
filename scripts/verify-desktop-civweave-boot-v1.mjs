import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [wrapper,assets,generator,release,installer,completion,recovery,rootBridge,workflow,packageText,versionText]=await Promise.all([
  read('public/service-worker-v203.js'),
  read('public/service-worker-shell-assets-v1.js'),
  read('scripts/build-service-worker-v211.mjs'),
  read('public/service-worker-release-generation-v1.js'),
  read('public/app/index.html'),
  read('public/service-worker-campus-completion-v246.js'),
  read('public/guild-release-recovery.html'),
  read('public/service-worker.js'),
  read('.github/workflows/verify-desktop-civweave-boot-v1.yml'),
  read('package.json'),read('VERSION')
]);

const shellRevision='shell-assets-v1-repair-v451-threshold-desktop-recovery';
const releaseRevision='release-generation-boundary-v10-bounded-release-storage';
const installerRevision='v14-observer-quiescence';
const output=generator.match(/const output=(`[^]*?`);\s*if\(process\.argv/);
assert.ok(output,'Registered worker must retain one explicit generator template.');
const generated=vm.runInNewContext(output[1],{version:versionText.trim()});
assert.equal(wrapper.replace(/\r\n/g,'\n'),generated.replace(/\r\n/g,'\n'),'The current registered worker must match its generator exactly.');
for(const source of [wrapper,generator]){
  assert.ok(source.includes(`/service-worker-shell-assets-v1.js?v=${shellRevision}`),'Desktop shell generation must be pinned by the registered worker and its generator.');
  assert.ok(source.includes(`/service-worker-release-generation-v1.js?v=${releaseRevision}`),'Bounded release storage must be pinned by the registered worker and its generator.');
  assert.ok(source.includes('/service-worker-core-v208.js?v=1.0.165-single-screen-local-fleet-v3'),'Keep the current local Fleet core import.');
  assert.ok(source.includes('mobile-chat-long-thread-fit-v362'),'Keep the current mobile chat layout import.');
}
assert.ok(release.includes(`const REVISION='${releaseRevision}'`));
assert.ok(recovery.includes(`REQUIRED_REVISION='${releaseRevision}'`),'Safe recovery must verify the same release generation.');
assert.ok(rootBridge.includes("importScripts('/service-worker-v203.js?v=root-worker-bridge-v450-desktop-startup-bounded')"),'Older root registrations must reach the same corrected worker.');
assert.ok(installer.includes(`/app/pwa-install-prompt-v250.js?v=${installerRevision}`));
assert.ok(completion.includes(`INSTALL_BRIDGE_URL=INSTALL_BRIDGE+'?v=${installerRevision}'`),'Installer prefetch must request the corrected prompt owner.');

const context={REQUIRED_SHELL_ASSETS:[],OPTIONAL_SHELL_ASSETS:[],SHELL_ASSETS:[],self:{}};
vm.runInNewContext(assets,context);
assert.equal(context.self.CivweaveShellAssetsV1.revision,shellRevision);

for(const pathname of [
  '/app/persistent-system-shell-v1.html',
  '/app/persistent-system-shell-v1.js',
  '/app/system-routes-v227.js',
  '/app/themed-system-nav-v178.js',
  '/app/persistent-shell-actions-v1.js',
  '/app/generation-lifecycle-v2.js',
  '/app/subsystem-avatar-state-v347.js',
  '/app/pwa-start-v436.html',
  '/app/working-campus-return-guard-v425.js',
  '/app/document-lifecycle-v221.js',
  '/app/working-campus-home-declutter-v1.js',
  '/app/working-campus-home-relocation-v441.js',
  '/app/shared-tools-cleanup-v175.js',
  '/app/local-ai/browser-pack-download-v1.js',
  '/app/local-ai/browser-pack-pwa-import-v1.js',
  '/app/human-message-bubble-v1.js',
  '/app/human-chat-network-v1.js',
  '/app/human-chat-guild-context-v1.js',
  '/app/human-chat-standalone-v2.js'
]){
  assert.ok(context.REQUIRED_SHELL_ASSETS.includes(pathname),`Required desktop boot or human-chat dependency missing: ${pathname}`);
  assert.ok(context.SHELL_ASSETS.includes(pathname));assert.equal(context.OPTIONAL_SHELL_ASSETS.includes(pathname),false);
}
for(const pathname of ['/app/system-routes-v227.js','/app/themed-system-nav-v178.js','/app/working-campus-return-guard-v425.js','/app/document-lifecycle-v221.js','/app/working-campus-home-declutter-v1.js'])assert.ok(generator.includes(`'public${pathname}'`),`Generator preflight must retain ${pathname}`);
assert.equal(context.self.CivweaveShellAssetsV1.requiredHumanChat.length,4);
const guides=['weaveling','moss','kamiya','rook','merlin'];
const media=['/Civweave-weaveling-sprites.png','/Living-School-moss-sprites.png','/Cerbanimo-kamiya-sprites.png','/FellowFare-rook-sprites.png','/Anarchadia-merlin-sprites.png',...guides.map(guide=>`/app/assets/ai/${guide}.png`),...guides.map(guide=>`/app/assets/ai/chat/${guide}-face-v255.webp`)];
assert.deepEqual(Array.from(context.self.CivweaveShellAssetsV1.requiredNavigationMedia),media);
for(const pathname of media)assert.ok(context.REQUIRED_SHELL_ASSETS.includes(pathname));
for(const file of ['civweave-branded-heart-192-v449.png','civweave-branded-heart-512-v449.png','civweave-branded-heart-maskable-512-v449.png'])assert.ok(context.OPTIONAL_SHELL_ASSETS.includes('/app/logos/'+file),'Keep the current launch branding.');
assert.ok(context.OPTIONAL_SHELL_ASSETS.includes(`/app/pwa-install-prompt-v250.js?v=${installerRevision}`));
const pkg=JSON.parse(packageText),suites=['test-installer-observer-quiescence-v1.mjs','test-pwa-start-bounded-launch-v1.mjs','test-release-storage-boundary-v1.mjs'];
for(const suite of suites){assert.ok(pkg.scripts['test:desktop-pwa']?.includes('scripts/'+suite));assert.equal(workflow.split("'scripts/"+suite+"'").length-1,2,'Desktop CI must select both PR and push changes to '+suite)}
assert.ok(pkg.scripts['check:runtime'].includes('npm run test:desktop-pwa'));
assert.ok(workflow.includes('npm ci --ignore-scripts'));assert.ok(workflow.includes('npm run test:desktop-pwa'));

console.log(JSON.stringify({ok:true,shellRevision,releaseRevision,installerRevision,generatorMatches:true,requiredHumanChat:true,currentBranding:true,currentFleet:true,regressionSuites:suites.length}));
