import test from 'node:test';
import assert from 'node:assert/strict';
import {countModelPosts,ensureHarmlessModelBudget} from '../public/app/shared/harmless-participation-v1.mjs';
test('counts only device-authored local and Guild AI posts in rolling day',()=>{
 const now=Date.parse('2026-11-01T10:00:00Z');
 const local=[
  {source:'local-model',at:'2026-11-01T09:00:00Z'},
  {source:'human',at:'2026-11-01T09:00:00Z'},
  {source:'local-model',at:'2026-10-29T09:00:00Z'}
 ];
 const shared=[
  {source:'local-model',signerId:'device:a',at:'2026-11-01T09:00:00Z'},
  {source:'local-model',signerId:'device:b',at:'2026-11-01T09:00:00Z'}
 ];
 assert.equal(countModelPosts({local,shared,deviceId:'device:a',now}),2);
 assert.throws(()=>ensureHarmlessModelBudget({local,shared,deviceId:'device:a',now,limit:1}),/daily/i);
 assert.equal(ensureHarmlessModelBudget({local,shared,deviceId:'device:a',now,limit:3}).remaining,1);
});
test('invalid model budgets fail closed',()=>{
 assert.throws(()=>ensureHarmlessModelBudget({limit:0}),/limit/);
 assert.throws(()=>ensureHarmlessModelBudget({limit:100}),/limit/);
});
