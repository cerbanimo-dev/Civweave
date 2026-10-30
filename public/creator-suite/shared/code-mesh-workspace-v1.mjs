import {applyCodeEdits,inspectSnippet,gitSnapshot,publicationPreview,CODE_WORKSPACE_SCHEMA,PUBLIC_CODE_SCHEMA,safeCodePath} from './code-workspace-core-v1.mjs';

const DB_NAME='civweave.code-mesh-workspace.v1',VAULT='vault',KEYS='keys';
const MESH_KIND='civweave.code-capsule.v1', MAX_HISTORY=250;
const enc=new TextEncoder(),dec=new TextDecoder(),previews=new Map(),locks=new Map();
let databasePromise=null;
function passport(){
  const id=globalThis.CivweavePassportIdentityV1?.passportId?.();
  if(!id)throw new Error('A local Civweave Passport is required to open encrypted code workspaces.');
  return id;
}
function mesh(){const m=globalThis.CivweaveLocalMeshV146;if(!m?.createObject||!m?.listObjects||!m?.validateObject)throw new Error('The signed local object mesh is not available.');return m;}
const now=()=>new Date().toISOString();
function b64(bytes){let result='';for(const b of bytes)result+=String.fromCharCode(b);return btoa(result).replaceAll('+','-').replaceAll('/','_').replace(/=+$/g,'');}
function unb64(s){const raw=String(s).replaceAll('-','+').replaceAll('_','/');return Uint8Array.from(atob(raw+'='.repeat((4-raw.length%4)%4)),c=>c.charCodeAt(0));}
const uniqueId=()=>crypto.randomUUID();
async function db(){
  if(databasePromise)return databasePromise;
  databasePromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{const d=request.result;if(!d.objectStoreNames.contains(VAULT))d.createObjectStore(VAULT,{keyPath:'id'});if(!d.objectStoreNames.contains(KEYS))d.createObjectStore(KEYS,{keyPath:'passportId'});};
    request.onerror=()=>{databasePromise=null;reject(request.error);};request.onsuccess=()=>resolve(request.result);
  });return databasePromise;
}
async function request(store,mode,command){
  const d=await db();return new Promise((resolve,reject)=>{
    const tx=d.transaction(store,mode),os=tx.objectStore(store),r=command(os);
    if(r&&typeof r==='object'&&'onsuccess' in r)r.onsuccess=()=>resolve(r.result);
    tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage aborted.'));
    if(!r)tx.oncomplete=()=>resolve(undefined);
  });
}
async function deviceKey(id){
  let row=await request(KEYS,'readonly',os=>os.get(id));
  if(row?.key)return row.key;
  // Non-extractable key is persisted by IndexedDB structured clone, never exported.
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const d=await db();return new Promise((resolve,reject)=>{
    const tx=d.transaction(KEYS,'readwrite'),os=tx.objectStore(KEYS),get=os.get(id);
    get.onsuccess=()=>{if(get.result?.key){row=get.result;}else{row={passportId:id,key,createdAt:now()};os.put(row);}};
    tx.oncomplete=()=>resolve(row.key);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
const aad=(id,p)=>enc.encode(CODE_WORKSPACE_SCHEMA+'\n'+p+'\n'+id);
async function encrypt(repo,p){
  const key=await deviceKey(p),iv=crypto.getRandomValues(new Uint8Array(12)),data=enc.encode(JSON.stringify(repo));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(repo.id,p)},key,data);
  return{id:repo.id,passportId:p,revision:repo.revision,iv:b64(iv),ciphertext:b64(new Uint8Array(ciphertext)),updatedAt:now()};
}
async function decrypt(record){
  const p=passport();if(record.passportId!==p)throw new Error('Workspace belongs to another Passport.');
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(record.iv),additionalData:aad(record.id,p)},await deviceKey(p),unb64(record.ciphertext));
  const repo=JSON.parse(dec.decode(plaintext));
  if(repo.schema!==CODE_WORKSPACE_SCHEMA||repo.id!==record.id||repo.revision!==record.revision)throw new Error('Workspace integrity mismatch.');
  return repo;
}
async function getRepo(id){const record=await request(VAULT,'readonly',os=>os.get(id));if(!record)throw new Error('Code workspace not found.');return decrypt(record);}
async function writeRepo(repo,expected){
  const row=await encrypt(repo,passport()),d=await db();
  return new Promise((resolve,reject)=>{
    const tx=d.transaction(VAULT,'readwrite'),os=tx.objectStore(VAULT),req=os.get(repo.id);let conflict=null;
    req.onsuccess=()=>{const current=req.result; if((current?.revision??null)!==expected){conflict=new Error('Stale workspace revision: read the latest status and retry.');tx.abort();return;}os.put(row);};
    tx.oncomplete=()=>resolve(repo);
    tx.onabort=()=>reject(conflict||tx.error||new Error('Workspace save aborted.'));tx.onerror=()=>reject(tx.error);
  });
}
async function locked(id,fn){
  // Cross-tab serial access where Web Locks are present, in-tab fallback otherwise.
  if(globalThis.navigator?.locks?.request)return navigator.locks.request('cw-code-'+id,fn);
  const previous=locks.get(id)||Promise.resolve();
  const next=previous.catch(()=>{}).then(fn);locks.set(id,next);try{return await next}finally{if(locks.get(id)===next)locks.delete(id);}
}
function publicStatus(repo){
  return{id:repo.id,title:repo.title,revision:repo.revision,head:repo.head,filePaths:Object.keys(repo.files).sort(),commits:repo.history.map(x=>({head:x.head,tree:x.tree,message:x.message,createdAt:x.createdAt})),privacy:'passport-encrypted-on-origin-device',publishedByDefault:false,format:'Git-SHA1-object-identities',fullGitCLI:false};
}
export async function createWorkspace({title='Untitled code project'}={}){
  const id=uniqueId(),repo={schema:CODE_WORKSPACE_SCHEMA,id,title:String(title).slice(0,120),createdAt:now(),files:{},revision:0,head:null,history:[]};
  await writeRepo(repo,null);return publicStatus(repo);
}
export async function listWorkspaces(){
  const p=passport(),rows=await request(VAULT,'readonly',os=>os.getAll()),result=[];
  for(const row of rows||[]){if(row.passportId!==p)continue;try{result.push(publicStatus(await decrypt(row)))}catch{result.push({id:row.id,unreadable:true,privacy:'encrypted'})}}
  return result;
}
export async function status(id){return publicStatus(await getRepo(id));}
export async function readFile(id,path,{startLine=1,endLine=200}={}){
  safeCodePath(path);const repo=await getRepo(id),source=repo.files[path];if(source===undefined)throw new Error('File not found.');
  const lines=source.split('\n'),start=Math.max(1,Math.floor(startLine)),end=Math.min(lines.length,start+Math.min(400,Math.max(1,Math.floor(endLine)-start+1))-1);
  return{path,revision:repo.revision,totalLines:lines.length,startLine:start,endLine:end,content:lines.slice(start-1,end).join('\n')};
}
export async function validate(id,{paths=null}={}){
  const repo=await getRepo(id),selected=paths===null?Object.keys(repo.files):paths;
  const reports=selected.map(path=>{safeCodePath(path);if(repo.files[path]===undefined)throw new Error('File not found: '+path);return inspectSnippet(path,repo.files[path]);});
  return{revision:repo.revision,head:repo.head,ok:reports.every(x=>x.ok),reports,staticOnly:true,testsExecuted:false};
}
export async function submitEdits({workspaceId,expectedRevision,edits,tier='small',message='Agentic edit batch',actor='AI'}={}){
  if(!Number.isInteger(expectedRevision)||expectedRevision<0)throw new Error('expectedRevision is required.');
  return locked(workspaceId,async()=>{
    const repo=await getRepo(workspaceId);
    if(repo.revision!==expectedRevision)throw new Error('Stale workspace revision: inspect current status.');
    if(repo.history.length>=MAX_HISTORY)throw new Error('Workspace checkpoint limit reached. Export a native Git archive before continuing.');
    const files=applyCodeEdits(repo.files,edits,{tier});
    const git=await gitSnapshot(files,{parent:repo.head,message,author:actor==='human'?'Civweave Human':'Civweave AI'});
    const changed=[...new Set(edits.map(x=>x.path))],reports=changed.filter(path=>files[path]!==undefined).map(path=>inspectSnippet(path,files[path]));
    const updated={...repo,files,head:git.head,revision:repo.revision+1,history:[...repo.history,{...git,files,actor:actor==='human'?'human':'ai'}]};
    await writeRepo(updated,repo.revision);
    return{...publicStatus(updated),editCount:edits.length,validation:{ok:reports.every(x=>x.ok),reports,staticOnly:true,testsExecuted:false}};
  });
}
export async function historyFile(workspaceId,head,path){
  safeCodePath(path);const repo=await getRepo(workspaceId),commit=repo.history.find(c=>c.head===head);
  if(!commit)throw new Error('Checkpoint not found.');
  return{path,head,content:commit.files[path]??null};
}
export async function previewPublication(workspaceId,options={}){
  const repo=await getRepo(workspaceId),packet=publicationPreview(repo.files,options);
  const publicGit=await gitSnapshot(packet.files,{message:'Public code capsule',author:'Civweave Contributor',timestamp:0});
  const previewId=uniqueId();
  const ready={previewId,workspaceId,revision:repo.revision,publicGitHead:publicGit.head,packet,createdAt:now()};
  previews.set(previewId,ready);
  return{previewId,revision:repo.revision,files:Object.keys(packet.files),license:packet.license,title:packet.title,description:packet.description,validation:packet.validation,gitHead:publicGit.head,warning:'Public mesh copies can persist indefinitely. No unpublish can recall copies. Publishing exposes selected source and the signing device pseudonym.'};
}
export async function publishReviewed(previewId,clickEvent){
  if(clickEvent?.isTrusted!==true)throw new Error('Only an explicit human UI action can authorize public publication.');
  const review=previews.get(previewId);if(!review)throw new Error('Publication preview expired.');
  previews.delete(previewId);
  if((await getRepo(review.workspaceId)).revision!==review.revision)throw new Error('Workspace changed after review; create a new preview.');
  const origin=await mesh().deviceId();
  const object=await mesh().createObject({kind:MESH_KIND,purpose:'Publicly licensed code available for review and optional adoption',consent:'public',audience:[],hopLimit:3,publish:true,priority:35,payload:{...review.packet,publicGitHead:review.publicGitHead,publishedAt:now(),providerDeviceId:origin}});
  return{published:true,objectId:object.id,revisionHash:object.revisionHash};
}
export async function discoverPublic({query='',limit=40}={}){
  const m=mesh(),q=String(query).trim().toLowerCase(),found=[];
  for(const object of await m.listObjects()){
    if(object.kind!==MESH_KIND||object.consent!=='public'||object.payload?.schema!==PUBLIC_CODE_SCHEMA)continue;
    if(!(await m.validateObject(object)).ok)continue;
    const p=object.payload;if(q&&!([p.title,p.description,Object.keys(p.files||{}).join(' ')].join(' ').toLowerCase().includes(q)))continue;
    found.push({objectId:object.id,title:p.title,description:p.description,license:p.license,paths:Object.keys(p.files||{}),head:p.publicGitHead,providerDeviceId:p.providerDeviceId,publishedAt:p.publishedAt});
    if(found.length>=Math.min(100,Math.max(1,limit)))break;
  }
  return found;
}
export async function inspectPublic(objectId){
  const m=mesh(),object=await m.getObject(objectId);
  if(object?.kind!==MESH_KIND||object.consent!=='public'||object.payload?.schema!==PUBLIC_CODE_SCHEMA||(await m.validateObject(object)).ok!==true)throw new Error('Not a validated public capsule.');
  const p=object.payload;publicationPreview(p.files,{paths:Object.keys(p.files),license:p.license,title:p.title,description:p.description});
  return{objectId,license:p.license,title:p.title,description:p.description,files:p.files,validation:Object.entries(p.files).map(([path,content])=>inspectSnippet(path,content)),source:'untrusted external code - never executed'};
}
export async function adoptReviewed(objectId,clickEvent){
  if(clickEvent?.isTrusted!==true)throw new Error('Only an explicit human UI action can adopt peer code.');
  const packet=await inspectPublic(objectId),repo=await createWorkspace({title:'Adopted: '+packet.title});
  // Clone into an encrypted local worktree; source cannot run on adoption.
  const edits=Object.entries(packet.files).map(([path,content])=>({op:'create',path,content}));
  if(edits.length){let revision=0;for(let i=0;i<edits.length;i+=64){const r=await submitEdits({workspaceId:repo.id,expectedRevision:revision,edits:edits.slice(i,i+64),tier:'large',message:'Adopt reviewed public code',actor:'human'});revision=r.revision;}}
  return{workspaceId:repo.id,adoptedFrom:objectId,sourceLicense:packet.license,executed:false};
}
export const CivweaveCodeWorkspaceV1=Object.freeze({createWorkspace,listWorkspaces,status,readFile,validate,submitEdits,historyFile,previewPublication,discoverPublic,inspectPublic});
globalThis.CivweaveCodeWorkspaceV1=CivweaveCodeWorkspaceV1;
// Publishing and adopting deliberately stay outside the AI-facing tools facade.
