/**
 * Thread B: Quest 3 WebXR interaction adapter.
 * Scene-independent: Thread A owns rendering and ray intersection.
 * An interaction is a local intent; the host/meeting floor retains authority.
 */
export const VR_ACTIONS=Object.freeze({
  SELECT:'select', MENU:'menu', RECENTER:'recenter', MOVE:'move',
  TARGET:'target', EXIT:'exit'
});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const validPoint=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
export function distance3(a,b){
  if(!validPoint(a)||!validPoint(b))return Infinity;
  return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
}
export function pinchActive(thumb,index,threshold=0.027){
  return distance3(thumb,index)<threshold;
}
export function stickMove(axes=[],deadzone=0.22){
  const x=Number(axes[2]??axes[0]??0),y=Number(axes[3]??axes[1]??0);
  if(!Number.isFinite(x)||!Number.isFinite(y))return {x:0,y:0};
  const magnitude=Math.hypot(x,y);
  if(magnitude<deadzone)return {x:0,y:0};
  const factor=(clamp(magnitude,0,1)-deadzone)/(1-deadzone);
  return {x:x/magnitude*factor,y:y/magnitude*factor};
}
export function createQuestInteraction({
  onAction=()=>{},hitTest=()=>null,onStatus=()=>{},
  pinchThreshold=0.027,pinchRelease=0.042,moveSpeed=0.65,
  now=()=>performance.now()
}={}){
  let session=null,referenceSpace=null,disposed=false,menuOpen=false;
  let lastSelect=new Map(),pinches=new Map(),sources=new Set(),offset={x:0,y:0,z:0};
  const emit=(type,detail={})=>{if(!disposed)onAction({type,...detail})};
  const status=message=>{if(!disposed)onStatus(message)};
  const describe=source=>source?.hand?'hand':source?.targetRayMode==='gaze'?'gaze':'controller';
  const ray=(frame,source)=>{
    if(!frame||!referenceSpace||!source?.targetRaySpace)return null;
    const pose=frame.getPose(source.targetRaySpace,referenceSpace);
    if(!pose)return null;
    const {position,orientation}=pose.transform;
    // XR target rays point along the input space's negative Z axis.
    const q=orientation;
    return {
      origin:{x:position.x+offset.x,y:position.y+offset.y,z:position.z+offset.z},
      direction:{x:-2*(q.x*q.z+q.w*q.y),y:-2*(q.y*q.z-q.w*q.x),z:-(1-2*(q.x*q.x+q.y*q.y))}
    };
  };
  const choose=(frame,source,method)=>{
    if(disposed||!source)return;
    const key=source;
    if(now()-(lastSelect.get(key)??-Infinity)<240)return;
    lastSelect.set(key,now());
    const hit=hitTest(ray(frame,source),{source,method,menuOpen});
    if(hit?.id)emit(VR_ACTIONS.SELECT,{targetId:String(hit.id),source:describe(source),handedness:source.handedness||'none',method});
    else emit(VR_ACTIONS.TARGET,{targetId:null,source:describe(source),method});
  };
  const onSelect=event=>choose(event.frame,event.inputSource,'trigger');
  const onInputs=()=>{sources=new Set(session?.inputSources||[]);status(sources.size+' XR input source(s) active')};
  const onEnd=()=>{detach();status('XR session ended')};
  function attach(nextSession,nextReferenceSpace){
    if(disposed)throw Error('Quest interaction controller disposed');
    if(!nextSession||!nextReferenceSpace)throw TypeError('XRSession and reference space required');
    detach();session=nextSession;referenceSpace=nextReferenceSpace;
    session.addEventListener('select',onSelect);
    session.addEventListener('inputsourceschange',onInputs);
    session.addEventListener('end',onEnd);
    onInputs();return api;
  }
  function detach(){
    session?.removeEventListener('select',onSelect);
    session?.removeEventListener('inputsourceschange',onInputs);
    session?.removeEventListener('end',onEnd);
    session=null;referenceSpace=null;sources.clear();pinches.clear();lastSelect.clear();
  }
  function recenter(){offset={x:0,y:0,z:0};emit(VR_ACTIONS.RECENTER,{offset:{...offset}})}
  function toggleMenu(){menuOpen=!menuOpen;emit(VR_ACTIONS.MENU,{open:menuOpen});return menuOpen}
  function update(frame,deltaSeconds=0){
    if(!session||!referenceSpace||disposed)return;
    const dt=clamp(Number(deltaSeconds)||0,0,0.05);
    for(const source of sources){
      if(source.hand){
        const thumb=source.hand.get?.('thumb-tip'),index=source.hand.get?.('index-finger-tip');
        if(!thumb||!index||!frame.getJointPose)continue;
        const a=frame.getJointPose(thumb,referenceSpace)?.transform?.position;
        const b=frame.getJointPose(index,referenceSpace)?.transform?.position;
        const was=pinches.get(source)||false;
        const length=distance3(a,b),is=was?length<pinchRelease:length<pinchThreshold;
        if(is&&!was)choose(frame,source,'pinch');
        pinches.set(source,is);continue;
      }
      const gamepad=source.gamepad;
      if(!gamepad)continue;
      const movement=stickMove(gamepad.axes);
      if(movement.x||movement.y){
        // Optional, slow seated translation; never silently moves the user.
        const dx=movement.x*moveSpeed*dt,dz=movement.y*moveSpeed*dt;
        emit(VR_ACTIONS.MOVE,{dx,dz,source:describe(source),handedness:source.handedness||'none'});
      }
    }
  }
  function dispose(){detach();disposed=true}
  const api={attach,detach,update,dispose,toggleMenu,recenter,ray,
    get state(){return {attached:!!session,menuOpen,offset:{...offset},inputCount:sources.size,disposed}}};
  return api;
}
