import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const provenanceSource=await fs.readFile(new URL('../public/app/content-provenance-v1.js',import.meta.url),'utf8'),importSource=await fs.readFile(new URL('../public/creator-suite/shared/import-provenance-v1.js',import.meta.url),'utf8');
const browser=vm.createContext({console,crypto,TextEncoder,TextDecoder,structuredClone,Blob,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},dispatchEvent(){}});browser.globalThis=browser;
vm.runInContext(provenanceSource,browser,{filename:'content-provenance-v1.js'});vm.runInContext(importSource,browser,{filename:'import-provenance-v1.js'});
const provenance=browser.CivweaveContentProvenanceV1,imports=browser.CivweaveCreatorImportProvenanceV1,blob=new Blob([new TextEncoder().encode('external source bytes')],{type:'audio/webm'});
const quarantined=await imports.quarantineFile(blob,{mediaType:'audio',artifactType:'audio',name:'external-source.webm'});
assert.equal(quarantined.schema,'civweave.creator-import-quarantine.v1');assert.equal(quarantined.status,'unknown-origin');assert.match(quarantined.reason,/no trusted creation history/i);
let summary=provenance.summarizeSession(quarantined.session);assert.equal(summary.origin,'unknown');assert.equal(summary.actorCounts.external,1);assert.equal(summary.aiUsed,false);
let session=await provenance.recordEvent(quarantined.session,{type:'audio.cut',actor:{kind:'human',id:'local-creator'},payload:{start:0,end:1}});summary=provenance.summarizeSession(session);assert.equal(summary.origin,'unknown','human editing must not wash an unverified import into human-authored origin');assert.equal(summary.actorCounts.human,1);assert.equal(summary.actorCounts.external,1);
session=await provenance.recordEvent(session,{type:'audio.gain',actor:{kind:'deterministic',id:'creator-suite'},payload:{gain:0.8}});assert.equal(provenance.summarizeSession(session).origin,'unknown','deterministic transforms must not wash unknown imported origin');
session=await provenance.recordEvent(session,{type:'ai.transform',actor:{kind:'civweave-ai',id:'weaveling',provider:'test',model:'test',requestId:'req'},payload:{operation:'denoise'}});summary=provenance.summarizeSession(session);assert.equal(summary.origin,'ai-generated','tracked Civweave AI transformation must remain visible even when the source import was unknown');assert.equal(summary.aiUsed,true);
const serialized=JSON.stringify(quarantined.session);assert.equal(serialized.includes('external source bytes'),false,'raw imported bytes must not enter provenance history');
console.log('Creator import quarantine origin invariant passed');
