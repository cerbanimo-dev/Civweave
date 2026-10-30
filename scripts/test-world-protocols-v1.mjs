import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_PROTOCOLS} from '../public/creator-suite/world-protocols/catalog.mjs';
import {pickWorlds,storyContext,storyObjective} from '../public/creator-suite/world-protocols/core.mjs';
test('exactly nine preinstalled worlds and unique IDs',()=>{assert.equal(WORLD_PROTOCOLS.length,9);assert.equal(new Set(WORLD_PROTOCOLS.map(w=>w.id)).size,9);assert.ok(WORLD_PROTOCOLS.every(w=>w.mechanics&&w.art&&w.tier==='public-reader-safe'));});
test('unknown and duplicate worlds do not pollute selected lore',()=>{assert.deepEqual(pickWorlds(['neon-afterimage','unknown','neon-afterimage','kaiju-garden']).map(w=>w.id),['neon-afterimage','kaiju-garden']);});
test('ordinary documents do not receive story instructions',()=>{assert.equal(storyContext({}), '');assert.equal(storyObjective({}), '');});
test('crossover context retains both realities',()=>{const ctx=storyContext({ids:['starship-commons','city-between-panels']});assert.match(ctx,/CROSSOVER/);assert.match(ctx,/Living starships/);assert.match(ctx,/comic panels/);});
test('shipping public packet is reasonably bounded and lacks private fields',()=>{const all=storyContext({ids:WORLD_PROTOCOLS.map(w=>w.id)});assert.ok(all.length<14001);for(const w of WORLD_PROTOCOLS)assert.deepEqual(Object.keys(w).sort(),['art','conflict','genres','id','mechanics','order','premise','seed','tier','title'].sort());});
