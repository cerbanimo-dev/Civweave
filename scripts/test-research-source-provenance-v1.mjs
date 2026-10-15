import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateResearchSource,filterResearchSources,researchPromptPolicy,INDICATORS} from '../public/app/research-source-policy-v1.mjs';

const inspect=(record)=>evaluateResearchSource(record).action;
test('publisher-reported domains are excluded, with exact host boundaries',()=>{
  assert.equal(inspect({url:'https://ibi.institute/research/paper'}),'exclude');
  assert.equal(inspect({url:'https://assets.ibi.institute/doc.pdf'}),'exclude');
  assert.equal(inspect({url:'https://burkeinstitute.substack.com/p/example'}),'exclude');
  assert.equal(inspect({url:'https://www.substack.com/p/example'}),'allow');
  assert.equal(inspect({url:'https://another.substack.com/p/example'}),'allow');
  assert.equal(inspect({url:'https://not-ibi.institute.example.com'}),'allow');
  assert.equal(inspect({url:'https://ibi.institute.evil.example'}),'allow');
});
test('only exact account identities are excluded, including account posts',()=>{
  assert.equal(inspect({url:'https://x.com/institute_ibi/status/123'}),'exclude');
  assert.equal(inspect({url:'https://twitter.com/institute_ibi/status/123'}),'exclude');
  assert.equal(inspect({url:'https://youtube.com/@Le_Radar_Public/videos'}),'exclude');
  assert.equal(inspect({url:'https://t.me/klichkovv/99'}),'exclude');
  assert.equal(inspect({url:'https://tiktok.com/@camille_lefevre_fr/video/1'}),'exclude');
  assert.equal(inspect({url:'https://x.com/institute_ibis/status/123'}),'allow');
  assert.equal(inspect({url:'https://youtube.com/@Le_Radar_Publicity'}),'allow');
  assert.equal(inspect({url:'https://x.com@independent.example/status/123'}),'allow');
});
test('authorship is checked without guilt by association or topic censorship',()=>{
  assert.equal(inspect({url:'https://university.example.org/paper',authorUrl:'https://t.me/institute_ibi'}),'exclude');
  assert.equal(inspect({url:'https://independent.example.org/investigation',text:'This article investigates ibi.institute, cites the original network and debunks its claims.'}),'allow');
  assert.equal(inspect({url:'https://x.com/independent_journalist/status/10',title:'I quoted an identified bot account'}),'allow');
  assert.equal(inspect({url:'https://en.wikipedia.org/wiki/Internet_Research_Agency'}),'allow');
  assert.equal(inspect({url:'https://unknown.example',author:'camille_lefevre_fr'}),'allow');
});
test('filter works offline and reports verifiable evidence',()=>{
  const filtered=filterResearchSources([{url:'https://ibi.institute/paper'},{url:'https://example.org/paper'}]);
  assert.equal(filtered.accepted.length,1);
  assert.equal(filtered.excluded.length,1);
  assert.ok(filtered.excluded[0].verdict.evidence.startsWith('https://github.com/facebook/'));
  assert.ok(INDICATORS.length>=22);
  assert.ok(researchPromptPolicy().includes('ibi.institute'));
  assert.ok(researchPromptPolicy().includes('NOT forbidden opinions'));
});
