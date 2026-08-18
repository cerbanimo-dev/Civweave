import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const html=await fs.readFile(new URL('../public/creator-suite/verify.html',import.meta.url),'utf8'),source=await fs.readFile(new URL('../public/creator-suite/receipt-viewer-v1.js',import.meta.url),'utf8');
assert.match(html,/id="cv-guild-manifest"/,'Verifier must allow an optional trusted Guild manifest');
assert.match(html,/signing-key trust/i);
assert.match(source,/civweave\.creator-provenance-review-receipt\.v1/);
assert.match(source,/verifyGuildReviewReceipt\(value,\{trustedGuildManifest:options\.trustedGuildManifest\|\|null\}\)/);
assert.match(source,/guildKeyTrusted/);
assert.match(source,/Guild signature verified, but the signing key was not anchored/i,'self-contained signature verification must not be presented as Guild-key trust');
assert.match(source,/Guild signature and signing key verified against the supplied Guild manifest/i);
assert.match(source,/reviewMethod:value\.reviewMethod/);
assert.doesNotMatch(source,/individualReviewer|reviewerId|tribunalVotes/,'standalone aggregate receipt viewer must not depend on individual reviewer identities');
console.log('Creator signed review receipt verifier UI trust-boundary contract passed');
