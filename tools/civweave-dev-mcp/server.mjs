#!/usr/bin/env node
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createToolRegistry } from './lib/tool-registry.mjs';

const CURRENT_PROTOCOL = '2026-07-28';
const LEGACY_PROTOCOL = '2025-11-25';
const SERVER_INFO = { name:'civweave-dev-tools', version:'1.0.0' };
const DEFAULT_LOCAL_STAGING_ORIGIN = 'http://127.0.0.1:8788';

function parseList(value) { return String(value || '').split(',').map((item)=>item.trim()).filter(Boolean); }
function isLoopback(host) { return ['127.0.0.1','::1','localhost'].includes(host); }

export function createMcpHttpServer({
  repoRoot = process.env.CIVWEAVE_REPO_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  host = process.env.CIVWEAVE_DEV_HOST || '127.0.0.1',
  port = Number(process.env.CIVWEAVE_DEV_PORT || 7331),
  token = process.env.CIVWEAVE_DEV_TOKEN || '',
  allowedOrigins = parseList(process.env.CIVWEAVE_DEV_ALLOWED_ORIGINS),
  localStagingOrigin = process.env.CIVWEAVE_LOCAL_STAGING_ORIGIN || DEFAULT_LOCAL_STAGING_ORIGIN,
  registry = createToolRegistry({repoRoot, localStagingOrigin}),
} = {}) {
  if (!isLoopback(host) && !token) throw new Error('CIVWEAVE_DEV_TOKEN is required when binding outside localhost');

  const allowOrigin = (origin) => {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;
    try { const url=new URL(origin); return isLoopback(url.hostname); } catch { return false; }
  };

  const server = http.createServer(async (req,res) => {
    const sendJson=(status,payload,extra={})=>{ const body=JSON.stringify(payload); res.writeHead(status,{'content-type':'application/json','content-length':Buffer.byteLength(body),...extra}); res.end(body); };
    if (req.method==='GET' && req.url==='/health') return sendJson(200,{ok:true,server:SERVER_INFO,protocol:CURRENT_PROTOCOL,localStagingOrigin});
    if (req.url!=='/mcp') return sendJson(404,{error:'not_found'});
    if (!allowOrigin(req.headers.origin)) return sendJson(403,{jsonrpc:'2.0',error:{code:-32001,message:'Origin not allowed'}});
    if (token && req.headers.authorization!==`Bearer ${token}`) return sendJson(401,{jsonrpc:'2.0',error:{code:-32002,message:'Unauthorized'}},{'www-authenticate':'Bearer'});
    if (req.method!=='POST') return sendJson(405,{error:'method_not_allowed'},{allow:'POST'});

    let raw='';
    for await (const chunk of req) { raw += chunk; if(raw.length>1_000_000){ req.destroy(); return; } }
    let message; try { message=JSON.parse(raw); } catch { return sendJson(400,{jsonrpc:'2.0',error:{code:-32700,message:'Parse error'}}); }
    const {id=null,method,params={}}=message || {};
    if (message?.jsonrpc!=='2.0' || typeof method!=='string') return sendJson(400,{jsonrpc:'2.0',id,error:{code:-32600,message:'Invalid Request'}});

    const requestedProtocol = req.headers['mcp-protocol-version'];
    if (requestedProtocol && ![CURRENT_PROTOCOL,LEGACY_PROTOCOL].includes(requestedProtocol)) {
      return sendJson(400,{jsonrpc:'2.0',id,error:{code:-32600,message:`Unsupported MCP protocol version: ${requestedProtocol}`}});
    }
    if (requestedProtocol===CURRENT_PROTOCOL && req.headers['mcp-method'] && req.headers['mcp-method']!==method) {
      return sendJson(400,{jsonrpc:'2.0',id,error:{code:-32020,message:'Mcp-Method header does not match JSON-RPC method'}});
    }
    if (method==='tools/call' && requestedProtocol===CURRENT_PROTOCOL && req.headers['mcp-name'] && req.headers['mcp-name']!==params.name) {
      return sendJson(400,{jsonrpc:'2.0',id,error:{code:-32020,message:'Mcp-Name header does not match tool name'}});
    }

    if (method==='notifications/initialized') { res.writeHead(204); return res.end(); }
    if (method==='initialize') return sendJson(200,{jsonrpc:'2.0',id,result:{protocolVersion:LEGACY_PROTOCOL,capabilities:{tools:{listChanged:false}},serverInfo:SERVER_INFO}});
    if (method==='server/discover') return sendJson(200,{jsonrpc:'2.0',id,result:{protocolVersion:CURRENT_PROTOCOL,capabilities:{tools:{listChanged:false}},serverInfo:SERVER_INFO}});
    if (method==='tools/list') return sendJson(200,{jsonrpc:'2.0',id,result:{tools:registry.list(),ttlMs:5000,cacheScope:'private'}});
    if (method==='tools/call') {
      if (!params?.name) return sendJson(200,{jsonrpc:'2.0',id,error:{code:-32602,message:'tools/call requires params.name'}});
      const result=await registry.call(params.name,params.arguments ?? {});
      return sendJson(200,{jsonrpc:'2.0',id,result});
    }
    return sendJson(200,{jsonrpc:'2.0',id,error:{code:-32601,message:`Method not found: ${method}`}});
  });

  return {
    server, host, port, localStagingOrigin,
    listen(){ return new Promise((resolve,reject)=>{ server.once('error',reject); server.listen(port,host,()=>{ server.off('error',reject); resolve(server.address()); }); }); },
    close(){ return new Promise((resolve,reject)=>server.close((error)=>error?reject(error):resolve())); },
  };
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const bridge=createMcpHttpServer();
  const address=await bridge.listen();
  process.stderr.write(`[civweave-dev-tools] MCP listening on http://${address.address}:${address.port}/mcp\n`);
  process.stderr.write(`[civweave-dev-tools] Local staging target: ${bridge.localStagingOrigin}\n`);
  process.stderr.write('[civweave-dev-tools] Browser actions are interaction-only; source changes must use repo.apply_patch.\n');
}
