import fs from 'node:fs';

const passover=fs.readFileSync('public/app/guide-capability-passover-v1.js','utf8');
const unified=fs.readFileSync('public/app/unified-chat-system-v1.js','utf8');
const loader=fs.readFileSync('public/app/shared-guide-surface-v236.js','utf8');
const surface=fs.readFileSync('public/app/guide-chat-surface-v350.js','utf8');
const sharedCore=fs.readFileSync('public/app/shared-guide-surface-v236-core-v244.js','utf8');
const identity=fs.readFileSync('public/app/guide-identity-integrity-v216.js','utf8');
const onboarding=fs.readFileSync('public/app/new-user-onboarding-v1.js','utf8');
const profiles=JSON.parse(fs.readFileSync('public/app/assets/ai/profiles.json','utf8'));
const systems=fs.readFileSync('docs/architecture/systems-of-practice.md','utf8');
const contract=JSON.parse(fs.readFileSync('config/guide-artifact-language-v1.json','utf8'));
const docs=fs.readFileSync('docs/contracts/guide-artifact-language-v1.md','utf8');

const expected={
  'civweave':{guide:'Weaveling',artifact:'Quest',plural:'Quests',internalArtifactClass:'weave'},
  'living-school':{guide:'Moss',artifact:'Learning Journey',plural:'Learning Journeys',internalArtifactClass:'curriculum'},
  'cerbanimo':{guide:'Kamiya',artifact:'Endeavor',plural:'Endeavors',internalArtifactClass:'quest'},
  'fellowfare':{guide:'Rook',artifact:'Manifest',plural:'Manifests',internalArtifactClass:'resource'}
};
for(const [system,want] of Object.entries(expected)){
  const got=contract.guides?.[system];
  if(!got)throw new Error(`Canonical guide artifact contract missing ${system}`);
  for(const key of ['guide','artifact','plural','internalArtifactClass'])if(got[key]!==want[key])throw new Error(`${system} ${key} must be ${want[key]}, got ${got[key]}`);
  if(!passover.includes(`artifact:'${want.artifact}'`))throw new Error(`Passover runtime is missing canonical artifact ${want.artifact}`);
  if(!docs.includes(`**${want.plural}**`)&&!docs.includes(`**${want.artifact}**`))throw new Error(`Canonical artifact docs are missing ${want.artifact}`);
  if(!systems.includes(`**${want.guide} makes ${want.plural}.**`))throw new Error(`Systems-of-practice does not solidify ${want.guide} -> ${want.plural}`);
  const profile=profiles.profiles?.find(row=>row.system===system);
  if(!profile?.role?.includes(want.artifact))throw new Error(`Guide profile for ${want.guide} does not use ${want.artifact} language.`);
}

for(const [artifact,system] of Object.entries({weave:'civweave',curriculum:'living-school',quest:'cerbanimo',resource:'fellowfare',governance:'anarchadia'})){
  if(!passover.includes(`${artifact}:'${system}'`))throw new Error(`Internal compatibility owner missing: ${artifact} -> ${system}`);
}
if(!unified.includes('generateCurriculumFromChat'))throw new Error('Moss Learning Journey generator was removed from unified chat.');
if(!unified.includes("registerCapability('living-school'"))throw new Error('Moss learning capability handler was removed.');
if(passover.includes("registerCapability('living-school'"))throw new Error('Passover layer must not replace Moss\'s learning capability handler.');
if(!unified.includes('learning journey|curriculum|course|syllabus|learning path'))throw new Error('Moss capability no longer recognizes canonical Learning Journey language alongside compatibility aliases.');
if(unified.includes('I can build the learning path')||unified.includes('Your queued learning path'))throw new Error('Living School user-facing generation copy regressed to learning-path language.');
if(!unified.includes('Your queued Learning Journey'))throw new Error('Living School queued generation does not use Learning Journey language.');
if(!passover.includes('globalThis.CivweaveResponseRouterV347'))throw new Error('Passover preflight no longer consults the shared MiniLM response router.');
if(!passover.includes("dispatchEvent(new CustomEvent('civweave:response-route'"))throw new Error('Passover decisions are no longer visible to the shared route strip.');
if(!passover.includes('surface.submitText(offer.sourceText,offer.targetSystem)'))throw new Error('Passover must resubmit the preserved original request.');
if(!passover.includes("surface.switchGuide?.(offer.targetSystem,{open:true"))throw new Error('Passover no longer opens the destination guide chat.');
if(!passover.includes('cw-capability-passover-v1'))throw new Error('Passover action button contract is missing.');
for(const snippet of [
  "if(value==='quest')return'weave'",
  "if(value==='endeavor'||value==='endeavour')return'quest'",
  "if(value==='manifest')return'resource'",
  "if(value==='learning journey')return'curriculum'"
])if(!passover.includes(snippet))throw new Error(`Canonical term mapping missing: ${snippet}`);
if(!passover.includes('DIRECT_CANONICAL'))throw new Error('Canonical passover targeting no longer distinguishes the requested artifact from incidental Quest context.');
if(!passover.includes("canonicalUserFacingTerms:true"))throw new Error('Canonical user-facing artifact language marker is missing.');
if(!loader.includes('/app/guide-capability-passover-v1.js?v=1.1.1-canonical-targets'))throw new Error('Shared guide loader does not load the canonical-target passover revision.');
if(!loader.includes('/app/unified-chat-system-v1.js?v=1.0.4-learning-journey'))throw new Error('Shared guide loader does not load the canonical Learning Journey unified-chat revision.');
if(!loader.includes('1.0.128-canonical-artifacts'))throw new Error('Shared guide loader does not request the canonical-artifact shared surface revision.');

for(const required of [
  "role:'Quest guide and central orchestrator'",
  "role:'Learning Journey guide'",
  "role:'Endeavor guide'",
  "role:'Manifest guide and Quartermaster'"
]){
  if(!surface.includes(required))throw new Error(`Canonical chat surface missing ${required}`);
  if(!sharedCore.includes(required))throw new Error(`Shared guide metadata missing ${required}`);
}
for(const required of [
  "civweave:{name:'Weaveling',role:'Quest guide and central orchestrator'}",
  "'living-school':{name:'Moss',role:'Learning Journey guide'}",
  "cerbanimo:{name:'Kamiya',role:'Endeavor guide'}",
  "fellowfare:{name:'Rook',role:'Manifest guide and quartermaster'}"
])if(!identity.includes(required))throw new Error(`Identity prompt boundary missing canonical role: ${required}`);

if(onboarding.includes('Questwright'))throw new Error('Onboarding still exposes Questwright for Kamiya.');
if(onboarding.includes('A learning path can become'))throw new Error('Onboarding still calls Moss output a learning path.');
for(const phrase of ['Moss · Learning Journey guide','Kamiya · Endeavor guide','Rook · Manifest guide and Quartermaster','Weaveling makes the Quest, Moss makes Learning Journeys, Kamiya makes Endeavors, Rook makes Manifests'])if(!onboarding.includes(phrase))throw new Error(`Onboarding missing canonical language: ${phrase}`);

console.log('Guide artifact language and capability passover contract verified across chat, generation, prompts, profiles, onboarding, and docs.');
