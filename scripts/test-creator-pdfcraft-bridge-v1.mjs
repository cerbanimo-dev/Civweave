import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {executePdfcraft,checkPdfcraftInstalled} from '../tools/creator-craft-bridge/pdfcraft.mjs';
import {createWordcraftBridge} from '../tools/creator-craft-bridge/server.mjs';
import {BridgeError} from '../tools/creator-craft-bridge/wordcraft.mjs';
const fixture=resolve('tools/creator-craft-bridge/test-cli.mjs');
const config={command:process.execPath,prefixArgs:[fixture],timeoutMs:5000};
const token='pdfcraft-local-test-token-of-adequate-length';
const pdf=(name)=>({name,contentBase64:Buffer.from('%PDF-1.4\n% fixture input\n').toString('base64')});
test('PdfCraft CLI inspection, extraction, and two-file combine call a real subprocess',async()=>{
 assert.equal(await checkPdfcraftInstalled(config),true);
 const info=await executePdfcraft({action:'info',files:[pdf('first.pdf')]},config);
 assert.equal(info.tool,'pdfcraft');
 assert.match(info.content,/fixture/);
 const text=await executePdfcraft({action:'text',files:[pdf('first.pdf')]},config);
 assert.match(text.content,/Fixture document content/);
 const out=await executePdfcraft({action:'combine',files:[pdf('first.pdf'),pdf('second.pdf')]},config);
 assert.equal(out.filename,'combined.pdf');
 assert.match(Buffer.from(out.contentBase64,'base64').toString(),/^%PDF-/);
});
test('PdfCraft rejects invalid files, names, hidden paths, and action/file count mismatch',async()=>{
 const bad=[
  {action:'info',files:[pdf('../outside.pdf')]},
  {action:'info',files:[{name:'incorrect.pdf',contentBase64:Buffer.from('bad input').toString('base64')}]},
  {action:'merge',files:[pdf('first.pdf'),pdf('second.pdf')]},
  {action:'combine',files:[pdf('first.pdf')]},
  {action:'combine',files:[pdf('first.pdf'),pdf('second.pdf'),pdf('third.pdf')]},
  {action:'text',files:[{name:'file.pdf',contentBase64:'abc!'}]},
  {action:'info',files:[{name:'file.exe',contentBase64:pdf('first.pdf').contentBase64}]},
 ];
 for(const input of bad)await assert.rejects(()=>executePdfcraft(input,config),BridgeError);
});
test('PdfCraft endpoint enforces token and web origin before processing document content',async t=>{
 const srv=createWordcraftBridge({token,allowedOrigins:['https://civweave-staging.pages.dev'],
  installed:async()=>false,cadInstalled:async()=>false,pdfInstalled:async()=>true,
  pdfExecute:req=>executePdfcraft(req,config)});
 await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>srv.close(resolve)));
 const url='http://127.0.0.1:'+srv.address().port;
 const denied=await fetch(url+'/v1/pdfcraft',{method:'POST',headers:{'Content-Type':'application/json',origin:'https://attacker.example',authorization:'Bearer '+token},body:JSON.stringify({action:'text',files:[pdf('a.pdf')]})});
 assert.equal(denied.status,403);
 const noToken=await fetch(url+'/v1/pdfcraft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'text',files:[pdf('a.pdf')]})});
 assert.equal(noToken.status,401);
 const installed=await fetch(url+'/v1/capabilities',{headers:{authorization:'Bearer '+token,origin:'https://civweave-staging.pages.dev'}});
 assert.equal((await installed.json()).pdfcraft.installed,true);
 const ok=await fetch(url+'/v1/pdfcraft',{method:'POST',headers:{'Content-Type':'application/json',origin:'https://civweave-staging.pages.dev',authorization:'Bearer '+token},body:JSON.stringify({action:'combine',files:[pdf('a.pdf'),pdf('b.pdf')]})});
 assert.equal(ok.status,200);
 assert.match(Buffer.from((await ok.json()).result.contentBase64,'base64').toString(),/^%PDF-/);
});
