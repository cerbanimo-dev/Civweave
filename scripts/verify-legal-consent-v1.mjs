import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [manifestText,runtime,entry,html,readinessText]=await Promise.all([
  read('public/legal/civweave-legal-release-v1.json'),
  read('public/app/legal-consent-v1.js'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/installed-entry-v146.html'),
  read('ops/launch/public-launch-readiness-v1.json')
]);
const manifest=JSON.parse(manifestText),readiness=JSON.parse(readinessText);
assert.equal(manifest.schema,'civweave.legal-release.v1');
assert.ok(['draft','final'].includes(manifest.status));
assert.ok(['disabled','required'].includes(manifest.enforcement));
if(manifest.status!=='final')assert.equal(manifest.enforcement,'disabled','Draft legal copy must never be enforced as final clickwrap.');
if(manifest.enforcement==='required'){
  assert.equal(manifest.status,'final');
  assert.match(String(manifest.termsVersion||''),/^\d{4}-\d{2}-\d{2}(?:[-._A-Za-z0-9]+)?$/);
  assert.ok(String(manifest.termsUrl||'').startsWith('/'),'Final Terms URL must be a same-origin public path.');
  await access(new URL(`public${manifest.termsUrl}`,root));
}
new vm.Script(runtime,{filename:'legal-consent-v1.js'});
assert.match(runtime,/RECORD_KEY='civweave\.legal\.terms\.acceptance\.v1'/);
assert.match(runtime,/method:'clickwrap'/);
assert.match(runtime,/type=\"checkbox\"/);
assert.match(runtime,/button\.disabled=!checkbox\.checked/);
assert.match(runtime,/value\.status!=='final'\|\|value\.enforcement!=='required'/);
assert.match(runtime,/Acceptance could not be persisted/);
assert.match(entry,/await ensureLegalConsent\(\);[\s\S]*authorize\(\);/,'Consent check must precede installed authorization.');
assert.match(entry,/value\?\.status==='final'&&value\?\.enforcement==='required'/,'Missing consent runtime must fail closed for a finalized legal release.');
assert.match(html,/legal-consent-v1\.js/);
assert.match(html,/\/app\/installed-entry-v146\.html/,'Safe recovery must return through the legal-aware installed entry rather than bypassing it.');
const legalGate=readiness.manualGates?.legalReviewAndClickwrap;
assert.ok(legalGate,'Public launch readiness must include the legal gate.');
if(legalGate.status==='pass'){
  assert.equal(manifest.status,'final');
  assert.equal(manifest.enforcement,'required');
  assert.ok(legalGate.evidence,'A passing legal gate requires durable review evidence.');
}
console.log(JSON.stringify({ok:true,revision:'legal-consent-v1',status:manifest.status,enforcement:manifest.enforcement,clickwrapReady:true,safeRecoveryGated:true,publicLegalGate:legalGate.status},null,2));
