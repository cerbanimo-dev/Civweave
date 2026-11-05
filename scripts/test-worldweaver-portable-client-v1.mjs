import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {COMMONS_BETWEEN} from '../public/app/shared/worldweaver-universe-v1.mjs';
import {LANTERN_MESH} from '../public/app/shared/worldweaver-lantern-mesh-v1.mjs';
import {exportPortableUniverseHtml} from '../public/app/shared/worldweaver-portable-client-v1.mjs';

for(const universe of [COMMONS_BETWEEN,LANTERN_MESH]){
  test(universe.id+' exports a complete one-file offline Civweave client',()=>{
    const html=exportPortableUniverseHtml(universe);
    assert.match(html,/<!doctype html>/i);
    assert.match(html,/id="cw-universe-data"/);
    assert.match(html,/id="cw-quest-form"/);
    assert.match(html,/id="cw-room-list"/);
    assert.doesNotMatch(html,/<script[^>]+src=/i);
    assert.doesNotMatch(html,/<link[^>]+href=/i);
    assert.doesNotMatch(html,/<iframe/i);
    const dom=new JSDOM(html,{url:'https://offline.example/'+universe.id,runScripts:'dangerously'});
    const {document}=dom.window;
    assert.equal(document.querySelector('#cw-world-title').textContent,universe.title);
    assert.ok(document.querySelectorAll('[data-room]').length>=4);
    const rooms=document.querySelectorAll('[data-room]');
    rooms[1].click();
    assert.ok(document.querySelector('#cw-current-room').textContent.length>0);
    const input=document.querySelector('#cw-quest-title');
    input.value='Help the people in this world';
    document.querySelector('#cw-quest-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
    assert.match(document.querySelector('#cw-quest-list').textContent,/Help the people/);
    assert.match(dom.window.localStorage.getItem('civweave.portable.world.'+universe.id+'.v1'),/Help the people/);
    document.querySelector('#cw-tab-journal').click();
    assert.equal(document.querySelector('#cw-panel-journal').hidden,false);
    dom.window.close();
  });
}

test('script delimiters and malicious labels are inert data',()=>{
  const html=exportPortableUniverseHtml({id:'test-world',title:'<script>evil</script>',rooms:[{id:'one',title:'</script><script>window.pwned=true</script>',description:'test'}]});
  assert.doesNotMatch(html,/<script>window\.pwned=true/i);
  const dom=new JSDOM(html,{url:'https://offline.example',runScripts:'dangerously'});
  assert.equal(dom.window.pwned,undefined);
  assert.match(dom.window.document.querySelector('#cw-current-room').textContent,/script/);
  dom.window.close();
});

test('rejects empty and oversized/malformed blueprint',()=>{
  assert.throws(()=>exportPortableUniverseHtml(null),/Universe/);
  assert.throws(()=>exportPortableUniverseHtml({id:'../../evil',title:'oops',rooms:[{id:'one',title:'One'}]}),/ID/);
  assert.throws(()=>exportPortableUniverseHtml({id:'empty',title:'Empty',rooms:[]}),/room/i);
});
