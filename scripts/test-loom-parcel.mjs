import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,readFile,readdir,rm,writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pack,verify,restore } from './loom-parcel.mjs';

async function fixture() {
  const base=await mkdtemp(path.join(os.tmpdir(),'civweave-parcel-test-'));
  const root=path.join(base,'repo');await mkdir(root);
  execFileSync('git',['init','-q'],{cwd:root});
  const files={
    'README.md':Buffer.from('# The Loom\n'.repeat(650)),
    'AGENTS.md':Buffer.from('This is an agent guide.'),
    'docs/contracts/mobile-interface-contract.md':Buffer.from('Offline-first; privacy by default.\n'),
    'scripts/loom-parcel.mjs':Buffer.from('// source'),
    'docs/lore/scene.md':Buffer.from('LOOM LORE '.repeat(30000)),
    'public/app/logos/image.png':Buffer.alloc(300000,42),
  };
  for(const [name,buffer] of Object.entries(files)){
    await mkdir(path.dirname(path.join(root,name)),{recursive:true});
    await writeFile(path.join(root,name),buffer);
  }
  execFileSync('git',['add','.'],{cwd:root});
  execFileSync('git',['-c','user.name=test','-c','user.email=test@example.com','commit','-qm','fixture'],{cwd:root});
  return {base,root,files};
}
test('seed is lossless, exact, portable and small',async(t)=>{
  const f=await fixture();t.after(()=>rm(f.base,{recursive:true,force:true}));
  const out=path.join(f.base,'parcels'),into=path.join(f.base,'restored');
  const info=await pack({root:f.root,out,tier:'seed','chunk-kib':'64'});
  assert.equal(info.fileCount,4);
  assert.equal(info.chunkBytes,65536);
  assert.equal((await verify({out})).ok,true);
  assert.match(await readFile(path.join(out,'loom-restore.mjs'),'utf8'),/export \{pack,verify,restore\}/);
  execFileSync(process.execPath,[path.join(out,'loom-restore.mjs'),'verify','--out',out]);
  await restore({out,into});
  for(const p of ['README.md','AGENTS.md','docs/contracts/mobile-interface-contract.md','scripts/loom-parcel.mjs'])
    assert.deepEqual(await readFile(path.join(into,p)),f.files[p]);
  const all=await readdir(path.join(out,'parts'));
  assert.ok(all.length>0);
  for(const name of all)assert.ok((await readFile(path.join(out,'parts',name))).length<=65536);
  await assert.rejects(()=>restore({out,into}),/empty/);
});
test('source excludes binary; full permits exact binary reconstruction',async(t)=>{
  const f=await fixture();t.after(()=>rm(f.base,{recursive:true,force:true}));
  const source=path.join(f.base,'source'),full=path.join(f.base,'full');
  await pack({root:f.root,out:source,tier:'source'});
  await restore({out:source,into:path.join(f.base,'source-restored')});
  assert.deepEqual(await readFile(path.join(f.base,'source-restored','docs/lore/scene.md')),f.files['docs/lore/scene.md']);
  await assert.rejects(()=>readFile(path.join(f.base,'source-restored','public/app/logos/image.png')),{code:'ENOENT'});
  await pack({root:f.root,out:full,tier:'full'});
  await restore({out:full,into:path.join(f.base,'full-restored')});
  assert.deepEqual(await readFile(path.join(f.base,'full-restored','public/app/logos/image.png')),f.files['public/app/logos/image.png']);
});
test('corrupt parcel is detected before restore writes',async(t)=>{
  const f=await fixture();t.after(()=>rm(f.base,{recursive:true,force:true}));
  const out=path.join(f.base,'parcels'),into=path.join(f.base,'restored');
  await pack({root:f.root,out,tier:'seed'});
  const first=(await readdir(path.join(out,'parts')))[0];
  await writeFile(path.join(out,'parts',first),Buffer.from('tampered'));
  await assert.rejects(()=>verify({out}),/Corrupt parcel/);
  await assert.rejects(()=>restore({out,into}),/Corrupt parcel/);
  await assert.rejects(()=>readdir(into),{code:'ENOENT'});
});
test('manifest tampering is rejected',async(t)=>{
  const f=await fixture();t.after(()=>rm(f.base,{recursive:true,force:true}));
  const out=path.join(f.base,'parcels');await pack({root:f.root,out,tier:'seed'});
  await writeFile(path.join(out,'manifest.json.br'),Buffer.from('not the manifest'));
  await assert.rejects(()=>verify({out}),/Manifest hash mismatch/);
});
