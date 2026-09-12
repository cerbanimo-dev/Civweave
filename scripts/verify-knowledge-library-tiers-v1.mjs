import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const root=path.join(repo,'public','downloads','knowledge-schools');
const manifest=JSON.parse(await fs.readFile(path.join(root,'tiers.json'),'utf8'));
const maxPackBytes=24*1024*1024;
const requiredLayers=['foundation','expanded','deep'];
const safeRelative=value=>typeof value==='string'&&value.length>0&&!value.includes('..')&&!path.isAbsolute(value);
const externalUrl=value=>{try{const url=new URL(String(value||''));return url.protocol==='https:'}catch{return false}};
async function sha256(file){const data=await fs.readFile(file);return crypto.createHash('sha256').update(data).digest('hex')}
function assert(condition,message){if(!condition)throw new Error(message)}

assert(manifest.schema==='civweave.knowledge-library-tiers.v1','Unexpected tier-manifest schema.');
assert(Array.isArray(manifest.layers),'Tier manifest has no layers.');
const bySlug=new Map(manifest.layers.map(record=>[record.slug,record]));
assert(requiredLayers.every(slug=>bySlug.has(slug)),'Tier manifest must define foundation, expanded, and deep.');
assert(bySlug.get('foundation').vital_level===3,'Foundation must map to Vital Level 3.');
assert(bySlug.get('expanded').vital_level===4&&bySlug.get('expanded').delta_from_level===3,'Expanded must be the Level 4 minus Level 3 delta.');
assert(bySlug.get('deep').vital_level===5&&bySlug.get('deep').delta_from_level===4,'Deep must be the Level 5 minus Level 4 delta.');
assert((bySlug.get('expanded').dependencies||[]).includes('foundation'),'Expanded must depend on Foundation.');
assert((bySlug.get('deep').dependencies||[]).includes('foundation')&&(bySlug.get('deep').dependencies||[]).includes('expanded'),'Deep must depend on Foundation and Expanded.');
assert(bySlug.get('foundation').availability==='ready','Foundation must remain ready.');

const foundationCatalog=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8'));
assert(foundationCatalog.schema==='civweave.knowledge-school-catalog.v1','Foundation catalog schema is incompatible.');
assert(Array.isArray(foundationCatalog.schools)&&foundationCatalog.schools.length===11,'Foundation must contain eleven schools.');
let foundationArticles=0,foundationBytes=0;
const foundationSlugs=new Set();
for(const school of foundationCatalog.schools){
  assert(school.school_slug&&!foundationSlugs.has(school.school_slug),`Foundation has a duplicate/missing school slug: ${school.school_slug}`);
  foundationSlugs.add(school.school_slug);
  assert(safeRelative(school.zip_file)&&String(school.zip_file).startsWith('schools/'),`Foundation has unsafe ZIP path ${school.zip_file}.`);
  const file=path.join(root,school.zip_file),stat=await fs.stat(file),bytes=Number(school.zip_bytes||0);
  assert(stat.isFile(),`Missing Foundation pack ${school.zip_file}.`);
  assert(bytes>0&&bytes<=maxPackBytes,`Foundation pack ${school.zip_file} is outside the 24 MiB boundary.`);
  assert(stat.size===bytes,`Foundation pack ${school.zip_file} size mismatch.`);
  assert(/^[0-9a-f]{64}$/.test(String(school.zip_sha256||'')),`Foundation pack ${school.zip_file} has invalid SHA-256.`);
  assert(await sha256(file)===school.zip_sha256,`Foundation pack ${school.zip_file} SHA-256 mismatch.`);
  foundationArticles+=Number(school.counts?.articles||0);foundationBytes+=bytes;
}
assert(foundationArticles===1001,`Foundation must contain exactly 1,001 articles; found ${foundationArticles}.`);
assert(Number(bySlug.get('foundation').materialized_articles)===foundationArticles,'Tier manifest Foundation article count mismatch.');

let readyLayerCount=0,packCount=0,externalPackCount=0,articleCount=0,compressedBytes=0;
for(const slug of ['expanded','deep']){
  const layer=bySlug.get(slug);
  assert(['ready','build-required'].includes(layer.availability),`${slug} has unsupported availability ${layer.availability}.`);
  if(layer.availability!=='ready')continue;
  readyLayerCount++;
  const expectedPath=path.join(root,'tiers',slug,'catalog.json');
  const catalog=JSON.parse(await fs.readFile(expectedPath,'utf8'));
  assert(catalog.schema==='civweave.knowledge-layer-catalog.v1',`${slug} catalog schema is incompatible.`);
  assert(catalog.layer===slug,`${slug} catalog identifies as ${catalog.layer}.`);
  assert(catalog.vital_level===layer.vital_level,`${slug} Vital level mismatch.`);
  assert(catalog.delta_from_level===layer.delta_from_level,`${slug} delta level mismatch.`);
  assert(Array.isArray(catalog.schools)&&catalog.schools.length===11,`${slug} must contain eleven schools.`);
  const seen=new Set();let catalogArticles=0,catalogBytes=0;
  for(const school of catalog.schools){
    assert(school.school_slug&&!seen.has(school.school_slug),`${slug} has a duplicate/missing school slug.`);seen.add(school.school_slug);
    assert(foundationSlugs.has(school.school_slug),`${slug} references unknown Foundation school ${school.school_slug}.`);
    assert(Array.isArray(school.packs),`${slug}/${school.school_slug} has no pack list.`);
    let schoolArticles=0,schoolBytes=0;
    for(const pack of school.packs){
      assert(safeRelative(pack.zip_file),`${slug}/${school.school_slug} has unsafe pack path ${pack.zip_file}.`);
      assert(Number(pack.zip_bytes)>0&&Number(pack.zip_bytes)<=maxPackBytes,`${slug}/${pack.pack_id} is outside the 24 MiB pack boundary.`);
      assert(/^[0-9a-f]{64}$/.test(String(pack.zip_sha256||'')),`${slug}/${pack.pack_id} has an invalid SHA-256.`);
      const bytes=Number(pack.zip_bytes);
      if(pack.download_url){
        assert(externalUrl(pack.download_url),`${slug}/${pack.pack_id} has an invalid external download URL.`);
        externalPackCount++;
      }else{
        const file=path.join(root,'tiers',slug,pack.zip_file),stat=await fs.stat(file);
        assert(stat.isFile(),`Missing ${slug} pack ${pack.zip_file}.`);
        assert(stat.size===bytes,`Size mismatch for ${slug}/${pack.zip_file}.`);
        assert(await sha256(file)===pack.zip_sha256,`SHA-256 mismatch for ${slug}/${pack.zip_file}.`);
      }
      schoolArticles+=Number(pack.article_count||0);schoolBytes+=bytes;packCount++;compressedBytes+=bytes;
    }
    assert(schoolArticles===Number(school.article_count||0),`${slug}/${school.school_slug} article count does not equal its packs.`);
    assert(schoolBytes===Number(school.zip_bytes||0),`${slug}/${school.school_slug} byte count does not equal its packs.`);
    catalogArticles+=schoolArticles;catalogBytes+=schoolBytes;
  }
  assert(catalogArticles===Number(catalog.article_count||0),`${slug} catalog article total mismatch.`);
  assert(catalogBytes===Number(catalog.zip_bytes||0),`${slug} catalog byte total mismatch.`);
  assert(Number(layer.materialized_articles)===catalogArticles,`${slug} tier manifest article total mismatch.`);
  articleCount+=catalogArticles;
}

const [runtime,builder,membershipBuilder,reconciler]=await Promise.all([
  fs.readFile(path.join(repo,'public','app','knowledge-library-tiers-v1.mjs'),'utf8'),
  fs.readFile(path.join(repo,'scripts','build-knowledge-library-tiers-v1.py'),'utf8'),
  fs.readFile(path.join(repo,'scripts','fetch-vital-memberships-v1.py'),'utf8'),
  fs.readFile(path.join(repo,'scripts','reconcile-foundation-vital-membership-v1.py'),'utf8'),
]);
for(const token of ['MAX_PACK_BYTES=24*1024*1024','stageCumulative','openSchoolPacks','routing_terms','cwknowledge-library-tiers-v1'])assert(runtime.includes(token),`Tier runtime is missing ${token}.`);
for(const token of ['civweave.knowledge-layer-catalog.v1','sections_fts','max-pack-mib','routing_terms','delta_from_level'])assert(builder.includes(token),`Tier compiler is missing ${token}.`);
for(const token of ['Wikipedia:Vital articles/Level/4','Wikipedia:Vital articles/Level/5','plnamespace','civweave.vital-membership.v1'])assert(membershipBuilder.includes(token),`Vital membership builder is missing ${token}.`);
for(const token of ['shipped-foundation-provenance','foundation_reconciliation','Could not prove Foundation membership'])assert(reconciler.includes(token),`Foundation reconciler is missing ${token}.`);

console.log(JSON.stringify({schema:manifest.schema,foundationArticles,foundationBytes,expanded:bySlug.get('expanded').availability,deep:bySlug.get('deep').availability,readyLayerCount,packCount,externalPackCount,materializedDeltaArticles:articleCount,compressedBytes,maxPackBytes},null,2));
