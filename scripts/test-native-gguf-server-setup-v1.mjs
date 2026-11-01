import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SERVER_URL,SERVER_MODEL,COMMANDS,
  validateServerAddress,checkServer,generateServerTest
} from '../public/app/local-ai/native-gguf-server-setup-v1.js';
const settings=readFileSync('public/app/settings-gateway-v317.js','utf8');
const source=readFileSync('public/app/local-ai/native-gguf-server-setup-v1.js','utf8');
assert.equal(SERVER_URL,'http://127.0.0.1:8080/v1');
assert.equal(SERVER_MODEL,'qwen35-4b-native');
assert.equal(COMMANDS.length,3);
assert.match(COMMANDS[0],/pkg install -y llama-cpp/);
assert.match(COMMANDS[1],/termux-setup-storage/);
assert.match(COMMANDS[1],/Qwen3\.5-4B-Q4_K_M\.gguf/);
assert.match(COMMANDS[2],/--host 127\.0\.0\.1 --port 8080/);
assert.match(COMMANDS[2],/--alias qwen35-4b-native/);
assert.match(COMMANDS[2],/--reasoning off/);
assert.match(source,/f-droid\.org\/packages\/com\.termux/);
assert.match(source,/github\.com\/termux\/termux-app\/releases/);
assert.match(source,/github\.com\/ggml-org\/llama\.cpp\/blob\/master\/docs\/android\.md/);
assert.match(source,/data-server-model/);
assert.match(settings,/data-native-gguf-server/);
assert.match(settings,/mountNativeServerSetup/);
assert.match(settings,/model!=='qwen35-4b-native'/);
assert.match(settings,/persist\(\{\.\.\.DEFAULTS,route:'openai-compatible'/);
assert.doesNotMatch(source,/localStorage|sessionStorage|modelManager\.downloadModel|termux-setup-storage\(/,'Viewing the guide must not write model state, execute native commands or download model weights.');
assert.equal(validateServerAddress(SERVER_URL),SERVER_URL);
for(const url of ['https://remote.example/v1','http://192.168.1.12:8080/v1',
  'http://127.0.0.1:8081/v1','http://localhost:8080/v1',
  'http://127.0.0.1:8080/v1/../admin'])assert.throws(()=>validateServerAddress(url),/Android setup only tests|only tests/);

const calls=[];
const answer=(payload,code=200)=>({ok:code>=200&&code<300,status:code,text:async()=>JSON.stringify(payload)});
const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('/models'))return answer({data:[{id:SERVER_MODEL}]});
  if(url.endsWith('/chat/completions'))return answer({choices:[{message:{content:'READY'}}]});
  throw Error('Unexpected URL '+url);
};
const first=await checkServer({fetcher});
assert.deepEqual(first.models,[SERVER_MODEL]);
const second=await generateServerTest({fetcher});
assert.equal(second.answer,'READY');
assert.equal(calls.length,2);
assert.deepEqual(calls.map(c=>c.url),[SERVER_URL+'/models',SERVER_URL+'/chat/completions']);
assert.equal(calls[0].options.method,'GET');
assert.equal(calls[1].options.method,'POST');
assert.equal(calls[1].options.credentials,'omit');
const body=JSON.parse(calls[1].options.body);
assert.equal(body.model,SERVER_MODEL);
assert.equal(body.max_tokens,24);
assert.equal(body.stream,false);
await assert.rejects(checkServer({fetcher:async()=>answer({data:[{id:'unexpected-model'}]})}),/Unexpected loaded model/);
await assert.rejects(generateServerTest({fetcher:async()=>answer({choices:[{message:{content:''}}]})}),/no visible generated text/);
await assert.rejects(checkServer({fetcher:async()=>answer({error:'down'},500)}),/HTTP 500/);
const alternate=async(url)=>url.endsWith('/models')?answer({data:[{id:'qwen35-2b-native'}]}):
 answer({choices:[{message:{content:'READY'}}]});
const foundTwo=await checkServer({model:'qwen35-2b-native',fetcher:alternate});
assert.deepEqual(foundTwo.models,['qwen35-2b-native']);
const testedTwo=await generateServerTest({model:'qwen35-2b-native',fetcher:alternate});
assert.equal(testedTwo.model,'qwen35-2b-native');
await assert.rejects(generateServerTest({fetcher:async()=>answer({choices:[{message:{content:'gibberish'}}]})}),/not the requested READY/);

console.log('Native Termux server guide tests passed: official download links, original Q4 file, loopback binding, explicit model and generation tests, and no settings-open networking.');
