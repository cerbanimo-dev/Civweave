import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCodeEdits, inspectSnippet, gitSnapshot, publicationPreview } from '../public/creator-suite/shared/code-workspace-core-v1.mjs';

test('small model submits no more than three atomic edits',()=>{
  const old={'src/a.js':'one\ntwo'};
  assert.throws(()=>applyCodeEdits(old,[{op:'append',path:'src/a.js',content:'x'} ,{op:'append',path:'src/a.js',content:'y'},{op:'append',path:'src/a.js',content:'z'},{op:'append',path:'src/a.js',content:'q'}],{tier:'small'}),/three/i);
  assert.deepEqual(old,{'src/a.js':'one\ntwo'});
  const next=applyCodeEdits(old,[{op:'replace_range',path:'src/a.js',startLine:2,endLine:2,content:'three'},{op:'create',path:'src/b.json',content:'{"ok":true}'}],{tier:'small'});
  assert.equal(next['src/a.js'],'one\nthree');
  assert.equal(next['src/b.json'],'{"ok":true}');
});
test('rejects traversal, stale or ambiguous edits',()=>{
  assert.throws(()=>applyCodeEdits({},[{op:'create',path:'../private',content:'x'}]),/path/i);
  assert.throws(()=>applyCodeEdits({'a.js':'x'},[{op:'create',path:'a.js',content:'y'}]),/exists/i);
  assert.throws(()=>applyCodeEdits({'a.js':'x'},[{op:'replace_range',path:'a.js',startLine:3,endLine:3,content:'y'}]),/range/i);
});
test('checkpoints produce stable Git-format blob, tree and commit object identities',async()=>{
  const first=await gitSnapshot({'hello.txt':'hello\n'},{message:'Initial commit',timestamp:0,author:'Local Author'});
  const second=await gitSnapshot({'hello.txt':'hello\n'},{message:'Initial commit',timestamp:0,author:'Local Author'});
  assert.equal(first.head,second.head);
  assert.equal(first.blobs['hello.txt'],'ce013625030ba8dba906f756967f9e9ca394464a');
  assert.match(first.head,/^[a-f0-9]{40}$/);
  assert.match(first.tree,/^[a-f0-9]{40}$/);
});
test('snippet validation blocks secret markers and invalid JSON without executing code',()=>{
  assert.equal(inspectSnippet('a.json','{oops}').ok,false);
  assert.equal(inspectSnippet('src/key.js','const api_key = "sk_test_123456789012345678901234567890";').ok,false);
  const check=inspectSnippet('a.js','const x = 1;');
  assert.equal(check.ok,true);
  assert.equal(check.syntaxStatus,'not-checked');
});
test('public review is deny-by-default, checks path allowlist and required license',()=>{
  const files={'src/a.js':'ok','config/.env':'SECRET=1'};
  assert.throws(()=>publicationPreview(files,{paths:['src/a.js'],license:''}),/license/i);
  assert.throws(()=>publicationPreview(files,{paths:['config/.env'],license:'MIT'}),/excluded/i);
  const packet=publicationPreview(files,{paths:['src/a.js'],license:'MIT',title:'Example'});
  assert.deepEqual(Object.keys(packet.files),['src/a.js']);
  assert.ok(!JSON.stringify(packet).includes('SECRET'));
});
