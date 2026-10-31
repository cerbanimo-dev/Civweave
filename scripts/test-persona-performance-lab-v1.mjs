import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('performance studio exposes private opt-in one-cue persona improvisation without a second chat runtime',()=>{
 const html=readFileSync(new URL('../public/app/tools/worldweaver-performance-lab.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/app/tools/worldweaver-performance-lab-v1.mjs',import.meta.url),'utf8');
 for(const id of ['persona-manifest-file','persona-scenario','persona-stage','persona-cast','persona-speaker',
  'persona-director-model','persona-actor-model','persona-inner-model','persona-split-mode','persona-direct-control','persona-willpower','persona-player-cue','persona-prepare','persona-act','persona-result']){
  assert.match(html,new RegExp('id="'+id+'"'),id);
 }
 assert.match(js,/prepareDirectedScene/);
 assert.match(js,/performPersonaTurn/);
 assert.match(js,/advanceSceneTurn/);
 assert.match(js,/runSplitMindTurn/);
 assert.match(js,/validatePersonaPack/);
 assert.match(js,/runCodeInference/);
 assert.match(html,/No automatic publication/i);
 assert.doesNotMatch(html,/<script[^>]+(?:persona-chat|new-chat-system)/i);
});
