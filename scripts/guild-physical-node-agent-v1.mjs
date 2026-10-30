#!/usr/bin/env node
// Civweave Guild physical-node companion (Node 22+). Run on the owner's actual server.
// Credentials are kept on that server and never printed to stdout.
import {mkdir,readFile,writeFile,chmod} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {homedir,hostname} from 'node:os';

const file=process.env.CIVWEAVE_GUILD_NODE_STATE||join(homedir(),'.civweave','guild-physical-node.json');
const origin=String(process.env.CIVWEAVE_GUILD_ORIGIN||'').trim().replace(/\/$/,'');
const pairingCode=String(process.env.CIVWEAVE_NODE_PAIRING_CODE||'').trim();
const syncKey=String(process.env.CIVWEAVE_GUILD_SYNC_KEY||'').trim();
const stableNodeId=String(process.env.CIVWEAVE_NODE_ID||hostname()).toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,120);
if(!origin||!/^https:\/\//.test(origin)||!stableNodeId||stableNodeId.length<8){
  console.error('Set CIVWEAVE_GUILD_ORIGIN to the HTTPS Guild Worker URL and CIVWEAVE_NODE_ID to a stable identifier (at least 8 characters).');
  process.exitCode=1;
}else{
  const request=async(path,{token='',body=null}={})=>{
    const response=await fetch(new URL(path,origin),{method:body?'POST':'GET',headers:{accept:'application/json',...(body?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000),cache:'no-store'});
    const value=await response.json().catch(()=>({}));if(!response.ok||value.ok===false)throw Error(value.error||'Guild Cloud HTTP '+response.status);
    return value;
  };
  async function load(){try{return JSON.parse(await readFile(file,'utf8'))}catch{return null}}
  async function save(value){await mkdir(dirname(file),{recursive:true,mode:0o700});await writeFile(file,JSON.stringify(value,null,2),{mode:0o600});await chmod(file,0o600)}
  let linked=await load();
  if(linked?.origin!==origin||linked?.nodeId!==stableNodeId)linked=null;
  if(!linked?.nodeToken){
    if(!pairingCode){console.error('On the owner dashboard choose Create pairing code; set CIVWEAVE_NODE_PAIRING_CODE on this physical server.');process.exitCode=1}
    else{
      const result=await request('/api/guild/physical/connect',{body:{pairingCode,nodeId:stableNodeId}});
      linked={origin,nodeId:stableNodeId,nodeToken:result.nodeToken,challenge:result.challenge,connectedAt:new Date().toISOString()};
      await save(linked);
      console.log('Node paired with Guild Cloud; first member slot reward is available.');
    }
  }
  let stopped=false,consecutiveSuccesses=0;
  process.on('SIGINT',()=>{stopped=true});process.on('SIGTERM',()=>{stopped=true});
  while(!stopped&&linked?.nodeToken){
    try{
      // Public manifest + authenticated envelope-list probes establish that this
      // server can reach both Guild Cloud and the signed-object sync endpoint.
      const manifest=await request('/api/fabric/manifest');
      const health=await request('/api/health');
      let meshSyncOk=false;
      if(syncKey){await request('/api/envelopes?limit=1',{token:syncKey});meshSyncOk=true}
      const recoveryOk=health.claimed===true&&manifest.guildId===health.guildId&&consecutiveSuccesses>=1;
      const result=await request('/api/guild/physical/heartbeat',{token:linked.nodeToken,body:{challengeEcho:linked.challenge,meshSyncOk,recoveryOk}});
      linked.challenge=result.challenge;linked.lastSeenAt=new Date().toISOString();await save(linked);
      consecutiveSuccesses++;
      console.log('Cloud heartbeat accepted; verified stage '+(result.onboarding?.stage||0)+'/5; '+(result.onboarding?.unlockedSlots||5)+'/10 Guild slots.');
    }catch(error){consecutiveSuccesses=0;console.error('Guild Cloud check failed: '+error.message+'; rechecking shortly.')}
    if(stopped)break;
    await new Promise(resolve=>setTimeout(resolve,30000));
  }
}
