import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHmac, createHash, webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';
import vm from 'node:vm';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [entry,lobby,productionRaw,stagingRaw]=await Promise.all([
  read('cloudflare/node-cloud/src/browser-tool-entry-v1.mjs'),
  read('public/app/host-node-installer-lobby-v1.js'),
  read('cloudflare/node-cloud/wrangler.jsonc'),
  read('cloudflare/node-cloud/wrangler.staging.jsonc')
]);
const parseJsonc=value=>JSON.parse(value.split('\n').filter(line=>!line.trim().startsWith('//')).join('\n'));
for (const [where,configText] of [['production',productionRaw],['staging',stagingRaw]]) {
  const config=parseJsonc(configText);
  const browser=config.ratelimits.find(item=>item.name==='GUILD_BROWSER_RATE_LIMITER');
  const ai=config.ratelimits.find(item=>item.name==='GUILD_AI_RATE_LIMITER');
  assert.equal(browser?.simple?.limit,8,where+' free browser-tool rate');
  assert.equal(ai?.simple?.limit,6,where+' paid or free AI generation rate unchanged');
  assert.notEqual(browser.namespace_id,ai.namespace_id,where+' tool use must not drain AI request tokens');
}
assert.match(lobby,/data-cw-guild-free-web-benefit/,'Guild join should display the free benefit');
assert.match(lobby,/free Citizen membership/,'Citizen seat must clearly include research');
assert.match(lobby,/No paid membership, search API key, or AI credits required/,'join surface must not imply paid access');

const nodeId='guild-free-benefit-test',sessionSecret='node-session-test-secret-at-least-24-characters';
const signSession=(userId,seatClass)=>{
  const domain='civweave.capacity-session.v1';
  const encoded=Buffer.from(JSON.stringify({v:1,nodeId,userId,seatClass,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
  const key=createHash('sha256').update(domain+'\\0'+sessionSecret).digest();
  const signature=createHmac('sha256',key).update(domain+'\\n'+encoded).digest('base64url');
  return encoded+'.'+signature;
};
let calls=0;
const counts=new Map();
let aiLimiterCalls=0;
const env={
  NODE_FABRIC_SESSION_SECRET:sessionSecret,
  GUILD_BROWSER_RATE_LIMITER:{limit:async ({key})=>{
    const next=(counts.get(key)||0)+1;counts.set(key,next);
    return {success:next<=8};
  }},
  GUILD_AI_RATE_LIMITER:{limit:async()=>{aiLimiterCalls++;throw new Error('Web tools are not AI generation!')}},
  BROWSER:{quickAction:async (kind,payload)=>{
    assert.equal(kind,'markdown');
    assert.match(payload.url,/^https:\/\/html\.duckduckgo\.com\/html/);
    calls++;
    return Response.json({success:true,result:'[Citable article](https://example.org/article)'});
  }}
};
const context=vm.createContext({
  URL,TextEncoder,TextDecoder,Uint8Array,atob,Response,Request,Headers,
  AbortController,setTimeout,clearTimeout,crypto:webcrypto,
});
vm.runInContext(entry.replace(/^export /gm,''),context);
const handler=vm.runInContext('handleBrowserToolRequest',context);
const send=async (token,node=nodeId)=>{
  const url='https://guild.example/api/browser/tool?nodeId='+encodeURIComponent(node);
  return handler(new Request(url,{method:'POST',headers:{
    authorization:'Bearer '+token,'content-type':'application/json',
    'x-civweave-node-id':node
  },body:JSON.stringify({action:'search',query:'guild citizen research'})}),env);
};
const citizen=signSession('citizen:free:012345','community');
for(let i=0;i<8;i++){
  const response=await send(citizen);
  const packet=await response.json();
  assert.equal(response.status,200,'free Citizen must be allowed to research');
  assert.equal(packet.ok,true);
  assert.equal(packet.benefit,'guild-free-web-research');
  assert.equal(packet.userId,'citizen:free:012345');
  assert.equal(packet.chargedNeurons,0);
  assert.equal(packet.chargedCents,0);
  assert.equal(packet.results?.[0]?.url,'https://example.org/article');
}
const rateLimited=await send(citizen);
assert.equal(rateLimited.status,429,'ninth tool action in 60 seconds should be denied for fairness');
assert.equal((await rateLimited.json()).code,'CIVWEAVE_GUILD_WEB_RATE_LIMIT');
assert.equal(calls,8,'rate-limited request must not spend Browser Run capacity');
const patron=signSession('patron:paid:123456','paid-expansion');
assert.equal((await send(patron)).status,200,'Patrons have same included tool benefit');
assert.equal((await send(citizen,'guild-other-node')).status,403,'signed session is bound to the selected Guild');
assert.equal((await send('invalid.capacity.token')).status,401,'unverified members must not use Guild browser tools');
assert.equal(aiLimiterCalls,0,'Guild web research must not consume Workers AI request-rate allowance');
assert.match(entry,/GUILD_BROWSER_RATE_LIMITER/);
assert.doesNotMatch(entry,/membershipTierId\s*===\s*['"]paid/);
console.log('Guild free web research: Citizen and Patron sessions, no AI credit charging, independent 8/min fairness, and invalid-session rejection PASS');
