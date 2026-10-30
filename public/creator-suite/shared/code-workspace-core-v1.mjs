// Deterministic, dependency-free code worktree and Git SHA-1 object identities.
// Parsing source never executes it. This module has no storage or network authority.
export const CODE_WORKSPACE_SCHEMA='civweave.code-workspace.v1';
export const PUBLIC_CODE_SCHEMA='civweave.public-code-capsule.v1';
const encoder=new TextEncoder();
const MAX_FILES=128,MAX_FILE_BYTES=256*1024,MAX_TOTAL_BYTES=4*1024*1024;
const limit=(s,n=1000)=>String(s??'').slice(0,n);
const utf8=s=>encoder.encode(s);
const bytes=(...parts)=>{const all=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){all.set(p,at);at+=p.length}return all};
const hex=arr=>Array.from(new Uint8Array(arr),n=>n.toString(16).padStart(2,'0')).join('');
const rawHex=s=>Uint8Array.from(s.match(/.{2}/g)||[],x=>parseInt(x,16));
export function safeCodePath(path){
  if(typeof path!=='string'||path.length>240||path.startsWith('/')||path.includes('\\')||/[\u0000-\u001f]/.test(path)||path.split('/').some(x=>!x||x==='.'||x==='..')||!/^[a-zA-Z0-9_.@+\-\/]+$/.test(path))throw new Error('Invalid code path.');
  return path;
}
function measure(files){
  if(Object.keys(files).length>MAX_FILES)throw new Error('Workspace file limit exceeded.');
  let total=0;
  for(const [path,text] of Object.entries(files)){safeCodePath(path);if(typeof text!=='string')throw new TypeError('Code file content must be text.');const size=utf8(text).length;if(size>MAX_FILE_BYTES)throw new Error('File size limit exceeded: '+path);total+=size;}
  if(total>MAX_TOTAL_BYTES)throw new Error('Workspace storage limit exceeded.');
  return files;
}
export function applyCodeEdits(files,edits,{tier='small'}={}){
  if(!Array.isArray(edits)||!edits.length)throw new Error('At least one edit is required.');
  if(edits.length>(tier==='small'?3:64))throw new Error('Small models may send at most three edits; larger models may send at most 64.');
  const next=measure({...files});
  for(const edit of edits){
    const path=safeCodePath(edit?.path),op=edit?.op,prior=next[path],content=edit?.content;
    if(!['create','replace','append','replace_range','delete'].includes(op))throw new Error('Unsupported edit operation.');
    if(['create','replace','append','replace_range'].includes(op)&&typeof content!=='string')throw new Error('Edit content must be text.');
    if(op==='create'){if(prior!==undefined)throw new Error('File already exists: '+path);next[path]=content;}
    if(op==='replace'){if(prior===undefined)throw new Error('File does not exist: '+path);next[path]=content;}
    if(op==='append'){if(prior===undefined)throw new Error('File does not exist: '+path);next[path]=prior+content;}
    if(op==='delete'){if(prior===undefined)throw new Error('File does not exist: '+path);delete next[path];}
    if(op==='replace_range'){
      if(prior===undefined)throw new Error('File does not exist: '+path);
      const lines=prior.split('\n'),start=edit.startLine,end=edit.endLine;
      if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||end>lines.length)throw new Error('Line range is out of bounds.');
      lines.splice(start-1,end-start+1,...content.split('\n'));next[path]=lines.join('\n');
    }
  }
  return measure(next);
}
async function gitObject(type,data){
  const payload=bytes(utf8(type+' '+data.length+'\0'),data);
  return hex(await crypto.subtle.digest('SHA-1',payload));
}
async function treeHash(files){
  const root={};
  for(const [path,text] of Object.entries(files)){
    let here=root;const segments=path.split('/');
    for(const segment of segments.slice(0,-1)){here[segment]??={};if(typeof here[segment]==='string')throw new Error('File/directory collision.');here=here[segment];}
    const name=segments.at(-1);if(here[name]!==undefined)throw new Error('File/directory collision.');here[name]=text;
  }
  async function walk(dir){
    const parts=[];
    for(const [name,value] of Object.entries(dir).sort(([a,va],[b,vb])=>(typeof va==='string'?a:a+'/').localeCompare(typeof vb==='string'?b:b+'/','en'))){
      const isFile=typeof value==='string',sha=isFile?await gitObject('blob',utf8(value)):await walk(value);
      parts.push(bytes(utf8((isFile?'100644':'40000')+' '+name+'\0'),rawHex(sha)));
    }
    return gitObject('tree',bytes(...parts));
  }
  return walk(root);
}
export async function gitSnapshot(files,{message='Checkpoint',parent=null,timestamp=Date.now(),author='Civweave Local'}={}){
  measure(files);
  const blobs={};for(const [path,text] of Object.entries(files))blobs[path]=await gitObject('blob',utf8(text));
  const tree=await treeHash(files),time=Math.floor(Number(timestamp)/1000);
  if(!Number.isSafeInteger(time)||time<0)throw new Error('Invalid commit timestamp.');
  if(parent!==null&&!/^[a-f0-9]{40}$/.test(parent))throw new Error('Invalid parent Git commit.');
  const actor=limit(author,80).replace(/[<>\r\n]/g,'')||'Civweave Local';
  const safeMessage=limit(message,500).replace(/[\u0000-\u001f]/g,' ').trim()||'Checkpoint';
  const identity=actor+' <local@civweave.invalid> '+time+' +0000';
  const body='tree '+tree+'\n'+(parent?'parent '+parent+'\n':'')+'author '+identity+'\ncommitter '+identity+'\n\n'+safeMessage+'\n';
  return{head:await gitObject('commit',utf8(body)),tree,blobs,parent,message:safeMessage,createdAt:new Date(time*1000).toISOString()};
}
const SECRET_RE=/(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|secret[_-]?key|password)\s*[:=]\s*['"`]?[A-Za-z0-9_\/+\-=]{20,}|gh[pousr]_[A-Za-z0-9_]{25,}|sk-(?:live|proj)-[A-Za-z0-9_\-]{20,})/i;
export function inspectSnippet(path,source){
  safeCodePath(path);if(typeof source!=='string')throw new TypeError('Snippet must be text.');
  const diagnostics=[];if(utf8(source).length>MAX_FILE_BYTES)diagnostics.push({severity:'error',code:'oversize',message:'Snippet exceeds the per-file limit.'});
  if(/(^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519|\.npmrc|credentials(?:\.json)?|secrets?\.json)$/i.test(path))diagnostics.push({severity:'error',code:'private-path',message:'Credential files cannot be published.'});
  if(SECRET_RE.test(source))diagnostics.push({severity:'error',code:'possible-secret',message:'Possible credential or private key: redact before publishing.'});
  if(/^(?:<<<<<<< |=======\s*$|>>>>>>> )/m.test(source))diagnostics.push({severity:'error',code:'merge-marker',message:'Unresolved merge conflict.'});
  let syntaxStatus='not-checked';
  if(/\.json$/i.test(path)){try{JSON.parse(source);syntaxStatus='checked'}catch(e){syntaxStatus='failed';diagnostics.push({severity:'error',code:'json-syntax',message:limit(e.message,180)});}}
  else diagnostics.push({severity:'info',code:'parser-unavailable',message:'Language syntax and tests require an approved validator; no code was executed.'});
  return{ok:!diagnostics.some(x=>x.severity==='error'),path,bytes:utf8(source).length,syntaxStatus,diagnostics};
}
export function publicationPreview(files,{paths=[],license,title='',description=''}={}){
  measure(files);
  if(!['MIT','Apache-2.0','BSD-3-Clause','GPL-3.0-or-later','MPL-2.0','CC0-1.0'].includes(license))throw new Error('An explicit redistribution license is required.');
  if(!Array.isArray(paths)||!paths.length||paths.length>MAX_FILES)throw new Error('Select files for publication.');
  const selected={};const validation=[];
  for(const path of new Set(paths)){safeCodePath(path);if(files[path]===undefined)throw new Error('Selected file is missing: '+path);const report=inspectSnippet(path,files[path]);if(!report.ok)throw new Error('File excluded from publication: '+path+' ('+report.diagnostics.filter(x=>x.severity==='error').map(x=>x.code).join(', ')+')');selected[path]=files[path];validation.push(report);}
  return{schema:PUBLIC_CODE_SCHEMA,title:limit(title,120),description:limit(description,2000),license,files:selected,validation,execution:'never-auto-run',adoption:'manual-review'};
}
