import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=await fs.readFile(new URL('../public/app/content-provenance-v1.js',import.meta.url),'utf8');
const context={crypto:webcrypto,TextEncoder,TextDecoder,structuredClone,console,Date,JSON,Object,Array,Set,Map,Promise,Uint8Array,CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},dispatchEvent(){return true}};context.globalThis=context;vm.runInNewContext(source,context,{filename:'content-provenance-v1.js'});const api=context.CivweaveContentProvenanceV1;
let session=api.createSession({id:'attack-session',mediaType:'text',artifactType:'document',sourceSystem:'creator-suite'});session=await api.recordEvent(session,{type:'text.insert',actor:{kind:'human',id:'h1'},payload:{length:4,content:'SECRET RAW TEXT',contentDigest:'sha256:a'}});session=await api.recordEvent(session,{type:'ai.generate',actor:{kind:'civweave-ai',id:'kamiya',provider:'p',model:'m',requestId:'r'},payload:{acceptedLength:8,prompt:'PRIVATE PROMPT',output:'PRIVATE OUTPUT',outputDigest:'sha256:b'}});session=await api.recordEvent(session,{type:'text.replace',actor:{kind:'human',id:'h1'},payload:{length:5,contentDigest:'sha256:c'}});assert.equal((await api.verifySession(session)).valid,true);assert.equal(JSON.stringify(session).includes('SECRET RAW TEXT'),false);assert.equal(JSON.stringify(session).includes('PRIVATE PROMPT'),false);assert.equal(JSON.stringify(session).includes('PRIVATE OUTPUT'),false);
for(const mutate of [
 s=>{s.events[0].actor.id='forged'},
 s=>{s.events.splice(1,1)},
 s=>{[s.events[0],s.events[1]]=[s.events[1],s.events[0]]},
 s=>{s.events[1].previousHash='0'.repeat(64)},
 s=>{s.headHash='f'.repeat(64)},
 s=>{s.events.push({...s.events[2],id:'forged',seq:4,hash:'0'.repeat(64)})}
]){const attacked=structuredClone(session);mutate(attacked);assert.equal((await api.verifySession(attacked)).valid,false)}
const finalized=await api.finalizeSession(session,{id:'a',metadata:{}});await assert.rejects(()=>api.recordEvent(finalized.session,{type:'text.insert',actor:{kind:'human',id:'h1'},payload:{length:1}}),/immutable/);
let external=api.createSession({id:'external',mediaType:'video'});external=await api.recordEvent(external,{type:'external.import',actor:{kind:'external',id:'file'},payload:{contentDigest:'sha256:x'}});assert.equal(api.summarizeSession(external).origin,'unknown');console.log('Content provenance adversarial contract passed');
