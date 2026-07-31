import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const mockPort = 4194;
const appPort = 4195;

const mock = http.createServer(async (request,response) => {
  const chunks=[];
  for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  response.setHeader('content-type','application/json');
  if (request.url === '/v1/chat/completions') {
    response.end(JSON.stringify({ choices:[{ message:{ content:'{"ok":true,"message":"OpenAI bridge works"}' } }] }));
    return;
  }
  if (request.url === '/v1beta/models/test-gemini:generateContent') {
    response.end(JSON.stringify({ candidates:[{ content:{ parts:[{ text:'{"ok":true,"message":"Gemini bridge works"}' }] } }] }));
    return;
  }
  response.statusCode=404;
  response.end(JSON.stringify({error:{message:`Unknown mock path ${request.url}`}}));
});
mock.listen(mockPort,'127.0.0.1');
await once(mock,'listening');

const app = spawn(process.execPath,[join(root,'server.mjs'),String(appPort)],{cwd:root,stdio:['ignore','pipe','pipe']});
let logs='';
app.stdout.on('data',(chunk)=>logs+=chunk);
app.stderr.on('data',(chunk)=>logs+=chunk);

async function waitFor(url) {
  for (let i=0;i<30;i++) {
    try { const response=await fetch(url); if (response.ok) return; } catch {}
    await delay(100);
  }
  throw new Error(`Server did not start. ${logs}`);
}

try {
  await waitFor(`http://127.0.0.1:${appPort}/api/ai/health`);
  const common = { system:'Return JSON only', user:'connection test', timeoutMs:30000 };
  const openAI = await fetch(`http://127.0.0.1:${appPort}/api/ai/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...common,provider:'openai-compatible',endpoint:`http://127.0.0.1:${mockPort}/v1`,model:'test'})});
  const openPayload = await openAI.json();
  if (!openAI.ok || !openPayload.content.includes('OpenAI bridge works')) throw new Error(`OpenAI bridge failed: ${JSON.stringify(openPayload)}`);

  const gemini = await fetch(`http://127.0.0.1:${appPort}/api/ai/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...common,provider:'gemini',endpoint:`http://127.0.0.1:${mockPort}/v1beta`,model:'test-gemini',apiKey:'not-logged'})});
  const geminiPayload = await gemini.json();
  if (!gemini.ok || !geminiPayload.content.includes('Gemini bridge works')) throw new Error(`Gemini bridge failed: ${JSON.stringify(geminiPayload)}`);
  console.log('Fellowfare local AI bridge tests passed.');
} finally {
  app.kill('SIGTERM');
  mock.close();
}
