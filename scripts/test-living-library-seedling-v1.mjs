import assert from 'node:assert/strict';
import {test} from 'node:test';
import {REVIEW_PLAN_KEY,EVIDENCE_PREFIX,STAGED_KEY,stageManualDraft,stageBundleForReview,evidenceForPlan,validateSubmission} from '../public/app/living-library-seedling-bridge-v1.mjs';
import {exportSeedlingEpub} from '../public/app/living-library-seedling-epub-v1.mjs';
import {sessionStatus,getMossThread,sendToMoss,transcript} from '../public/app/living-library-seedling-connect-core-v1.mjs';
import fs from 'node:fs';
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
test('evidence and Guild export preserve module-linked source references',()=>{
 const d=fixture();d.sources[0].moduleId=d.modules[1].id;
 const bundle=guildBundle(d);
 assert.equal(bundle.sourceCatalog[0].moduleId,d.modules[1].id);
 const plan=livingSchoolPlan(d);
 assert.equal(plan.modules.length,3);
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

test('manual Seedling plan stages only REVIEW state and preserves source/media evidence',()=>{
 const data=new Map();const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
 const staged=stageManualDraft(fixture(),{storage});
 assert.ok(staged.planId);
 const plan=JSON.parse(data.get(REVIEW_PLAN_KEY));
 assert.equal(plan.schema,'civweave.learning-journey-plan.v2');
 assert.equal(plan.state,'review');assert.equal(plan.approvedAt,null);
 const evidence=evidenceForPlan(staged.planId,{storage});
 assert.equal(evidence.sourceCatalog.length,1);assert.equal(evidence.mediaCatalog.length,1);
 assert.equal(evidence.mediaDownloadsIncluded,false);
 assert.equal(JSON.parse(data.get(STAGED_KEY)).source,'manual-editor');
});
test('Guild plan can be staged but cannot replace an approved plan or another review without confirmation',()=>{
 const data=new Map();const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
 const original=stageManualDraft(fixture(),{storage});
 const different=fixture();different.id='different-id';const candidate=guildBundle(different);
 assert.throws(()=>stageBundleForReview(candidate,{storage}),/Another Living School plan/);
 const swapped=stageBundleForReview(candidate,{storage,replace:true,origin:'signed-guild-mesh'});
 assert.ok(swapped.planId!==original.planId);
 assert.equal(JSON.parse(data.get(STAGED_KEY)).source,'signed-guild-mesh');
 const active=JSON.parse(data.get(REVIEW_PLAN_KEY));active.state='approved';active.approvedAt=new Date().toISOString();
 data.set(REVIEW_PLAN_KEY,JSON.stringify(active));
 assert.throws(()=>stageBundleForReview(guildBundle(fixture()),{storage,replace:true}),/approved Living School plan/);
});
test('broken Guild submissions cannot reach the canonical review slot',()=>{
 const bad=guildBundle(fixture());bad.userApprovalRequired=false;
 assert.throws(()=>validateSubmission(bad),/Guild review submission/);
 bad.userApprovalRequired=true;bad.plan.state='approved';bad.plan.approvedAt='2026-01-01T00:00:00Z';
 assert.throws(()=>validateSubmission(bad),/unapproved/);
 const changed=guildBundle(fixture());changed.mediaCatalog[0].url='javascript:alert(1)';
 assert.throws(()=>validateSubmission(changed),/Invalid image or video/);
});
test('review staging rolls back storage on any write failure',()=>{
 const data=new Map();let writes=0;
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>{writes++;if(writes===2)throw Error('simulated quota failure');data.set(k,String(v))},removeItem:k=>data.delete(k)};
 assert.throws(()=>stageManualDraft(fixture(),{storage}),/simulated quota failure/);
 assert.equal(data.get(REVIEW_PLAN_KEY),undefined);
});

test('X4 Pro EPUB export has correct ZIP/EPUB layout and true offline article text',()=>{
 const d=fixture(),epub=exportSeedlingEpub(d);
 assert.ok(epub instanceof Uint8Array);
 assert.equal(Buffer.from(epub.subarray(0,4)).toString('hex'),'504b0304');
 const label=Buffer.from(epub).toString('utf8');
 assert.match(label,/application\/epub\+zip/);
 assert.match(label,/META-INF\/container.xml/);
 assert.match(label,/OEBPS\/content.opf/);
 assert.match(label,/OEBPS\/nav.xhtml/);
 assert.match(label,/Module 1/);
 assert.match(label,/Historical article/);
 assert.match(label,/Demonstration/);
 assert.match(label,/dQw4w9WgXcQ/);
});
test('EPUB optional images enforce actual file signatures',()=>{
 const d=fixture();
 const mediaId=d.media[0].id;
 d.media[0].kind='image';
 const fake=new Uint8Array([0,1,2,3,4]);
 assert.throws(()=>exportSeedlingEpub(d,{images:[{mediaId,name:'fake.png',bytes:fake}]}),/valid PNG or JPEG/);
});

test('Moss companion only uses canonical logged-in chat and never handles Passport tokens',async()=>{
 const calls=[];
 const frame={
  CivweaveHubPassportAccountV1:{identity:()=>({userId:'member-1',credential:'sensitive-secret'}),current:()=>({accountName:'Guild member'})},
  CivweaveGuideChatSurfaceV350:{open:x=>calls.push(['open',x]),submitText:async(...args)=>{calls.push(['submit',...args]);return true}},
  CivweaveSettingsV320:{readState:()=>({provider:'server-auto',model:'account-selected'})},
  CivweaveRealmSessionIntegrityV237:{readThread:system=>({messages:[{id:'1',role:'assistant',text:'Moss response',at:'2026-10-29'}]})}
 };
 assert.equal(sessionStatus(frame).session,true);
 assert.equal(sessionStatus(frame).provider,'server-auto');
 const result=await sendToMoss(frame,'Help me build a garden Learning Journey');
 assert.equal(result.ok,true);
 assert.equal(calls[0][0],'open');
 assert.equal(calls[0][1].guide,'living-school');
 assert.deepEqual(calls[1],['submit','Help me build a garden Learning Journey','living-school',{skipAddress:true}]);
 assert.equal(getMossThread(frame)[0].text,'Moss response');
 assert.match(transcript(result.thread),/Moss response/);
 assert.doesNotMatch(JSON.stringify(result),'sensitive-secret');
 await assert.rejects(()=>sendToMoss({},'Hello'),/Sign in/);
});
test('X4 Pro Wi-Fi plugin is public-only, points to a real public catalog and never carries credentials',()=>{
 const p='public/seedling/crosspoint-plugin/seedling/';
 const m=JSON.parse(fs.readFileSync(p+'manifest.json','utf8'));
 const d=JSON.parse(fs.readFileSync(p+'device.json','utf8'));
 const c=JSON.parse(fs.readFileSync('public/seedling/library-v1.json','utf8'));
 assert.equal(m.name,'seedling');
 assert.equal(c.schema,'civweave.seedling.public-library.v1');
 assert.equal(c.items.length,14);
 assert.equal(d.browse.items,'items');
 assert.equal(d.browse.fields.title,'title');
 assert.equal(d.download.dest_dir,'/Books/Seedling/Updates');
 assert.ok(/^https:\/\/raw\.githubusercontent\.com\//.test(d.browse.url));
 assert.ok(c.items.every(b=>/^https:\/\/www\.gutenberg\.org\/ebooks\/\d+\.epub\.noimages$/.test(b.url)));
 assert.doesNotMatch(JSON.stringify(d)+JSON.stringify(m),/Bearer|password|token|Passport|credential|secret/i);
});
test('Moss companion links to the canonical chat surface and does not mint its own model endpoint',()=>{
 const html=fs.readFileSync('public/app/living-library-seedling-connect-v1.html','utf8');
 assert.match(html,/working-campus-v440\.html/);
 assert.match(html,/sendToMoss\(w,prompt\)/);
 assert.doesNotMatch(html,/\/api\/ai\/|apiKey|Authorization.*Bearer/);
});
