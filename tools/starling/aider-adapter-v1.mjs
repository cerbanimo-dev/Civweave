/**
 * Local-only Aider execution adapter ported from Starling Studio's on-demand
 * coding workshop. Never callable directly by an untrusted model or browser.
 *
 * The caller is the trusted Civweave host, which must verify a task-scoped
 * grant via the existing permission owner. The adapter does not deploy code,
 * claim tasks, or mark Quest beats complete.
 */
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,copyFile,realpath,lstat,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep,win32,posix,relative,dirname,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {planCollectiveToolUse} from '../../public/app/shared/starling-collective-tools-v1.mjs';

const EXTENSIONS=new Set(['.py','.js','.ts','.html','.css','.json','.md','.svg','.txt']);
const text=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';

export function normalizeAiderFiles(files) {
  if(!Array.isArray(files)||files.length<1||files.length>12)throw new TypeError('Provide 1–12 workshop-relative files.');
  const unique=[];
  for(const value of files){
    if(typeof value!=='string'||!value||value.length>160||value.includes('\\')||value.includes(':')||value.startsWith('.')||value.startsWith('/')||isAbsolute(value)||win32.isAbsolute(value))
      throw new TypeError('Unsafe workspace file path.');
    const parts=value.split('/');
    if(parts.some(part=>!part||part==='.'||part==='..'||part.startsWith('.')||['secrets','data','node_modules','dist','build'].includes(part.toLowerCase())))
      throw new TypeError('Restricted workspace path.');
    const extension=posix.extname(value).toLowerCase();
    if(!EXTENSIONS.has(extension))throw new TypeError('Unsupported source file format.');
    if(!unique.includes(value))unique.push(value);
  }
  return unique;
}
function localEndpoint(input){
  const url=new URL(text(input||'http://127.0.0.1:11434/v1',1000));
  if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.hash)
    throw new TypeError('The Aider local adapter requires a loopback HTTP model endpoint.');
  if(!url.pathname.endsWith('/v1'))url.pathname=url.pathname.replace(/\/+$/,'')+'/v1';
  return url.origin+url.pathname;
}
function normalizeModel(value){
  const model=text(value||'qwen3.5:4b',130);
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._/:+-]{0,129}$/.test(model))throw new TypeError('Invalid local model name.');
  return model.startsWith('openai/')||model.startsWith('ollama/')?model:'openai/'+model;
}
function boundedOutput(value,limit){return typeof value==='string'?value.slice(-limit):''}
function spawnRunner({args,cwd,endpoint,timeoutMs,executable='aider'}){
  return new Promise(resolveResult=>{
    let finished=false,stdout='',stderr='',child;
    const finish=output=>{if(finished)return;finished=true;clearTimeout(timer);resolveResult(output)};
    const timer=setTimeout(()=>{try{child?.kill()}catch{};finish({success:false,error:'Aider exceeded the bounded task deadline.',stdout,stderr})},timeoutMs);
    try{
      child=spawn(executable,args,{cwd,shell:false,windowsHide:true,env:{
        PATH:process.env.PATH||'',Path:process.env.Path||'',SystemRoot:process.env.SystemRoot||'',
        HOME:cwd,USERPROFILE:cwd,TEMP:process.env.TEMP||tmpdir(),TMP:process.env.TMP||tmpdir(),
        OPENAI_API_BASE:endpoint,OPENAI_API_KEY:'ollama',AIDER_ANALYTICS:'false',PYTHONUTF8:'1'
      }});
      child.stdout?.on('data',buffer=>{stdout=boundedOutput(stdout+buffer.toString('utf8'),30000)});
      child.stderr?.on('data',buffer=>{stderr=boundedOutput(stderr+buffer.toString('utf8'),12000)});
      child.on('error',error=>finish({success:false,error:'Could not launch Aider: '+error.message,stdout,stderr}));
      child.on('close',exitCode=>finish({success:exitCode===0,exitCode,stdout,stderr}));
    }catch(error){finish({success:false,error:'Aider failed: '+error.message})}
  });
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function validatedFiles(root,files){
  const entries=[];
  for(const file of files){
    const full=resolve(root,file);
    if(!full.startsWith(root+sep))throw new TypeError('Workshop path escaped approved root.');
    const stat=await lstat(full);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2_000_000)throw new TypeError('Aider files must be regular source files under 2 MB.');
    const actual=await realpath(full);
    if(!actual.startsWith(root+sep))throw new TypeError('Workshop file links outside approved root.');
    entries.push({name:file,full,hash:sha(await readFile(full))});
  }
  return entries;
}

export async function executeAiderHandoff({
  workspaceRoot,guildId,taskId,actorId,brief,files,authorization,verifyAuthorization,
  verifyApplyAuthorization,enabledTools=[],apply=false,model,baseUrl,timeoutMs=240000,runner=spawnRunner
}={}){
  const policy=planCollectiveToolUse({toolId:'aider',taskId,guildId,actorId,enabledTools,authorization,verifyAuthorization});
  if(!policy.allowed)throw new Error('Aider task authorization denied: '+policy.reason);
  if(apply===true&&(!authorization||typeof verifyApplyAuthorization!=='function'||verifyApplyAuthorization(authorization)!==true))
    throw new Error('Aider apply authorization is required.');
  const prompt=text(brief,4001);
  if(!prompt||prompt.length>4000)throw new TypeError('Coding brief must be 1–4,000 characters.');
  const selected=normalizeAiderFiles(files);
  if(typeof workspaceRoot!=='string'||!isAbsolute(workspaceRoot))throw new TypeError('Trusted workshop must be an absolute path.');
  const root=await realpath(workspaceRoot);
  const entries=await validatedFiles(root,selected);
  const endpoint=localEndpoint(baseUrl),chosenModel=normalizeModel(model);
  const deadline=Math.min(900000,Math.max(10000,Math.floor(Number(timeoutMs)||240000)));
  // Both preview and approved apply run in a disposable file-only copy.
  // This is not OS-level isolation: host security must still restrict the
  // Aider process externally when invoking untrusted model-generated code.
  const scratch=await mkdtemp(join(tmpdir(),'civweave-starling-aider-'));
  const cwd=scratch;
  try{
    for(const file of entries){const target=join(scratch,file.name);await mkdir(dirname(target),{recursive:true});await copyFile(file.full,target)}
    const assignment='You are the Aider implementation tool for Civweave Starling Collective. Edit only listed workshop files. Do not access secrets, the parent workspace, deployment, payments, publishing, or other services. Return the changes for Cerbanimo review. This is not authority to mark work complete.\n\nTASK:\n'+prompt;
    const args=['--yes','--no-git','--no-auto-commits','--no-stream','--message',assignment,...(apply?[]:['--dry-run']),'--model',chosenModel,...selected];
    const result=await runner({args,cwd,endpoint,timeoutMs:deadline,executable:'aider'});
    const changes=[];
    if(apply&&result?.success===true)for(const file of entries){
      const candidate=resolve(scratch,file.name);
      const stat=await lstat(candidate);
      if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2_000_000)throw new TypeError('Aider returned an unsafe edited file.');
      const bytes=await readFile(candidate),actual=sha(bytes);
      if(actual!==file.hash){
        // Re-check target identity and the original contents immediately
        // before copying; another actor must not replace this approved file.
        const current=await realpath(file.full);
        if(current!==file.full||sha(await readFile(file.full))!==file.hash)throw new Error('Workshop file changed during Aider execution; review and retry.');
        await copyFile(candidate,file.full);
        changes.push(file.name);
      }
    }
    return Object.freeze({
      schema:'civweave.starling-aider-result.v1',
      success:result?.success===true&&(!apply||changes.length>0),
      mode:apply?'apply':'preview',applied:apply===true,workshop:root,
      changedFiles:Object.freeze(changes),
      stdout:boundedOutput(result?.stdout,30000),stderr:boundedOutput(result?.stderr,12000),
      error:text(result?.error,500)||((result?.success===true&&apply&&!changes.length)?'No approved file changed.':null),
      reviewRequired:true,questBeatCompleted:false
    });
  }finally{await rm(scratch,{recursive:true,force:true})}
}
