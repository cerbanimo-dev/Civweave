import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { NodeAiBootstrapStore } from '../lib/node-ai-bootstrap-v1.mjs';
import { loadOrCreateMoneyEdgeIdentity } from '../lib/node-money-edge-bootstrap-v1.mjs';

const pair=()=>{const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');return{publicKey:publicKey.export({type:'spki',format:'pem'}).toString().trim(),privateKey:privateKey.export({type:'pkcs8',format:'pem'}).toString().trim()}};

test('new node creates a stable local identity and operational secrets without environment provisioning',()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'cw-node-bootstrap-'));
  const filePath=path.join(dir,'node.json');
  try{
    const first=new NodeAiBootstrapStore({filePath,env:{},now:()=>1_700_000_000_000});
    const a=first.state;
    assert.match(a.nodeId,/^node-[a-f0-9]{24}$/);
    assert.match(a.operatorId,/^operator-[a-f0-9]{24}$/);
    assert.match(a.receiptPrivateKey,/BEGIN PRIVATE KEY/);
    assert.match(a.receiptPublicKey,/BEGIN PUBLIC KEY/);
    for(const value of [a.authSecret,a.internalSecret,a.capabilitySecret,a.paymentWebhookSecret]) assert.ok(Buffer.byteLength(value)>=32);
    const payload=Buffer.from('civweave-node-bootstrap-proof');
    const signature=crypto.sign(null,payload,a.receiptPrivateKey);
    assert.equal(crypto.verify(null,payload,a.receiptPublicKey,signature),true);
    assert.equal(statSync(filePath).mode&0o777,0o600);

    const second=new NodeAiBootstrapStore({filePath,env:{},now:()=>1_700_000_010_000});
    const b=second.state;
    assert.equal(b.nodeId,a.nodeId);
    assert.equal(b.operatorId,a.operatorId);
    assert.equal(b.receiptPrivateKey,a.receiptPrivateKey);
    assert.equal(b.receiptPublicKey,a.receiptPublicKey);
    assert.equal(b.authSecret,a.authSecret);
    assert.equal(b.internalSecret,a.internalSecret);
    assert.equal(b.capabilitySecret,a.capabilitySecret);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('node pins the HTTPS-discovered money-edge public key and refuses silent trust-root replacement',()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'cw-node-trust-'));
  const filePath=path.join(dir,'node.json');
  try{
    const node=new NodeAiBootstrapStore({filePath,env:{CIVWEAVE_MONEY_EDGE_URL:'https://edge.example'},now:()=>1_700_000_000_000});
    const edge=pair(),other=pair();
    const fingerprint=crypto.createHash('sha256').update(edge.publicKey).digest('hex');
    const pinned=node.pinMoneyEdgeTrust({publicKey:edge.publicKey,keyId:'edge-key',fingerprint,origin:'https://edge.example'});
    assert.equal(pinned.moneyEdgeTrustPinned,true);
    assert.equal(pinned.moneyEdgeFingerprint,fingerprint);
    const reload=new NodeAiBootstrapStore({filePath,env:{},now:()=>1_700_000_001_000});
    assert.equal(reload.state.moneyEdgePublicKey,edge.publicKey);
    assert.throws(()=>reload.pinMoneyEdgeTrust({publicKey:other.publicKey,origin:'https://edge.example'}),/changed after this node pinned it/i);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Cerbanimo money edge self-generates a stable signing identity and admin credential on persistent storage',()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'cw-edge-bootstrap-'));
  const filePath=path.join(dir,'edge.json');
  try{
    const first=loadOrCreateMoneyEdgeIdentity({filePath,env:{},now:()=>1_700_000_000_000});
    assert.match(first.privateKey,/BEGIN PRIVATE KEY/);
    assert.match(first.publicKey,/BEGIN PUBLIC KEY/);
    assert.ok(Buffer.byteLength(first.adminSecret)>=32);
    assert.equal(first.signingIdentityGeneratedLocally,true);
    assert.equal(first.adminCredentialGeneratedLocally,true);
    assert.equal(statSync(filePath).mode&0o777,0o600);
    const second=loadOrCreateMoneyEdgeIdentity({filePath,env:{},now:()=>1_700_000_010_000});
    assert.equal(second.privateKey,first.privateKey);
    assert.equal(second.publicKey,first.publicKey);
    assert.equal(second.fingerprint,first.fingerprint);
    assert.equal(second.adminSecret,first.adminSecret);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
