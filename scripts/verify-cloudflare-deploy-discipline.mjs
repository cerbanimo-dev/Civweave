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

console.log('Cloudflare deploy discipline verified: no evergreen mirror and non-production automation commits skip Pages previews.');
