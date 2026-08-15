from pathlib import Path

p=Path('scripts/verify-five-system-navigation-v227.mjs')
s=p.read_text()

old="const [routesSource,boundarySource,navSource,campusSource,campusPart4,workerWrapper,workerNavigation,gatewayBase,gatewayWrapper,...pages]=await Promise.all([\n  read('public/app/system-routes-v227.js'),\n  read('public/app/install-boundary-v146.js'),"
new="const [routesSource,boundarySource,coreRuntimeSource,navSource,campusSource,campusPart4,workerWrapper,workerNavigation,gatewayBase,gatewayWrapper,...pages]=await Promise.all([\n  read('public/app/system-routes-v227.js'),\n  read('public/app/install-boundary-v146.js'),\n  read('public/app/core-interface-runtime-v1.js'),"
if old not in s: raise SystemExit('five-system source list anchor changed')
s=s.replace(old,new,1)

old="for(const [label,source] of Object.entries({routesSource,boundarySource,navSource,campusSource,workerNavigation}))new Function(source);"
new="for(const [label,source] of Object.entries({routesSource,boundarySource,coreRuntimeSource,navSource,campusSource,workerNavigation}))new Function(source);"
if old not in s: raise SystemExit('five-system syntax source list changed')
s=s.replace(old,new,1)

old="""  for(const script of experienceScripts)assert.ok(result.appended.some(node=>String(node.src||'').includes(script)),`${system} does not load ${script} from the shared experience boundary.`);
  for(const retired of retiredCanonicalChatScripts)assert.ok(!result.appended.some(node=>String(node.src||'').includes(retired)),`${system} resurrected retired canonical chat runtime ${retired}.`);
  if(system==='civweave'){assert.equal(result.appended.length,experienceScripts.length,'Civweave canonical startup must inject only the approved experience-layer scripts.');assert.ok(result.appended.every(node=>experienceScripts.some(script=>String(node.src||'').includes(script))),'Civweave canonical startup injected a non-experience or legacy script.')}else assert.ok(result.appended.some(node=>String(node.src||'').includes('/app/system-routes-v227.js')),`${system} does not load the shared route contract before compatibility navigation.`);
}"""
new="""  assert.equal(result.appended.length,1,`${system} boundary must inject exactly one core interface runtime.`);
  assert.ok(result.appended.some(node=>String(node.src||'').includes('/app/core-interface-runtime-v1.js')),`${system} boundary did not bootstrap the core interface runtime.`);
  for(const script of experienceScripts)assert.ok(!result.appended.some(node=>String(node.src||'').includes(script)),`${system} boundary directly loaded shared owner ${script}.`);
  for(const retired of retiredCanonicalChatScripts)assert.ok(!result.appended.some(node=>String(node.src||'').includes(retired)),`${system} resurrected retired canonical chat runtime ${retired}.`);
}
for(const script of ['/app/system-routes-v227.js','/app/release-version-v1.js',...experienceScripts])assert.ok(coreRuntimeSource.includes(`'${script}'`)||coreRuntimeSource.includes(`\"${script}\"`),`Core interface runtime does not assemble ${script}.`);
for(const retired of retiredCanonicalChatScripts)assert.ok(!coreRuntimeSource.includes(retired),`Core interface runtime resurrected retired canonical chat runtime ${retired}.`);"""
if old not in s: raise SystemExit('five-system boundary assembly assertion block changed')
s=s.replace(old,new,1)

old="assert.match(boundarySource,/canonicalSystemCount:5/);assert.match(boundarySource,/canonicalExperienceScripts:SYSTEM_EXPERIENCE_SCRIPTS\\.length/);assert.match(boundarySource,/settingsGatewayRevision:'v317-single-owner-first-click-only'/);"
new="assert.match(boundarySource,/canonicalSystemCount:5/);assert.match(boundarySource,/canonicalRuntimeScripts:1/);assert.match(boundarySource,/sharedLoadingOwner:'core-interface-runtime-v1'/);assert.match(boundarySource,/settingsGatewayRevision:'v317-single-owner-first-click-only'/);"
if old not in s: raise SystemExit('five-system boundary metadata assertion changed')
s=s.replace(old,new,1)

old="""const realmIndex=experienceScripts.indexOf('/app/realm-session-integrity-v237.js'),workspaceIndex=experienceScripts.indexOf('/app/guide-workspace-v242.js'),topbarIndex=experienceScripts.indexOf('/app/working-campus-topbar-v243.js');assert.equal(workspaceIndex,realmIndex+1,'Guide workspace must load immediately after realm-local thread ownership.');assert.equal(topbarIndex,workspaceIndex+1,'Working Campus topbar must load immediately after guide workspace ownership.');
const radioIndex=experienceScripts.indexOf('/app/system-radio-agent-v233.js'),trackIndex=experienceScripts.indexOf('/app/radio-track-suggestions-v240.js'),canonicalPlaylistsIndex=experienceScripts.indexOf('/app/canonical-playlists-v1.js'),playlistGovernanceIndex=experienceScripts.indexOf('/app/radio-playlist-governance-v1.js'),meshIndex=experienceScripts.indexOf('/app/civweave-systems-mesh-v251.js'),hostSessionIndex=experienceScripts.indexOf('/app/host-node-session-v1.js'),nodeMeshIndex=experienceScripts.indexOf('/app/node-ai-mesh-v1.js'),veilMeshIndex=experienceScripts.indexOf('/app/quest-veil-mesh-v1.js'),veilGateIndex=experienceScripts.indexOf('/app/quest-veil-ledger-gate-v1.js'),veilIndex=experienceScripts.indexOf('/app/quest-veil-v1.js');assert.equal(radioIndex,3,'Radio must remain immediately after the Settings gateway, mobile AI guard, and experience orchestrator.');assert.equal(trackIndex,radioIndex+1,'Exact-track suggestions must remain immediately after radio.');assert.equal(canonicalPlaylistsIndex,trackIndex+1,'Canonical playlists must load immediately after exact-track suggestions.');assert.equal(playlistGovernanceIndex,canonicalPlaylistsIndex+1,'Playlist governance must load immediately after canonical playlists.');assert.equal(meshIndex,playlistGovernanceIndex+1,'Systems mesh must remain immediately after playlist governance.');assert.equal(hostSessionIndex,meshIndex+1,'Hub Node session ownership must load immediately after systems mesh.');assert.equal(nodeMeshIndex,hostSessionIndex+1,'Node AI mesh must follow Hub Node session ownership.');assert.equal(veilMeshIndex,nodeMeshIndex+1,'Quest Veil mesh must follow the node AI mesh.');assert.equal(veilGateIndex,veilMeshIndex+1,'Mandatory Quest Veil ledger gate must follow its mesh runtime.');assert.equal(veilIndex,veilGateIndex+1,'Quest Veil finale renderer must remain downstream of the mandatory gate.');"""
new="""const runtimeIndex=script=>coreRuntimeSource.indexOf(`'${script}'`);
const realmIndex=runtimeIndex('/app/realm-session-integrity-v237.js'),workspaceIndex=runtimeIndex('/app/guide-workspace-v242.js'),topbarIndex=runtimeIndex('/app/working-campus-topbar-v243.js');assert.ok(realmIndex>=0&&workspaceIndex>realmIndex,'Guide workspace must load after realm-local thread ownership.');assert.ok(topbarIndex>workspaceIndex,'Working Campus topbar must load after guide workspace ownership.');
const radioIndex=runtimeIndex('/app/system-radio-agent-v233.js'),trackIndex=runtimeIndex('/app/radio-track-suggestions-v240.js'),canonicalPlaylistsIndex=runtimeIndex('/app/canonical-playlists-v1.js'),playlistGovernanceIndex=runtimeIndex('/app/radio-playlist-governance-v1.js'),meshIndex=runtimeIndex('/app/civweave-systems-mesh-v251.js'),hostSessionIndex=runtimeIndex('/app/host-node-session-v1.js'),nodeMeshIndex=runtimeIndex('/app/node-ai-mesh-v1.js'),veilMeshIndex=runtimeIndex('/app/quest-veil-mesh-v1.js'),veilGateIndex=runtimeIndex('/app/quest-veil-ledger-gate-v1.js'),veilIndex=runtimeIndex('/app/quest-veil-v1.js');assert.ok(radioIndex>=0&&trackIndex>radioIndex,'Exact-track suggestions must remain after radio.');assert.ok(canonicalPlaylistsIndex>trackIndex,'Canonical playlists must load after exact-track suggestions.');assert.ok(playlistGovernanceIndex>canonicalPlaylistsIndex,'Playlist governance must load after canonical playlists.');assert.ok(meshIndex>playlistGovernanceIndex,'Systems mesh must remain after playlist governance.');assert.ok(hostSessionIndex>meshIndex,'Hub Node session ownership must load after systems mesh.');assert.ok(nodeMeshIndex>hostSessionIndex,'Node AI mesh must follow Hub Node session ownership.');assert.ok(veilMeshIndex>nodeMeshIndex,'Quest Veil mesh must follow the node AI mesh.');assert.ok(veilGateIndex>veilMeshIndex,'Mandatory Quest Veil ledger gate must follow its mesh runtime.');assert.ok(veilIndex>veilGateIndex,'Quest Veil finale renderer must remain downstream of the mandatory gate.');"""
if old not in s: raise SystemExit('five-system shared order assertion changed')
s=s.replace(old,new,1)

s=s.replace("revision:'five-system-navigation-v227-settings-gateway-v317-browser-boundary-v228-install-only-pwa-v1'","revision:'five-system-navigation-v227-core-interface-runtime-v1-browser-boundary-v228-install-only-pwa-v1'",1)
s=s.replace("canonicalExperienceScriptCount:experienceScripts.length","canonicalRuntimeScripts:1,sharedRuntimeScriptCount:experienceScripts.length",1)
s=s.replace("settingsOwner:'settings-gateway-v317'","sharedLoadingOwner:'core-interface-runtime-v1',settingsOwner:'settings-gateway-v317'",1)

p.write_text(s)
