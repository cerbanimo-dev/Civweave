import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';

const read=file=>readFileSync(new URL(`../public/app/${file}`,import.meta.url),'utf8');
const browser=read('knowledge-library-browser-v1.mjs').replace(/^import[^\n]*\r?\n/gm,'').replace(/^export /gm,'');
const html=read('knowledge-library-browser-v1.html');
const origin='https://civweave.test';
const mossPath='/app/cabinets/living-school/index.html';
const shellPath='/app/persistent-system-shell-v1.html';
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));

async function fixture(t,{persistent=true,hostPath=mossPath,foreignShell=false,staleStage=false,foreignModal=false,shellAccepts=true}={}){
  const calls=[],errors=[],console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message));
  const dom=new JSDOM('<html data-persistent-system="living-school"><body></body></html>',{url:origin+(persistent?shellPath+'?system=living-school&installed=1':hostPath+'?installed=1'),runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});
  t.after(()=>dom.window.close());
  const outer=dom.window;
  let moss=outer;
  if(persistent){
    const stage=outer.document.createElement('iframe');stage.id='cw-persistent-system-stage';stage.src=origin+hostPath+'?cabinet=1&installed=1&embed=1&persistentShell=1';outer.document.body.append(stage);moss=stage.contentWindow;
    outer.CivweavePersistentSystemShellV1={persistentNavbar:true,chromeOwner:true,current:()=> 'living-school',navigate:(system,options)=>{calls.push({system,options});return shellAccepts}};
    if(staleStage)stage.id='stale-stage';
  }else moss.CivweaveSystemRoutesV227={navigate:(system,options)=>{calls.push({system,options});return origin+'/app/working-campus-v440.html?installed=1'}};
  moss.document.open();moss.document.write('<html data-civweave-system="living-school"><head></head><body><header class="lsc218-header"></header></body></html>');moss.document.close();
  moss.requestAnimationFrame=fn=>{fn();return 0};
  moss.eval(read('cabinets/living-school/living-library-panel-v1.js'));
  moss.CivweaveLivingLibraryV1.open();
  const panel=moss.document.getElementById('living-library-panel-v1');
  let frame=panel.querySelector('iframe');
  if(foreignModal){frame=moss.document.createElement('iframe');frame.src=origin+'/app/knowledge-library-browser-v1.html?embed=living-school';moss.document.body.append(frame)}
  const library=frame.contentWindow;
  library.document.open();library.document.write(html);library.document.close();
  library.CivweaveKnowledgeSchools={loadCatalog:async()=>({schools:[]}),status:async()=>[]};
  library.upstreamRuntime={allLayerStatus:async()=>[],listDownloaded:async()=>[],searchDownloaded:async()=>[]};
  library.searchDownloadedKnowledge=async()=>[];
  library.eval(browser);await settle();
  if(foreignShell)dom.reconfigure({url:'https://untrusted.test'+shellPath+'?system=living-school'});
  const back=library.document.querySelector('.library-header .back');
  let prevented=false;
  // Observe the application's handler, then suppress jsdom's unimplemented
  // navigation so this fixture never emulates top-level browser navigation.
  back.addEventListener('click',event=>{prevented=event.defaultPrevented;event.preventDefault()});
  return{outer,moss,library,panel,frame,back,calls,errors,click(){back.click();return prevented}};
}

test('Living Library returns through its actual persistent ancestor and closes the existing modal',async t=>{
  const x=await fixture(t),before=x.library.location.href;
  assert.equal(x.click(),true,'The embedded link must consume its own default frame navigation');
  assert.equal(x.calls.length,1);assert.equal(x.calls[0].system,'civweave');
  assert.equal(x.panel.hidden,true);assert.equal(x.moss.document.body.style.overflow,'');
  assert.equal(x.library.location.href,before,'Returning must not replace the modal iframe with a campus');
  assert.deepEqual(x.errors,[]);
});

for(const [name,options] of [['foreign shell origin',{foreignShell:true}],['unrecognized host route',{hostPath:'/app/fellowfare-cabinet-v144.html'}],['stale persistent stage',{staleStage:true}],['unowned modal frame',{foreignModal:true}]])test(`Living Library refuses a ${name} without nesting Civweave or controlling an ancestor`,async t=>{
  const x=await fixture(t,options),before=x.library.location.href;
  assert.equal(x.click(),true);assert.equal(x.calls.length,0);assert.equal(x.panel.hidden,false);
  assert.equal(x.library.location.href,before);assert.match(x.library.document.getElementById('library-help').textContent,/return|close|Civweave/i);
});

test('a standalone Living School host delegates the return to its canonical route owner',async t=>{
  const x=await fixture(t,{persistent:false});assert.equal(x.click(),true);assert.equal(x.calls.length,1);assert.equal(x.calls[0].system,'civweave');assert.equal(x.panel.hidden,true);
});

test('a declined shell return leaves the library open and never falls through to frame navigation',async t=>{
  const x=await fixture(t,{shellAccepts:false}),before=x.library.location.href;
  assert.equal(x.click(),true);assert.equal(x.calls.length,1);assert.equal(x.panel.hidden,false);assert.equal(x.library.location.href,before);
  assert.match(x.library.document.getElementById('library-help').textContent,/Could not return/);
});

test('the standalone library fallback points at the current persistent Civweave entry',()=>{
  const dom=new JSDOM(html,{url:origin+'/app/knowledge-library-browser-v1.html'});
  try{const back=dom.window.document.querySelector('.library-header .back'),url=new URL(back.href);assert.equal(url.pathname,shellPath);assert.equal(url.searchParams.get('system'),'civweave');assert.equal(url.searchParams.get('installed'),'1');assert.notEqual(back.target,'_top')}
  finally{dom.window.close()}
});
