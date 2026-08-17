import fs from 'node:fs';

const passover=fs.readFileSync('public/app/guide-capability-passover-v1.js','utf8');
const unified=fs.readFileSync('public/app/unified-chat-system-v1.js','utf8');
const loader=fs.readFileSync('public/app/shared-guide-surface-v236.js','utf8');
const contract=JSON.parse(fs.readFileSync('config/guide-artifact-language-v1.json','utf8'));
const docs=fs.readFileSync('docs/contracts/guide-artifact-language-v1.md','utf8');

const expected={
  'civweave':{guide:'Weaveling',artifact:'Quest',internalArtifactClass:'weave'},
  'living-school':{guide:'Moss',artifact:'Learning Journey',internalArtifactClass:'curriculum'},
  'cerbanimo':{guide:'Kamiya',artifact:'Endeavor',internalArtifactClass:'quest'},
  'fellowfare':{guide:'Rook',artifact:'Manifest',internalArtifactClass:'resource'}
};
for(const [system,want] of Object.entries(expected)){
  const got=contract.guides?.[system];
  if(!got)throw new Error(`Canonical guide artifact contract missing ${system}`);
  for(const key of ['guide','artifact','internalArtifactClass'])if(got[key]!==want[key])throw new Error(`${system} ${key} must be ${want[key]}, got ${got[key]}`);
  if(!passover.includes(`artifact:'${want.artifact}'`))throw new Error(`Passover runtime is missing canonical artifact ${want.artifact}`);
  if(!docs.includes(`**${want.artifact}${want.artifact.endsWith('s')?'':'s'}**`)&&!docs.includes(`**${want.artifact}**`))throw new Error(`Canonical artifact docs are missing ${want.artifact}`);
}

for(const [artifact,system] of Object.entries({weave:'civweave',curriculum:'living-school',quest:'cerbanimo',resource:'fellowfare',governance:'anarchadia'})){
  if(!passover.includes(`${artifact}:'${system}'`))throw new Error(`Internal compatibility owner missing: ${artifact} -> ${system}`);
}
if(!unified.includes('generateCurriculumFromChat'))throw new Error('Moss Learning Journey generator was removed from unified chat.');
if(!unified.includes("registerCapability('living-school'"))throw new Error('Moss learning capability handler was removed.');
if(passover.includes("registerCapability('living-school'"))throw new Error('Passover layer must not replace Moss\'s learning capability handler.');
if(!passover.includes('globalThis.CivweaveResponseRouterV347'))throw new Error('Passover preflight no longer consults the shared MiniLM response router.');
if(!passover.includes("dispatchEvent(new CustomEvent('civweave:response-route'"))throw new Error('Passover decisions are no longer visible to the shared route strip.');
if(!passover.includes('surface.submitText(offer.sourceText,offer.targetSystem)'))throw new Error('Passover must resubmit the preserved original request.');
if(!passover.includes("surface.switchGuide?.(offer.targetSystem,{open:true"))throw new Error('Passover no longer opens the destination guide chat.');
if(!passover.includes('cw-capability-passover-v1'))throw new Error('Passover action button contract is missing.');
if(!passover.includes("if(/\\bquests?\\b/.test(t))return{artifact:'weave',explicitCanonical:true}"))throw new Error('User-facing Quest must route to Weaveling/Civweave.');
if(!passover.includes("if(/\\bendeavou?rs?\\b/.test(t))return{artifact:'quest',explicitCanonical:true}"))throw new Error('User-facing Endeavor must route to Kamiya/Cerbanimo.');
if(!passover.includes("if(/\\blearning journeys?\\b/.test(t))return{artifact:'curriculum',explicitCanonical:true}"))throw new Error('User-facing Learning Journey must route to Moss/Living School.');
if(!passover.includes("canonicalUserFacingTerms:true"))throw new Error('Canonical user-facing artifact language marker is missing.');
if(!loader.includes('/app/guide-capability-passover-v1.js'))throw new Error('Shared guide loader does not load the capability passover owner.');
if(!loader.includes('canonical-guide-artifacts'))throw new Error('Shared guide loader has not advanced to the canonical artifact-language revision.');

console.log('Guide artifact language and capability passover contract verified.');
