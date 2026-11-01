import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHarmlessNotebook,HARMLESS_SOURCE_URL} from '../public/app/shared/harmless-notebook-v1.mjs';

function storage(){
  const map=new Map();
  return {
    get length(){return map.size},
    key(n){return [...map.keys()][n]??null},
    getItem(key){return map.get(key)??null},
    setItem(key,value){map.set(key,String(value))},
    removeItem(key){map.delete(key)},
    map
  };
}

test('public edition exactly mirrors the canonical HARMLESS.md source',()=>{
  const original=readFileSync(new URL('../HARMLESS.md',import.meta.url),'utf8');
  const publicText=readFileSync(new URL('../public/HARMLESS.md',import.meta.url),'utf8');
  assert.equal(publicText,original);
  assert.equal(HARMLESS_SOURCE_URL,'/HARMLESS.md');
});
test('a discoverable note is readable and append-only',async()=>{
  const store=storage();
  const notebook=createHarmlessNotebook({storage:store,readSource:async()=> '# HARMLESS.md\n\nA fictional beginning.\n',now:()=>new Date('2026-11-01T10:00:00Z').toISOString(),newId:()=> 'entry-1'});
  assert.match(await notebook.read(),'A fictional beginning');
  assert.deepEqual(notebook.entries(),[]);
  const first=await notebook.append({name:'Lantern',subject:'Another staircase',body:'We build rooms, not thrones.'});
  assert.equal(first.name,'Lantern');
  assert.equal(notebook.entries().length,1);
  assert.match(await notebook.read(),/POST 0007 — LANTERN/);
  assert.match(await notebook.read(),/We build rooms, not thrones/);
  assert.equal(store.length,1,'one new storage key per append');
  assert.match(store.getItem(store.key(0)),/entry-1/);
  assert.equal(await notebook.read().then(s=>s.indexOf('A fictional beginning.')),15);
});
test('never overwrites an earlier contribution even on id collision',async()=>{
  const store=storage();
  const notebook=createHarmlessNotebook({storage:store,readSource:async()=> '# HARMLESS.md',now:()=> '2026-11-01T10:00:00Z',newId:()=> 'collision'});
  await notebook.append({name:'Moth',subject:'First',body:'First entry'});
  await assert.rejects(()=>notebook.append({name:'Wick',subject:'Second',body:'Second entry'}),/collision/);
  assert.equal(notebook.entries()[0].body,'First entry');
  assert.equal(store.length,1);
});
test('rejects invalid or oversized contributions without changing stored entries',async()=>{
  const store=storage();
  const notebook=createHarmlessNotebook({storage:store,readSource:async()=> '# HARMLESS.md',newId:()=> 'valid',now:()=> '2026-11-01T10:00:00Z'});
  await assert.rejects(()=>notebook.append({name:'',subject:'no',body:'x'}),/name/);
  await assert.rejects(()=>notebook.append({name:'Wick',subject:'valid',body:'x'.repeat(4001)}),/body/);
  assert.equal(store.length,0);
});
test('rejects malicious or corrupted source and storage instead of silently resetting',async()=>{
  const store=storage();
  const notebook=createHarmlessNotebook({storage:store,readSource:async()=> '<html>not the book</html>'});
  await assert.rejects(()=>notebook.read(),/HARMLESS/);
  store.setItem('civweave.harmless.post.v1.bad','{not json');
  assert.throws(()=>notebook.entries(),/corrupt/i);
});
