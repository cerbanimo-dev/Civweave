import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../public/creator-suite/shared/provenance-label-v1.js',import.meta.url),'utf8'),browser=vm.createContext({console});browser.globalThis=browser;vm.runInContext(source,browser,{filename:'provenance-label-v1.js'});const api=browser.CivweaveCreatorProvenanceLabelV1;
const unknown={origin:'unknown',actorCounts:{human:4,external:1,'civweave-ai':0,deterministic:0}},unknownBadges=api.describeArtifact({summary:unknown,finding:{outcome:'verified'}});assert.equal(unknownBadges.originBadge.label,'External / Unknown','review must not wash an imported unknown origin into Human Created');assert.equal(unknownBadges.reviewBadge.label,'Provenance Verified');assert.equal(unknownBadges.creationOriginImmutable,true);assert.equal(unknownBadges.reviewIsAdditive,true);
const human={origin:'human-authored',actorCounts:{human:5,external:0,'civweave-ai':0,deterministic:0}},humanBadges=api.describeArtifact({summary:human,finding:{outcome:'anomalous'}});assert.equal(humanBadges.originBadge.label,'Human Created','an anomalous review does not rewrite the recorded creation origin');assert.equal(humanBadges.reviewBadge.label,'Provenance Anomaly');assert.match(humanBadges.reviewBadge.detail,/not a stylistic AI detector/i);
const mixed=api.describe({origin:'ai-generated',actorCounts:{human:3,'civweave-ai':2,external:0,deterministic:0}});assert.equal(mixed.label,'Mixed: AI + Human');assert.equal(mixed.canonicalOrigin,'ai-generated');
const ai=api.describeArtifact({summary:{origin:'ai-generated',actorCounts:{human:0,'civweave-ai':1,external:0,deterministic:0}},finding:{outcome:'verified-with-ai'}});assert.equal(ai.originBadge.label,'AI Generated');assert.equal(ai.reviewBadge.label,'Verified with AI');
const unresolved=api.describeReview({outcome:'needs-human-review'});assert.equal(unresolved.label,'Human Review Needed');assert.equal(api.describeReview({}).label,'Not Reviewed');
console.log('Creator additive provenance badge contract passed');
