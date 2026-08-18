import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');

const [actions,render,entry,chat,broker,router]=await Promise.all([
  read('public/app/living-school-cleanroom-actions-v243.mjs'),
  read('public/app/cabinets/living-school/living-school-cleanroom-render-v218.mjs'),
  read('public/app/cabinets/living-school/living-school-cleanroom-v218.mjs'),
  read('public/app/unified-chat-system-v1.js'),
  read('public/app/ai-capability-broker-v268.js'),
  read('public/app/gemini-task-tier-router-v213.js')
]);

assert(actions.includes("CivweaveAICapabilityBrokerV268?.selectedProvider?.('interactive')"),'Living School generation is not reading the canonical shared provider selection.');
assert(actions.includes("modelRouteAuthority:'shared-model-settings'"),'Living School generation does not record shared model settings as its route authority.');
assert(actions.includes('data.modelRoute=selectedCurriculumRoute(data.modelRoute);'),'Living School does not re-resolve the selected provider immediately before curriculum generation.');
assert(actions.includes("fields(target,['title','capability','level','count','mode','proof'])"),'The Living School workbench still submits a separate modelRoute field.');
assert(!actions.includes('explicitly selected deterministic local compiler'),'Living School can still falsely claim the deterministic compiler was explicitly selected.');
assert(render.includes('Follows the model selected in Civweave Settings.'),'Living School does not disclose that generation follows shared Settings.');
assert(!render.includes('name="modelRoute"')&&!render.includes('name=\\"modelRoute\\"'),'Living School still renders a second model-selection control.');
assert(!entry.includes('s.settings?.modelRoute'),'Living School chat normalization still reads a stale per-school model route.');
assert(!chat.includes('state?.settings?.modelRoute'),'Unified chat still injects a stale Living School model route into curriculum requests.');
assert(broker.includes("selectedProvider(profile='interactive')"),'The capability broker no longer exposes the selected shared provider.');
assert(router.includes("const SMALL_MODEL='gemini-3.1-flash-lite'")&&router.includes("const COMPLEX_MODEL='gemini-3.7-flash'"),'Gemini task-tier routing no longer exposes the expected interactive/complex model pair.');

console.log(JSON.stringify({
  ok:true,
  contract:'living-school-model-authority-v1',
  modelAuthority:'shared-settings',
  duplicateLivingSchoolSelector:false,
  staleChatRouteOverride:false,
  truthfulGenerationProvenance:true,
  geminiCapabilityRouting:true
},null,2));
