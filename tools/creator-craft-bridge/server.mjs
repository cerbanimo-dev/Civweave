import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {executeWordcraft,checkInstalled,BridgeError,MAX_INPUT_BYTES} from './wordcraft.mjs';
import {executeCadcraft,checkCadcraftInstalled} from './cadcraft.mjs';

const PORT=47871;
const MAX_BODY_BYTES=Math.ceil(MAX_INPUT_BYTES/3)*4+4096;
const DEFAULT_ORIGINS=['http://127.0.0.1:8788','http://localhost:8788'];
export function createWordcraftBridge({token,allowedOrigins=DEFAULT_ORIGINS,execute=executeWordcraft,installed=checkInstalled,cadExecute=executeCadcraft,cadInstalled=checkCadcraftInstalled}={}){
  if(typeof token!=='string'||token.length<32)throw new Error('A random bridge access token of at least 32 characters is required.');
  const origins=new Set(allowedOrigins);
  const secureToken=Buffer.from(token);
  const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};
  return createServer(async(req,res)=>{
    const origin=req.headers.origin;
    if(origin&&!origins.has(origin)){json(res,403,{ok:false,code:'ORIGIN_DENIED'});return;}
    if(origin){
      res.setHeader('Access-Control-Allow-Origin',origin);
      res.setHeader('Vary','Origin');
      res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
      if(req.headers['access-control-request-private-network']==='true')res.setHeader('Access-Control-Allow-Private-Network','true');
    }
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    const host=String(req.headers.host||'');
    if(!/^((127\.0\.0\.1)|(localhost))(:\d+)?$/.test(host)){json(res,403,{ok:false,code:'HOST_DENIED'});return;}
    const supplied=String(req.headers.authorization||'').replace(/^Bearer /,'');
    const suppliedBuffer=Buffer.from(supplied);
    if(suppliedBuffer.length!==secureToken.length||!timingSafeEqual(suppliedBuffer,secureToken)){
      json(res,401,{ok:false,code:'UNAUTHORIZED'});return;
    }
    try{
      if(req.method==='GET'&&req.url==='/v1/capabilities'){
        json(res,200,{ok:true,schema:'civweave.craft-bridge-capabilities.v1',wordcraft:{installed:await installed(),actions:['inspect','text','pdf'],maxInputBytes:MAX_INPUT_BYTES},cadcraft:{installed:await cadInstalled(),actions:['info','svg'],maxInputBytes:MAX_INPUT_BYTES}});
        return;
      }
      if(req.method!=='POST'||!['/v1/wordcraft','/v1/cadcraft'].includes(req.url)){json(res,404,{ok:false,code:'NOT_FOUND'});return;}
      if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new BridgeError('JSON request required.','CONTENT_TYPE',415);
      let size=0,chunks=[];
      for await(const chunk of req){
        size+=chunk.length;
        if(size>MAX_BODY_BYTES){throw new BridgeError('Request too large.','REQUEST_TOO_LARGE',413);}
        chunks.push(chunk);
      }
      let request;
      try{request=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
      catch{throw new BridgeError('Malformed JSON.','INVALID_JSON',400);}
      const result=await(req.url==='/v1/wordcraft'?execute(request):cadExecute(request));
      json(res,200,{ok:true,result});
    }catch(error){
      if(error instanceof BridgeError)json(res,error.status,{ok:false,code:error.code,error:error.message});
      else json(res,500,{ok:false,code:'INTERNAL_ERROR',error:'Document processing failed.'});
    }
  });
}
if(process.argv[1]&&resolve(fileURLToPath(import.meta.url))===resolve(process.argv[1])){
  const token=process.env.CIVWEAVE_CRAFT_TOKEN||randomBytes(32).toString('base64url');
  const origins=String(process.env.CIVWEAVE_CRAFT_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  const server=createWordcraftBridge({token,allowedOrigins:[...DEFAULT_ORIGINS,...origins]});
  server.listen(PORT,'127.0.0.1',()=>{
    console.log('Civweave WordCraft bridge on http://127.0.0.1:'+PORT);
    console.log('Bridge token (enter only in your trusted Civweave Creator Suite): '+token);
    console.log('Allowed origins: '+[...DEFAULT_ORIGINS,...origins].join(', '));
  });
}
