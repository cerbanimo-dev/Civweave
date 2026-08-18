import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root=new URL('..',import.meta.url),readJson=async path=>JSON.parse(await fs.readFile(new URL(path,root),'utf8'));
const review=await readJson('./docs/vendor/creator-suite-c2pa-v1.json'),pkg=await readJson('./public/creator-suite/package-v1.json'),serviceWorker=await fs.readFile(new URL('./public/creator-suite/service-worker.js',root),'utf8');
assert.equal(review.schema,'civweave.creator-suite-vendor-review.v1');
assert.equal(review.capability,'c2pa-content-credentials');
assert.equal(review.runtimePolicy.optionalCreatorSuiteOnly,true);
assert.equal(review.runtimePolicy.coreCivweaveDependency,false);
assert.equal(review.runtimePolicy.cdnRuntimeAllowed,false);
assert.equal(review.runtimePolicy.unsignedFallbackAllowed,false);
assert.equal(review.primaryCandidate.package,'@contentauth/c2pa-web');
assert.equal(review.primaryCandidate.packageLicense,'MIT');
assert.ok(Array.isArray(review.requiredBeforeVendoring)&&review.requiredBeforeVendoring.length>=5);
if(review.approvedForShipping!==true){
  const all=JSON.stringify(pkg);
  assert.doesNotMatch(all,/c2pa[-_/].*(?:\.js|\.wasm)|c2pa_bg\.wasm/i,'unapproved C2PA runtime bytes must not enter the Creator Suite package manifest');
  assert.doesNotMatch(serviceWorker,/c2pa[-_/].*(?:\.js|\.wasm)|c2pa_bg\.wasm/i,'unapproved C2PA runtime bytes must not enter the Creator Suite offline cache');
}
assert.doesNotMatch(serviceWorker,/https?:\/\//i,'Creator Suite service worker must not acquire a CDN C2PA fallback');
console.log('Creator C2PA vendor quarantine contract passed');
