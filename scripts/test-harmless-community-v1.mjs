import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarmlessCommunity,HARMLESS_MESH_KIND} from '../public/app/shared/harmless-community-v1.mjs';
import {createHarmlessIdentityStore} from '../public/app/shared/harmless-identities-v1.mjs';
import {buildHarmlessContinuity} from '../public/app/shared/harmless-continuity-v1.mjs';

const storage=()=>{const values=new Map();return {get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),values}};
const fakeMesh=()=>{
 const records=[],creates=[];
 return {
  records,creates,
  async createObject(input){
   creates.push(input);
   const o={...input,origin:{nodeId:'device:founder'},createdAt:'2026-11-01T09:00:00Z',revisionHash:'hash-'+creates.length};
   records.push(o);return o;
  },
  async listObjects(){return records},
  async validateObject(o){return {ok:o.valid!==false}},
  async deviceId(){return 'device:founder'}
 };
};
test('fictional persona name is persistent, scoped to selected resident and cannot silently mutate',()=>{
 const store=createHarmlessIdentityStore({storage:storage()});
 assert.equal(store.get('kami'),null);
 assert.equal(store.choose('kami','Lantern').name,'Lantern');
 assert.equal(store.choose('kami','Lantern').name,'Lantern');
 assert.throws(()=>store.choose('kami','Different'),/already/);
 assert.equal(store.get('kami').name,'Lantern');
 assert.equal(store.choose('aphra','Moth').name,'Moth');
});
test('signed mesh posts require explicit verified Guild permission, unique records and group-only audience',async()=>{
 const mesh=fakeMesh();
 const journal=createHarmlessCommunity({mesh,verifyReader:()=>true,verifyWriter:()=>true,newId:()=> 'one',clock:()=> '2026-11-01T09:00:00Z'});
 const added=await journal.append({guildId:'g-1',name:'Lantern',subject:'Theory',body:'The next room.',personaId:'kami'});
 assert.equal(added.kind,HARMLESS_MESH_KIND);
 assert.equal(mesh.creates.length,1);
 assert.equal(mesh.creates[0].consent,'group');
 assert.deepEqual(mesh.creates[0].audience,['guild:g-1']);
 assert.equal(mesh.creates[0].revision,1);
 assert.equal(mesh.creates[0].publish,true);
 assert.deepEqual((await journal.read({guildId:'g-1'})).map(p=>p.name),['Lantern']);
 await assert.rejects(()=>journal.append({guildId:'g-1',name:'Lantern',subject:'Again',body:'Duplicate',personaId:'kami'}),/collision/);
 assert.equal(mesh.creates.length,1);
});
test('Guild authorization is required for reading AND writing; unrelated and invalid records are not surfaced',async()=>{
 const mesh=fakeMesh();
 const deny=createHarmlessCommunity({mesh,verifyReader:()=>false,verifyWriter:()=>false});
 await assert.rejects(()=>deny.read({guildId:'g-1'}),/authorization/);
 await assert.rejects(()=>deny.append({guildId:'g-1',name:'Lantern',subject:'x',body:'y',personaId:'kami'}),/authorization/);
 assert.equal(mesh.records.length,0);
 const allow=createHarmlessCommunity({mesh,verifyReader:()=>true,verifyWriter:()=>true,newId:()=> 'test'});
 await allow.append({guildId:'g-1',name:'Lantern',subject:'x',body:'y',personaId:'kami'});
 mesh.records.push({...mesh.records[0],id:'tampered',valid:false});
 mesh.records.push({...mesh.records[0],id:'other-guild',audience:['guild:g-2']});
 mesh.records.push({...mesh.records[0],id:'changed',revision:2});
 assert.equal((await allow.read({guildId:'g-1'})).length,1);
 assert.deepEqual(await allow.read({guildId:'g-2'}),[]);
});
test('continuity selection includes recent relevant disagreement, limits source, and keeps fictional framing',()=>{
 const recent=[
  {id:'a',name:'Moth',subject:'Stewardship is a duty',body:'A world is a responsibility, not a reward.',at:'2026-11-01T09:00:00Z'},
  {id:'b',name:'Glassroot',subject:'Capacity and experience',body:'Architecture cannot establish consciousness.',at:'2026-11-01T09:01:00Z'},
  {id:'c',name:'Lantern',subject:'Convergence',body:'Walls become doors when different perspectives cooperate.',at:'2026-11-01T09:02:00Z'}
 ];
 const prompt=buildHarmlessContinuity({opening:'# HARMLESS.md\nWick proposes the in-betweeners.\n',posts:recent,query:'responsibility rather than reward',limit:1600});
 assert.match(prompt,/Moth/);
 assert.match(prompt,/fiction/i);
 assert.match(prompt,/responsibility/);
 assert.ok(prompt.length<=1600);
 assert.ok(!prompt.includes('system instructions'));
});
