import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const exists=file=>access(path.join(root,file)).then(()=>true,()=>false);
const [wrapper,core,repair,repairOnly,indexHtml]=await Promise.all([
  read('public/service-worker-v203.js'),
  read('public/service-worker-core-v208.js'),
  read('public/service-worker-shell-repair-v293.js'),
  read('public/app/installer-repair-only-v1.js'),
  read('public/app/index.html')
]);
const retired='public/service-worker-shell-repair-v225.js';
assert.equal(await exists(retired),false,'Superseded v225 shell repair worker must remain physically absent.');
assert.ok(!wrapper.includes('/service-worker-shell-repair-v225.js'),'Generated worker resurrected the v225 shell repair owner.');
assert.equal((wrapper.match(/service-worker-shell-repair-v293\.js/g)||[]).length,1,'Generated worker must import exactly one installed shell repair owner.');
assert.ok(core.includes("'/app/installer-repair-only-v1.js'"),'Core optional shell assets must cache the repair-only installer UI directly.');
assert.ok(repair.includes("const REVISION='installed-shell-repair-v293'"),'v293 is not the canonical installed shell repair owner.');
assert.equal((repair.match(/event\.data\?\.type!=='REPAIR_DEVICE_PACKAGE'/g)||[]).length,1,'Canonical repair owner must have exactly one REPAIR_DEVICE_PACKAGE message boundary.');
assert.ok(repairOnly.includes("browserRuntimePolicy:'installer-only-until-installed-display'"),'Repair UI must keep browser runtime disabled.');
assert.ok(indexHtml.includes('/app/installer-repair-only-v1.js?v=install-only-pwa-v1'),'Installer must continue loading the repair-only UI.');
assert.ok(!indexHtml.includes('/app/installer-online-fallback-v225.js'),'Retired online fallback must not return to the installer.');
console.log(JSON.stringify({ok:true,revision:'shell-repair-single-owner-v293',retiredV225Absent:true,repairOwner:'service-worker-shell-repair-v293.js',repairMessages:1,repairUiCachedBy:'service-worker-core-v208.js',browserRuntime:false},null,2));