import assert from 'node:assert/strict';
import test from 'node:test';
import {assertProductionVersion,compareSemver,deployedVersionFromManifest} from './verify-production-boot-canary-v251.mjs';

test('exact production policy requires exact release',()=>{
  assert.equal(assertProductionVersion({expected:'1.0.71',deployed:'1.0.71'}),'1.0.71');
  assert.throws(()=>assertProductionVersion({expected:'1.0.71',deployed:'1.0.72'}),/does not exactly match/);
});

test('PR production-floor policy accepts newer but rejects older',()=>{
  assert.equal(assertProductionVersion({expected:'1.0.71',deployed:'1.0.72',allowNewer:true}),'1.0.72');
  assert.throws(()=>assertProductionVersion({expected:'1.0.71',deployed:'1.0.70',allowNewer:true}),/older than required production floor/);
  assert.equal(compareSemver('2.0.0','1.99.99'),1);
  assert.equal(compareSemver('1.0.70','1.0.71'),-1);
});

test('deployed version is derived from canonical manifest name',()=>{
  assert.equal(deployedVersionFromManifest({name:'Civweave v1.0.72'}),'1.0.72');
  assert.throws(()=>deployedVersionFromManifest({name:'Civweave latest'}),/not a Civweave semantic release/);
});
