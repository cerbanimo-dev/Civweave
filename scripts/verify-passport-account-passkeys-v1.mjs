import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PassportAccountService } from '../cloudflare/account-edge/src/hub-passport-account-v1.mjs';
import { CivweaveAccountDirectory } from '../cloudflare/node-cloud/src/account-directory-v1.mjs';

class MemoryStorage {
  constructor(){this.map=new Map();}
  async get(key){return this.map.get(key);}
  async put(key,value){if(key&&typeof key==='object'&&!Array.isArray(key)){for(const [k,v] of Object.entries(key))this.map.set(k,v);}else this.map.set(key,value);}
  async delete(key){this.map.delete(key);}
}
const token=()=>crypto.getRandomValues(new Uint8Array(32)).reduce((s,b)=>s+(b%36).toString(36),'').slice(0,48).padEnd(48,'x');
const state={storage:new MemoryStorage()};
const service=new PassportAccountService(state,{}, {vaultSecret:'test-vault-secret-that-is-long-enough'});
const created=await service.ensureAccount('civweave-cloud',{userId:'resident:test:000001',passportId:'passport:test:000001',credential:token()});
assert.equal(created.ok,true);
assert.match(created.account.accountName,/^weave-[a-z0-9]{9}$/);
assert.equal(created.account.recoveryEmailSet,false);
assert.equal(created.account.mailboxManaged,true);
assert.equal(JSON.stringify(created.account).includes('@relay.cerbanimo.cc'),false,'hidden mailbox leaked into public account payload');
assert.equal(JSON.stringify(created.account).includes('hiddenMailbox'),false,'hidden mailbox field leaked into public account payload');

let delivered=null;
const directoryState={storage:new MemoryStorage()};
const directory=new CivweaveAccountDirectory(directoryState,{CERBANIMO_MAIL:{async sendRecovery(message){delivered=message;return{ok:true};}}});
const first=await directory.begin({email:'person@example.com'});
assert.equal(first.ok,true);assert.equal(first.accepted,true);assert.ok(first.challengeToken);assert.equal('existing' in first,false,'begin response must not reveal account existence');
const code=String(delivered?.text||'').match(/\b(\d{6})\b/)?.[1];assert.ok(code,'test mail did not contain six digit code');
const verified=await directory.verify({challengeToken:first.challengeToken,code});
assert.equal(verified.existing,false);assert.ok(verified.proofToken);
const claim=await directory.claim({proofToken:verified.proofToken,locator:{origin:'https://civweave.cc',nodeId:'civweave-cloud',accountId:created.account.accountId,accountName:created.account.accountName}});
assert.equal(claim.existing,false);
const second=await directory.begin({email:'person@example.com'});const secondCode=String(delivered?.text||'').match(/\b(\d{6})\b/)?.[1];const secondVerified=await directory.verify({challengeToken:second.challengeToken,code:secondCode});
assert.equal(secondVerified.existing,true);assert.equal(secondVerified.locator.accountId,created.account.accountId);

const root=path.resolve(import.meta.dirname,'..');
const client=fs.readFileSync(path.join(root,'public/app/hub-passport-account-v1.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/app/hub-recovery-ui-v1.js'),'utf8');
const server=fs.readFileSync(path.join(root,'cloudflare/account-edge/src/hub-passport-account-v1.mjs'),'utf8');
const cloudConfig=fs.readFileSync(path.join(root,'cloudflare/node-cloud/wrangler.jsonc'),'utf8');
const mail=fs.readFileSync(path.join(root,'cloudflare/cerbanimo-mail/src/index.mjs'),'utf8');
assert.match(client,/navigator\.credentials\.create/);assert.match(client,/navigator\.credentials\.get/);assert.match(client,/passport-link\/authenticate/);assert.match(client,/CivweaveHostNodeSessionImportV1/);
assert.match(server,/verifiedAttestationSpki/);assert.match(server,/user verification and attested credential data/);assert.match(server,/recoveryMethod: 'email\+existing-passkey'/);
assert.doesNotMatch(ui,/Add a recovery email before creating this Hub account/);assert.match(ui,/outside recovery email is optional/i);assert.match(ui,/email proof plus an existing account passkey/i);
assert.match(cloudConfig,/"ACCOUNT_DIRECTORY"/);assert.match(cloudConfig,/"CERBANIMO_MAIL"/);assert.match(cloudConfig,/"new_sqlite_classes"\s*:\s*\["CivweaveAccountDirectory"\]/);
assert.match(mail,/extends WorkerEntrypoint/);assert.match(mail,/async sendRecovery/);assert.doesNotMatch(mail,/pathname === ['"]\/api\/send/);
console.log(JSON.stringify({ok:true,schema:'civweave.passport-account-passkeys.verify.v1',accountName:created.account.accountName,noEmailRequired:true,hiddenMailboxNotExposed:true,existingEmailRequiresVerifiedProofThenPasskey:true,internalMailRpc:true},null,2));
