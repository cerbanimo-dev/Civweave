import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const root=read('public/index.html');
const installer=read('public/app/index.html');
const boundary=read('public/app/install-boundary-v146.js');
const campus=read('public/app/working-campus-v440.html');
const campusRuntime=read('public/app/working-campus-v156.js');
const family=read('site/cerbanimo-cc/family/index.html');
const guardian=read('public/app/family-guardian-v1.html');
const builder=read('site/cerbanimo-cc/build.mjs');
const homepage=read('site/cerbanimo-cc/index.html');
const japanese=read('site/cerbanimo-cc/index.ja.html');

const rootScript=root.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(rootScript,'root script missing');
function route(url,{standalone=false}={}){
  let redirect=null;
  const parsed=new URL(url);
  const ctx={
    URL,URLSearchParams,
    location:{origin:parsed.origin,hostname:parsed.hostname,search:parsed.search,
      replace(value){redirect=value}},
    navigator:{standalone,userAgent:'Mozilla/5.0'},
    matchMedia:()=>({matches:standalone}),
    document:{querySelector:()=>({textContent:''})},
  };
  ctx.globalThis=ctx;
  vm.runInNewContext(rootScript,ctx);
  return new URL(redirect);
}
for(const path of ['https://civweave.cc/','https://community.example/','http://localhost:8080/']){
  const target=route(path);
  assert.equal(target.origin,new URL(path).origin,'entry must remain on its own Guild origin');
  assert.equal(target.pathname,'/app/working-campus-v440.html','browser entry must be canonical');
}
assert.equal(route('https://civweave.cc/?install=required').pathname,'/app/working-campus-v440.html');
assert.equal(route('https://civweave.cc/?install=1').pathname,'/app/index.html');
assert.equal(route('https://civweave.cc/',{standalone:true}).pathname,'/app/pwa-start-v436.html');

assert.match(installer,/params\.get\('install'\)==='1'/);
assert.match(installer,/source','browser-first-threshold-v1'/);
assert.match(boundary,/function allowed\(\)\{return true\}/);
assert.match(boundary,/browserRuntimePolicy:'browser-first-install-optional'/);
assert.doesNotMatch(boundary,/location\.replace\(installerUrl\(\)\)/);
assert.match(campus,/href="\/app\/family-guardian-v1\.html"/);
assert.match(campusRuntime,/get\('offline'\)!=='1'/);
assert.match(campusRuntime,/installer\.searchParams\.set\('install','1'\)/);
assert.match(family,/Connection status: not enabled/);
assert.match(family,/Age-appropriate supervision notices/);
assert.match(guardian,/Guardian connection not active/);
assert.match(guardian,/never displays child records/);
assert.match(builder,/cpSync\(resolve\(source, 'family'\), resolve\(output, 'family'\)/);
assert.match(homepage,/href="family\/"\>Family safety/);
assert.match(japanese,/href="\.\.\/family\/" lang="en"/);

console.log('Moonbridge browser-first / guardian gateway static and route checks passed.');
