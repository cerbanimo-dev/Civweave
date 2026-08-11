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

console.log('Cloudflare deploy discipline verified: no duplicate preview mirror, non-production automation skips Pages, runtime/data staging stays parallel, and only required portable packaging remains in the production hot path.');
