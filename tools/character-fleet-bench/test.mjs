import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {planCases,loadRoster} from './run.mjs';
const home=path.dirname(fileURLToPath(import.meta.url));
test('canonical fleet, fixed 20 unique questions per character, five variants',async()=>{
  const bank=JSON.parse(await readFile(path.join(home,'questions.json'),'utf8'));
  const variants=JSON.parse(await readFile(path.join(home,'agents.json'),'utf8'));
  assert.equal(variants.length,5);
  assert.equal(new Set(variants.map(x=>x.id)).size,5);
  for(const v of variants)assert.ok((await readFile(path.join(home,v.file),'utf8')).length>120);
  assert.equal(bank.characters.length,23);
  for(const entry of bank.characters){assert.equal(entry.questions.length,20);assert.equal(new Set(entry.questions.map(x=>x.id)).size,20);assert.equal(new Set(entry.questions.map(x=>x.text)).size,20);}
  const {roster,guideProfiles}=await loadRoster();
  assert.equal(roster.length,13);
  for(const character of roster)assert.ok(bank.characters.find(x=>x.id===character.id));
  const bound={default:{provider:'ollama',model:'qwen3.5:4b',endpoint:'http://127.0.0.1:11434'},guideProfiles};
  const plan=planCases({questionBank:bank,characters:roster,variants:variants.map(x=>({...x,text:'test variant'})),bindings:bound});
  assert.equal(plan.length,5*13*20);
  assert.equal(new Set(plan.map(x=>x.caseId)).size,plan.length);
  assert.deepEqual([...new Set(plan.map(x=>x.variant))],variants.map(x=>x.id));
});
test('one outstanding model call; all five variants complete in order; resume is idempotent',async()=>{
  let active=0,peak=0,hits=0;const requests=[];
  const server=createServer(async(req,res)=>{
    active++;peak=Math.max(active,peak);
    let body='';for await(const part of req)body+=part;
    const parsed=JSON.parse(body);requests.push(parsed.messages[1].content);hits++;
    await new Promise(resolve=>setTimeout(resolve,8));
    res.setHeader('content-type','application/json');res.end(JSON.stringify({message:{content:'In-character response'},eval_count:8}));active--;
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const dir=await mkdtemp(path.join(tmpdir(),'civweave-fleet-'));
  const run=(extra=[])=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(home,'run.mjs'),'--run','--only','starling:aphra','--question-limit','2','--config',path.join(dir,'config.json'),'--out',path.join(dir,'out.jsonl'),...extra],{stdio:'pipe'});
    let stderr='';child.stderr.on('data',b=>stderr+=b);
    child.on('exit',code=>code===0?resolve():reject(new Error('Exit '+code+' '+stderr)));
  });
  try{
    await writeFile(path.join(dir,'config.json'),JSON.stringify({default:{provider:'ollama',model:'mock',endpoint:'http://127.0.0.1:'+server.address().port}}));
    await run();assert.equal(peak,1);assert.equal(hits,10);
    const rows=(await readFile(path.join(dir,'out.jsonl'),'utf8')).trim().split('\n').map(x=>JSON.parse(x));
    assert.equal(rows.length,10);assert.ok(rows.every(x=>x.status==='success'));
    assert.equal(new Set(rows.map(x=>x.variant)).size,5);
    assert.deepEqual(rows.map(x=>x.variant).filter((v,i,a)=>i===0||v!==a[i-1]),['canon-voice','relationship-continuity','situated-action','dissent-uncertainty','integrated-self-check']);
    await run(['--resume']);assert.equal(hits,10);
    assert.equal(requests.length,10);
  }finally{server.close();await rm(dir,{recursive:true,force:true});}
});
