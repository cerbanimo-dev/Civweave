import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(path,'utf8');
const source=read('public/app/chat-visual-expressions-v1.js');
const guide=read('public/app/guide-chat-surface-v350.js');
const native=read('public/app/local-ai/native-server-guide-fastpath-v1.js');
const passover=read('public/app/guide-capability-passover-v1.js');
const local=read('public/app/local-provider-authority-v1.js');
const assistant=read('public/app/assistant-runtime-v141.js');
const smollm=read('public/app/smollm2-small-model-v137.js');
const offline=read('public/service-worker-shell-assets-v1.js');

class FakeNode{
  constructor(tag){
    this.tagName=tag;
    this.children=[];
    this.style={};
    this.dataset={};
    this.attributes={};
    this.listeners={};
    this.textContent='';
  }
  append(...nodes){this.children.push(...nodes);}
  setAttribute(k,v){this.attributes[k]=String(v);}
  addEventListener(k,fn){this.listeners[k]=fn;}
}
const calls=[];
const sandbox={
  console,
  document:{createElement:tag=>new FakeNode(tag),getElementById:()=>null},
  dispatchEvent(){},
  CustomEvent:class{},
  CivweaveGuideChatSurfaceV350:{open:args=>calls.push(args)}
};
vm.runInNewContext(source,sandbox,{filename:'chat-visual-expressions-v1.js',timeout:1500});
const visuals=sandbox.CivweaveChatVisualsV1;
assert.ok(visuals?.render&&visuals?.mount&&visuals?.promptFor,'Visual renderer API must load without the rest of the PWA');
const fence=String.fromCharCode(96).repeat(3);
const input='Plain intro\n'+fence+'cw-view\n'+JSON.stringify({type:'chart',title:'Sample',labels:['A','B'],values:[3,7]})+'\n'+fence+'\nPlain outro';
const parsed=visuals.extract(input);
assert.equal(parsed.views.length,1,'Valid block produces one module');
assert.equal(parsed.text,'Plain intro\n\nPlain outro','Module markup is removed from visible prose');
assert.equal(parsed.views[0].title,'Sample');
assert.equal(visuals.extract('[[cw:meter|Milestones|2|5]]').views[0].value,2);
assert.equal(visuals.extract('[[cw:character|moss|curious|Try this]]').views[0].mood,'curious');
assert.equal(visuals.extract('before\n'+fence+'cw-view\n{not json}\n'+fence).views.length,0,'Invalid JSON is never interpreted');
assert.ok(visuals.extract('before\n'+fence+'cw-view\n{not json}\n'+fence).text.includes('{not json}'),'Failed visuals remain readable');
assert.equal(visuals.parse('{"type":"html","body":"<script>no</script>"}'),null,'No arbitrary HTML component');
assert.ok(!source.includes('.innerHTML='),'AI data must never pass through innerHTML');
assert.ok(!source.includes('eval('),'No runtime code evaluation');
assert.equal(visuals.tierFor('smollm2-360m-instruct'),'tiny');
assert.equal(visuals.tierFor('qwen3.5:4b'),'small');
assert.equal(visuals.tierFor('qwen3.5:27b'),'full');
assert.ok(visuals.promptFor({model:'qwen3.5:4b'}).includes('cw-view'));
assert.ok(visuals.promptFor({model:'qwen3.5:0.8b'}).includes('[[cw:meter'));
assert.equal(visuals.promptFor({structured:true}),'','Strict machine tasks must be able to opt out of markup');

const options={type:'choices',title:'Choose',options:[{label:'Work on Moss',prompt:'Make a Learning Journey'}]};
assert.ok(visuals.valid(options),'Choices with options must validate');
const view=visuals.render(options,{system:'living-school'});
assert.equal(view.tagName,'section');
function all(node){return [node,...node.children.flatMap(all)];}
const button=all(view).find(node=>node.tagName==='button');
assert.ok(button,'Choice must render a control');
button.listeners.click();
assert.equal(calls[0].guide,'living-school');
assert.equal(calls[0].prefill,'Make a Learning Journey','Click must only prefill text, not submit it');
const userText='<img src=x onerror=alert(1)>';
const card=visuals.render({type:'card',title:userText,body:userText},{system:'civweave'});
assert.ok(all(card).some(node=>node.textContent===userText),'Display arbitrary user text as inert text nodes');
assert.ok(all(card).every(node=>node.tagName!=='img'),'HTML injection cannot create an image tag');
assert.ok(visuals.render({type:'quiz',options:['x','y'],answerIndex:1,question:'Pick?'})?.children.length);
assert.ok(visuals.render({type:'table',headers:['a','b'],rows:[['1','2']]})?.children.length);
assert.ok(visuals.render({type:'diagram',nodes:['first','second']})?.children.length);
for(const file of [guide,native,passover,local,assistant,smollm]){
  assert.ok(file.includes('ChatVisualsV1')||file.includes('cw:meter'),'Each live guide prompt path must expose visual tools');
}
assert.ok(guide.includes('visuals.mount(article,row'),'Canonical persistent chat owns module placement');
assert.ok(guide.includes('ensureVisuals()'),'Visual renderer must be loaded before model requests');
assert.ok(offline.includes('/app/chat-visual-expressions-v1.js'),'Offline shell must include the optional module');
console.log('Visual expression regression checks passed.');
