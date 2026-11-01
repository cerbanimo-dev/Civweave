import assert from 'node:assert/strict';
import test from 'node:test';
import {buildGuildRadioSchedule, locateGuildRadioTrack, validateGuildRadioSchedule} from '../public/app/shared/guild-radio-schedule-v1.mjs';

const BUNDLES=[
 {id:'climate',title:'Climate',tracks:['a','b'],brief:'A reflection about climate.',discussion:'A longer conversation about climate.'},
 {id:'freedom',title:'Freedom',tracks:['b','c'],brief:'A reflection about freedom.',discussion:'A longer conversation about freedom.'},
 {id:'machines',title:'Machines',tracks:['a','c'],brief:'A reflection about machines.',discussion:'A longer conversation about machines.'}
];
const TRACKS=[{id:'a',durationSeconds:140},{id:'b',durationSeconds:170},{id:'c',durationSeconds:110}];

test('guild authority chooses whole bundles, shuffles songs and assigns contiguous UTC times',()=>{
 const at=Date.UTC(2026,10,1,15,5);
 const data=buildGuildRadioSchedule({guildId:'guild-alpha',bundles:BUNDLES,tracks:TRACKS,nowMs:at});
 assert.equal(data.schema,'civweave.guild-radio-schedule.v1');
 assert.equal(data.guildId,'guild-alpha');
 assert.ok(data.chunks.length>=3);
 for(const chunk of data.chunks){
  assert.ok(BUNDLES.some(bundle=>bundle.id===chunk.bundleId));
  assert.deepEqual([...chunk.tracks.map(t=>t.id)].sort(), [...BUNDLES.find(b=>b.id===chunk.bundleId).tracks].sort());
  assert.equal(chunk.startAt,chunk.tracks[0].startAt);
  for(let i=1;i<chunk.tracks.length;i++) assert.equal(Date.parse(chunk.tracks[i-1].endAt),Date.parse(chunk.tracks[i].startAt));
  assert.ok(chunk.brief && chunk.discussion);
 }
 for(let i=1;i<data.chunks.length;i++) assert.equal(data.chunks[i-1].endAt,data.chunks[i].startAt);
 const active=locateGuildRadioTrack(data,at);
 assert.ok(active);assert.ok(active.offsetSeconds>=0);
 assert.equal(validateGuildRadioSchedule(data,{guildId:'guild-alpha',trackIds:TRACKS.map(t=>t.id)}),true);
});

test('same guild/time generates stable tracks and different guilds vary',()=>{
 const at=Date.UTC(2026,10,1,12);
 const args={guildId:'alpha',bundles:BUNDLES,tracks:TRACKS,nowMs:at};
 const a=buildGuildRadioSchedule(args),b=buildGuildRadioSchedule({...args,nowMs:at+30000});
 assert.deepEqual(a.chunks,b.chunks);
 const other=buildGuildRadioSchedule({...args,guildId:'beta'});
 assert.notDeepEqual(a.chunks.map(c=>c.bundleId),other.chunks.map(c=>c.bundleId));
});

test('malformed schedule and unlisted tracks are rejected',()=>{
 const packet=buildGuildRadioSchedule({guildId:'alpha',bundles:BUNDLES,tracks:TRACKS,nowMs:Date.UTC(2026,10,1)});
 assert.equal(validateGuildRadioSchedule({...packet,guildId:'other'},{guildId:'alpha',trackIds:TRACKS.map(t=>t.id)}),false);
 const mutated=structuredClone(packet);mutated.chunks[0].tracks[0].id='unlisted';
 assert.equal(validateGuildRadioSchedule(mutated,{guildId:'alpha',trackIds:TRACKS.map(t=>t.id)}),false);
 assert.equal(locateGuildRadioTrack(packet,Date.UTC(2030,0,1)),null);
});
