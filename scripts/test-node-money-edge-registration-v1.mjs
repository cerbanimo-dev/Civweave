import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicRegistrationCallback } from '../lib/node-money-edge-http-v1.mjs';

const publicLookup=async()=>[{address:'93.184.216.34',family:4}];

test('money-edge registration accepts only HTTPS callbacks that resolve publicly',async()=>{
  assert.equal(await assertPublicRegistrationCallback('https://node.example/path',{lookup:publicLookup}),'https://node.example');
  await assert.rejects(()=>assertPublicRegistrationCallback('http://node.example',{lookup:publicLookup}),/must use HTTPS/i);
  await assert.rejects(()=>assertPublicRegistrationCallback('https://localhost',{lookup:publicLookup}),/public hostname/i);
  await assert.rejects(()=>assertPublicRegistrationCallback('https://127.0.0.1',{lookup:publicLookup}),/public internet/i);
  await assert.rejects(()=>assertPublicRegistrationCallback('https://10.1.2.3',{lookup:publicLookup}),/public internet/i);
  await assert.rejects(()=>assertPublicRegistrationCallback('https://[::1]',{lookup:publicLookup}),/public internet/i);
  await assert.rejects(()=>assertPublicRegistrationCallback('https://node.example',{lookup:async()=>[{address:'192.168.1.10',family:4}]}),/public internet/i);
  await assert.rejects(()=>assertPublicRegistrationCallback('https://node.example',{lookup:async()=>[{address:'93.184.216.34',family:4},{address:'10.0.0.8',family:4}]}),/public internet/i);
});

test('money-edge registration refuses non-address DNS responses',async()=>{
  await assert.rejects(()=>assertPublicRegistrationCallback('https://node.example',{lookup:async()=>[]}),/did not resolve/i);
  await assert.rejects(()=>assertPublicRegistrationCallback('https://node.example',{lookup:async()=>[{address:'not-an-ip'}]}),/invalid IP/i);
});
