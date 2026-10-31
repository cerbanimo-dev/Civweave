import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountProductionReview} from '../public/app/shared/worldweaver-production-review-v1.mjs';
import {exportArtCraftTrailerPackage} from '../public/app/shared/worldweaver-filmcraft-interchange-v1.mjs';
function fixture(t){
 const dom=new JSDOM('<section id="review"></section>',{url:'https://civweave.test'});t.after(()=>dom.window.close());const document=dom.window.document;
 const state={schema:'civweave.performance-studio.v1',revision:4,project:{id:'project-1',title:'Synthetic',sourceTitle:'Synthetic story',rights:'owned'},sources:[{id:'source-1',chapter:'Synthetic',text:'PRIVATE',sourceRef:'book:synthetic'}],proposals:[{id:'scene-1',status:'review-required',title:'Synthetic scene',synopsis:'Synthetic action.',sourceIds:['source-1'],dialogue:[{character:'hero',text:'A synthetic line.',direction:'Quietly',seconds:4}],set:{location:'Synthetic court',mood:'Curious',color:'#345678',props:[{id:'gate',name:'Gate',shape:'box',x:2,y:3,height:5,width:3,depth:1,color:'#998877'}],light:'Soft',ambience:'Quiet'},visualDirection:'Original shapes.'}],stagePlans:[],casts:[]};
 let plan={frameRate:30,shots:[{id:'shot-1',sceneId:'scene-1',inFrame:0,outFrame:900,dialogue:[{lineIndex:0,inFrame:0,outFrame:120}],blocking:[{character:'hero',inFrame:0,outFrame:120,from:{x:110,y:120,z:0},to:{x:120,y:120,z:0},action:'walk',description:'Approach.'}],camera:{framing:'wide',movement:'locked',description:'Readable shot.'},lighting:'Warm light',sound:[{id:'wind',kind:'ambience',inFrame:0,outFrame:900,description:'Quiet wind.'}],screenCues:[{inFrame:780,outFrame:900,text:'Synthetic title.'}]}]};
 const applied=[],sceneEdits=[],errors=[],frames=[];document.addEventListener('civweave:trailer-preview-frame',event=>frames.push(event.detail));
 const component=mountProductionReview({root:document.getElementById('review'),document,getState:()=>structuredClone(state),getPlan:()=>structuredClone(plan),getPackage:()=>exportArtCraftTrailerPackage(state,plan),getImportReceipt:()=>({authenticatedProducer:false}),applyPlan:next=>{exportArtCraftTrailerPackage(state,next);plan=structuredClone(next);applied.push(plan)},applyScenePatch:patch=>{sceneEdits.push(patch)},getRigRequirements:()=>plan.rigRequirements||[],setRigRequirements:rows=>{const next={...plan,rigRequirements:rows};exportArtCraftTrailerPackage(state,next);plan=next},onError:error=>errors.push(error.message)});
 component.refresh();return{document,win:dom.window,component,applied,sceneEdits,errors,frames,plan:()=>plan,$:id=>document.getElementById(id),tab:key=>document.querySelector(`[data-review-tab="${key}"]`),submit:id=>document.getElementById(id).dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}))};
}
test('all production file types have semantic device review tabs and immutable receipts stay clearly labelled',t=>{
 const f=fixture(t);for(const key of ['script','timeline','sets','rigs','blocking','direction','captions','receipts'])assert.ok(f.tab(key));assert.match(f.$('production-device-status').textContent,/proposed|review/i);assert.ok(f.document.querySelector('[role="tabpanel"]'));
 f.tab('receipts').click();assert.match(f.$('production-receipts').textContent,/authenticatedProducer/);assert.match(f.document.getElementById('production-panel-receipts').textContent,/read.only|immutable/i);
});
test('blocking fields save through the mapped plan, invalid timing preserves form input, and scrubbing emits a bounded preview request',t=>{
 const f=fixture(t);f.tab('blocking').click();f.$('production-blocking-from-x').value='114';f.submit('production-blocking-form');assert.equal(f.applied.length,1);assert.equal(f.plan().shots[0].blocking[0].from.x,114);
 f.$('production-blocking-out').value='901';f.submit('production-blocking-form');assert.equal(f.applied.length,1);assert.equal(f.$('production-blocking-out').value,'901');assert.ok(f.errors.length);
 f.$('production-review-frame').value='60';f.$('production-review-frame').dispatchEvent(new f.win.Event('input',{bubbles:true}));assert.equal(f.frames.at(-1).frame,60);assert.equal(f.frames.at(-1).sceneId,'scene-1');assert.equal(f.frames.at(-1).shotId,'shot-1');
});
test('script, set, camera, sound and title edits use structured forms without approving or executing artifacts',t=>{
 const f=fixture(t);f.$('production-script-text').value='A revised synthetic line.';f.submit('production-script-form');assert.equal(f.sceneEdits.at(-1).line.text,'A revised synthetic line.');
 f.tab('sets').click();f.$('production-set-location').value='Revised court';f.submit('production-set-form');assert.equal(f.sceneEdits.at(-1).set.location,'Revised court');
 f.tab('direction').click();f.$('production-camera-description').value='A careful dolly toward the gate.';f.$('production-sound-description').value='Gentle wind.';f.submit('production-direction-form');assert.equal(f.plan().shots[0].camera.description,'A careful dolly toward the gate.');assert.equal(f.plan().shots[0].sound[0].description,'Gentle wind.');
 f.tab('captions').click();f.$('production-title-text').value='A revised title';f.submit('production-title-form');assert.equal(f.plan().shots[0].screenCues[0].text,'A revised title');assert.ok(f.applied.every(plan=>plan.producerAuthorization===undefined));
});
test('script scene fields submit an explicit metadata patch with the canonical character bounds',t=>{
 const f=fixture(t);assert.equal(f.$('production-scene-title').maxLength,140);assert.equal(f.$('production-scene-synopsis').maxLength,1100);assert.equal(f.$('production-scene-visual-direction').maxLength,800);
 assert.equal(f.$('production-scene-title').value,'Synthetic scene');assert.equal(f.$('production-scene-synopsis').value,'Synthetic action.');assert.equal(f.$('production-scene-visual-direction').value,'Original shapes.');
 f.$('production-scene-title').value='A revised scene';f.$('production-scene-synopsis').value='An explicit new proposed action.';f.$('production-scene-visual-direction').value='Scruffy fabric and mismatched table tennis ball eyes.';f.submit('production-scene-form');
 assert.deepEqual(f.sceneEdits.at(-1),{sceneId:'scene-1',title:'A revised scene',synopsis:'An explicit new proposed action.',visualDirection:'Scruffy fabric and mismatched table tennis ball eyes.'});assert.equal(f.applied.length,0);
});
test('rig requirements have a visible schematic and edit proposed metadata rather than casting or loading a skeleton',t=>{
 const f=fixture(t);f.tab('rigs').click();assert.ok(f.$('production-rig-diagram').querySelector('svg'));assert.match(f.$('production-rig-diagram').textContent,/schematic|proposed/i);
 f.$('production-rig-appearance').value='Original layered fabric and a readable silhouette.';f.document.querySelector('[data-add-rig-control]').click();f.document.querySelector('[name=controlName]').value='root-control';f.document.querySelector('[name=controlMin]').value='0';f.document.querySelector('[name=controlMax]').value='1';f.submit('production-rig-form');assert.equal(f.plan().rigRequirements[0].character,'hero');assert.match(f.plan().rigRequirements[0].appearanceNotes,/layered fabric/);assert.equal(f.plan().rigRequirements[0].status,undefined);assert.equal(f.plan().rigRequirements[0].skeleton.controls[0].name,'root-control');
});
test('abstract effect rigs can save a zero leg ratio and GUI proportion bounds match the canonical requirement validator',t=>{
 const f=fixture(t);f.tab('rigs').click();f.$('production-rig-body').value='other';f.$('production-rig-body').dispatchEvent(new f.win.Event('input',{bubbles:true}));f.$('production-rig-legToBodyRatio').value='0';assert.ok(f.$('production-rig-form').checkValidity(),'zero leg ratio is valid for abstract effects');f.submit('production-rig-form');assert.equal(f.plan().rigRequirements[0].proportions.legToBodyRatio,0);assert.equal(f.plan().rigRequirements[0].bodyType,'other');assert.match(f.$('production-rig-diagram').textContent,/volume|effect/i);
 const bounds={heightMeters:['0.05','20'],headToBodyRatio:['0.02','1'],armSpanMeters:['0.05','40'],legToBodyRatio:['0','1']};for(const [key,[min,max]]of Object.entries(bounds)){assert.equal(f.$('production-rig-'+key).min,min);assert.equal(f.$('production-rig-'+key).max,max)}
 const before=structuredClone(f.plan());f.$('production-rig-legToBodyRatio').value='1.1';assert.equal(f.$('production-rig-form').checkValidity(),false);f.submit('production-rig-form');assert.deepEqual(f.plan(),before);assert.ok(f.errors.length);
});
