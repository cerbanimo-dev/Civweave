import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PassportAccountService } from '../cloudflare/account-edge/src/hub-passport-account-v4.mjs';
import { CivweaveCapacityAccount } from '../cloudflare/node-cloud/src/capacity-membership-admin-v1.mjs';
import { createLocalHubAccountStore } from '../lib/local-hub-account-v1.mjs';
import { createLocalHostCapacityStore } from '../lib/local-host-capacity-v2.mjs';
import os from 'node:os';
import fsp from 'node:fs/promises';

class MemoryStorage {
  constructor(){this.map=new Map();}
  async get(key){return this.map.get(key);}
  async put(key,value){if(key&&typeof key==='object'&&!Array.isArray(key)){for(const [k,v] of Object.entries(key))this.map.set(k,v);}else this.map.set(key,value);}
  async delete(key){this.map.delete(key);}
  async list({prefix=''}={}){return new Map([...this.map.entries()].filter(([key])=>String(key).startsWith(prefix)));}
}
const BASE32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function fromBase32(text){let bits=0,value=0;const out=[];for(const char of String(text).toUpperCase().replace(/=+$/g,'')){const i=BASE32.indexOf(char);if(i<0)throw new Error('bad base32');value=(value<<5)|i;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}return Buffer.from(out)}
function totp(secret,now=Date.now()){const counter=Math.floor(now/30000),bytes=Buffer.alloc(8);bytes.writeBigUInt64BE(BigInt(counter));const digest=crypto.createHmac('sha1',fromBase32(secret)).update(bytes).digest(),offset=digest[digest.length-1]&15,binary=digest.readUInt32BE(offset)&0x7fffffff;return String(binary%1_000_000).padStart(6,'0')}
const token=()=>crypto.randomBytes(32).toString('base64url');

// Cloud account: one canonical account/seat identity, custom username, recovery kit,
// TOTP fallback, ten paired devices, and two active devices.
const storage=new MemoryStorage(),state={storage},now=Date.now();
const service=new PassportAccountService(state,{}, {vaultSecret:'test-vault-secret-that-is-long-enough',now:()=>now});
const identity={userId:'cwres:test:000001',credential:token(),passportId:'passport:test:000001',deviceId:'cwdev:test:000001',deviceLabel:'Test phone'};
const created=await service.ensureAccount('civweave-cloud',{...identity,accountName:'cami-weave'});
assert.equal(created.account.accountName,'cami-weave');
assert.equal(created.account.pairedDeviceCount,1);
assert.equal(created.account.activeDeviceCount,0);
assert.equal(created.account.onlineMembershipReady,false);
assert.equal(created.account.offlineMembershipReady,false);
assert.equal(created.recoveryKit.codes.length,8);
const totpSetup=await service.beginTotp(identity);
await service.verifyTotp({...identity,code:totp(totpSetup.secret,now)});
await service.acknowledgeRecoveryKit(identity);
let readiness=await service.membershipReadiness(identity);
assert.equal(readiness.account.offlineMembershipReady,true);
assert.equal(readiness.account.onlineMembershipReady,false);
const accountKey=`hub-account:${created.account.accountId}`;
const stored=await storage.get(accountKey);
await storage.put(accountKey,Object.freeze({...stored,recoveryEmail:'person@example.com',recoveryEmailVerifiedAt:new Date(now).toISOString()}));
readiness=await service.membershipReadiness(identity);
assert.equal(readiness.account.onlineMembershipReady,true);

const auth1=await service.authorizeSession({...identity,totpCode:totp(totpSetup.secret,now)});
assert.equal(auth1.account.activeDeviceCount,1);
const device2={...identity,deviceId:'cwdev:test:000002',deviceLabel:'Laptop'};
const auth2=await service.authorizeSession({...device2,totpCode:totp(totpSetup.secret,now)});
assert.equal(auth2.account.activeDeviceCount,2);
const device3={...identity,deviceId:'cwdev:test:000003',deviceLabel:'Tablet'};
await assert.rejects(()=>service.authorizeSession({...device3,totpCode:totp(totpSetup.secret,now)}),error=>error?.code==='active-device-limit'&&error?.status===409);
const auth3=await service.authorizeSession({...device3,replaceDeviceId:identity.deviceId,totpCode:totp(totpSetup.secret,now)});
assert.equal(auth3.account.activeDeviceCount,2);
assert.equal(auth3.account.devices.find(row=>row.deviceId===identity.deviceId)?.active,false);
for(let i=4;i<=10;i+=1)await service.ensureAccount('civweave-cloud',{...identity,accountName:'cami-weave',deviceId:`cwdev:test:${String(i).padStart(6,'0')}`,deviceLabel:`Device ${i}`});
await assert.rejects(()=>service.ensureAccount('civweave-cloud',{...identity,accountName:'cami-weave',deviceId:'cwdev:test:000011',deviceLabel:'Device 11'}),error=>error?.code==='paired-device-limit'||/10 paired devices/i.test(error?.message||''));

// Device-bound capacity token dies immediately when its paired device is deactivated.
const sessionToken=`session.${token()}.${token()}`;
await service.bindCapacitySession({userId:identity.userId,deviceId:device2.deviceId,token:sessionToken,expiresAt:new Date(now+60_000).toISOString()});
assert.equal((await service.checkCapacitySession({token:sessionToken})).active,true);
await service.deactivateDevice({...identity,deviceId:device2.deviceId});
await assert.rejects(()=>service.checkCapacitySession({token:sessionToken}),error=>error?.code==='device-session-deactivated'&&error?.status===401);

// Capacity counts the canonical account userId once and frees it on Steward removal.
const capacityStorage=new MemoryStorage(),capacityState={storage:capacityStorage};
await capacityStorage.put('config',{schema:'civweave.host-capacity.v2',workersPlan:'free',hostNodeIds:['civweave-cloud'],operatingReserveMicrocents:0,communityEndowmentMicrocents:0,communityTopupReserveMicrocents:0,creditReserveMicrocents:0,updatedAt:new Date(now).toISOString()});
const capacity=new CivweaveCapacityAccount(capacityState,{CIVWEAVE_WORKERS_PLAN:'free'});
const admitted=await capacity.admitMember({nodeId:'civweave-cloud',userId:identity.userId,seatClass:'community',billingStatus:'free',loginCredentialHash:'a'.repeat(64)});
assert.equal(admitted.idempotent,false);
const reconnect=await capacity.admitMember({nodeId:'civweave-cloud',userId:identity.userId,seatClass:'community',billingStatus:'free',loginCredentialHash:'a'.repeat(64)});
assert.equal(reconnect.idempotent,true,'same account reconnect consumed another seat');
await capacity.annotateMember({nodeId:'civweave-cloud',userId:identity.userId,accountId:created.account.accountId,accountName:'cami-weave',passportIds:['passport:test:000001','passport:test:000002']});
assert.equal((await capacity.listMembers({nodeId:'civweave-cloud'})).members.length,1);
const removed=await capacity.removeMember({nodeId:'civweave-cloud',userId:identity.userId,blockRejoin:true});
assert.equal(removed.removed,true);assert.equal(removed.capacity.memberCount,0);
await assert.rejects(()=>capacity.admitMember({nodeId:'civweave-cloud',userId:identity.userId,seatClass:'community',billingStatus:'free',loginCredentialHash:'a'.repeat(64)}),error=>error?.status===403);

// Physical LAN Hub: account setup and admission remain possible with no internet at all.
const temp=await fsp.mkdtemp(path.join(os.tmpdir(),'civweave-local-account-'));
try{
  let localNow=now;
  const localAccounts=createLocalHubAccountStore({dataDir:temp,nodeId:'cw:test-local-node',now:()=>localNow});
  const localCapacity=createLocalHostCapacityStore({dataDir:temp,nodeId:'cw:test-local-node',communitySeatLimit:2,paidExpansionSeatLimit:2,now:()=>localNow});
  const localCreated=await localAccounts.create({accountName:'offline-cami',recoveryEmail:'offline@example.com',passportId:'passport:offline:0001',deviceId:'cwdev:offline:0001',deviceLabel:'Offline phone'});
  assert.equal(localCreated.account.recoveryEmailVerificationPending,true);
  assert.equal(localCreated.recoveryKit.codes.length,8);
  await localAccounts.verifyTotpSetup({accountName:'offline-cami',credential:localCreated.credential,code:totp(localCreated.totp.secret,localNow)});
  await localAccounts.acknowledgeRecoveryKit({accountName:'offline-cami',credential:localCreated.credential});
  const localAuth=await localAccounts.authorize({accountName:'offline-cami',credential:localCreated.credential,totpCode:totp(localCreated.totp.secret,localNow),passportId:'passport:offline:0001',deviceId:'cwdev:offline:0001',deviceLabel:'Offline phone'});
  assert.equal(localAuth.account.offlineMembershipReady,true);
  const firstSeat=await localCapacity.admit({residentId:localAuth.accountId,userId:localAuth.accountId,seatClass:'community',billingStatus:'free'});
  const secondPassportAuth=await localAccounts.authorize({accountName:'offline-cami',credential:localCreated.credential,totpCode:totp(localCreated.totp.secret,localNow),passportId:'passport:offline:0002',deviceId:'cwdev:offline:0001',deviceLabel:'Offline phone'});
  const sameSeat=await localCapacity.admit({residentId:secondPassportAuth.accountId,userId:secondPassportAuth.accountId,seatClass:'community',billingStatus:'free'});
  assert.equal(firstSeat.idempotent,false);assert.equal(sameSeat.idempotent,true,'second Passport consumed another local seat');
  assert.equal((await localCapacity.snapshot()).counts.communityMembers,1);
}finally{await fsp.rm(temp,{recursive:true,force:true});}

const root=path.resolve(import.meta.dirname,'..');
const ui=fs.readFileSync(path.join(root,'public/app/hub-recovery-ui-v1.js'),'utf8');
const localUi=fs.readFileSync(path.join(root,'public/app/host-node-local-capacity-v1.js'),'utf8');
const client=fs.readFileSync(path.join(root,'public/app/hub-passport-account-v1.js'),'utf8');
const federated=fs.readFileSync(path.join(root,'server/federated.mjs'),'utf8');
const worker=fs.readFileSync(path.join(root,'cloudflare/node-cloud/wrangler.jsonc'),'utf8');
assert.match(ui,/Annual Member Rebate/);assert.match(ui,/10 paired devices/);assert.match(ui,/2 active/);assert.match(ui,/recovery email/i);assert.match(ui,/Two-factor authentication/);
assert.match(client,/connectStripe/);assert.match(client,/stripe\/onboard/);assert.match(localUi,/Internet is optional here/);assert.match(localUi,/Authenticator 2FA/);
assert.match(federated,/createLocalHubAccountStore/);assert.match(federated,/localHubAccounts\.authorize/);assert.match(worker,/server-ai-entry-v8\.mjs/);
console.log(JSON.stringify({ok:true,schema:'civweave.hub-account-lifecycle.verify.v2',cloud:{username:true,recoveryKit:true,totp:true,maxPairedDevices:10,maxActiveDevices:2,deviceRevocation:true,stableSeat:true,stewardRemoval:true},local:{internetRequired:false,recoveryEmailRecorded:true,recoveryKit:true,totp:true,stableSeatAcrossPassports:true},stripe:{memberAccountSurface:true,annualMemberRebateCopy:true}},null,2));
