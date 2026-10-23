import assert from 'node:assert/strict';
import {test} from 'node:test';
import {newDraft,livingSchoolPlan,guildBundle,validateDraft,normaliseSource,normaliseMedia,videoEmbed,externalUrl} from '../public/app/living-library-seedling-core-v1.mjs';

const fixture=()=>{const d=newDraft();d.title='Read and memorize tarot';d.capability='Independently recognize and explain Major Arcana symbols';d.proof='Name a random card, identify three symbols, and explain the interpretation without looking';d.modules.forEach((m,i)=>Object.assign(m,{title:'Module '+(i+1),focus:'Learn topic '+(i+1),outcome:'Identify and explain topic '+(i+1)}));d.sources=[normaliseSource({title:'Historical article',url:'https://example.org/tarot-history',type:'article'})];d.media=[normaliseMedia({kind:'video',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',title:'Demonstration'})];return d};
test('manual authoring matches Living School review schema and approval boundary',()=>{
 const p=livingSchoolPlan(fixture());
 assert.equal(p.schema,'civweave.learning-journey-plan.v2');
 assert.equal(p.state,'review');assert.equal(p.approvedAt,null);assert.equal(p.requiresExplicitApproval,true);
 assert.equal(p.request.count,3);assert.equal(p.request.outline.length,3);assert.equal(p.modules.length,3);
 for(const m of p.modules)assert.ok(m.title&&m.focus&&m.outcome);
 assert.equal(p.authoring.mode,'manual-source-curated');
});
test('Guild review bundle preserves sources and media and cannot approve or publish itself',()=>{
 const d=fixture();d.guildId='my-guild';const b=guildBundle(d);
 assert.equal(b.schema,'civweave.seedling.guild-learning-submission.v1');
 assert.equal(b.guildId,'my-guild');assert.equal(b.status,'review-requested');assert.equal(b.userApprovalRequired,true);
 assert.equal(b.plan.state,'review');assert.equal(b.sourceCatalog.length,1);assert.equal(b.mediaCatalog.length,1);
 assert.equal(b.sourceCatalog[0].verification,'user-curated-unverified');
 assert.equal(b.mediaCatalog[0].offlineAvailable,false);
});
test('invalid plans are blocked',()=>{
 const d=fixture();d.proof='';assert.match(validateDraft(d).join(' '),/observable proof/i);assert.throws(()=>livingSchoolPlan(d),/proof/i);
 const f=fixture();f.modules=f.modules.slice(0,2);assert.throws(()=>livingSchoolPlan(f),/3–8 modules/);
});
test('only safe external media URLs and known video embeds are accepted',()=>{
 assert.equal(externalUrl('javascript:alert(1)'),null);
 assert.equal(externalUrl('data:text/html,hello'),null);
 assert.equal(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
 assert.equal(videoEmbed('https://video.example.com/file'),null);
});
