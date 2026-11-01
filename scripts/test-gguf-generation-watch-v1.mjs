import assert from 'node:assert/strict';
import {createGGUFGenerationWatch,GGUF_FIRST_VISIBLE_MS,GGUF_OUTPUT_IDLE_MS,GGUF_MAX_GENERATE_MS} from '../public/app/local-ai/gguf-generation-watch-v1.js';
function sandbox(){
  const clock={ms:0,nextId:1,timers:new Map(),events:[]};
  const watcher=(overrides={})=>createGGUFGenerationWatch({
    ...overrides,now:()=>clock.ms,
    onProgress:(stage,details)=>clock.events.push({stage,details}),
    timerSet:(fn,ms)=>{const id=clock.nextId++;clock.timers.set(id,{fn,ms});return id},
    timerClear:id=>clock.timers.delete(id)
  });
  const fire=ms=>{
    const record=[...clock.timers].find(([,val])=>val.ms===ms);
    assert.ok(record,'Expected active '+ms+'ms timer');
    clock.ms+=ms;clock.timers.delete(record[0]);record[1].fn();
  };
  return{clock,watcher,fire};
}
{
  const s=sandbox(),w=s.watcher();
  w.prefill({processed:42,total:200,cached:8});
  assert.equal(w.snapshot().prefillEvents,1);
  assert.equal(w.snapshot().prefill.processed,42);
  assert.equal(w.snapshot().prefill.total,200);
  assert.equal(w.snapshot().visibleChunks,0);
  s.fire(GGUF_FIRST_VISIBLE_MS);
  await assert.rejects(w.cancelled,{code:'GGUF_FIRST_VISIBLE_TOKEN_TIMEOUT'});
  assert.equal(w.snapshot().errorCode,'GGUF_FIRST_VISIBLE_TOKEN_TIMEOUT');
  assert.equal(s.clock.events.at(-1).stage,'watchdog-timeout');
  w.stop();
}
{
  const s=sandbox(),w=s.watcher();
  for(let i=0;i<48;i++)w.chunk({hidden:true});
  assert.equal(w.snapshot().hiddenChunks,48);
  assert.ok(s.clock.events.some(x=>x.stage==='hidden-progress'));
  // Hidden thinking must not defeat a first VISIBLE token deadline.
  s.fire(GGUF_FIRST_VISIBLE_MS);
  await assert.rejects(w.cancelled,{code:'GGUF_FIRST_VISIBLE_TOKEN_TIMEOUT'});
  w.stop();
}
{
  const s=sandbox(),w=s.watcher();
  s.clock.ms=700;
  w.chunk({visible:true});
  assert.equal(w.snapshot().firstTokenMs,700);
  assert.equal(s.clock.events.find(x=>x.stage==='first-token').details.firstTokenMs,700);
  assert.equal([...s.clock.timers.values()].some(x=>x.ms===GGUF_FIRST_VISIBLE_MS),false);
  w.chunk({visible:true});
  s.fire(GGUF_OUTPUT_IDLE_MS);
  await assert.rejects(w.cancelled,{code:'GGUF_OUTPUT_STALL'});
  w.stop();
}
{
  const s=sandbox(),w=s.watcher();
  w.chunk({visible:true});
  s.fire(GGUF_MAX_GENERATE_MS);
  await assert.rejects(w.cancelled,{code:'GGUF_GENERATION_TIME_LIMIT'});
  w.stop();
}
{
  const s=sandbox(),external=new AbortController(),w=s.watcher({signal:external.signal});
  external.abort();
  await assert.rejects(w.cancelled,{code:'GGUF_ABORTED'});
  assert.equal(s.clock.timers.size,0);
  w.stop();
}
{
  const s=sandbox(),w=s.watcher();
  w.chunk({visible:true});w.stop();
  assert.equal(s.clock.timers.size,0,'Finishing inference must remove all generation watchdogs');
}

{
  const s=sandbox(),w=s.watcher();
  const originalFirst=[...s.clock.timers].find(([,row])=>row.ms===GGUF_FIRST_VISIBLE_MS)?.[0];
  s.clock.ms=100000;w.prefill({processed:384,total:1697,cached:0});
  const renewedFirst=[...s.clock.timers].find(([,row])=>row.ms===GGUF_FIRST_VISIBLE_MS)?.[0];
  assert.notEqual(renewedFirst,originalFirst,'Advancing prefill must renew the no-progress deadline');
  assert.ok(s.clock.events.some(row=>row.stage==='prefill-progress'&&row.details.processed===384));
  s.clock.ms=180000;w.prefill({processed:700,total:1697});
  assert.notEqual([...s.clock.timers].find(([,row])=>row.ms===GGUF_FIRST_VISIBLE_MS)?.[0],renewedFirst);
  w.chunk({visible:true});
  assert.equal([...s.clock.timers.values()].some(row=>row.ms===GGUF_FIRST_VISIBLE_MS),false);
  w.stop();
}
{
  const s=sandbox(),w=s.watcher();
  const first=[...s.clock.timers].find(([,row])=>row.ms===GGUF_FIRST_VISIBLE_MS)?.[0];
  w.prefill({processed:0,total:1697});
  const next=[...s.clock.timers].find(([,row])=>row.ms===GGUF_FIRST_VISIBLE_MS)?.[0];
  w.prefill({processed:0,total:1697});
  const unchanged=[...s.clock.timers].find(([,row])=>row.ms===GGUF_FIRST_VISIBLE_MS)?.[0];
  assert.equal(next,unchanged,'Repeated unchanged prefill must not keep a stalled model alive');
  w.stop();
}
console.log('GGUF visible token watchdog regression passed: hidden-only first token, visible stream, idle, total duration, external abort and timer cleanup.');