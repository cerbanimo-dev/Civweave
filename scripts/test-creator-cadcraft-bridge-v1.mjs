import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {executeCadcraft,checkCadcraftInstalled} from '../tools/creator-craft-bridge/cadcraft.mjs';
import {createWordcraftBridge} from '../tools/creator-craft-bridge/server.mjs';
import {BridgeError} from '../tools/creator-craft-bridge/wordcraft.mjs';
const fixture=resolve('tools/creator-craft-bridge/test-cli.mjs');
const config={command:process.execPath,prefixArgs:[fixture],timeoutMs:5000};
const token='local-cad-test-bridge-token-of-adequate-length';
const drawing={name:'workshop.dxf',contentBase64:Buffer.from('DXF fixture data').toString('base64')};
test('CADCraft inspection and SVG export call the real subprocess fixture',async()=>{
  assert.equal(await checkCadcraftInstalled(config),true);
  const info=await executeCadcraft({action:'info',...drawing},config);
  assert.match(info.details,/CADCraft drawing fixture/);
  const out=await executeCadcraft({action:'svg',...drawing},config);
  assert.equal(out.filename,'workshop.svg');
  assert.equal(out.mime,'image/svg+xml');
  assert.match(Buffer.from(out.contentBase64,'base64').toString('utf8'),/^<svg /);
});
test('CADCraft input validation forbids traversal, arbitrary extension or action',async()=>{
  for(const bad of [
    {action:'info',name:'../other.dxf',contentBase64:drawing.contentBase64},
    {action:'info',name:'text.docx',contentBase64:drawing.contentBase64},
    {action:'file',...drawing},
    {action:'info',name:'draw.dxf',contentBase64:'!'}
  ])await assert.rejects(()=>executeCadcraft(bad,config),BridgeError);
});
test('same authenticated bridge gates CADCraft and denies untrusted web origins',async t=>{
  const srv=createWordcraftBridge({token,allowedOrigins:['https://civweave-staging.pages.dev'],
    installed:async()=>true,cadInstalled:async()=>true,
    cadExecute:req=>executeCadcraft(req,config)});
  await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>srv.close(resolve)));
  const url='http://127.0.0.1:'+srv.address().port;
  const denied=await fetch(url+'/v1/cadcraft',{method:'POST',headers:{authorization:'Bearer '+token,'Content-Type':'application/json',origin:'https://evil.example'},body:JSON.stringify({action:'info',...drawing})});
  assert.equal(denied.status,403);
  const allowed=await fetch(url+'/v1/cadcraft',{method:'POST',headers:{authorization:'Bearer '+token,'Content-Type':'application/json',origin:'https://civweave-staging.pages.dev'},body:JSON.stringify({action:'svg',...drawing})});
  assert.equal(allowed.status,200);
  const body=await allowed.json();
  assert.equal(body.result.tool,'cadcraft');
  assert.match(Buffer.from(body.result.contentBase64,'base64').toString(),/^<svg /);
});
