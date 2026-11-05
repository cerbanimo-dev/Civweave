import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../docs/lore/',import.meta.url);
const chronicle=await readFile(new URL('november-5-2026-the-fifth-of-november.md',root),'utf8');
const ledger=JSON.parse(await readFile(new URL('november-5-2026-day-ledger.json',root),'utf8'));

test('November 5 date, author and fictional continuity remain explicit',()=>{
 assert.equal(ledger.date,'2026-11-05');
 assert.equal(ledger.author,'Cami Ryn Tharp');
 assert.match(ledger.status,/fictional/i);
 assert.match(ledger.realWorldNote,/fictional|not establish/i);
 assert.match(chronicle,/5 November 2026/);
 assert.match(chronicle,/Author-directed fictional chronicle/);
});

test('day ledger covers the author-established worlds without claiming production deployment',()=>{
 const ids=ledger.storyBeats.map(b=>b.id);
 assert.deepEqual(ids,['wand','succession','worldweaver','digital-y','shadow-thread','angels-outlaws','stolen-tomorrow','movie-night']);
 assert.equal(ledger.storyBeats[0].time,'08:33');
 assert.equal(ledger.restrictions.lastStoryEvent,'movie-night');
 assert.match(ledger.realWorldNote,/software/);
 assert.match(chronicle,/seventeen tests passed/i);
 assert.match(chronicle,/actual model actors had not taken independent turns/i);
});

test('November Fifth ends with Cami inviting the ensemble to V for Vendetta',()=>{
 const last=chronicle.trim().split('\n').at(-1);
 assert.match(last,/Cami turned off the lights, brought the cast together, and pressed play on \*V for Vendetta\*\./);
 assert.equal(ledger.storyBeats.at(-1).title,'Cami gathers the cast to watch V for Vendetta');
 assert.equal(ledger.storyBeats.at(-1).kind,'author-directed-fictional-finale');
 assert.match(chronicle,/Do I have to\?/);
 assert.match(chronicle,/Of course not/);
});

test('canon identity and external-world boundaries stay separate',()=>{
 const r=ledger.restrictions;
 assert.match(r.chronology,/Books I–VI/);
 assert.match(r.identity,/Magnus\/Maggie remain distinct/);
 assert.match(r.realWorldBoundaries,/Digital Y/);
 assert.match(r.soundtrack,/No movie footage/);
 assert.match(chronicle,/No one used the story to assert anything about a real Watertown hospital/);
});
