import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRESENCE_KIND,
  PRESENCE_SCHEMA,
  buildNodeCatalog,
  buildPresencePayload,
  createNodeCard,
  extractPresence,
  mergePresenceRecords,
  normalizeNodeUrl,
  normalizeSettings,
  parseNodeCard,
} from '../public/app/shared/commonweave-peer-discovery-core-v219.mjs';

test('normalizes secure node origins and permits local HTTP development',()=>{
  assert.equal(normalizeNodeUrl('https://node.example/path?q=1'),'https://node.example');
  assert.equal(normalizeNodeUrl('http://localhost:8788/api'),'http://localhost:8788');
  assert.throws(()=>normalizeNodeUrl('http://node.example'),/must use HTTPS/);
  assert.throws(()=>normalizeNodeUrl('https://name:secret@node.example'),/cannot contain usernames/);
});

test('normalizes opt-in discovery settings without exposing paired capability tags',()=>{
  const settings=normalizeSettings({
    enabled:true,
    visibility:'paired',
    label:'  Cami  ',
    capabilities:['Teaching','teaching','Woodwork'],
    services:{trades:false},
  });
  assert.deepEqual(settings.capabilities,['teaching','woodwork']);
  assert.equal(settings.services.trades,false);
  const payload=buildPresencePayload({peerId:'device:one',settings,now:0});
  assert.equal(payload.schema,PRESENCE_SCHEMA);
  assert.equal(payload.label,'');
  assert.deepEqual(payload.capabilities,[]);
});

test('deduplicates configured, pairing, and manual node sources',()=>{
  const catalog=buildNodeCatalog({
    configuredNode:{url:'https://node.example',label:'Home'},
    friends:[{id:'peer:a',label:'Rook',nodeUrl:'https://node.example/'},{id:'peer:b',label:'Moss',nodeUrl:'https://other.example'}],
    savedNodes:[{url:'https://other.example/path',label:'Commons',source:'manual'}],
  });
  assert.equal(catalog.length,2);
  assert.equal(catalog[0].url,'https://node.example');
  assert.deepEqual(catalog[0].sources,['configured','pairing']);
  assert.equal(catalog[0].removable,false);
  assert.equal(catalog[1].source,'pairing');
});

test('extracts only self-consistent signed-object-shaped presence envelopes',()=>{
  const object={
    kind:PRESENCE_KIND,
    payload:{schema:PRESENCE_SCHEMA,peerId:'device:friend',visibility:'paired',services:{tasks:true},announcedAt:'2026-08-06T14:00:00.000Z'},
    origin:{nodeId:'device:friend'},
    createdAt:'2026-08-06T14:00:00.000Z',
    updatedAt:'2026-08-06T14:00:00.000Z',
    expiresAt:'2026-08-06T14:12:00.000Z',
  };
  const record=extractPresence({kind:'peer-presence-v1',payload:object},'https://node.example');
  assert.equal(record.peerId,'device:friend');
  assert.equal(record.nodeUrl,'https://node.example');
  assert.equal(extractPresence({kind:'peer-presence-v1',payload:{...object,payload:{...object.payload,peerId:'device:spoof'}}},'https://node.example'),null);
});

test('shows paired-only presence only to known friends and merges shared nodes',()=>{
  const records=[
    {peerId:'device:friend',visibility:'paired',label:'',nodeUrl:'https://one.example',updatedAt:'2026-08-06T14:00:00.000Z',expiresAt:'2026-08-06T15:00:00.000Z',services:{}},
    {peerId:'device:friend',visibility:'paired',label:'',nodeUrl:'https://two.example',updatedAt:'2026-08-06T14:01:00.000Z',expiresAt:'2026-08-06T15:00:00.000Z',services:{}},
    {peerId:'device:stranger',visibility:'paired',label:'Hidden',nodeUrl:'https://one.example',updatedAt:'2026-08-06T14:02:00.000Z',expiresAt:'2026-08-06T15:00:00.000Z',services:{}},
    {peerId:'device:public',visibility:'public',label:'Public Weaver',nodeUrl:'https://one.example',updatedAt:'2026-08-06T14:03:00.000Z',expiresAt:'2026-08-06T15:00:00.000Z',services:{}},
  ];
  const peers=mergePresenceRecords(records,{localPeerId:'device:self',friends:[{id:'device:friend',label:'Trusted Friend'}],now:Date.parse('2026-08-06T14:05:00.000Z')});
  assert.equal(peers.length,2);
  const friend=peers.find(peer=>peer.peerId==='device:friend');
  assert.equal(friend.label,'Trusted Friend');
  assert.deepEqual(friend.nodes,['https://one.example','https://two.example']);
  assert.ok(!peers.some(peer=>peer.peerId==='device:stranger'));
});

test('round-trips node cards while stripping paths and credentials',()=>{
  const card=createNodeCard({url:'https://node.example/api',label:'North Commons'});
  assert.deepEqual(parseNodeCard(JSON.stringify(card)),card);
  assert.equal(parseNodeCard('https://another.example/path').url,'https://another.example');
});
