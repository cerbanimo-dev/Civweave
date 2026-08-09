import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const [bridge,broker,boundary,legacy,wrapper,core,cleanup,critical]=await Promise.all([
  readFile('public/app/weaveling-memory-bridge-v191.js','utf8'),readFile('public/app/ai-capability-broker-v268.js','utf8'),readFile('public/app/cerbanimo-deterministic-boundary-v203.js','utf8'),readFile('public/service-worker-v156.js','utf8'),readFile('public/service-worker-v203.js','utf8'),readFile('public/service-worker-core-v208.js','utf8'),readFile('public/service-worker-living-school-cleanroom-v218.js','utf8'),readFile('public/service-worker-critical-v199.js','utf8')
]);
assert(/const VERSION='[^']*weaveling-memory-bridge-v\d+-[^']*'/.test(bridge),'Current memory bridge revision is missing.');
assert(!/runtime\.generate\s*=|runtime\.fastMemoryRevision\s*=/.test(bridge),'Memory bridge mutates a frozen runtime directly.');
assert(bridge.includes('const proxy=Object.freeze({...runtime,generate:wrapped,fastMemoryRevision:VERSION})'),'Immutable runtime proxy is missing.');
assert(broker.includes('CivweaveAICapabilityBrokerV268'),'Shared AI capability broker is missing.');
assert(!boundary.includes('DETERMINISTIC_PROVIDER_BOUNDARY'),'Legacy Cerbanimo hard provider rejection returned.');
assert(boundary.includes("consequentialActions:'deterministic-contracts'"),'Cerbanimo consequence authority boundary is missing.');
assert(critical.includes("'/app/weaveling-memory-bridge-v191.js'"),'Critical compatibility package lost the memory bridge.');
assert(critical.includes("'/app/cerbanimo-deterministic-boundary-v203.js'"),'Critical compatibility package lost the Cerbanimo authority shim.');
assert(legacy.includes("importScripts('/service-worker-v203.js"),'Legacy registration no longer bridges to v203.');
assert(wrapper.includes('/service-worker-living-school-cleanroom-v218.js')&&wrapper.includes('/service-worker-core-v208.js'),'v203 does not compose cache retirement with the retained core.');
assert(core.includes("const BUILD = 'lightweight-shell-v208'")&&core.includes('DOWNLOAD_OFFLINE_PACKAGE'),'Retained lightweight/offline core is missing.');
assert(cleanup.includes("const REVISION='living-school-cleanroom-v218'")&&cleanup.includes('event.stopImmediatePropagation()'),'Living School cache boundary is missing.');
console.log(JSON.stringify({ok:true,revision:'memory-bridge-frozen-runtime-current',frozenRuntimeProxy:true,sharedCapabilityBroker:true,deterministicConsequenceAuthority:true,criticalAuthorityShim:true,installedWorkerMode:'v218-cleanroom-wrapper-retained-v208-core'},null,2));
