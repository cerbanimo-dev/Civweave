from pathlib import Path

p=Path('scripts/verify-guide-workspace-v242.mjs')
s=p.read_text()

old="const [workspace,boundary,campusCss,release]=await Promise.all([\n  read('public/app/guide-workspace-v242.js'),\n  read('public/app/install-boundary-v146.js'),\n  read('public/app/working-campus-v156.css'),"
new="const [workspace,boundary,coreRuntime,campusCss,release]=await Promise.all([\n  read('public/app/guide-workspace-v242.js'),\n  read('public/app/install-boundary-v146.js'),\n  read('public/app/core-interface-runtime-v1.js'),\n  read('public/app/working-campus-v156.css'),"
if old not in s: raise SystemExit('guide source list changed')
s=s.replace(old,new,1)
s=s.replace('new Function(workspace);new Function(boundary);','new Function(workspace);new Function(boundary);new Function(coreRuntime);',1)

old="""const realmIndex=boundary.indexOf('REALM_SESSION_INTEGRITY,'),workspaceIndex=boundary.indexOf('GUIDE_WORKSPACE,');
check('workspace loads after realm session integrity',realmIndex>=0&&workspaceIndex>realmIndex);
const experienceStart=boundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),experienceEnd=boundary.indexOf('];',experienceStart),experience=boundary.slice(experienceStart,experienceEnd);
check('canonical boundary boots workspace without retired runtime constants',experience.includes('GUIDE_WORKSPACE')&&!boundary.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')&&!boundary.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'));
check('boundary exposes v250 policy',boundary.includes("guideWorkspaceRevision:'v250-v242-canonical-owner'"));
console.log(JSON.stringify({ok:true,version,checks:checks.length,workspace:'v242-canonical-v250',viewportOwner:'v242',scrollTrap:false,launcherFirst:true,duplicateOwners:0,deletedOwners:3},null,2));"""
new="""const realmIndex=coreRuntime.indexOf("'/app/realm-session-integrity-v237.js'"),workspaceIndex=coreRuntime.indexOf("'/app/guide-workspace-v242.js'");
check('workspace loads after realm session integrity',realmIndex>=0&&workspaceIndex>realmIndex);
check('core runtime owns workspace assembly',coreRuntime.includes('const SHARED_BOOT_SCRIPTS=Object.freeze([')&&coreRuntime.includes("'/app/guide-workspace-v242.js'"));
check('install boundary boots only core runtime',boundary.includes("const CORE_INTERFACE_RUNTIME='/app/core-interface-runtime-v1.js'")&&!boundary.includes('SYSTEM_EXPERIENCE_SCRIPTS')&&!boundary.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')&&!boundary.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'));
check('boundary exposes v250 policy',boundary.includes("guideWorkspaceRevision:'v250-v242-canonical-owner'"));
console.log(JSON.stringify({ok:true,version,checks:checks.length,workspace:'v242-canonical-v250',interfaceRuntime:'core-interface-runtime-v1',viewportOwner:'v242',scrollTrap:false,launcherFirst:true,duplicateOwners:0,deletedOwners:3},null,2));"""
if old not in s: raise SystemExit('guide ownership assertions changed')
s=s.replace(old,new,1)
p.write_text(s)
