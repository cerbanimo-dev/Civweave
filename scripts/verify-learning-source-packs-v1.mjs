import fs from'node:fs/promises';
import path from'node:path';
import {fileURLToPath}from'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const read=relative=>fs.readFile(path.join(repo,relative),'utf8');
const json=async relative=>JSON.parse(await read(relative));
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const includes=(source,tokens,label)=>{for(const token of tokens)assert(source.includes(token),`${label} is missing ${token}`)};

const [articles,videos,supplemental,mediaRegistry,runtime,installer,recommender,videoShim,activeRun,rootWorker,worker203]=await Promise.all([
  json('public/downloads/knowledge-schools/catalog.json'),
  json('public/downloads/knowledge-schools/video-atlases/catalog.json'),
  json('public/downloads/knowledge-schools/supplemental-articles-v1.json'),
  json('config/open-learning-media-packs-v1.json'),
  read('public/app/learning-source-pack-runtime-v1.mjs'),
  read('public/app/knowledge-school-installer-v1.js'),
  read('public/app/living-school-media-pack-recommender-v1.mjs'),
  read('public/app/video-atlas-installer-v1.js'),
  read('public/app/living-school-active-run-ui-v1.js'),
  read('public/service-worker.js'),
  read('public/service-worker-v203.js')
]);
assert(articles.schema==='civweave.knowledge-school-catalog.v1','Unexpected article catalog schema.');
assert(videos.schema==='civweave.video-learning-atlas.catalog.v1','Unexpected video atlas schema.');
assert(supplemental.schema==='civweave.supplemental-article-catalog.v1','Unexpected supplemental catalog schema.');
const articleSlugs=new Set(articles.schools.map(row=>row.school_slug)),videoSlugs=new Set(videos.schools.map(row=>row.school_slug));
assert(articleSlugs.size===videoSlugs.size,'Article and video catalogs have different school counts.');
for(const slug of articleSlugs)assert(videoSlugs.has(slug),`No matching video-link atlas for ${slug}.`);
for(const slug of videoSlugs)assert(articleSlugs.has(slug),`No matching article school for ${slug}.`);
const topicSlugs=new Set((mediaRegistry.topics||[]).map(row=>row.slug)),ids=new Set();
assert(supplemental.articles.length>=50,`Expected at least 50 targeted gap articles, found ${supplemental.articles.length}.`);
for(const row of supplemental.articles){assert(row.id&&!ids.has(row.id),`Duplicate supplemental article id: ${row.id}`);ids.add(row.id);assert(articleSlugs.has(row.school_slug),`Supplement ${row.id} references unknown school ${row.school_slug}.`);assert(Array.isArray(row.topics)&&row.topics.length,`Supplement ${row.id} has no topic mapping.`);for(const topic of row.topics)assert(topicSlugs.has(topic),`Supplement ${row.id} references unknown media topic ${topic}.`)}
for(const id of ['tarot','major-arcana','prompt-engineering','gardening','active-listening','music-theory','second-language-acquisition'])assert(ids.has(id),`Missing required gap bridge ${id}.`);
includes(runtime,["VIDEO_CACHE_NAME='cw-video-learning-atlas-v1'","VIDEO_MIRROR_CACHE_NAME='cwknowledge-video-learning-atlas-v1'","SUPPLEMENTAL_CACHE_NAME='cwknowledge-school-supplemental-v1'",'stageLearningSourcePacks','learningSourcePackStatus','searchSupplementalArticles','youtube_availability_index','youtube_metadata_sidecar','https://en.wikipedia.org/w/api.php',"origin:'*'","crypto.subtle.digest('SHA-256'"],'unified source-pack runtime');
includes(installer,['learning-source-pack-runtime-v1.mjs','foundation articles','video links','gap articles','Download ${needed.length} learning pack','removeLearningSourcePacks'],'knowledge installer');
includes(recommender,['living-school-media-pack-recommender-v1.6-foundation-ready-dedupe','Recommended learning packs','stageLearningSourcePacks','sourceSchoolSlugs','Articles and matched video links download together.','learningSourcePackStatus','alreadyDownloaded','foundationReady','sourcePackCurrent','updateAvailable','pendingRecommendations','skippedAlreadyDownloaded','Finish pack'],'Living School pack recommender');
assert(recommender.includes("states.every(row=>row.articleCurrent===true||row.current===true)"),'Living School must treat already-saved foundation article schools as curriculum-ready even when optional media can refresh.');
includes(activeRun,['1.1.0-living-school-active-run-ui-v1-source-pack-authority','CivweaveKnowledgeSchools','store.status()','sourceSchoolSlugs','foundation-ready-primary','Continue to curriculum','living-school-media-pack-recommendations'],'Living School source-pack authority guard');
assert(activeRun.includes("slugs.every(slug=>bySlug.get(slug)?.current===true)"),'The pre-curriculum guard must use the canonical saved foundation-school status rather than optional media completeness.');
includes(rootWorker,['root-worker-bridge-v21-learning-source-pack-authority','service-worker-v203.js?v=root-worker-bridge-v21-learning-source-pack-authority'],'root service-worker bridge');
includes(worker203,['staging-installed-entry-takeover-v21-learning-source-pack-authority','cwrecovery-v453-learning-source-pack-authority','v203PurgeLivingSchoolSourceStatusAssets','/app/living-school-active-run-ui-v1.js','/app/living-school-media-pack-recommender-v1.mjs','/app/learning-source-pack-runtime-v1.mjs','/app/knowledge-school-seeds-v1.js'],'staging Living School source-state cache recovery');
includes(videoShim,['video-atlas-installer-v2-unified-source-pack-shim','learning-source-pack-runtime-v1.mjs','CivweaveVideoAtlasPacksV2'],'video-atlas compatibility shim');
assert(!videoShim.includes('video-atlas-panel'),'The legacy standalone video-atlas panel is still present.');
console.log(JSON.stringify({schoolPacks:articleSlugs.size,foundationArticles:articles.schools.reduce((sum,row)=>sum+Number(row.counts?.articles||0),0),videoLinks:videos.schools.reduce((sum,row)=>sum+Number(row.count||0),0),supplementalGapArticles:supplemental.articles.length,sourcePackRuntime:'v1',downloadOfferDedupe:'canonical-foundation-authority',stagingCacheRecovery:'v21',standaloneVideoPanel:false},null,2));
