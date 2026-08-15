from pathlib import Path

p=Path('scripts/verify-civweave-systems-mesh-v251.mjs')
s=p.read_text()

old="const runtimePath='public/app/civweave-systems-mesh-v251.js';\nconst routesPath='public/app/system-routes-v227.js';"
new="const runtimePath='public/app/civweave-systems-mesh-v251.js';\nconst interfaceRuntimePath='public/app/core-interface-runtime-v1.js';\nconst routesPath='public/app/system-routes-v227.js';"
if old not in s: raise SystemExit('systems mesh path block changed')
s=s.replace(old,new,1)
old="const runtime=fs.readFileSync(runtimePath,'utf8');\nconst routes=fs.readFileSync(routesPath,'utf8');"
new="const runtime=fs.readFileSync(runtimePath,'utf8');\nconst interfaceRuntime=fs.readFileSync(interfaceRuntimePath,'utf8');\nconst routes=fs.readFileSync(routesPath,'utf8');"
if old not in s: raise SystemExit('systems mesh source reads changed')
s=s.replace(old,new,1)
old="""assert.ok(boundary.includes("const SYSTEMS_MESH_RUNTIME='/app/civweave-systems-mesh-v251.js'"));
assert.match(boundary,/SYSTEM_EXPERIENCE_SCRIPTS=\[[\s\S]*SYSTEMS_MESH_RUNTIME/);
assert.match(boundary,/systemsMeshRevision:'v251-five-system-non-privileged-event-contract'/);"""
new="""assert.match(interfaceRuntime,/['\"]\/app\/civweave-systems-mesh-v251\.js['\"]/,'Core interface runtime must assemble the systems mesh.');
assert.match(interfaceRuntime,/const SHARED_BOOT_SCRIPTS=Object\.freeze\(\[/);
assert.match(boundary,/const CORE_INTERFACE_RUNTIME='\/app\/core-interface-runtime-v1\.js'/);
assert.doesNotMatch(boundary,/SYSTEM_EXPERIENCE_SCRIPTS|SYSTEMS_MESH_RUNTIME='\/app\/civweave-systems-mesh-v251\.js'/,'Install boundary must not retain a second systems-mesh loader.');
assert.match(boundary,/systemsMeshRevision:'v251-five-system-non-privileged-event-contract'/);"""
if old not in s: raise SystemExit('systems mesh boundary ownership assertions changed')
s=s.replace(old,new,1)
p.write_text(s)
