(()=>{
'use strict';
let session=null,saveTimer=null,lastText='';
const editor=()=>document.getElementById('cs-text-editor');
const provenance=()=>globalThis.CivweaveContentProvenanceV1;
const store=()=>globalThis.CivweaveCreatorStoreV1;
async function digest(text){const bytes=new TextEncoder().encode(text),hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')}
function notify(){dispatchEvent(new CustomEvent('creator-suite:session-updated',{detail:{kind:'text',session}}))}
async function persist(){if(session)await store()?.putSession(session)}
function newSession(){session=provenance().createSession({mediaType:'text',artifactType:'document',sourceSystem:'creator-suite'});lastText='';if(editor())editor().textContent='';persist();notify();return session}
async function recordHumanSnapshot(type='text.replace'){
  if(!session)newSession();const text=editor()?.innerText||'',contentDigest=await digest(text);session=await provenance().recordEvent(session,{type,actor:{kind:'human',id:'local-creator'},payload:{length:text.length,contentDigest:`sha256:${contentDigest}`}});lastText=text;await persist();notify();return session;
}
function scheduleSnapshot(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>recordHumanSnapshot(),180)}
async function execute(action,args,actor){if(!session)newSession();if(action==='replaceAll'||action==='generate'){const text=String(args.text||args.content||''),contentDigest=await digest(text);editor().innerText=text;session=await provenance().recordEvent(session,{type:'ai.generate',actor,payload:{target:'document',acceptedLength:text.length,outputDigest:`sha256:${contentDigest}`}});lastText=text;await persist();notify();return{session,textLength:text.length}}if(action==='append'){const text=String(args.text||''),next=(editor().innerText||'')+text,contentDigest=await digest(text);editor().innerText=next;session=await provenance().recordEvent(session,{type:'text.insert',actor,payload:{offset:next.length-text.length,length:text.length,contentDigest:`sha256:${contentDigest}`}});lastText=next;await persist();notify();return{session,textLength:next.length}}throw new Error(`Unsupported text action: ${action}`)}
function init(){const node=editor();if(!node)return;node.addEventListener('input',scheduleSnapshot);node.addEventListener('paste',async event=>{if(!session)newSession();const pasted=event.clipboardData?.getData('text/plain')||'';session=await provenance().recordEvent(session,{type:'external.paste',actor:{kind:'external',id:'clipboard'},payload:{length:pasted.length,contentDigest:`sha256:${await digest(pasted)}`}});await persist();notify()});document.querySelector('[data-new-session="text"]')?.addEventListener('click',newSession);globalThis.CivweaveCreatorToolsV1?.registerEditor('text',{actions:['replaceAll','generate','append'],execute});newSession()}
globalThis.CivweaveCreatorTextV1=Object.freeze({init,newSession,getSession:()=>session,getText:()=>editor()?.innerText||'',recordHumanSnapshot});
})();
