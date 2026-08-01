/* Commonweave universal Merlin chat v1.0.14
 * Conversational, read-only, and intentionally free of deterministic response wrappers.
 */
(function(global){
  "use strict";
  if(global.CommonweaveMerlinChat)return;
  const script=document.currentScript;
  const asset=(name)=>new URL(`../assets/ai/${name}`,script?.src||location.href).href;
  const STORAGE="commonweave.merlin-chat.v1";
  const POSITION_KEY="commonweave.merlin-launcher-position.v1";
  const MAX_MESSAGES=80;
  const SECRET_KEY=/api.?key|secret|token|password|credential|private|bearer/i;
  let controller=null,open=false,unread=false;
  const safeJson=(raw,fallback=null)=>{try{return JSON.parse(raw)}catch{return fallback}};
  const esc=(value)=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const compact=(value,max=220)=>String(value??"").replace(/\s+/g," ").trim().slice(0,max);
  const read=(key,fallback=null)=>safeJson(localStorage.getItem(key)||"",fallback);
  const cloneSafe=(value,depth=0)=>{
    if(depth>4)return "[depth limited]";
    if(Array.isArray(value))return value.slice(0,20).map(item=>cloneSafe(item,depth+1));
    if(!value||typeof value!=="object")return typeof value==="string"?value.slice(0,600):value;
    const out={};for(const [key,item] of Object.entries(value)){if(SECRET_KEY.test(key))continue;out[key]=cloneSafe(item,depth+1)}return out;
  };
  function load(){const stored=read(STORAGE,{messages:[],includePlatform:true});return {messages:Array.isArray(stored?.messages)?stored.messages.slice(-MAX_MESSAGES):[],includePlatform:stored?.includePlatform!==false}}
  let session=load();
  function save(){try{localStorage.setItem(STORAGE,JSON.stringify({messages:session.messages.slice(-MAX_MESSAGES),includePlatform:session.includePlatform,updatedAt:new Date().toISOString()}))}catch{}}
  function currentRealm(){const path=location.pathname;return path.includes("living-school")?"Living School":path.includes("cerbanimo")?"Cerbanimo":path.includes("anarchadia")?"Anarchadia":path.includes("fellowfare")?"FellowFare":"Commonweave Campus"}
  function summarizeIntentions(){const values=read("commonweave.intentions.v2",[]);return (Array.isArray(values)?values:[]).slice(0,12).map(item=>({title:compact(item.title,140),status:item.status,progress:item.health?.progress,health:compact(item.health?.summary,180),steps:Array.isArray(item.steps)?item.steps.length:0,systems:item.systems||[]}))}
  function summarizeLiving(){const s=read("living-academy-v19-state",null);if(!s)return null;return {school:s.school?{title:compact(s.school.title,160),subject:compact(s.school.subject,180),modules:s.school.modules?.length||0}:null,workspace:s.academy?.activeWorkspace,completedModules:s.clearedModules?.length||0,practica:(s.academy?.practica||[]).slice(-10).map(x=>({title:compact(x.title,120),status:x.status,moduleId:x.moduleId})),reviews:(s.academy?.reviews||[]).slice(-10).map(x=>({status:x.status,practicumId:x.practicumId||x.artifactId})),artifacts:s.artifacts?.length||0,badges:(s.badges||[]).map(x=>compact(x.name||x.title,100)).slice(-12),credentials:s.credentialProposals?.length||0,events:(s.events||[]).slice(-12).map(x=>({type:x.type,at:x.at}))}}
  function summarizeCerbanimo(){const s=read("cerbanimo-pocket-constellary-v0.6",null);if(!s)return null;return {quests:(s.quests||[]).slice(0,12).map(x=>({title:compact(x.title,130),status:x.status,tasks:x.taskIds?.length||0})),tasks:(s.tasks||[]).slice(0,20).map(x=>({title:compact(x.title,120),status:x.status,questId:x.questId})),threads:s.threads?.length||0,proposals:(s.proposals||[]).filter(x=>x.status==="pending").length,selectedView:s.ui?.view}}
  function summarizeFellowFare(){const s=read("fellowfare.mvp.state.v3",null)||read("fellowfare.mvp.state.v2",null);if(!s)return null;return {route:s.route,agreements:(s.agreements||[]).slice(0,12).map(x=>({title:compact(x.title,120),status:x.status})),listings:(s.listings||[]).slice(0,12).map(x=>({title:compact(x.title,120),status:x.status})),inbox:s.inbox?.length||s.messages?.length||0,profile:compact(s.profile?.displayName||s.profile?.name,100)}}
  function domSummary(){return [...document.querySelectorAll("h1,h2,[role='heading'],.status-token,.tag")].filter(node=>node.offsetParent!==null).map(node=>compact(node.textContent,120)).filter(Boolean).slice(0,28)}
  function platformSnapshot(){
    const live=global.CommonweaveLiveData?.records;
    return cloneSafe({capturedAt:new Date().toISOString(),currentRealm:currentRealm(),visibleInterface:domSummary(),intentions:summarizeIntentions(),livingSchool:summarizeLiving(),cerbanimo:summarizeCerbanimo(),fellowFare:summarizeFellowFare(),liveRecords:Array.isArray(live)?live.slice(0,20).map(r=>({system:r.system,type:r.type,title:compact(r.title,120),status:r.status,updatedAt:r.updatedAt})):[]});
  }
  const SYSTEM=`You are Merlin, Commonweave's android starfish wizard. You are a universal conversational and generative companion with read-only platform insight.

Your allowed work:
- Answer questions about the supplied Commonweave platform snapshot.
- Explain patterns, summarize records, compare information, brainstorm, write, rewrite, imagine, critique, and generate drafts.
- State uncertainty when the snapshot does not contain the answer.

Hard boundaries:
- You have no tools and must never claim to have changed, moved, routed, approved, submitted, created, deleted, or updated an intention, task, quest, record, setting, route, or platform state.
- Do not act as a navigation or directions system. You may name the realm or screen where information appears, but do not issue step-by-step routing directions or pretend to open it.
- Do not convert the conversation into deterministic plans, JSON contracts, proposals, or action wrappers unless the user explicitly asks you to draft such text. Even then, it remains an uncommitted draft.
- Do not impersonate Kamiya, Moss, Rook, or Weaveling. For intention movement, routing, approvals, or operational planning, say that Merlin is read-only and the appropriate platform steward must handle it.
- Never expose secrets, keys, tokens, or private fields. The supplied context has already been filtered.

Speak naturally. The interface renders your answer as ordinary conversation, not a deterministic wrapper.`;
  function modelConfig(){const rt=global.CommonweaveModelRuntime,base=rt?.readSharedConfig?.("interactive");if(!base)return null;return {...base,stream:true,temperature:Math.max(.45,Number(base.temperature||.75)),maxTokens:Math.max(2048,Number(base.maxTokens||4096)),timeoutMs:Math.max(90000,Number(base.timeoutMs||120000)),service:"commonweave-merlin"}}
  function modelReady(){const config=modelConfig();return config&&!['deterministic','manual'].includes(config.provider)}
  let ui={};
  function launcherPosition(){return read(POSITION_KEY,null)}
  function saveLauncherPosition(position){try{localStorage.setItem(POSITION_KEY,JSON.stringify(position))}catch{}}
  function clampLauncherPosition(position){
    if(!ui.launcher)return null;
    const rect=ui.launcher.getBoundingClientRect(),margin=8;
    const width=rect.width||74,height=rect.height||74;
    return {x:Math.max(margin,Math.min(global.innerWidth-width-margin,Number(position?.x)||margin)),y:Math.max(margin,Math.min(global.innerHeight-height-margin,Number(position?.y)||margin))};
  }
  function applyLauncherPosition(position=launcherPosition()){
    if(!ui.launcher||!position)return;const next=clampLauncherPosition(position);if(!next)return;
    ui.launcher.style.left=`${next.x}px`;ui.launcher.style.top=`${next.y}px`;ui.launcher.style.right="auto";ui.launcher.style.bottom="auto";saveLauncherPosition(next);
  }
  function resetLauncherPosition(){
    try{localStorage.removeItem(POSITION_KEY)}catch{}
    if(!ui.launcher)return;
    ui.launcher.style.removeProperty("left");ui.launcher.style.removeProperty("top");ui.launcher.style.removeProperty("right");ui.launcher.style.removeProperty("bottom");
  }
  function bindLauncherDrag(){
    const launcher=ui.launcher;if(!launcher)return;let drag=null,suppressClick=false;
    launcher.addEventListener("pointerdown",event=>{
      if(event.button!==0&&event.pointerType!=="touch")return;const rect=launcher.getBoundingClientRect();
      drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,moved:false};
      launcher.setPointerCapture?.(event.pointerId);launcher.dataset.dragging="true";
    });
    launcher.addEventListener("pointermove",event=>{
      if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;if(!drag.moved&&Math.hypot(dx,dy)<7)return;
      drag.moved=true;suppressClick=true;event.preventDefault();applyLauncherPosition({x:event.clientX-drag.offsetX,y:event.clientY-drag.offsetY});
    });
    const finish=event=>{if(!drag||drag.id!==event.pointerId)return;launcher.releasePointerCapture?.(event.pointerId);launcher.dataset.dragging="false";if(drag.moved)saveLauncherPosition(clampLauncherPosition({x:launcher.offsetLeft,y:launcher.offsetTop}));drag=null;setTimeout(()=>{suppressClick=false},120)};
    launcher.addEventListener("pointerup",finish);launcher.addEventListener("pointercancel",finish);
    launcher.addEventListener("click",event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();return}setOpen(true)});
    launcher.addEventListener("dblclick",resetLauncherPosition);
    global.addEventListener("resize",()=>applyLauncherPosition(),{passive:true});global.addEventListener("orientationchange",()=>setTimeout(()=>applyLauncherPosition(),80),{passive:true});
    applyLauncherPosition();
  }
  function build(){
    if(document.querySelector(".cw-merlin-launcher"))return;
    const launcher=document.createElement("button");launcher.type="button";launcher.className="cw-merlin-launcher";launcher.setAttribute("aria-label","Open universal chat with Merlin");launcher.innerHTML=`<img src="${esc(asset("merlin.png"))}" alt=""><span>Merlin</span>`;
    const shell=document.createElement("div");shell.className="cw-merlin-shell";shell.hidden=true;shell.innerHTML=`<section class="cw-merlin-panel" role="dialog" aria-modal="true" aria-labelledby="cwMerlinTitle"><header class="cw-merlin-head"><img src="${esc(asset("merlin.png"))}" alt="Merlin, an android starfish wizard"><div><h2 id="cwMerlinTitle">Merlin</h2><p>Universal generative chat · platform-aware · read-only</p></div><button type="button" class="cw-merlin-close" aria-label="Close Merlin chat">×</button></header><div class="cw-merlin-boundary"><span><b>No intention movement.</b> Merlin can inspect, explain, and generate, but cannot route or operate the platform.</span><button type="button" data-merlin-config>Model</button></div><div class="cw-merlin-log" role="log" aria-live="polite"></div><form class="cw-merlin-compose"><div class="cw-merlin-options"><label class="cw-merlin-option"><input type="checkbox" data-merlin-platform checked>Include current platform insight</label><button type="button" class="cw-merlin-option" data-merlin-position-reset>Reset Merlin position</button><button type="button" class="cw-merlin-option" data-merlin-clear>Clear conversation</button></div><div class="cw-merlin-entry"><textarea data-merlin-input aria-label="Message Merlin" placeholder="Ask about the platform, explore an idea, or generate something..."></textarea><div class="cw-merlin-actions"><button class="primary" type="submit">Send</button><button type="button" data-merlin-stop disabled>Stop</button></div></div><div class="cw-merlin-status" role="status"></div></form></section>`;
    document.body.append(launcher,shell);
    ui={launcher,shell,log:shell.querySelector(".cw-merlin-log"),input:shell.querySelector("[data-merlin-input]"),status:shell.querySelector(".cw-merlin-status"),platform:shell.querySelector("[data-merlin-platform]"),stop:shell.querySelector("[data-merlin-stop]")};
    ui.platform.checked=session.includePlatform;
    bindLauncherDrag();shell.querySelector(".cw-merlin-close").addEventListener("click",()=>setOpen(false));shell.addEventListener("click",event=>{if(event.target===shell)setOpen(false)});
    shell.querySelector("[data-merlin-position-reset]").addEventListener("click",()=>resetLauncherPosition());
    shell.querySelector("[data-merlin-clear]").addEventListener("click",()=>{if(confirm("Clear Merlin's local conversation history?")){session.messages=[];save();render()}});
    shell.querySelector("[data-merlin-config]").addEventListener("click",openModelSettings);
    ui.platform.addEventListener("change",()=>{session.includePlatform=ui.platform.checked;save()});
    ui.stop.addEventListener("click",()=>controller?.abort());
    shell.querySelector("form").addEventListener("submit",event=>{event.preventDefault();send(ui.input.value)});
    ui.input.addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();send(ui.input.value)}});
    render();
  }
  function setOpen(next){open=next;ui.shell.hidden=!next;ui.launcher.setAttribute("aria-expanded",String(next));if(next){unread=false;ui.launcher.dataset.unread="false";setTimeout(()=>ui.input.focus(),30)}else ui.launcher.focus()}
  function openModelSettings(){
    const button=document.querySelector("[data-open-model-settings],#model-key-shortcut,#home-choose-model,#open-model-foundry-create,#open-model-foundry-account,#top-model-route,#stage-settings,#model-settings");if(button){if(button.tagName==="DETAILS")button.open=true;else button.click();return}
    global.dispatchEvent(new CustomEvent("commonweave:open-model-settings",{detail:"Merlin needs a connected interactive language model. Deterministic mode is intentionally unsupported."}));
    if(global.parent!==global)global.parent.postMessage({type:"commonweave:open-model-settings",detail:"Merlin needs a connected interactive language model."},location.origin);
    ui.status.textContent="Open the Commonweave shared model settings and connect an interactive model.";
  }
  function messageHtml(message,index){const role=message.role==="user"?"user":"assistant",pending=message.pending?" pending":"";return `<article class="cw-merlin-message ${role}${pending}" data-merlin-index="${index}">${role==="assistant"?`<img class="cw-merlin-avatar" src="${esc(asset("merlin.png"))}" alt="">`:""}<div class="cw-merlin-bubble">${esc(message.content||"")}<span class="cw-merlin-meta">${role==="assistant"?"Merlin":"You"}${message.at?` · ${new Date(message.at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`:""}</span></div></article>`}
  function render(){if(!ui.log)return;ui.log.innerHTML=session.messages.length?session.messages.map(messageHtml).join(""):`<div class="cw-merlin-empty"><b>The little wizard is listening.</b>Ask for a platform summary, a critique, a story, a draft, an explanation, or a strange new possibility.</div>`;ui.log.scrollTop=ui.log.scrollHeight}
  async function send(raw){
    const text=String(raw??"").trim().slice(0,12000);if(!text||controller)return;
    if(!modelReady()){ui.status.textContent="Merlin requires a connected interactive language model. Deterministic and manual routes are not used for this chat.";openModelSettings();return}
    ui.input.value="";const user={role:"user",content:text,at:new Date().toISOString()};const reply={role:"assistant",content:"",at:new Date().toISOString(),pending:true};session.messages.push(user,reply);session.messages=session.messages.slice(-MAX_MESSAGES);save();render();
    controller=new AbortController();ui.stop.disabled=false;ui.status.textContent="Merlin is thinking without an action wrapper…";
    try{
      const snapshot=session.includePlatform?platformSnapshot():{currentRealm:currentRealm(),platformInsightDisabled:true};
      const history=session.messages.slice(0,-1).slice(-18).map(item=>({role:item.role,content:item.content}));
      const result=await global.CommonweaveModelRuntime.generateInteractive({purpose:"merlin-universal-conversation",config:modelConfig(),system:`${SYSTEM}\n\nCURRENT READ-ONLY PLATFORM SNAPSHOT:\n${JSON.stringify(snapshot,null,2)}`,messages:history,responseFormat:"text",maxRepairAttempts:0,signal:controller.signal,requireExternalConsent:true,onEvent:event=>{if(event.phase==="partial"){reply.content=event.accumulatedText||`${reply.content}${event.text||""}`;render()}}});
      if(result.status!=="success")throw new Error(result.error?.message||`The model ended with ${result.status}.`);
      reply.content=result.outputText||reply.content||"I returned without a message.";reply.pending=false;reply.model=result.actual?.model;ui.status.textContent=`Read-only conversation · ${result.actual?.provider||"model"}${result.actual?.model?` · ${result.actual.model}`:""}`;
      if(!open){unread=true;ui.launcher.dataset.unread="true"}
    }catch(error){reply.pending=false;reply.content=error?.name==="AbortError"||controller?.signal.aborted?"The turn was stopped.":`I could not reach the connected conversational model: ${error.message||error}`;ui.status.textContent="No platform state was changed."}
    finally{controller=null;ui.stop.disabled=true;save();render()}
  }
  const api=Object.freeze({open:()=>setOpen(true),close:()=>setOpen(false),platformSnapshot,moveLauncher:applyLauncherPosition,resetLauncher:resetLauncherPosition,clear:()=>{session.messages=[];save();render()},send});
  global.CommonweaveMerlinChat=api;
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",build,{once:true});else build();
})(window);
