import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const [bridge,spine,broker,boundary,legacy,wrapper,core,cleanup,critical]=await Promise.all([
  readFile('public/app/weaveling-memory-bridge-v191.js','utf8'),readFile('public/app/fast-interactive-runtime-v192.js','utf8'),readFile('public/app/ai-capability-broker-v268.js','utf8'),readFile('public/app/cerbanimo-deterministic-boundary-v203.js','utf8'),readFile('public/service-worker-v156.js','utf8'),readFile('public/service-worker-v203.js','utf8'),readFile('public/service-worker-core-v208.js','utf8'),readFile('public/service-worker-living-school-cleanroom-v218.js','utf8'),readFile('public/service-worker-critical-v199.js','utf8')
]);
assert(/const VERSION='[^']*weaveling-memory-bridge-v\d+-[^']*'/.test(bridge),'Current memory bridge revision is missing.');
assert(!/const proxy=Object\.freeze\(\{\.\.\.runtime,generate:wrapped,fastMemoryRevision:VERSION\}\)/.test(bridge),'Memory bridge still creates its own model runtime proxy.');
assert(bridge.includes('globalThis.CivweaveFastInteractiveV192')&&bridge.includes('spine.install()'),'Memory bridge does not delegate runtime installation to the shared spine.');
assert(spine.includes('__civweaveRuntimeSpineV269:true'),'Single model runtime spine marker is missing.');
assert(spine.includes("register('fast-interactive'")&&spine.includes('middleware=new Map()'),'Fast interactive behavior is not registered through middleware.');
assert(!spine.includes('setInterval('),'Runtime spine returned to polling-based installation.');
assert(broker.includes('CivweaveAICapabilityBrokerV268')&&broker.includes('function diagnostics()'),'Shared AI capability broker diagnostics are missing.');
assert(!boundary.includes('DETERMINISTIC_PROVIDER_BOUNDARY'),'Legacy Cerbanimo hard provider rejection returned.');
assert(boundary.includes("consequentialActions:'deterministic-contracts'"),'Cerbanimo consequence authority boundary is missing.');
assert(critical.includes("'/app/weaveling-memory-bridge-v191.js'"),'Critical compatibility package lost the memory bridge.');
assert(critical.includes("'/app/cerbanimo-deterministic-boundary-v203.js'"),'Critical compatibility package lost the Cerbanimo authority shim.');
assert(legacy.includes("importScripts('/service-worker-v203.js"),'Legacy registration no longer bridges to v203.');
assert(wrapper.includes('/service-worker-living-school-cleanroom-v218.js')&&wrapper.includes('/service-worker-core-v208.js'),'v203 does not compose cache retirement with the retained core.');
assert(core.includes("const BUILD = 'lightweight-shell-v208")&&core.includes('DOWNLOAD_OFFLINE_PACKAGE'),'Retained lightweight-shell-v208 core family or offline-package ownership is missing.');
assert(cleanup.includes("const REVISION='living-school-cleanroom-v218'")&&cleanup.includes('event.stopImmediatePropagation()'),'Living School cache boundary is missing.');
console.log(JSON.stringify({ok:true,revision:'memory-bridge-runtime-spine-v269',singleRuntimeSpine:true,memoryRuntimeWrapper:false,sharedCapabilityBroker:true,deterministicConsequenceAuthority:true,criticalAuthorityShim:true,retainedCoreFamily:'lightweight-shell-v208',offlinePackageOwner:true,installedWorkerMode:'v218-cleanroom-wrapper-retained-v208-core'},null,2));