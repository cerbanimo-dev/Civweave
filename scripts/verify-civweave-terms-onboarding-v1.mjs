import fs from 'node:fs';
import assert from 'node:assert/strict';

const terms = fs.readFileSync('public/legal/civweave-terms-of-service.txt', 'utf8');
const entry = fs.readFileSync('public/app/installed-entry-v146.js', 'utf8');
const fallback = fs.readFileSync('public/app/installer-online-fallback-v225.js', 'utf8');
const manifest = fs.readFileSync('public/app/manifest.webmanifest', 'utf8');
const serviceWorker = fs.readFileSync('public/service-worker-core-v208.js', 'utf8');

assert.match(terms, /^CIVWEAVE TERMS OF SERVICE/m);
assert.match(terms, /Effective Date: August 13, 2026/);
assert.match(terms, /Last Updated: August 13, 2026/);
assert.match(terms, /no official affiliation, partnership, sponsorship, endorsement, or other formal relationship[^\n]+“Commonweave.”/);
assert.match(terms, /Legal notices: cerbanimo@gmail\.com/);
assert.match(terms, /Privacy inquiries: cerbanimo@gmail\.com/);
assert.doesNotMatch(terms, /\[(?:DATE|LEGAL CONTACT EMAIL|COUNTY|REGISTERED BUSINESS ADDRESS|GENERAL SUPPORT EMAIL|LEGAL EMAIL|PRIVACY EMAIL)\]/);

assert.match(entry, /const TERMS_KEY='civweave\.legal\.terms\.acceptance\.v1'/);
assert.match(entry, /const TERMS_VERSION='2026-08-13'/);
assert.match(entry, /const TERMS_URL='\/legal\/civweave-terms-of-service\.txt'/);
assert.match(entry, /schema:'civweave\.legal\.acceptance\.v1'/);
assert.match(entry, /acceptedAt:new Date\(\)\.toISOString\(\)/);
assert.match(entry, /method:'clickwrap'/);
assert.match(entry, /id="cw-terms-consent" type="checkbox"/);
assert.match(entry, /I agree to the Civweave Terms of Service\./);
assert.match(entry, /Agree & enter Civweave/);
assert.match(entry, /accept\.disabled=!consent\.checked/);
assert.match(entry, /if\(!consent\.checked\)return/);

const gateIndex = entry.indexOf('await ensureTermsAccepted();');
const authorizeIndex = entry.indexOf('authorize();', gateIndex);
assert.ok(gateIndex >= 0, 'boot must await Terms acceptance');
assert.ok(authorizeIndex > gateIndex, 'authorization must happen after Terms acceptance');
assert.match(entry, /closest\('#boot-safe'\)/);
assert.match(entry, /event\.stopImmediatePropagation\(\)/);

assert.match(fallback, /return installedEntryUrl\('installer-online-fallback'\)/);
assert.match(fallback, /onlineFallback\.href = campusUrl\(\)/);
assert.match(fallback, /legalGate: 'installed-entry-v1'/);
assert.match(serviceWorker, /REQUIRED_SHELL_ASSETS[\s\S]*\/legal\/civweave-terms-of-service\.txt/);

const parsedManifest = JSON.parse(manifest);
assert.equal(parsedManifest.start_url, '/app/installed-entry-v146.html?installed=1');
assert.ok(parsedManifest.shortcuts.every(item => item.url.startsWith('/app/installed-entry-v146.html?')));
assert.ok(parsedManifest.related_applications.every(item => !/commonweave/i.test(`${item.url} ${item.id}`)));

console.log(JSON.stringify({
  ok: true,
  termsVersion: '2026-08-13',
  acceptanceKey: 'civweave.legal.terms.acceptance.v1',
  clickwrapRequired: true,
  installerFallbackGated: true,
  recoveryFallbackGated: true,
  manifestCommonweaveReferenceRemoved: true
}, null, 2));
