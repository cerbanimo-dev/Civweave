import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const shelf=read('public/app/shared/learning-pack-shelf-v1.mjs');
const css=read('public/app/shared/learning-pack-shelf-v1.css');
const living=read('public/app/living-school-learning-packs-v1.mjs');
const cerbanimo=read('public/app/cerbanimo-learning-packs-v1.js');
const workflow=read('.github/workflows/verify-learning-packs-v1.yml');
const catalog=JSON.parse(read('public/downloads/learning-packs/catalog.json'));

assert(shelf.includes("export function mountLearningPackShelf"),'Shelf must export one shared mount function.');
assert(shelf.includes("audience==='living-school'")&&shelf.includes("'cerbanimo'"),'Shelf must be realm-aware.');
assert(shelf.includes("adapter.catalog()")&&shelf.includes("adapter.status()"),'Shelf must render from the canonical catalog and device status.');
assert(shelf.includes("adapter.stage([id]")&&shelf.includes("packs.remove([id])"),'Shelf must support verified offline add/remove through the shared runtime.');
assert(shelf.includes("packs.loadPack(record.id")&&shelf.includes("packs.search('',{packIds:[record.id]"),'Shelf must browse the same loaded pack records used by the resolver.');
assert(shelf.includes("adapter.createQuest(row.id")&&shelf.includes("adapter.generateCurriculum(row.id"),'Shelf must hand selected authored content to existing realm engines.');
assert(shelf.includes("if(row.kind==='labor-reference')")&&shelf.includes('Reference only. Adapt this occupational description'),'Any surfaced labor reference must remain visibly non-executable.');
assert(shelf.indexOf("if(row.kind==='labor-reference')")<shelf.indexOf('const action=actionLabel'),'Labor-reference guard must run before executable item actions are created.');
assert(shelf.includes('INTERNAL_CORE_PACKS')&&shelf.includes('coreInfrastructure')&&shelf.includes('hiddenFromShelf'),'Shelf must hide core infrastructure records rather than expose them as user-managed downloads.');
for(const id of ['onet-labor-atlas-30-3','esco-skill-crosswalk-v1']){
  const row=catalog.packs.find(item=>item.id===id);assert(row?.coreInfrastructure&&row?.hiddenFromShelf,`${id} must be core-managed and hidden from the shelf.`);
}
assert(shelf.includes("record.optional!==false")&&shelf.includes('Remove offline copy'),'Core/non-optional packs must not expose removal controls.');
assert(shelf.includes("event.key==='Escape'")&&shelf.includes("event.key!=='Tab'"),'Shelf dialog must provide Escape close and keyboard focus containment.');
assert(shelf.includes("role','dialog")&&shelf.includes("aria-modal"),'Shelf must expose dialog semantics.');
assert(css.includes('@media(max-width:720px)'),'Shelf must have a mobile layout.');
assert(css.includes('data-audience="living-school"'),'Shelf CSS must carry a Living School realm treatment.');
assert(css.includes('env(safe-area-inset-bottom)'),'Shelf launcher must respect mobile safe areas.');
assert(living.includes("mountLearningPackShelf({audience:'living-school',adapter:api})"),'Living School must mount the shared shelf.');
assert(cerbanimo.includes("mountLearningPackShelf({audience:'cerbanimo',adapter:api})"),'Cerbanimo must mount the shared shelf.');
assert(living.includes('remove,search')&&cerbanimo.includes('stage,remove,search'),'Both realm adapters must expose pack removal alongside existing search/stage APIs.');
assert(workflow.includes('learning-pack-shelf-v1.mjs')&&workflow.includes('verify-learning-pack-shelf-v1.mjs'),'Learning-pack CI must cover the shelf runtime and contract verifier.');

console.log('Learning Pack Shelf v1 contract passed.',{sharedMount:true,offlineControls:true,coreLaborHidden:true,referenceGuard:true,livingSchool:true,cerbanimo:true,mobile:true});
