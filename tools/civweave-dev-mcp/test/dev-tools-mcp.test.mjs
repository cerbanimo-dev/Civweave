import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { createToolRegistry } from '../lib/tool-registry.mjs';
import { createMcpHttpServer } from '../server.mjs';
import { resolveRepoPath } from '../lib/repo-tools.mjs';

const execFileAsync=promisify(execFile);

async function makeRepo(){
  const root=await mkdtemp(path.join(os.tmpdir(),'civweave-dev-mcp-'));
  await execFileAsync('git',['init','-q'],{cwd:root});
  await execFileAsync('git',['config','user.email','test@example.test'],{cwd:root});
  await execFileAsync('git',['config','user.name','Test'],{cwd:root});
  await writeFile(path.join(root,'package.json'),JSON.stringify({type:'module',scripts:{'test:unit':'node --test test-smoke.mjs','deploy':'echo never'}},null,2));
  await writeFile(path.join(root,'test-smoke.mjs'),"import test from 'node:test'; test('ok',()=>{});\n");
  await mkdir(path.join(root,'public'));
  await writeFile(path.join(root,'public','app.js'),"export const greeting='hello';\n");
  await execFileAsync('git',['add','.'],{cwd:root});
  await execFileAsync('git',['commit','-qm','initial'],{cwd:root});
  return root;
}

function fakeCdpFactory(){
  const calls=[];
  const handlers=new Map();
  const client={
    async call(method,params={}){
      calls.push({method,params});
      if(method==='Runtime.evaluate'){
        const expression=String(params.expression);
        if(expression.includes("const el=document.querySelector") && expression.includes('Element is not visible')) return {result:{value:{tag:'BUTTON',id:'go',x:20,y:20,width:40,height:20}}};
        if(expression.includes('innerWidth/2')) return {result:{value:{x:400,y:300}}};
        if(expression.includes('scrollX,y:scrollY')) return {result:{value:{x:0,y:100}}};
        return {result:{value:{url:'http://localhost/app',readyState:'complete',scroll:{y:0},serviceWorkers:[],caches:[]}}};
      }
      if(method==='Page.captureScreenshot') return {data:'iVBORw0KGgo='};
      return {};
    },
    on(method,handler){ const set=handlers.get(method)??new Set(); set.add(handler); handlers.set(method,set); return ()=>set.delete(handler); },
    async close(){},
  };
  return async()=>({client,target:{id:'page-1',url:'http://localhost/app'}});
}

test('repo path guard rejects traversal', async()=>{
  const root=await makeRepo();
  assert.throws(()=>resolveRepoPath(root,'../escape.txt'),/escapes/);
});

test('registry reads, searches, applies checked patches, and only runs safe npm scripts', async()=>{
  const root=await makeRepo();
  const registry=createToolRegistry({repoRoot:root,cdpFactory:fakeCdpFactory()});
  const names=registry.list().map((t)=>t.name);
  assert(names.includes('repo.apply_patch'));
  assert(names.includes('pwa.snapshot'));
  assert(names.includes('pwa.query'));
  assert(!names.includes('pwa.eval'));

  const read=await registry.call('repo.read_file',{path:'public/app.js'});
  assert.equal(read.isError,undefined);
  assert.match(read.content[0].text,/hello/);

  const search=await registry.call('repo.search',{query:'greeting'});
  assert.match(search.content[0].text,/public\/app.js/);

  const patch=`diff --git a/public/app.js b/public/app.js\nindex 7407f12..0000000 100644\n--- a/public/app.js\n+++ b/public/app.js\n@@ -1 +1 @@\n-export const greeting='hello';\n+export const greeting='world';\n`;
  const applied=await registry.call('repo.apply_patch',{patch});
  assert.equal(applied.isError,undefined,applied.content?.[0]?.text);
  assert.match(await readFile(path.join(root,'public','app.js'),'utf8'),/world/);

  const safe=await registry.call('repo.run_npm_script',{script:'test:unit'});
  assert.equal(safe.isError,undefined,safe.content?.[0]?.text);
  const blocked=await registry.call('repo.run_npm_script',{script:'deploy'});
  assert.equal(blocked.isError,true);
  assert.match(blocked.content[0].text,/outside the dev-tool verification allowlist/);

  const gitMetadataPatch=`diff --git a/.git/config b/.git/config\n--- a/.git/config\n+++ b/.git/config\n@@ -1 +1 @@\n-old\n+new\n`;
  const blockedMetadata=await registry.call('repo.apply_patch',{patch:gitMetadataPatch});
  assert.equal(blockedMetadata.isError,true);
  assert.match(blockedMetadata.content[0].text,/git metadata/);
});

test('browser tools expose bounded inspection and interaction without caller-supplied runtime eval', async()=>{
  const root=await makeRepo();
  const registry=createToolRegistry({repoRoot:root,cdpFactory:fakeCdpFactory()});
  const snapshot=await registry.call('pwa.snapshot',{});
  assert.equal(snapshot.isError,undefined);
  const screenshot=await registry.call('pwa.screenshot',{});
  assert.equal(screenshot.content[0].type,'image');
  const click=await registry.call('pwa.click',{selector:'#go'});
  assert.equal(click.isError,undefined);
  const definitions=registry.list();
  assert(definitions.every((tool)=>!['pwa.eval','pwa.execute','runtime.patch'].includes(tool.name)));
  const unsafeNav=await registry.call('pwa.navigate',{url:'javascript:document.body.textContent="patched"'});
  assert.equal(unsafeNav.isError,true);
  assert.match(unsafeNav.content[0].text,/protocol is not allowed/);
  const browserDefs=registry.list().filter((tool)=>tool.name.startsWith('pwa.'));
  assert(browserDefs.every((tool)=>!Object.hasOwn(tool.inputSchema?.properties ?? {},'endpoint')));

});

test('MCP HTTP endpoint supports discovery, list, call, header mismatch rejection, and localhost origin policy', async()=>{
  const root=await makeRepo();
  const registry=createToolRegistry({repoRoot:root,cdpFactory:fakeCdpFactory()});
  assert.throws(()=>createMcpHttpServer({repoRoot:root,host:'0.0.0.0',port:0,registry}),/CIVWEAVE_DEV_TOKEN/);
  const bridge=createMcpHttpServer({repoRoot:root,host:'127.0.0.1',port:0,registry});
  const address=await bridge.listen();
  const base=`http://127.0.0.1:${address.port}`;
  try{
    const health=await fetch(`${base}/health`); assert.equal(health.status,200);
    const list=await fetch(`${base}/mcp`,{method:'POST',headers:{'content-type':'application/json','mcp-protocol-version':'2026-07-28','mcp-method':'tools/list'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list',params:{_meta:{'io.modelcontextprotocol/clientInfo':{name:'test',version:'1'}}}})});
    assert.equal(list.status,200); const listed=await list.json(); assert(listed.result.tools.some((t)=>t.name==='repo.read_file'));

    const call=await fetch(`${base}/mcp`,{method:'POST',headers:{'content-type':'application/json','mcp-protocol-version':'2026-07-28','mcp-method':'tools/call','mcp-name':'repo.status'},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'repo.status',arguments:{},_meta:{'io.modelcontextprotocol/clientInfo':{name:'test',version:'1'}}}})});
    assert.equal(call.status,200); const called=await call.json(); assert.match(called.result.content[0].text,/master|main/);

    const mismatch=await fetch(`${base}/mcp`,{method:'POST',headers:{'content-type':'application/json','mcp-protocol-version':'2026-07-28','mcp-method':'tools/list'},body:JSON.stringify({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'repo.status',arguments:{}}})});
    assert.equal(mismatch.status,400);

    const forbidden=await fetch(`${base}/mcp`,{method:'POST',headers:{'content-type':'application/json','origin':'https://evil.example'},body:JSON.stringify({jsonrpc:'2.0',id:4,method:'tools/list',params:{}})});
    assert.equal(forbidden.status,403);
  } finally { await bridge.close(); }
});
