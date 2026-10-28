import test from 'node:test';
import assert from 'node:assert/strict';
import {COLLECTIVE_TOOL_CATALOG, resolveCollectiveTool, planCollectiveToolUse, toolCapabilities} from '../public/app/shared/starling-collective-tools-v1.mjs';

test('Aider remains an external adapter with local workspace boundaries',()=>{
  const aider=resolveCollectiveTool('aider');
  assert.equal(aider.kind,'external-adapter');
  assert.equal(aider.status,'migration-pending');
  assert.equal(aider.risk,'workspace-write');
});
test('creative, CAD and standard document work are represented without fabricating installed engines',()=>{
  for(const id of ['photocraft','vectorcraft','filmcraft','lightcraft','pdfcraft','cadcraft','documents','spreadsheets','presentations']){
    const t=resolveCollectiveTool(id);assert.ok(t);assert.equal(t.status,'planned');
  }
  assert.equal(resolveCollectiveTool('artcraft'),null);
});
test('uninstalled tools cannot be invoked by a model',()=>{
 const plan=planCollectiveToolUse({toolId:'photocraft',taskId:'t',guildId:'g',actorId:'kami',enabledTools:[]});
 assert.equal(plan.allowed,false);assert.equal(plan.reason,'tool-not-installed');
});
test('workspace write requires a verified task approval and install',()=>{
 const common={toolId:'aider',taskId:'t',guildId:'g',actorId:'kami',enabledTools:['aider']};
 assert.equal(planCollectiveToolUse(common).allowed,false);
 assert.equal(planCollectiveToolUse({...common,authorization:{scope:'task',guildId:'g',taskId:'t',actorId:'kami',toolId:'aider',approved:true}}).allowed,true);
});
test('approval is strictly scoped to tool, Guild, task, and actor',()=>{
 const common={toolId:'aider',taskId:'t',guildId:'g',actorId:'kami',enabledTools:['aider']};
 const grant={scope:'task',guildId:'g',taskId:'t',actorId:'kami',toolId:'aider',approved:true};
 for(const key of ['guildId','taskId','actorId','toolId']){
  const bad={...grant,[key]:'other'};
  assert.equal(planCollectiveToolUse({...common,authorization:bad}).allowed,false,key);
 }
});
test('model-supplied approval assertions do not grant authority without a verifier',()=>{
 const common={toolId:'aider',taskId:'t',guildId:'g',actorId:'kami',enabledTools:['aider']};
 const auth={scope:'task',guildId:'g',taskId:'t',actorId:'kami',toolId:'aider',approved:true};
 assert.equal(planCollectiveToolUse({...common,authorization:auth,requireVerifier:true}).allowed,false);
 assert.equal(planCollectiveToolUse({...common,authorization:auth,verifyAuthorization:()=>true}).allowed,true);
});
test('only confirmed installed capabilities are advertised for matching',()=>{
 const caps=toolCapabilities(['aider','photocraft','random'],{installedTools:['aider']});
 assert.ok(caps.includes('coding'));assert.equal(caps.includes('image-editing'),false);
});
test('unknown IDs are denied without fallback routing',()=>{
 assert.equal(resolveCollectiveTool('arbitrary-shell'),null);
 assert.equal(planCollectiveToolUse({toolId:'arbitrary-shell',enabledTools:['arbitrary-shell']}).allowed,false);
});
