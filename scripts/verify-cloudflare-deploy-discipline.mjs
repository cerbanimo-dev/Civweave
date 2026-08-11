import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(path,'utf8');

assert(!fs.existsSync('.github/workflows/sync-jules-evergreen-branch.yml'),'Do not mirror main to evergreen/jules-pipeline: the extra branch push creates a duplicate Cloudflare Pages preview build.');

const atlas=read('.github/workflows/build-video-learning-atlas.yml');
assert(atlas.includes("[CF-Pages-Skip] Build optional Video Learning Atlas bundles"),'Video Atlas branch writer must skip Cloudflare Pages previews.');

const schools=read('.github/workflows/materialize-knowledge-school-seeds.yml');
assert(schools.includes("[CF-Pages-Skip] Add optional category school seed assets"),'Knowledge-school branch writer must skip Cloudflare Pages previews.');

const openMedia=read('.github/workflows/harvest-open-learning-media-v1.yml');
assert(openMedia.includes('if [ "$TARGET_REF" = "main" ]'),'Open-media refresh must distinguish production from branch refreshes.');
assert(openMedia.includes("COMMIT_MESSAGE='Refresh open learning media catalog'"),'Main open-media refresh must remain deployable.');
assert(openMedia.includes("COMMIT_MESSAGE='[CF-Pages-Skip] Refresh open learning media catalog'"),'Non-main open-media refreshes must skip Pages previews.');

const pagesBuild=read('scripts/build-cloudflare-pages.mjs');
assert(pagesBuild.includes('await Promise.all(['),'Pages runtime staging must remain parallelized.');
for(const required of ['stage-transformers-assets.mjs','stage-transformers-v4-assets.mjs','stage-maplibre-v275.mjs','stage-federation-finder-data-v274.mjs','materialize-parity-ledger.mjs','build-mobile-install-kit.mjs']){
  assert(pagesBuild.includes(required),`Pages build lost required generated/runtime packaging stage: ${required}`);
}
for(const forbidden of ['generate-prelive-metadata-v281.mjs','smoke-installer-resume-state-v280.mjs','smoke-installer-hardening-v281.mjs']){
  assert(!pagesBuild.includes(forbidden),`Pages deploy hot path must not run release/verification work: ${forbidden}`);
}
assert(!pagesBuild.includes('sourceOversized = oversizedFiles(sourceDir)'),'Pages deploy must not recursively audit both source and output trees.');
assert(pagesBuild.includes('Civweave mobile/Pocket Campus package build failed.'),'Pages build must retain Pocket Campus generation while that seed is not committed.');
assert(pagesBuild.includes('externalizeKnowledgeSchoolZips'),'Pages build must externalize optional knowledge-school ZIP bytes.');
assert(pagesBuild.includes('raw.githubusercontent.com'),'Pages build must pin external school ZIPs to immutable repository commits.');
assert(pagesBuild.includes("mode:'external-immutable-zips'"),'Pages catalog must advertise the immutable external ZIP policy.');
assert(pagesBuild.includes("pages_carries_zip_bytes:false"),'Pages catalog must state that school ZIP bytes are not part of the site payload.');
assert(pagesBuild.includes("rmSync(zipDir,{recursive:true,force:true})"),'Pages output must remove the optional school ZIP directory after catalog rewriting.');

const knowledgeHelper=read('public/app/knowledge-school-seeds-v1.js');
for(const required of ['record?.download_url','legacySeedUrl','seedUrls','matchCachedSeed','X-Civweave-Source-URL']){
  assert(knowledgeHelper.includes(required),`Knowledge-school downloader lost external/legacy compatibility token: ${required}`);
}

const transformersV3=read('scripts/stage-transformers-assets.mjs');
assert(transformersV3.includes("purpose:'browser-runtime-only'"),'Transformers v3 must remain browser-runtime-only.');
assert(!transformersV3.includes("fsp.cp(source,destination"),'Transformers v3 must not copy the entire npm dist tree into Pages.');
const transformersV4=read('scripts/stage-transformers-v4-assets.mjs');
assert(transformersV4.includes("purpose:'gemma4-mobile-browser-runtime-only'"),'Transformers v4 must remain browser-runtime-only.');
assert(transformersV4.includes("manifest.schema!=='civweave.transformers-stage.v6'"),'Transformers v4 must reject stale full-runtime stages and prune them once.');

console.log('Cloudflare deploy discipline verified: no duplicate preview mirror, non-production automation skips Pages, runtime/data staging stays minimal and parallel, and optional school ZIP bytes remain outside the Pages publish payload.');
