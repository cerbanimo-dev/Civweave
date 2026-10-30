/**
 * Worldweaver Stagecraft adapter.
 * Turns an approved screenplay into OpenSimulator-compatible provisional
 * set/actor primitives and an executable-by-trusted-provider cue score.
 * Actors are markers here: native avatar rigs and animation playback are NOT
 * implemented in this browser preview.
 */
import {PERFORMANCE_SCHEMA} from './worldweaver-performance-studio-v1.mjs';
import {OPENSIM_GEOMETRY_SCHEMA,buildOpenSimGeometry} from './worldweaver-opensim-geometry-v1.mjs';
const q={x:0,y:0,z:0,w:1};
const bound=(x,a,b)=>Math.max(a,Math.min(b,x));
const box=(id,name,shape,x,y,z,w,d,h,color)=>({
 id,name,type:shape,offset:{x,y,z},rotation:q,scale:{x:w,y:d,z:h},color});
const entry=(scene,x,cast)=>({character:x,avatarRef:cast?.avatarRef??null,
 pilotPrincipalId:cast?.pilotPrincipalId??null,voiceRef:cast?.voiceRef??null,
 stageType:cast?'avatar-cue-target':'unassigned'});
const colors=['#b780aa','#66a5a0','#ddaf62','#8b9eb8','#c77d76','#9ba978'];
export function compileStageScene(state,sceneId,{regionId='stage:local',revision=1,instanceId}={}){
 if(state?.schema!==PERFORMANCE_SCHEMA)throw new TypeError('Production state required');
 const scene=state.proposals.find(x=>x.id===sceneId);
 if(!scene)throw new RangeError('Unknown screenplay scene');
 if(scene.status!=='approved')throw new Error('Scene must be human-approved before staging');
 const cast=[...new Set(scene.dialogue.map(l=>l.character))].map((character,i)=>{
  const binding=state.casts.find(c=>c.character===character);
  return {...entry(scene,character,binding),
   x:115+i*bound(12/Math.max(1,Math.min(10,scene.dialogue.length)),1,6),
   y:122+i%2*7,z:1.6,mark:colors[i%colors.length]};
 });
 instanceId=instanceId??'stage:'+scene.id;
 const objects=[{
  id:'set:'+scene.id,name:scene.set.location,kind:'stage',instanceId,
  position:{x:128,y:128,z:0},rotation:q,parts:[
   box('stage-floor','Stage floor','box',0,0,-.2,72,56,.4,scene.set.color),
   box('stage-backdrop','Set backdrop','box',0,26,9,72,1.5,18,'#32494b'),
   box('stage-left-wall','Left wing','box',-37,0,7,1.5,55,14,'#384a54'),
   box('stage-right-wall','Right wing','box',37,0,7,1.5,55,14,'#384a54')
  ]
 }];
 for(const prop of scene.set.props){
  objects.push({
   id:'prop:'+scene.id+':'+prop.id,name:prop.name,kind:'prop',instanceId,
   position:{x:128+prop.x,y:128+prop.y,z:0},rotation:q,
   parts:[box('mesh:'+scene.id+':'+prop.id,prop.name,prop.shape,0,0,prop.height/2,
     prop.width,prop.depth,prop.height,prop.color)]});
 }
 for(const actor of cast){
  objects.push({
   id:'actor:'+scene.id+':'+actor.character,name:actor.character,kind:'actor-marker',instanceId,
   position:{x:actor.x,y:actor.y,z:0},rotation:q,
   parts:[
    box('marker-body:'+actor.character,'Rehearsal stand-in','cylinder',0,0,1.1,.8,.8,2.2,actor.mark),
    box('marker-head:'+actor.character,'Head marker','cylinder',0,0,2.5,.65,.65,.65,'#d4c8af')]
  });
 }
 const region={schema:OPENSIM_GEOMETRY_SCHEMA,regionId,size:{x:256,y:256},
  revision,source:'provisional-or-imported',objects};
 return {sceneId:scene.id,region,geometry:buildOpenSimGeometry(region),cast,
  draft:true,source:'screenplay stage mockup; not an OpenSimulator persistent region'};
}
export function compilePerformanceScore(state,sceneId,{maxSeconds=3600}={}){
 const stage=compileStageScene(state,sceneId);
 const scene=state.proposals.find(x=>x.id===sceneId);
 let elapsed=0;
 const events=[],momentsByLine=new Map();
 for(const moment of scene.moments){
  const list=momentsByLine.get(moment.afterLine)||[];list.push(moment);momentsByLine.set(moment.afterLine,list);
 }
 scene.dialogue.forEach((line,i)=>{
  const duration=line.seconds??bound(Math.ceil(line.text.length/16),3,90);
  events.push({type:'dialogue',sceneId,at:elapsed,until:elapsed+duration,character:line.character,
   text:line.text,direction:line.direction,avatarRef:stage.cast.find(c=>c.character===line.character)?.avatarRef??null});
  elapsed+=duration;
  for(const moment of momentsByLine.get(i)||[]){
   events.push({type:'audience-invite',sceneId,at:elapsed,until:elapsed+moment.maxSeconds,
    momentId:moment.id,prompt:moment.prompt,mode:moment.mode,interruptible:true});
   elapsed+=moment.maxSeconds;
  }
 });
 if(elapsed>maxSeconds)throw new TypeError('Stage performance exceeds duration budget');
 return {sceneId,seconds:elapsed,events,camera:'unassigned-for-shot-planning',
  note:'Timeline cues only. Native OpenSimulator gesture/animation and actual generated speech require separate approved adapters.'};
}
