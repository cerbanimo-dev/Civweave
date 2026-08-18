import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { verifyCreationPacket } from '../lib/creator-provenance-packet-verify-v1.mjs';

const source=await fs.readFile(new URL('../public/app/content-provenance-v1.js',import.meta.url),'utf8');
const context=vm.createContext({console,crypto,TextEncoder,TextDecoder,structuredClone,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},dispatchEvent(){}});context.globalThis=context;
vm.runInContext(source,context,{filename:'content-provenance-v1.js'});
const api=context.CivweaveContentProvenanceV1;
let session=api.createSession({id:'creation:verify-vector',mediaType:'text',artifactType:'document',sourceSystem:'creator-suite',startedAt:'2026-08-18T12:00:00.000Z'});
session=await api.recordEvent(session,{id:'event:1',timestamp:'2026-08-18T12:00:01.000Z',type:'text.insert',actor:{kind:'human',id:'creator'},payload:{length:5,contentDigest:'sha256:x',text:'private'}});
session=await api.recordEvent(session,{id:'event:2',timestamp:'2026-08-18T12:00:02.000Z',type:'ai.generate',actor:{kind:'civweave-ai',id:'kamiya',provider:'device-local',model:'gemma',requestId:'req:1'},payload:{acceptedLength:8,outputDigest:'sha256:y',output:'private'}});
const packet=await api.makePacket(session);
assert.equal((await verifyCreationPacket(packet)).valid,true);
assert.equal('text'in packet.events[0].payload,false);
assert.equal('output'in packet.events[1].payload,false);

const tampered=structuredClone(packet);tampered.events[0].payload.length=500;
assert.equal((await verifyCreationPacket(tampered)).reason,'event-hash-mismatch');
const packetHash=structuredClone(packet);packetHash.summary.origin='human-authored';
assert.equal((await verifyCreationPacket(packetHash)).reason,'packet-hash-mismatch');
const reordered=structuredClone(packet);reordered.events.reverse();
assert.equal((await verifyCreationPacket(reordered)).reason,'sequence-mismatch');

console.log('Shared Creator provenance packet verifier matches browser producer');
