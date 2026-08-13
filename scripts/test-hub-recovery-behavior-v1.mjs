import assert from 'node:assert/strict';
import { HubAccountRecoveryService } from '../cloudflare/account-edge/src/hub-account-recovery-v1.mjs';
class Storage{constructor(){this.map=new Map()}async get(k){return this.map.get(k)}async put(k,v){if(k&&typeof k==='object'&&v===undefined){for(const [a,b] of Object.entries(k))this.map.set(a,structuredClone(b));return}this.map.set(k,structuredClone(v))}}
const mail=[];let now=Date.parse('2026-08-13T22:00:00Z');
const service=new HubAccountRecoveryService({storage:new Storage()},{},{vaultSecret:'test-node-recovery-key-material-1234567890',now:()=>now,deliver:async(_env,msg)=>{mail.push(msg);return{sent:true,transport:'test'}}});
const login='x'.repeat(48),userId='cwres:resident-1234567890';
const created=await service.signup('garden-a',{userId,credential:login,email:'person@example.com',passportId:'passport:alpha-123'});
assert.equal(created.account.emailVerified,false);assert.ok(!JSON.stringify(created).includes(login));
const code=mail[0].text.split('\n').find(x=>/^[A-Za-z0-9_-]{40,200}$/.test(x));
assert.equal((await service.verifyEmail(code)).account.emailVerified,true);await assert.rejects(()=>service.verifyEmail(code));
const known=await service.requestRecovery({email:'person@example.com'}),unknown=await service.requestRecovery({email:'nobody@example.net'});assert.deepEqual(known,unknown);
const recovery=mail[1].text.split('\n').find(x=>/^[A-Za-z0-9_-]{40,200}$/.test(x)),restored=await service.completeRecovery(recovery);assert.equal(restored.userId,userId);assert.equal(restored.credential,login);assert.deepEqual(restored.passportIds,['passport:alpha-123']);await assert.rejects(()=>service.completeRecovery(recovery));
now+=61_000;await service.signup('garden-a',{userId,credential:login,email:'person@example.com',passportId:'passport:beta-456'});assert.deepEqual((await service.status({userId,credential:login})).account.passportIds,['passport:alpha-123','passport:beta-456']);
console.log(JSON.stringify({ok:true,schema:'civweave.hub-recovery-behavior.v1'}));
