import fs from 'node:fs';

const passover=fs.readFileSync('public/app/guide-capability-passover-v1.js','utf8');
const unified=fs.readFileSync('public/app/unified-chat-system-v1.js','utf8');
const loader=fs.readFileSync('public/app/shared-guide-surface-v236.js','utf8');

for(const [artifact,system] of Object.entries({curriculum:'living-school',quest:'cerbanimo',resource:'fellowfare',governance:'anarchadia',weave:'civweave'})){
  if(!passover.includes(`${artifact}:'${system}'`))throw new Error(`Capability owner missing: ${artifact} -> ${system}`);
}
if(!unified.includes('generateCurriculumFromChat'))throw new Error('Moss learning generator was removed from unified chat.');
if(!unified.includes("registerCapability('living-school'"))throw new Error('Moss learning capability handler was removed.');
if(passover.includes("registerCapability('living-school'"))throw new Error('Passover layer must not replace Moss\'s learning capability handler.');
if(!passover.includes('globalThis.CivweaveResponseRouterV347'))throw new Error('Passover preflight no longer consults the shared MiniLM response router.');
if(!passover.includes("dispatchEvent(new CustomEvent('civweave:response-route'"))throw new Error('Passover decisions are no longer visible to the shared route strip.');
if(!passover.includes('surface.submitText(offer.sourceText,offer.targetSystem)'))throw new Error('Passover must resubmit the original request unchanged.');
if(!passover.includes("surface.switchGuide?.(offer.targetSystem,{open:true"))throw new Error('Passover no longer opens the destination guide chat.');
if(!passover.includes('cw-capability-passover-v1'))throw new Error('Passover action button contract is missing.');
if(!passover.includes("if(sourceSystem==='civweave')return null"))throw new Error('Weaveling must remain the cross-realm orchestrator instead of being forcibly passed over.');
if(!loader.includes('/app/guide-capability-passover-v1.js'))throw new Error('Shared guide loader does not load the capability passover layer.');

console.log('Guide capability passover contract verified.');