import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [streaming,loader]=await Promise.all([
  read('public/app/guide-stream-thinking-v249.js'),
  read('public/app/shared-guide-surface-v236.js')
]);

new Function(streaming);
new Function(loader);

assert.match(loader,/guide-stream-thinking-v249\.js\?v=[^'"\s]*v249-navigation-lifecycle-v424/,'shared guide loader must mount the navigation-safe streaming thinking layer');
assert.match(loader,/function liveHead\(\)/,'shared guide loader must retain detached-document protection');
assert.match(loader,/addEventListener\('pageshow',\(\)=>queueMicrotask\(install\)\)/,'shared guide loader must reinstall after page restoration');
assert.match(streaming,/purpose==='civweave-guide-response-v141'/,'canonical assistant responses must opt into streaming');
assert.match(streaming,/stream:true,config:\{\.\.\.\(request\.config\|\|\{\}\),stream:true\}/,'interactive model requests must force stream on both request and config');
assert.match(streaming,/event\?\.phase!=='partial'/,'partial model events must drive live chat rendering');
assert.match(streaming,/indexOf\('<think>'\)/,'thinking parser must recognize opening think tags');
assert.match(streaming,/indexOf\('<\/think>'/,'thinking parser must recognize closing think tags');
assert.match(streaming,/<details class=\"cw249-thinking\"/,'thinking output must render as a disclosure');
assert.match(streaming,/state\.done\?'':'open'/,'thinking disclosure must stay open during generation and collapse on completion');
assert.match(streaming,/"answer"\\s\*:\\s\*"/,'structured JSON answer text must be extracted incrementally rather than exposing raw JSON');
assert.match(streaming,/thinkingText:state\.thinking/,'completed reasoning must persist with the assistant row');
assert.match(streaming,/thinkingCollapsed:true/,'completed reasoning must persist in collapsed form');
assert.ok(!streaming.includes('setInterval('),'streaming layer must not poll continuously');

console.log(JSON.stringify({ok:true,revision:'guide-stream-thinking-v249-navigation-lifecycle-v424',livePartials:true,thinkingDisclosure:true,collapseOnFinal:true,structuredAnswerStreaming:true,navigationSafeLoader:true},null,2));