import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve,join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {executeWordcraft,checkInstalled,BridgeError} from '../tools/creator-craft-bridge/wordcraft.mjs';
import {createWordcraftBridge} from '../tools/creator-craft-bridge/server.mjs';
const fixture=resolve('tools/creator-craft-bridge/test-cli.mjs');
const cliConfig={command:process.execPath,prefixArgs:[fixture],timeoutMs:5000};
const token='creator-test-token-with-strong-enough-length';
const file={name:'proposal.docx',contentBase64:Buffer.from('PK fake test input').toString('base64')};

test('WordCraft CLI inspection, text extraction and PDF conversion run as real subprocesses',async()=>{
  assert.equal(await checkInstalled(cliConfig),true);
  const inspection=await executeWordcraft({action:'inspect',...file},cliConfig);
  assert.equal(inspection.structure.paragraphs,2);
  const extracted=await executeWordcraft({action:'text',...file},cliConfig);
  assert.match(extracted.text,/Fixture document content/);
  const pdf=await executeWordcraft({action:'pdf',...file},cliConfig);
  assert.equal(pdf.mime,'application/pdf');
  assert.equal(pdf.filename,'proposal.pdf');
  assert.match(Buffer.from(pdf.contentBase64,'base64').toString('utf8'),/^%PDF-/);
});

test('WordCraft refuses traversal, unrecognized actions, unsupported extensions and malformed bytes',async()=>{
  const cases=[
    {action:'inspect',name:'../secret.docx',contentBase64:file.contentBase64},
    {action:'inspect',name:'secret.pdf',contentBase64:file.contentBase64},
    {action:'run',...file},
    {action:'text',name:'report.docx',contentBase64:'!!!'},
    {action:'text',name:'report.docx',contentBase64:Buffer.alloc(8*1024*1024+1).toString('base64')}
  ];
  for(const bad of cases)await assert.rejects(()=>executeWordcraft(bad,cliConfig),BridgeError);
});

test('HTTP bridge denies unauthenticated or cross-origin calls, permits approved session only',async t=>{
  const srv=createWordcraftBridge({token,allowedOrigins:['https://civweave-staging.pages.dev'],
    installed:async()=>true,execute:req=>executeWordcraft(req,cliConfig)});
  await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>srv.close(resolve)));
  const origin='http://127.0.0.1:'+srv.address().port;
  const get=(path,options={})=>fetch(origin+path,options);
  const unauth=await get('/v1/capabilities');
  assert.equal(unauth.status,401);
  const denied=await get('/v1/capabilities',{headers:{origin:'https://not-trusted.example',authorization:'Bearer '+token}});
  assert.equal(denied.status,403);
  const allowed=await get('/v1/capabilities',{headers:{origin:'https://civweave-staging.pages.dev',authorization:'Bearer '+token}});
  assert.equal(allowed.status,200);
  assert.equal((await allowed.json()).wordcraft.installed,true);
  const preflight=await get('/v1/wordcraft',{method:'OPTIONS',headers:{origin:'https://civweave-staging.pages.dev','access-control-request-private-network':'true'}});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-private-network'),'true');
  const run=await get('/v1/wordcraft',{method:'POST',headers:{origin:'https://civweave-staging.pages.dev',authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'text',...file})});
  assert.equal(run.status,200);
  assert.match((await run.json()).result.text,/Fixture document content/);
  const path=await get('/v1/wordcraft',{method:'POST',headers:{authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'text',name:'../outside.docx',contentBase64:file.contentBase64})});
  assert.equal(path.status,400);
});

test('browser connector includes per-action approval, explicit selection and no persistent token',async()=>{
  const source=await readFile(resolve('public/creator-suite/wordcraft-connector-v1.js'),'utf8');
  assert.match(source,/window\.confirm/);
  assert.match(source,/activeFile\.arrayBuffer/);
  assert.match(source,/registerEditor\('wordcraft'/);
  assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB|eval\(/);
});

test('HTTP bridge rejects a third simultaneous document job without queuing unbounded work',async t=>{
  let started=0,release;
  const hold=new Promise(resolve=>{release=resolve;});
  let signal;
  const twoStarted=new Promise(resolve=>{signal=resolve;});
  const srv=createWordcraftBridge({token,installed:async()=>true,execute:async()=>{
    started++;
    if(started===2)signal();
    await hold;
    return{schema:'civweave.craft-result.v1',action:'text',text:'done'};
  }});
  await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>srv.close(resolve)));
  const url='http://127.0.0.1:'+srv.address().port+'/v1/wordcraft';
  const send=()=>fetch(url,{method:'POST',headers:{authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'text',...file})});
  const first=send(),second=send();
  await twoStarted;
  const busy=await send();
  assert.equal(busy.status,429);
  assert.equal((await busy.json()).code,'BRIDGE_BUSY');
  release();
  assert.equal((await first).status,200);
  assert.equal((await second).status,200);
});
