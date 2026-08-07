import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [hub,runtime,sharedChat,versionText,packageSource]=await Promise.all([
  readFile(path.join(root,'public/app/weaveling-hub-v233.js'),'utf8'),
  readFile(path.join(root,'public/app/working-campus-v156.js'),'utf8'),
  readFile(path.join(root,'public/app/persistent-guide-chat-v215.js'),'utf8'),
  readFile(path.join(root,'VERSION'),'utf8'),
  readFile(path.join(root,'package.json'),'utf8')
]);

const version=versionText.trim();
const pkg=JSON.parse(packageSource);
assert.equal(pkg.version,version,'package.json and VERSION must stay synchronized.');
assert.equal(version,'1.0.25','Weaveling hub release version drifted.');

for(const heading of ['AGENT REPORTS','CHRONICLE','REPORT IN']){
  assert(hub.includes(heading),`Missing Weaveling hub section: ${heading}`);
}
for(const key of ['civweave.agent-reports.v1','civweave.chronicles.v1','civweave.user-updates.v1']){
  assert(hub.includes(key),`Missing hub local contract: ${key}`);
}
assert(hub.includes("'/app/persistent-guide-chat-v215.js'"),'Hub must reuse the shared persistent guide chat runtime.');
assert(hub.includes("'/app/persistent-guide-viewport-v216.js'"),'Hub must reuse the shared guide viewport runtime.');
assert(hub.includes("'civweave:user-update-reported'"),'Reported updates must emit the shared user-update event.');
assert(hub.includes("'civweave:agent-report'"),'Hub must accept agent report events.');
assert(hub.includes("'civweave:chronicle-update'"),'Hub must accept Chronicle update events.');
assert(hub.includes('wh233-legacy-bridge'),'Legacy Working Campus chat hooks must be retained only as a hidden compatibility bridge.');
assert(!hub.includes('cwp215-launcher'),'Hub must not clone or fork the shared chat launcher styling.');

assert(runtime.includes("const HUB_SCRIPT='/app/weaveling-hub-v233.js';"),'Working Campus must load the Weaveling hub.');
assert(runtime.includes('await ensureHub();'),'Working Campus must mount the hub before its split runtime starts.');
assert(sharedChat.includes("const LAUNCHER_ID='cwp215-launcher';"),'Shared guide chat launcher contract changed unexpectedly.');
assert(sharedChat.includes('#${LAUNCHER_ID}{'),'Shared guide chat launcher styling is unavailable.');

console.log(JSON.stringify({
  ok:true,
  version,
  revision:'weaveling-hub-v233',
  sections:['agent-reports','chronicle','report-in'],
  chatLauncher:'persistent-guide-chat-v215'
},null,2));
