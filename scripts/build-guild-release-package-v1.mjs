import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const {subtle}=webcrypto;
const encoder=new TextEncoder();
const repoRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));
const REQUIRED_PATHS=Object.freeze([
  '/index.html','/app/','/app/pwa-start-v436.html','/app/persistent-system-shell-v1.html','/app/persistent-system-shell-v1.js','/app/system-routes-v227.js','/app/themed-system-nav-v178.js','/app/five-system-direct-navigation-v1.js','/app/persistent-system-context-v1.js','/app/persistent-shell-actions-v1.js','/app/generation-lifecycle-v2.js','/app/subsystem-avatar-state-v347.js','/app/settings-local-route-v331.js','/app/settings-local-loader-v337.js','/app/settings-local-route-v325.js','/app/settings-gateway-v317.js','/app/shared-guide-surface-v236.js','/app/guide-chat-surface-v350.js','/app/local-ai/gemma4-current-registry-authority-v1.js','/app/local-ai/gemma4-structured-quest-completion-v1.js','/app/local-ai/gemma4-litert-request-authority-v1.js','/app/local-ai/gemma4-structured-quest-compact-envelope-v1.js','/app/local-ai/gemma4-structured-task-authority-v1.js','/app/local-ai/gemma4-weave-draft-pipeline-v1.js','/app/local-ai/gemma4-first-request-intake-bridge-v1.js','/app/local-ai/gemma4-route-integrity-v1.js','/app/local-ai/gemma4-learning-plan-entry-authority-v1.js','/app/generation-failure-inspector-v1.js','/app/human-message-bubble-v1.js','/app/human-chat-network-v1.js','/app/human-chat-guild-context-v1.js','/app/platform-experience-v160.css','/app/working-campus-v440.html','/app/realm-console-v140.html','/app/realm-console-v140.css','/app/cerbanimo-quest-engine-v144.css','/app/shared/civweave-parity-runtime.js','/app/realm-console-v140.js','/app/cerbanimo-quest-engine-v144.js','/app/cerbanimo-quest-path-v266.js','/app/cerbanimo-proof-attachments-v165.js','/app/cerbanimo-video-task-contract-v1.mjs','/app/cw-reward-ledger-v2.js','/app/civweave-basic-value-v1.js','/app/cw-reward-receivers-v2.js','/app/civweave-basic-value-model-v1.js','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html','/app/cabinets/living-school/index.html','/finder/index.html','/app/hub-map-v1.html','/app/federation-finder-map-v275.html','/app/civweave-hub-map-v1.js','/app/civweave-guild-map-runtime-v2.js','/app/civweave-map-service-v275.js','/app/civweave-map-bootstrap-v1.js','/app/civweave-map-mesh-v276.js','/app/civweave-map-mesh-bridge-v276.js','/app/civweave-map-coverage-v277.js','/app/civweave-map-storage-v1.js','/app/civweave-map-offline-v1.js','/app/civweave-map-ui-v1.js'
]);
const normalized=value=>{if(Array.isArray(value))return value.map(normalized);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())if(value[key]!==undefined)out[key]=normalized(value[key]);return out}return value};
const canonical=value=>JSON.stringify(normalized(value));
const b64url=bytes=>Buffer.from(bytes).toString('base64url');
const sha256=async value=>b64url(await subtle.digest('SHA-256',value instanceof Uint8Array?value:encoder.encode(String(value??''))));
const args=Object.fromEntries(process.argv.slice(2).reduce((rows,item,index,list)=>{if(item.startsWith('--'))rows.push([item.slice(2),list[index+1]&&!list[index+1].startsWith('--')?list[index+1]:true]);return rows},[]));
const publicJwkFrom=value=>({kty:'EC',crv:'P-256',x:value.x,y:value.y,ext:true,key_ops:['verify']});
const contentType=path=>path.endsWith('.html')||path.endsWith('/')?'text/html; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':/\.m?js$/.test(path)?'text/javascript; charset=utf-8':path.endsWith('.json')?'application/json; charset=utf-8':'application/octet-stream';
const localPath=path=>path==='/app/'?join(repoRoot,'public/app/index.html'):join(repoRoot,'public',path.replace(/^\//,''));

async function generate(prefix){
  const pair=await subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const privateJwk=await subtle.exportKey('jwk',pair.privateKey),publicJwk=publicJwkFrom(await subtle.exportKey('jwk',pair.publicKey));
  const keyId=`p256:${(await sha256(canonical(publicJwk))).slice(0,32)}`;
  const anchor={schema:'civweave.local-release-trust-anchor.v1',keyId,publicKey:publicJwk,capabilities:['release','delegate','revoke'],label:keyId};
  writeFileSync(`${prefix}.private.jwk`,`${JSON.stringify(privateJwk,null,2)}\n`,{mode:0o600});
  writeFileSync(`${prefix}.anchor.json`,`${JSON.stringify(anchor,null,2)}\n`);
  console.log(JSON.stringify({ok:true,keyId,privateKey:`${prefix}.private.jwk`,anchor:`${prefix}.anchor.json`}));
}

async function build(){
  if(!args['private-key']||!args['release-id']||!args.out)throw new Error('Usage: node scripts/build-guild-release-package-v1.mjs --private-key <jwk> --release-id <id> --out <json> [--trust-bundle <json>]');
  const privateJwk=JSON.parse(readFileSync(resolve(String(args['private-key'])),'utf8')),publicJwk=publicJwkFrom(privateJwk);
  const signerKeyId=`p256:${(await sha256(canonical(publicJwk))).slice(0,32)}`;
  const assets=[];
  const manifestAssets=[];
  for(const path of REQUIRED_PATHS){
    const body=new Uint8Array(readFileSync(localPath(path))),digest=await sha256(body),type=contentType(path);
    manifestAssets.push({path,sha256:digest,contentType:type,required:true});
    assets.push({path,sha256:digest,contentType:type,bodyBase64Url:b64url(body)});
  }
  const unsigned={schema:'civweave.guild-release-manifest.v1',releaseId:String(args['release-id']),createdAt:new Date().toISOString(),signerKeyId,assets:manifestAssets};
  const privateKey=await subtle.importKey('jwk',privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const signature=b64url(await subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,encoder.encode(canonical(unsigned))));
  const packet={schema:'civweave.guild-release-package.v1',manifest:{...unsigned,signature},assets};
  if(args['trust-bundle'])packet.trustBundle=JSON.parse(readFileSync(resolve(String(args['trust-bundle'])),'utf8'));
  writeFileSync(resolve(String(args.out)),`${JSON.stringify(packet)}\n`);
  console.log(JSON.stringify({ok:true,releaseId:unsigned.releaseId,signerKeyId,assetCount:assets.length,out:resolve(String(args.out))}));
}

if(args['generate-key'])await generate(resolve(String(args['generate-key'])));else await build();
