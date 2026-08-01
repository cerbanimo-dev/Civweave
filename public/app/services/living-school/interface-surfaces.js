/* Living School reusable interface surface router v1.0.15 */
(function(global){
  "use strict";
  const base="./visual-assets/interfaces/";
  const profiles={
    chalkKiosk:{id:"chalk-kiosk",kind:"chalk",asset:base+"chalkboard-kiosk.png",alt:"A mossbound curriculum chalkboard hosting a live Living School form",x:20.8,y:24.7,w:58.4,h:40.5,r:"3px",clip:"inset(0 round 3px)",pad:"3.5% 4.5%",font:".78rem"},
    chalkWeekly:{id:"chalk-weekly",kind:"chalk",asset:base+"chalkboard-weekly.png",alt:"A modular weekly chalkboard hosting a live Living School feed",x:23.6,y:21.3,w:66.7,h:45.5,r:"3px",clip:"inset(0 round 3px)",pad:"3.2% 3.6%",font:".74rem"},
    chalkEasel:{id:"chalk-easel",kind:"chalk",asset:base+"chalkboard-easel.png",alt:"A portable chalkboard hosting a compact Living School form",x:32.5,y:18.5,w:45.0,h:48.0,r:"5px",clip:"inset(0 round 5px)",pad:"5% 6%",font:".76rem"},
    holoWall:{id:"hologram-wall",kind:"hologram",asset:base+"hologram-wall.png",alt:"A wall hologram hosting live Living School output",x:21.1,y:18.7,w:57.8,h:47.1,r:"20px",clip:"inset(0 round 20px)",pad:"5% 6%",font:".72rem"},
    holoPedestal:{id:"hologram-pedestal",kind:"hologram",asset:base+"hologram-pedestal.png",alt:"A pedestal hologram hosting a Living School generator form",x:35.1,y:10.8,w:29.8,h:39.6,r:"8px",clip:"inset(0 round 8px)",pad:"5% 7%",font:".66rem"},
    holoMap:{id:"hologram-topic-map",kind:"hologram",asset:base+"hologram-topic-map.png",alt:"A circular hologram hosting live research and topic-map output",x:19.0,y:17.0,w:62.0,h:29.0,r:"50%",clip:"ellipse(49% 47% at 50% 50%)",pad:"11% 14%",font:".58rem"},
    holoConstellation:{id:"hologram-constellation",kind:"hologram",asset:base+"hologram-constellation.png",alt:"An observatory hologram hosting a live learner constellation",x:23.0,y:19.0,w:54.0,h:27.5,r:"44% 44% 4% 4%",clip:"polygon(50% 0,70% 3%,84% 10%,94% 21%,100% 38%,100% 100%,0 100%,0 38%,6% 21%,16% 10%,30% 3%)",pad:"15% 9% 5%",font:".58rem"},
    holoCluster:{id:"hologram-cluster",kind:"hologram",asset:base+"hologram-cluster.png",alt:"A multi-panel hologram hosting a live Living School feed",x:34.4,y:26.0,w:31.4,h:25.6,r:"5px",clip:"inset(0 round 5px)",pad:"1.2% 1.5%",font:".58rem"}
  };
  const exact={
    "home-launchpad":"holoCluster","school-overview":"holoCluster","marketplace-panel":"holoCluster",
    "frictionless-launch":"holoPedestal","school-builder":"chalkKiosk","model-settings":"holoWall","assessment-studio":"holoWall","media-studio":"holoWall",
    "moss-research-lab":"holoWall","research-results":"holoMap",
    "learner-constellation-panel":"holoWall","constellation-graph":"holoConstellation","constellation-detail":"holoWall","pathway-intelligence":"holoMap","learning-path-panel":"holoWall","misconception-panel":"chalkWeekly","opportunity-panel":"holoCluster","retrieval-panel":"chalkEasel",
    "cohort-panel":"chalkWeekly","review-panel":"chalkWeekly","review-queue":"chalkWeekly","review-history":"chalkWeekly",
    "human-help-panel":"chalkKiosk","help-request-builder":"chalkKiosk","help-match-panel":"holoWall","review-feedback":"chalkEasel",
    "practica-dashboard":"chalkKiosk","artifacts-panel":"holoWall","final-project-panel":"holoWall",
    "passport-panel":"holoWall","billing-panel":"chalkWeekly","facilitator-panel":"chalkWeekly","manifest-panel":"holoWall"
  };
  const workspaceDefaults={home:"holoCluster",market:"holoCluster",help:"chalkKiosk",constellation:"holoConstellation",learn:"holoWall",studio:"holoPedestal",cohort:"chalkWeekly",practica:"chalkKiosk",review:"chalkWeekly",credentials:"holoWall",admin:"chalkWeekly"};
  function hasInteractiveForm(node){return !!node?.querySelector?.("form,input,textarea,select,[contenteditable='true']");}
  function contentCount(node){
    if(!node)return 0;
    const selectors=["tbody tr","article",".card",".listing-card",".result-card",".module-row",".artifact-card",".review-card","li"];
    return Math.max(...selectors.map(selector=>node.querySelectorAll(selector).length),0);
  }
  function resolve(target,node){
    const focus=target?.focus||node?.id||"";
    const key=exact[focus]||workspaceDefaults[target?.workspace];
    if(key&&profiles[key])return profiles[key];
    if(hasInteractiveForm(node))return profiles.chalkKiosk;
    return contentCount(node)>2?profiles.holoCluster:profiles.holoWall;
  }
  function formFilled(node){
    if(!node)return false;
    return [...node.querySelectorAll("input,textarea,select")].some(control=>{
      if(control.type==="checkbox"||control.type==="radio")return control.checked;
      return String(control.value||"").trim().length>0;
    });
  }
  function statusFor(node,profile,target){
    const living=global.LivingSchoolLivingDisplays?.infer?.({target,node,profile});
    if(living)return living;
    const controls=node?.querySelectorAll?.("input,textarea,select,button")?.length||0;
    const data=contentCount(node);
    const filled=formFilled(node);
    if(data>2)return {text:`Live ${profile.kind} display · ${data} data items`,filled,hasData:true};
    if(controls)return {text:filled?`Form in progress · ${controls} controls`:`Live form · ${controls} controls`,filled,hasData:false};
    return {text:"Live output surface",filled:false,hasData:!!node?.textContent?.trim()};
  }
  function mount({target,node,projection,device,image,status}){
    if(!node||!projection||!device||!image)return null;
    const profile=resolve(target,node);
    projection.dataset.surface=profile.id;projection.dataset.surfaceKind=profile.kind;
    device.style.setProperty("--ls-surface-x",`${profile.x}%`);device.style.setProperty("--ls-surface-y",`${profile.y}%`);
    device.style.setProperty("--ls-surface-w",`${profile.w}%`);device.style.setProperty("--ls-surface-h",`${profile.h}%`);device.style.setProperty("--ls-surface-radius",profile.r||"8px");
    device.style.setProperty("--ls-surface-clip",profile.clip||`inset(0 round ${profile.r||"8px"})`);device.style.setProperty("--ls-surface-pad",profile.pad||"4% 5%");device.style.setProperty("--ls-surface-font",profile.font||".74rem");
    image.src=profile.asset;image.alt=profile.alt;
    let scheduled=0;
    const sync=()=>{
      cancelAnimationFrame(scheduled);scheduled=requestAnimationFrame(()=>{
        const state=statusFor(node,profile,target);
        projection.classList.toggle("ls-surface-filled",state.filled);projection.classList.toggle("ls-surface-has-data",state.hasData);if(state.state)projection.dataset.displayState=state.state;if(state.flow?.stage)projection.dataset.displayStage=state.flow.stage;
        if(status)status.textContent=state.text;
      });
    };
    const observer=new MutationObserver(sync);observer.observe(node,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["value","checked","selected","hidden","class"]});
    node.addEventListener("input",sync,true);node.addEventListener("change",sync,true);node.addEventListener("submit",sync,true);sync();
    return {profile,sync,destroy(){cancelAnimationFrame(scheduled);observer.disconnect();node.removeEventListener("input",sync,true);node.removeEventListener("change",sync,true);node.removeEventListener("submit",sync,true);projection.classList.remove("ls-surface-filled","ls-surface-has-data");}};
  }
  global.LivingSchoolInterfaceSurfaces={schema:"living-school-interface-surfaces-1.3",profiles,resolve,mount};
})(window);
