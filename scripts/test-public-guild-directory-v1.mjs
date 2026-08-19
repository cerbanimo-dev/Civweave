import assert from 'node:assert/strict';
import {registerPublicGuildEdge} from '../cloudflare/core/src/guild-directory.mjs';

const writes=[];
const env={
  DB:{
    prepare(sql){
      return{
        bind(...values){return{async run(){writes.push({sql,values});return{success:true}}}}
      };
    },
  },
};

const status={
  ok:true,
  claimed:true,
  guildId:'northside-repair',
  displayName:'Northside Repair Guild',
  location:{
    schema:'civweave.hub-location.v1',
    latitude:43.975,
    longitude:-75.911,
    precisionMeters:100,
    coordinateDecimals:3,
    source:'guildkeeper-browser-geolocation',
    capturedAt:'2026-08-19T20:00:00.000Z',
    syncedAt:'2026-08-19T20:00:05.000Z',
  },
  updatedAt:'2026-08-19T20:00:05.000Z',
};
const manifest={
  ok:true,
  schema:'civweave.guild-cloud-fabric.v1',
  guildId:'northside-repair',
  displayName:'Northside Repair Guild',
  workerOrigin:'https://northside-guild.example.org',
  location:status.location,
  capabilities:['always-online-guild-edge','three-starter-nodes','workers-ai','guild-map-location'],
  infrastructure:{starterNodes:[{nodeId:'northside-repair-a'},{nodeId:'northside-repair-b'},{nodeId:'northside-repair-c'}]},
};
const fetcher=async url=>{
  const target=new URL(String(url));
  if(target.pathname==='/api/guild/status')return Response.json(status);
  if(target.pathname==='/api/fabric/manifest')return Response.json(manifest);
  return Response.json({ok:false},{status:404});
};

const registered=await registerPublicGuildEdge(env,{publicOrigin:'https://northside-guild.example.org/some/path'},{fetcher});
assert.equal(registered.guildId,'northside-repair');
assert.equal(registered.nodeId,'northside-repair');
assert.equal(registered.publicOrigin,'https://northside-guild.example.org');
assert.equal(registered.runtime,'cloudflare-mobile-guild-edge');
assert.equal(registered.verifiedFromLiveEdge,true);
assert.ok(registered.capabilities.includes('public-guild-directory'));
assert.equal(registered.location.latitude,43.975);
assert.equal(registered.location.coordinateDecimals,3);
assert.equal(writes.length,1);
assert.equal(writes[0].values[0],'northside-repair');
assert.equal(writes[0].values[2],'Northside Repair Guild');
assert.equal(writes[0].values[3],'cloudflare-mobile-guild-edge');
assert.equal(writes[0].values[4],'https://northside-guild.example.org');
assert.ok(!JSON.stringify(writes).includes('membershipKey'));

await assert.rejects(
  ()=>registerPublicGuildEdge(env,{publicOrigin:'http://northside-guild.example.org'},{fetcher}),
  /HTTPS/i,
);
await assert.rejects(
  ()=>registerPublicGuildEdge(env,{publicOrigin:'https://localhost'},{fetcher}),
  /public DNS|publicly routable/i,
);
await assert.rejects(
  ()=>registerPublicGuildEdge(env,{publicOrigin:'https://northside-guild.example.org'},{fetcher:async url=>{
    const target=new URL(String(url));
    if(target.pathname==='/api/guild/status')return Response.json(status);
    return Response.json({...manifest,guildId:'different-guild'});
  }}),
  /identity/i,
);

console.log(JSON.stringify({ok:true,schema:'civweave.public-guild-directory.test.v1',verifiedLiveEdge:true,membershipKeyShared:false,oneMapRecordPerGuild:true}));
