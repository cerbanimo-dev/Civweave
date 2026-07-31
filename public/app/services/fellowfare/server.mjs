import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || process.argv[2] || 4173);
const host = process.env.HOST || '0.0.0.0';
const types = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8', '.png':'image/png',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.txt':'text/plain; charset=utf-8', '.md':'text/markdown; charset=utf-8'
};

function json(response, status, body) {
  response.writeHead(status, {
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer'
  });
  response.end(JSON.stringify(body));
}

async function readJSON(request, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Request is too large'), { status:413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('Request body must be valid JSON'), { status:400 }); }
}

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url,{ ...options, signal:controller.signal }).finally(() => clearTimeout(timer));
}

function providerError(payload, status) {
  return payload?.error?.message || payload?.message || `Provider returned HTTP ${status}`;
}

async function callOpenAICompatible(config) {
  if (!config.model) throw Object.assign(new Error('An exact model name is required'), { status:400 });
  const base = String(config.endpoint || '').trim().replace(/\/$/,'');
  if (!/^https?:\/\//i.test(base)) throw Object.assign(new Error('Endpoint must begin with http:// or https://'), { status:400 });
  const url = /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
  const response = await fetchWithTimeout(url, {
    method:'POST',
    headers:{ 'content-type':'application/json', ...(config.apiKey ? { authorization:`Bearer ${config.apiKey}` } : {}) },
    body:JSON.stringify({
      model:config.model,
      messages:[{ role:'system', content:config.system },{ role:'user', content:config.user }],
      temperature:0.2,
      stream:false
    })
  }, config.timeoutMs);
  const payload = await response.json().catch(async () => ({ message:await response.text().catch(() => '') }));
  if (!response.ok) throw Object.assign(new Error(providerError(payload,response.status)), { status:502 });
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw Object.assign(new Error('Provider returned no assistant content'), { status:502 });
  return content;
}

async function callGemini(config) {
  if (!config.apiKey) throw Object.assign(new Error('A Gemini API key is required'), { status:400 });
  const base = String(config.endpoint || 'https://generativelanguage.googleapis.com/v1beta').trim().replace(/\/$/,'');
  if (!/^https?:\/\//i.test(base)) throw Object.assign(new Error('Endpoint must begin with http:// or https://'), { status:400 });
  const model = config.model || 'gemini-2.5-flash';
  const url = `${base}/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    systemInstruction:{ parts:[{ text:config.system }] },
    contents:[{ role:'user', parts:[{ text:config.user }] }],
    generationConfig:{ temperature:0.2, responseMimeType:'application/json' }
  };
  let response = await fetchWithTimeout(url, { method:'POST', headers:{ 'content-type':'application/json', 'x-goog-api-key':config.apiKey }, body:JSON.stringify(body) }, config.timeoutMs);
  let payload = await response.json().catch(() => ({}));
  if (!response.ok && response.status === 400) {
    // Some Gemini-compatible gateways reject responseMimeType. Retry without schemas or extra properties.
    delete body.generationConfig.responseMimeType;
    response = await fetchWithTimeout(url, { method:'POST', headers:{ 'content-type':'application/json', 'x-goog-api-key':config.apiKey }, body:JSON.stringify(body) }, config.timeoutMs);
    payload = await response.json().catch(() => ({}));
  }
  if (!response.ok) throw Object.assign(new Error(providerError(payload,response.status)), { status:502 });
  const content = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
  if (!content) throw Object.assign(new Error('Gemini returned no candidate content'), { status:502 });
  return content;
}

async function handleAI(request, response) {
  const body = await readJSON(request);
  const timeoutMs = Math.max(15_000, Math.min(300_000, Number(body.timeoutMs || 120_000)));
  const config = {
    provider:body.provider,
    endpoint:body.endpoint,
    model:body.model,
    apiKey:body.apiKey,
    system:String(body.system || ''),
    user:String(body.user || ''),
    timeoutMs
  };
  if (!config.system || !config.user) throw Object.assign(new Error('System and user prompts are required'), { status:400 });
  const content = config.provider === 'gemini' ? await callGemini(config) : await callOpenAICompatible(config);
  json(response,200,{ ok:true, content });
}

async function serveStatic(request, response, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const relative = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]+/, '');
  let filepath = join(root,relative);
  try {
    const info = await stat(filepath);
    if (info.isDirectory()) filepath = join(filepath,'index.html');
  } catch {
    if (!extname(filepath)) filepath = join(root,'index.html');
  }
  if (!filepath.startsWith(root)) throw Object.assign(new Error('Invalid path'), { status:400 });
  const body = await readFile(filepath);
  const extension = extname(filepath).toLowerCase();
  response.writeHead(200,{
    'content-type':types[extension] || 'application/octet-stream',
    'cache-control':extension === '.html' || extension === '.js' || extension === '.css' ? 'no-cache' : 'public, max-age=3600',
    'x-content-type-options':'nosniff',
    'referrer-policy':'same-origin',
    'permissions-policy':'geolocation=(), camera=(), microphone=()'
  });
  if (request.method === 'HEAD') response.end(); else response.end(body);
}

const server = http.createServer(async (request,response) => {
  try {
    const url = new URL(request.url || '/',`http://${request.headers.host || 'localhost'}`);
    if (request.method === 'GET' && url.pathname === '/api/ai/health') return json(response,200,{ ok:true, bridge:'fellowfare-local-ai', version:'0.3.0' });
    if (request.method === 'POST' && url.pathname === '/api/ai/chat') return await handleAI(request,response);
    if (!['GET','HEAD'].includes(request.method || 'GET')) return json(response,405,{ ok:false, error:'Method not allowed' });
    await serveStatic(request,response,url);
  } catch (error) {
    if (error.name === 'AbortError') return json(response,504,{ ok:false, error:'The provider did not answer before the configured timeout.' });
    const status = Number(error.status || (error.code === 'ENOENT' ? 404 : 500));
    if (status === 404) return json(response,404,{ ok:false, error:'Not found' });
    console.error('[Fellowfare]', error.message);
    json(response,status,{ ok:false, error:status >= 500 ? error.message || 'Server error' : error.message });
  }
});

server.listen(port,host,() => {
  console.log(`\nFellowfare is ready at http://localhost:${port}`);
  console.log(`LAN access is enabled on ${host}:${port}. Press Ctrl+C to stop.`);
  console.log('The local AI bridge is available at /api/ai/health. Secrets are never logged.\n');
});
