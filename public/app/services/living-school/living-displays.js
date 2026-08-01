/* Living School Living Displays v1.0.14 */
(function(global){
  "use strict";
  if(global.LivingSchoolLivingDisplays)return;
  const STATE_KEY="living-academy-v19-state";
  const DISPLAY_KEY="living-school.living-displays.v1";
  const STATES=["empty","editing","processing","completed","updated","reviewed","error","archived"];
  const STAGES=["intake","curriculum","practicum","submission","feedback","credential"];
  const stageLabels={intake:"Curriculum intake",curriculum:"Generated curriculum",practicum:"Practicum",submission:"Submission",feedback:"Mentor feedback",credential:"Credential progress"};
  const safeJson=(raw,fallback=null)=>{try{return JSON.parse(raw)}catch{return fallback}};
  const readState=()=>safeJson(localStorage.getItem(STATE_KEY)||"",null);
  const readDisplay=()=>safeJson(localStorage.getItem(DISPLAY_KEY)||"",{phase:"intake",lastFingerprint:"",lastNotice:"",updatedAt:null});
  const saveDisplay=(value)=>{try{localStorage.setItem(DISPLAY_KEY,JSON.stringify(value))}catch{}};
  let display=readDisplay();
  let lastSnapshot=null;
  function patchStorage(){
    const proto=global.Storage?.prototype;if(!proto||proto.__livingDisplayPatched)return;
    const native=proto.setItem;Object.defineProperty(proto,"__livingDisplayPatched",{value:true});
    proto.setItem=function(key,value){const result=native.call(this,key,value);if(this===global.localStorage&&key===STATE_KEY)global.dispatchEvent(new CustomEvent("living-school:statechange",{detail:{state:safeJson(value,null),source:"storage"}}));return result};
  }
  function counts(state){
    const practica=state?.academy?.practica||[],reviews=state?.academy?.reviews||[],notes=state?.academy?.facilitatorNotes||[];
    return {modules:state?.school?.modules?.length||0,completedModules:state?.clearedModules?.length||0,activePractica:practica.filter(x=>x.status==="active").length,submittedPractica:practica.filter(x=>x.status==="submitted").length,completedPractica:practica.filter(x=>/complete|approved|reviewed/.test(x.status||"")).length,pendingReviews:reviews.filter(x=>!['approved','rejected','complete'].includes(x.status)).length,approvedReviews:reviews.filter(x=>x.status==="approved").length,notes:notes.length,artifacts:state?.artifacts?.length||0,badges:state?.badges?.length||0,credentials:state?.credentialProposals?.length||0};
  }
  function pathway(state){
    const c=counts(state);let index=0;
    if(c.modules)index=1;if(c.activePractica||c.submittedPractica||c.completedPractica)index=2;if(c.submittedPractica||c.completedPractica)index=3;if(c.approvedReviews||c.notes)index=4;if(c.badges||c.credentials)index=5;
    return {stage:STAGES[index],index,label:stageLabels[STAGES[index]],counts:c,steps:STAGES.map((stage,i)=>({stage,label:stageLabels[stage],status:i<index?"done":i===index?"current":"future"}))};
  }
  function formFilled(node){return [...(node?.querySelectorAll?.("input,textarea,select")||[])].some(control=>control.type==="checkbox"||control.type==="radio"?control.checked:String(control.value||"").trim())}
  function dataCount(node){return Math.max(0,...["tbody tr","article",".card",".listing-card",".result-card",".module-row",".artifact-card",".review-card",".roster-card",".assignment-card","li"].map(selector=>node?.querySelectorAll?.(selector)?.length||0))}
  function isBusy(node){return !!node?.querySelector?.("[aria-busy='true'],.is-generating,.generating,.loading,[data-loading='true']")||/generating|building|researching|processing|preparing|waiting for model/i.test(node?.textContent||"")}
  function hasError(node){return !!node?.querySelector?.("[aria-invalid='true'],.error,.bad,.model-error")||/error:|failed|could not|stopped:/i.test(node?.textContent||"")}
  function focusKey(target,node){return target?.focus||node?.id||""}
  function infer({target,node,profile}){
    const state=readState(),flow=pathway(state),key=focusKey(target,node),c=flow.counts,filled=formFilled(node),items=dataCount(node),controls=node?.querySelectorAll?.("input,textarea,select,button")?.length||0;
    let value="empty";
    if(hasError(node))value="error";
    else if(isBusy(node)||display.phase==="processing"&&Date.now()-Date.parse(display.updatedAt||0)<180000)value="processing";
    else if(/school-builder|frictionless-launch/.test(key))value=c.modules?"completed":filled?"editing":"empty";
    else if(/practica/.test(key))value=c.completedPractica?"reviewed":c.submittedPractica?"completed":c.activePractica?"editing":filled?"editing":"empty";
    else if(/review/.test(key))value=c.approvedReviews?"reviewed":c.pendingReviews||items?"updated":filled?"editing":"empty";
    else if(/passport|credential|badge/.test(key))value=c.badges||c.credentials?"reviewed":c.artifacts?"completed":"empty";
    else if(/research|cohort|market|overview|constellation|pathway/.test(key))value=items>0||c.modules?"updated":controls&&filled?"editing":"empty";
    else if(controls)value=filled?"editing":"empty";
    else if(items>0||node?.textContent?.trim())value="updated";
    const density=(node?.textContent?.length||0)>5000||items>12?"dense":(node?.textContent?.length||0)>1800||items>5?"compact":"normal";
    const label={empty:"Waiting for input",editing:"Form in progress",processing:"Generating live output",completed:"Completed output",updated:"New live data",reviewed:"Reviewed and sealed",error:"Needs attention",archived:"Archived"}[value];
    return {state:value,density,flow,text:`${label} · ${flow.label}`,filled,hasData:items>0||c.modules>0,counts:c,profile:profile?.id||"surface"};
  }
  function fingerprint(state){const c=counts(state);return JSON.stringify(c)}
  function updateWorkflow(state,source="state"){
    if(!state)return;const flow=pathway(state),nextFingerprint=fingerprint(state),previous=lastSnapshot||display.lastFingerprint;
    let notice="";if(previous&&previous!==nextFingerprint){const old=typeof previous==="string"?safeJson(previous,{}):previous,now=flow.counts;if(now.modules>(old.modules||0))notice="Curriculum ready";else if(now.activePractica>(old.activePractica||0))notice="Practicum opened";else if(now.submittedPractica>(old.submittedPractica||0))notice="Evidence submitted";else if(now.approvedReviews>(old.approvedReviews||0)||now.notes>(old.notes||0))notice="New feedback arrived";else if(now.badges>(old.badges||0)||now.credentials>(old.credentials||0))notice="Credential progress updated";else if(now.artifacts>(old.artifacts||0))notice="New artifact recorded"}
    lastSnapshot=flow.counts;display={...display,phase:flow.stage,lastFingerprint:nextFingerprint,lastNotice:notice||display.lastNotice,updatedAt:new Date().toISOString(),source};saveDisplay(display);global.dispatchEvent(new CustomEvent("living-school:display-workflow",{detail:{flow,notice,source}}));
  }
  function ensureDecorations(device){
    let thread=device.querySelector(".ls-display-thread");if(!thread){thread=document.createElement("div");thread.className="ls-display-thread";thread.setAttribute("aria-hidden","true");device.append(thread)}
    let notice=device.querySelector(".ls-display-notice");if(!notice){notice=document.createElement("div");notice.className="ls-display-notice";device.append(notice)}return {thread,notice};
  }
  function renderThread(device,flow){const {thread}=ensureDecorations(device);thread.innerHTML=`${flow.steps.map(step=>`<span class="${step.status}" title="${step.label}"></span>`).join("")}<b>${flow.label}</b>`}
  function showNotice(device,text){if(!text)return;const {notice}=ensureDecorations(device);notice.textContent=text;notice.classList.remove("show");void notice.offsetWidth;notice.classList.add("show")}
  function decorate({target,node,projection,device,surface,status}){
    let previous="";
    const sync=()=>{const contract=infer({target,node,profile:projection.__lsSurfaceProfile});if(!STATES.includes(contract.state))contract.state="updated";projection.dataset.displayState=contract.state;projection.dataset.displayStage=contract.flow.stage;surface.dataset.displayDensity=contract.density;renderThread(device,contract.flow);if(status)status.textContent=contract.text;if(previous&&previous!==contract.state&&['completed','updated','reviewed','error'].includes(contract.state))showNotice(device,contract.text);previous=contract.state;return contract};
    const onWorkflow=event=>{const contract=sync();if(event.detail?.notice)showNotice(device,event.detail.notice);return contract};global.addEventListener("living-school:display-workflow",onWorkflow);global.addEventListener("living-school:statechange",sync);sync();return {sync,destroy(){global.removeEventListener("living-school:display-workflow",onWorkflow);global.removeEventListener("living-school:statechange",sync);projection.removeAttribute("data-display-state");projection.removeAttribute("data-display-stage")}};
  }
  function wrapSurfaces(){const surfaces=global.LivingSchoolInterfaceSurfaces;if(!surfaces||surfaces.__livingDisplaysWrapped)return;const original=surfaces.mount.bind(surfaces);surfaces.mount=function(args){const mounted=original(args);args.projection.__lsSurfaceProfile=mounted?.profile;const surface=args.projection.querySelector(".ls-projection-surface");const decorated=decorate({...args,surface});const destroy=mounted?.destroy?.bind(mounted);return {...mounted,display:decorated,destroy(){decorated.destroy();destroy?.()}}};Object.defineProperty(surfaces,"__livingDisplaysWrapped",{value:true})}
  function markProcessing(event){const id=event.target?.closest?.("button")?.id||"";if(["frictionless-build","generate-school","create-practicum"].includes(id)){display={...display,phase:"processing",updatedAt:new Date().toISOString(),lastNotice:id==="create-practicum"?"Preparing practicum":"Growing curriculum"};saveDisplay(display);global.dispatchEvent(new CustomEvent("living-school:display-workflow",{detail:{flow:pathway(readState()),notice:display.lastNotice,source:id}}))}}
  function initDom(){updateWorkflow(readState(),"boot");document.addEventListener("click",markProcessing,true);global.addEventListener("living-school:statechange",event=>updateWorkflow(event.detail?.state||readState(),event.detail?.source||"state"));setInterval(()=>{const state=readState(),fp=fingerprint(state);if(fp!==display.lastFingerprint)updateWorkflow(state,"poll")},2200)}
  patchStorage();wrapSurfaces();
  const api=Object.freeze({schema:"living-school-living-displays-1.0",states:STATES,stages:STAGES,readState,pathway,infer,updateWorkflow});global.LivingSchoolLivingDisplays=api;
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initDom,{once:true});else initDom();
})(window);
