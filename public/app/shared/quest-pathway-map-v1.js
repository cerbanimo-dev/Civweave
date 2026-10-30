(()=>{
'use strict';
if(globalThis.CivweaveQuestPathwayMapV1)return;
const VERSION='1.2.0-four-lane-game-board';
const LANES=Object.freeze([
  {id:'living-school',label:'Living School',verb:'Learn',color:'#9acb70',glyph:'✧'},
  {id:'cerbanimo',label:'Cerbanimo',verb:'Build',color:'#bb79ff',glyph:'⚒'},
  {id:'fellowfare',label:'FellowFare',verb:'Gather & share',color:'#f5b446',glyph:'◇'},
  {id:'anarchadia',label:'Anarchadia',verb:'Agree',color:'#ff3d96',glyph:'⚖'}
]);
const FACES={'living-school':'moss',cerbanimo:'kamiya',fellowfare:'rook',anarchadia:'merlin'};
const OTHER={id:'unassigned',label:'Unassigned subsystem',verb:'Choose a subsystem',color:'#b8c6df',glyph:'?'};
const ALIASES=Object.freeze({learning:'living-school',learn:'living-school','skilled-labor':'cerbanimo',making:'cerbanimo',build:'cerbanimo',resource:'fellowfare',resources:'fellowfare',exchange:'fellowfare',outsource:'fellowfare',governance:'anarchadia',consent:'anarchadia'});
const ACTIONS=new Set(['inspect','edit','open-native','submit-guild']);
const DONE=new Set(['accepted','completed','complete','done']);
const PATH_LIMIT=12,STEP_LIMIT=96;
const bound=new WeakMap();
let diagramId=0;
const clean=(value,max=800)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=value=>Array.isArray(value)?value:[];
const lud=()=>globalThis.CivweaveLudModeV1?.isEnabled?.()===true||document.documentElement?.dataset.civweaveOperatingMode==='lud';
const dependencies=value=>{const owner=value&&typeof value==='object'?value:{},raw=Object.hasOwn(owner,'dependsOn')?owner.dependsOn:Object.hasOwn(owner,'dependencies')?owner.dependencies:owner.dependencyIds||[];return[...new Set((Array.isArray(raw)?raw:[raw]).slice(0,16).map(ref=>clean(typeof ref==='string'?ref:ref?.id||ref?.taskId,180)).filter(Boolean))]};
function realm(path){const raw=clean(path?.realm||path?.system||path?.type,80).toLowerCase().replace(/[ _]+/g,'-'),id=ALIASES[raw]||raw;return LANES.find(lane=>lane.id===id)||OTHER}
function status(value,reported=false){const id=clean(value,60).toLowerCase()||'draft',labels={review:'Under review',draft:'Draft',ready:'Ready',active:'In progress',blocked:'Blocked',accepted:reported?'Reported accepted':'Saved accepted',completed:reported?'Reported complete':'Saved complete',complete:reported?'Reported complete':'Saved complete',done:reported?'Reported complete':'Saved complete',abandoned:'Abandoned',cancelled:'Cancelled'};return{id,label:labels[id]||id.replace(/[_-]/g,' ')}}
function hasGovernance(plan){const g=plan?.governance;return Boolean(g&&typeof g==='object'&&!Array.isArray(g)&&g.included!==false&&(clean(g.title)||clean(g.purpose)||clean(g.reviewQuestion)||list(g.agreements).some(value=>clean(value))));}
function prepare(plan,reported=false){
  const state=status(plan.state,reported);
  const paths=list(plan.paths),sources=paths.slice(0,PATH_LIMIT).map((path,pathIndex)=>({path,pathIndex,governance:false})),sourceCount=paths.length+(hasGovernance(plan)?1:0);
  if(hasGovernance(plan))sources.push({path:{...plan.governance,realm:'anarchadia',steps:[]},pathIndex:paths.length,governance:true});
  const visible=sources.slice(0,PATH_LIMIT),perPath=Math.min(24,Math.max(1,Math.floor(STEP_LIMIT/Math.max(1,visible.length)))),index=new Map();
  const records=visible.map(({path,pathIndex,governance})=>{
    path=path&&typeof path==='object'?path:{};
    const steps=list(path.steps?.length?path.steps:path.tasks),progress=new Set(list(path.progress).filter(value=>Number.isInteger(value)&&value>=0));
    return{id:clean(path.id,180),title:clean(path.title,240)||(governance?'Governance layer':'Untitled path'),pathIndex,governance,realm:realm(path),rawRealm:clean(path.realm||path.system||path.type,80),status:status(path.status||plan.state,reported),dependencies:dependencies(path),total:steps.length,steps:steps.slice(0,perPath).map((step,stepIndex)=>({id:clean(typeof step==='object'?step?.id||step?.taskId:'',180),stepIndex,title:clean(typeof step==='string'?step:step?.title||step?.name||step?.label||step?.description,500),status:status((typeof step==='object'?step?.status:'')||(progress.has(stepIndex)?'completed':state.id==='review'?'draft':'ready'),reported),dependencies:dependencies(step)})).filter(step=>step.title)};
  });
  for(const path of records)for(const node of[path,...path.steps])if(node.id){const matches=index.get(node.id)||[];matches.push(node);index.set(node.id,matches)}
  return{paths,sourceCount,visible,records,index};
}
function graphFor(records){
  const nodes=[],edges=[],unresolved=[],index=new Map(),sequence=[];
  for(const record of records){const lane=LANES.findIndex(l=>l.id===record.realm.id),col=lane<0?4:lane;
    for(const [offset,value]of[record,...record.steps].entries()){
      const node={key:`p${record.pathIndex}${offset?'-s'+value.stepIndex:''}`,id:value.id,title:value.title,pathIndex:record.pathIndex,stepIndex:offset?value.stepIndex:null,realm:record.realm.id,color:record.realm.color,status:value.status,dependencies:value.dependencies,governance:record.governance,col,cyclic:false,locked:false};nodes.push(node);if(node.id){const found=index.get(node.id)||[];found.push(node);index.set(node.id,found)}
      if(offset)sequence.push({from:offset===1?`p${record.pathIndex}`:`p${record.pathIndex}-s${record.steps[offset-2].stepIndex}`,to:node.key,kind:'sequence'});
    }
  }
  const byKey=new Map(nodes.map(n=>[n.key,n]));
  for(const node of nodes)for(const id of node.dependencies){const found=index.get(id)||[];if(found.length!==1){unresolved.push({node:node.key,id,state:found.length?'ambiguous':'unresolved'});continue}edges.push({from:found[0].key,to:node.key,kind:'dependency'});}
  // Only declared dependencies define logical cycles. Beat order remains a visual trail.
  const outgoing=new Map(nodes.map(n=>[n.key,[]]));for(const e of edges)outgoing.get(e.from).push(e.to);
  let counter=0;const stack=[],onStack=new Set(),numbers=new Map(),low=new Map(),cycles=[];
  function visit(key){numbers.set(key,counter);low.set(key,counter++);stack.push(key);onStack.add(key);for(const next of outgoing.get(key)){if(!numbers.has(next)){visit(next);low.set(key,Math.min(low.get(key),low.get(next)))}else if(onStack.has(next))low.set(key,Math.min(low.get(key),numbers.get(next)))}if(low.get(key)===numbers.get(key)){const group=[];let next;do{next=stack.pop();onStack.delete(next);group.push(next)}while(next!==key);if(group.length>1||outgoing.get(key).includes(key)){cycles.push(group);for(const k of group)byKey.get(k).cyclic=true}}}
  for(const node of nodes)if(!numbers.has(node.key))visit(node.key);
  const lockCache=new Map();
  function locked(node,seen=new Set()){
    if(lockCache.has(node.key))return lockCache.get(node.key);
    if(node.cyclic||seen.has(node.key)||node.stepIndex===null&&nodes.some(member=>member.pathIndex===node.pathIndex&&member.cyclic))return true;const trail=new Set([...seen,node.key]);
    const result=node.stepIndex!==null&&locked(byKey.get(`p${node.pathIndex}`),trail)||node.dependencies.some(id=>{const found=index.get(id)||[];return found.length!==1||!DONE.has(found[0].status.id)||locked(found[0],trail)});
    lockCache.set(node.key,result);return result;
  }
  for(const node of nodes)node.locked=locked(node);
  // Lay out declared prerequisites first. Add sequence constraints only when they
  // do not contradict that graph, so drawing order never fabricates a lock.
  const constraints=new Map(nodes.map(n=>[n.key,[]]));
  for(const e of edges)if(!byKey.get(e.from).cyclic&&!byKey.get(e.to).cyclic)constraints.get(e.from).push(e.to);
  function reaches(from,to,seen=new Set()){if(from===to)return true;if(seen.has(from))return false;seen.add(from);return constraints.get(from).some(next=>reaches(next,to,seen))}
  for(const e of sequence)if(!reaches(e.to,e.from))constraints.get(e.from).push(e.to);
  const incoming=new Map(nodes.map(n=>[n.key,0])),rank=new Map(nodes.map(n=>[n.key,0]));for(const next of constraints.values())for(const key of next)incoming.set(key,incoming.get(key)+1);
  const queue=nodes.filter(n=>incoming.get(n.key)===0),rows=[0,0,0,0,0];let placed=0;
  while(queue.length){const node=queue.shift(),row=Math.max(rank.get(node.key),rows[node.col]);node.x=19+node.col*190;node.y=128+row*144;rows[node.col]=row+1;placed++;for(const key of constraints.get(node.key)){rank.set(key,Math.max(rank.get(key),row+1));incoming.set(key,incoming.get(key)-1);if(incoming.get(key)===0)queue.push(byKey.get(key));}}
  if(placed!==nodes.length)for(const node of nodes)if(node.x===undefined){node.x=19+node.col*190;node.y=128+rows[node.col]++*144;node.locked=true;}
  // Unassigned work remains explicit below the four canonical lanes, never a fifth mobile column.
  const unassigned=nodes.filter(n=>n.col===4),knownBottom=Math.max(-16,...nodes.filter(n=>n.col<4).map(n=>n.y));
  unassigned.forEach((node,i)=>{node.x=304;node.y=knownBottom+144*(i+1)});
  const all=[...edges,...sequence],shown=all.filter(e=>e.kind==='sequence').concat(all.filter(e=>e.kind==='dependency').slice(0,192));
  return{nodes,edges:shown.map((e,i)=>{const from=byKey.get(e.from),to=byKey.get(e.to);return{...e,key:`e${i}`,fromRealm:from.realm,toRealm:to.realm,colorFrom:from.color,colorTo:to.color,crossSubsystem:from.realm!==to.realm,state:from.cyclic&&to.cyclic?'cycle':DONE.has(from.status.id)?'complete':'pending'}}),unresolved,cycles,omittedEdges:Math.max(0,edges.length-192),width:760,height:Math.max(280,...nodes.map(n=>n.y+144))};
}
function project(plan){return graphFor(prepare(plan&&typeof plan==='object'?plan:{}).records)}
function canOpenPath(plan,pathId){const graph=project(plan),matches=graph.nodes.filter(n=>n.id===pathId&&n.stepIndex===null);return matches.length===1&&!matches[0].locked;}
function mapTheme(options){const raw=clean(options.theme||document.documentElement?.dataset.civweaveSystem||document.documentElement?.dataset.cwThemedCurrent||document.body?.dataset.system,80);return['civweave',...LANES.map(l=>l.id)].includes(raw)?raw:'civweave'}
function progressMarkup(records,graph,reported){
  const beats=records.flatMap(r=>r.steps),completed=beats.filter(s=>DONE.has(s.status.id)).length,total=beats.length,fullTotal=records.reduce((n,r)=>n+r.total,0),ratio=total?completed/total:0;
  return `<div data-quest-map-progress data-completed="${completed}" data-total="${total}"><div class="cw-qmap-stats"><span><strong>${completed} / ${total}</strong> ${reported?'reported':'saved'} checkpoints${fullTotal>total?' shown':''}</span><span><strong>${records.length}</strong> paths &amp; layers</span><span><strong>${graph.nodes.filter(n=>n.stepIndex!==null&&n.locked).length}</strong> waiting</span></div><div class="cw-qmap-progress" role="progressbar" aria-label="${reported?'Member-reported':'Saved'} checkpoint progress" aria-valuemin="0" aria-valuemax="${Math.max(1,total)}" aria-valuenow="${completed}" aria-valuetext="${completed} of ${total} ${reported?'reported':'saved'} checkpoints${fullTotal>total?' shown':''}" style="--quest-progress:${ratio}"><span class="cw-qmap-progress-fill"></span></div></div>`;
}
function wovenMarkup(graph,records,attrs,actions,reported){
  const prefix=`cw-qthread-${++diagramId}`,nodeByKey=new Map(graph.nodes.map(n=>[n.key,n]));
  const paths=graph.edges.map(edge=>{const from=nodeByKey.get(edge.from),to=nodeByKey.get(edge.to),x1=from.x+76,y1=from.y+112,x2=to.x+76,y2=to.y,mid=(y1+y2)/2;
    const d=y2>y1?`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`:`M ${x1} ${y1} C ${Math.min(752,x1+76)} ${y1+40}, ${Math.min(752,x2+76)} ${y2-40}, ${x2} ${y2}`;
    return{...edge,d,x1,y1,x2,y2};});
  let pulses=0,sparks=0;
  const nodes=graph.nodes.map((node,nodeIndex)=>{
    const record=records.find(r=>r.pathIndex===node.pathIndex),step=node.stepIndex===null?null:record.steps.find(s=>s.stepIndex===node.stepIndex),lane=LANES.find(l=>l.id===node.realm)||OTHER,tag=actions.includes('inspect')?'button':'div',done=DONE.has(node.status.id)&&!node.locked,burst=done&&!reported&&sparks++<1;
    return `<${tag}${tag==='button'?' type="button" data-quest-map-action="inspect"':''} class="cw-qmap-map-node" data-quest-map-graph-node="${node.key}" data-arrival="${nodeIndex<12}" data-node-kind="${step?'beat':'path'}" data-locked="${node.locked}" data-node-status="${esc(node.status.id)}" ${attrs(record,step)} style="--arrival-delay:${Math.min(nodeIndex,11)*.02}s;--node-x:${(node.x+76)/graph.width*100}%;--node-y:${node.y}px;--quest-lane:${node.color}" aria-label="${esc(`${lane.label}: ${node.title}. ${node.status.label}${node.cyclic?'. Dependency cycle':node.locked?'. Waiting for prerequisites':''}`)}"><span class="cw-qmap-node-emblem" aria-hidden="true">${node.cyclic?'↻':node.locked?'⌑':done?'✓':step?step.stepIndex+1:lane.glyph}</span><span class="cw-qmap-node-copy"><small>${lane.verb}${step?' · '+(step.stepIndex+1):' · path'}</small><strong>${esc(node.title)}</strong><small>${node.cyclic?'Dependency cycle':node.locked?'Waiting':esc(node.status.label)}</small></span>${burst?'<span class="cw-qmap-sparks" aria-hidden="true">'+Array.from({length:8},()=>'<i class="cw-qmap-spark"></i>').join('')+'</span>':''}</${tag}>`;
  }).join('');
  return `<div class="cw-qmap-weave"><div class="cw-qmap-thread-legend" aria-label="Map key"><span>━ Dependency</span><span>┄ Beat order · not a lock</span><span>✓ ${reported?'Reported':'Saved'} progress</span></div><p class="cw-qmap-note">Tap a checkpoint to inspect. Hold to inspect. Swipe vertically to explore.</p><div class="cw-qmap-scroll" role="region" tabindex="0" aria-label="Interwoven Quest map. Four subsystem lanes. Scroll vertically to explore."><div class="cw-qmap-canvas" style="height:${graph.height}px"><div class="cw-qmap-lane-bands" aria-hidden="true">${LANES.map(l=>`<span style="--quest-lane:${l.color}"></span>`).join('')}</div><div class="cw-qmap-lane-labels" aria-label="Subsystem thread colors">${LANES.map(l=>`<span style="--quest-lane:${l.color}"><img src="/app/assets/ai/chat/${FACES[l.id]}-face-v255.webp" alt="" width="46" height="46" decoding="async" draggable="false"><span><b>${l.label}</b><small>${l.verb}</small></span></span>`).join('')}</div><svg class="cw-qmap-threads" width="100%" height="${graph.height}" viewBox="0 0 ${graph.width} ${graph.height}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs>${paths.map(p=>`<linearGradient id="${prefix}-${p.key}" gradientUnits="userSpaceOnUse" x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}"><stop offset="15%" stop-color="${p.colorFrom}"/><stop offset="85%" stop-color="${p.colorTo}"/></linearGradient>`).join('')}</defs>${paths.map(p=>`<path class="cw-qmap-thread-underlay" d="${p.d}"/><path class="cw-qmap-thread" data-edge-kind="${p.kind}" data-cross-subsystem="${p.crossSubsystem}" data-edge-state="${p.state}" data-from="${p.from}" data-to="${p.to}" d="${p.d}" stroke="url(#${prefix}-${p.key})"/>${p.kind==='dependency'&&pulses++<12?`<path class="cw-qmap-pulse" d="${p.d}" stroke="url(#${prefix}-${p.key})"/>`:''}${p.kind==='dependency'?`<path d="M ${p.x2-5} ${p.y2-9} L ${p.x2} ${p.y2-2} L ${p.x2+5} ${p.y2-9}" fill="none" stroke="${p.colorTo}" stroke-width="2.5"/>`:''}`).join('')}</svg>${nodes}</div></div>${graph.unresolved.length?`<p class="cw-qmap-notice">${graph.unresolved.length} unresolved or ambiguous dependency references. Their details remain visible below.</p>`:''}${graph.omittedEdges?`<p class="cw-qmap-note">${graph.omittedEdges} additional dependency connections are listed in path details.</p>`:''}</div>`;
}
function render(plan,options={}){
  if(!plan||typeof plan!=='object')return'';
  const questId=clean(plan.id,180),reported=options.reported===true,state=status(plan.state,reported),actions=[...new Set(list(options.actions||['inspect']).filter(action=>ACTIONS.has(action)&&(!reported||action!=='open-native')))];
  const {paths,records,index,visible,sourceCount}=prepare(plan,reported),graph=graphFor(records),art=options.art!==false&&!lud();
  const depState=node=>node.dependencies.map(id=>{const matches=index.get(id)||[];return{id,title:matches.length===1?matches[0].title:'',state:matches.length>1?'ambiguous':matches.length===0?'unresolved':DONE.has(matches[0].status.id)?'complete':'pending'}});
  const links=node=>{const refs=depState(node);return refs.length?`<ul class="cw-qmap-dependencies">${refs.map(ref=>`<li data-quest-map-dependency="${esc(ref.id)}" data-dependency-state="${ref.state}">${ref.state==='ambiguous'?'Ambiguous dependency: ':ref.state==='unresolved'?'Unresolved dependency: ':'Requires: '}${esc(ref.title||ref.id)}${ref.state==='complete'?' · saved complete':ref.state==='pending'?' · pending':''}</li>`).join('')}</ul>`:''};
  const attrs=(record,step=null)=>`data-path-id="${esc(record.id)}" data-path-index="${record.pathIndex}" data-realm="${record.realm.id}" data-governance="${record.governance}"${step?` data-step-id="${esc(step.id)}" data-step-index="${step.stepIndex}"`:''}`;
  const inspect=(record,step,copy)=>actions.includes('inspect')?`<button type="button" class="cw-qmap-inspect" data-quest-map-action="inspect" ${attrs(record,step)}>${copy}</button>`:`<div class="cw-qmap-inspect">${copy}</div>`;
  const pathMarkup=record=>{
    const locked=graph.nodes.find(n=>n.pathIndex===record.pathIndex&&n.stepIndex===null)?.locked===true,nativeAllowed=questId&&record.id&&record.realm.id!=='unassigned'&&!record.governance&&!locked&&['active','ready','completed'].includes(state.id);
    const counts=record.governance?'Separate governance layer':`${record.total} ${record.total===1?'beat':'beats'}`;
    return`<div class="cw-qmap-path" data-quest-map-path="${esc(record.id)}" data-path-index="${record.pathIndex}" data-locked="${locked}"><header>${inspect(record,null,`<span class="cw-qmap-path-number" aria-hidden="true">${record.pathIndex+1}</span><span><strong>${esc(record.title)}</strong><small>${esc(record.status.label)}${record.realm.id==='unassigned'?' · '+esc(record.rawRealm):''}${locked?' · dependency locked':''} · ${counts}</small></span>`)}</header>${links(record)}${record.steps.length?`<ol class="cw-qmap-trail" aria-label="${esc(record.title)} beats">${record.steps.map(step=>{const stepLocked=graph.nodes.find(n=>n.pathIndex===record.pathIndex&&n.stepIndex===step.stepIndex)?.locked===true;return`<li data-quest-map-step="${esc(step.id)}" data-locked="${stepLocked}" data-step-status="${esc(step.status.id)}">${inspect(record,step,`<span class="cw-qmap-node" aria-hidden="true">${stepLocked?'⌑':DONE.has(step.status.id)?'✓':step.stepIndex+1}</span><span><strong>${esc(step.title)}</strong><small>${esc(step.status.label)}${stepLocked?' · dependency locked':''}</small></span>`)}${links(step)}</li>`}).join('')}</ol>`:record.governance?'':'<p class="cw-qmap-empty">No beats specified.</p>'}${record.total>record.steps.length?`<p class="cw-qmap-note">Map preview: ${record.steps.length} of ${record.total} beats. Open this path for its full saved details.</p>`:''}${actions.includes('open-native')?`<button type="button" class="cw-qmap-native" data-quest-map-action="open-native" ${attrs(record)} ${nativeAllowed?'':'disabled'}>Open ${esc(record.realm.label)}${!nativeAllowed&&state.id==='review'?' · activate first':''}</button>`:''}</div>`;
  };
  const motionPaused=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
  const motionControl=art?`<button type="button" data-quest-map-motion aria-pressed="${motionPaused?'true':'false'}">${motionPaused?'Resume effects':'Pause effects'}</button>`:'';
  const lanes=[...LANES,...(records.some(record=>record.realm.id==='unassigned')?[OTHER]:[])];
  return`<section class="cw-quest-pathway-map" data-quest-pathway-map data-quest-id="${esc(questId)}" data-quest-map-actions="${actions.join('|')}" data-map-theme="${mapTheme(options)}" data-art="${art}" data-reported="${reported}" data-motion="${motionPaused?'paused':'running'}" aria-label="${esc(clean(options.title,160)||'Quest pathway map')}"><header class="cw-qmap-heading"><div><small>${esc(clean(options.scope,160)||(reported?'Shared Guild snapshot':'Saved Quest'))}</small><h3>${esc(clean(plan.title,240)||'Your Quest map')}</h3><p>${esc(state.id==='review'?'Awaiting activation':state.label)} · ${paths.length} ${paths.length===1?'path':'paths'}${hasGovernance(plan)?' + governance':''}</p></div>${motionControl}</header>${reported?'<p class="cw-qmap-notice">Member-reported snapshot. Proof is not included in this publication.</p>':''}<p class="cw-qmap-note">Choose a checkpoint. Follow its thread. Build the shared outcome.</p>${progressMarkup(records,graph,reported)}${art?wovenMarkup(graph,records,attrs,actions,reported):''}${graph.cycles.length?'<p class="cw-qmap-notice cw-qmap-cycle-warning">Dependency cycle: review the linked requirements. Cyclic paths remain locked.</p>':''}<details class="cw-qmap-details" ${art?'':'open'}><summary>Path details · all saved beats and controls</summary><div class="cw-qmap-regions">${lanes.map(lane=>{const members=records.filter(record=>record.realm.id===lane.id);return`<section class="cw-qmap-region" data-quest-map-lane="${lane.id}" style="--quest-lane:${lane.color}" aria-label="${lane.label}"><header><span class="cw-qmap-region-symbol" aria-hidden="true">${lane.glyph}</span><div><h4>${lane.label}</h4><small>${lane.verb}</small></div></header>${members.length?members.map(pathMarkup).join(''):'<p class="cw-qmap-empty">No path requested in this subsystem.</p>'}</section>`}).join('')}</div></details>${sourceCount>visible.length?`<p class="cw-qmap-notice">Map preview: ${visible.length} of ${sourceCount} paths and layers. The complete saved Quest remains available in review.</p>`:''}${questId&&actions.some(action=>['edit','submit-guild'].includes(action))?`<nav class="cw-qmap-actions" aria-label="Quest actions">${actions.includes('edit')?'<button type="button" data-quest-map-action="edit">Review / edit Quest</button>':''}${actions.includes('submit-guild')?'<button type="button" data-quest-map-action="submit-guild">Submit Quest to Guild…</button>':''}</nav>`:''}</section>`;
}
function bind(host,callback){
  if(!host?.addEventListener||typeof callback!=='function')return()=>{};
  const existing=bound.get(host);if(existing){existing.callback=callback;return existing.dispose}
  const record={callback,dispose:null};let press=null,suppressed=null;
  const buttonFor=target=>target?.closest?.('button[data-quest-map-action]');
  function cancel(){if(press){clearTimeout(press.timer);delete press.button.dataset.holding;press=null}}
  function dispatch(button,event){
    if(!button||button.disabled||!host.contains(button))return;
    const map=button.closest('[data-quest-pathway-map]'),action=button.dataset.questMapAction;if(!map||!ACTIONS.has(action)||!String(map.dataset.questMapActions).split('|').includes(action))return;
    const pathIndex=button.dataset.pathIndex===undefined?null:Number(button.dataset.pathIndex),stepIndex=button.dataset.stepIndex===undefined?null:Number(button.dataset.stepIndex);
    if(pathIndex!==null&&(!Number.isInteger(pathIndex)||pathIndex<0)||stepIndex!==null&&(!Number.isInteger(stepIndex)||stepIndex<0))return;
    if(action==='inspect'){for(const previous of map.querySelectorAll('[data-selected],[data-held]')){delete previous.dataset.selected;if(previous!==button)delete previous.dataset.held}button.dataset.selected='true'}
    event.preventDefault();record.callback({action,questId:map.dataset.questId||'',pathId:button.dataset.pathId||'',pathIndex,stepId:button.dataset.stepId||'',stepIndex,realm:button.dataset.realm||'',governance:button.dataset.governance==='true'},event);
  }
  const click=event=>{
    const motion=event.target.closest?.('[data-quest-map-motion]');
    if(motion&&host.contains(motion)){const map=motion.closest('[data-quest-pathway-map]');if(!map)return;cancel();map.dataset.motion=map.dataset.motion==='paused'?'running':'paused';motion.setAttribute('aria-pressed',String(map.dataset.motion==='paused'));motion.textContent=map.dataset.motion==='paused'?'Resume effects':'Pause effects';return}
    const button=buttonFor(event.target);cancel();if(suppressed===button){suppressed=null;if(event.detail>0){event.preventDefault();return}}dispatch(button,event);
  };
  const down=event=>{
    cancel();suppressed=null;const button=buttonFor(event.target);if(event.button!==0||event.isPrimary===false||!button?.matches('[data-quest-map-graph-node][data-quest-map-action="inspect"]')||button.disabled||!host.contains(button))return;
    button.dataset.holding='true';const current={button,id:event.pointerId,x:event.clientX,y:event.clientY,focused:host.ownerDocument.hasFocus?.()===true,timer:0};press=current;
    current.timer=setTimeout(()=>{if(press!==current)return;press=null;delete button.dataset.holding;if(!button.isConnected||!host.contains(button)||(host.ownerDocument.hidden===true||host.ownerDocument.visibilityState==='hidden')||current.focused&&host.ownerDocument.hasFocus?.()===false)return;button.dataset.held='true';suppressed=button;dispatch(button,event)},500);
  };
  const move=event=>{if(press&&event.pointerId===press.id&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>10)cancel()};
  const up=event=>{if(!press||event.pointerId===press.id)cancel()};
  const listeners=[['click',click],['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',cancel],['pointerleave',cancel],['focusout',cancel],['scroll',cancel,true]];
  for(const [type,fn,capture]of listeners)host.addEventListener(type,fn,capture||false);
  record.dispose=()=>{cancel();suppressed=null;for(const [type,fn,capture]of listeners)host.removeEventListener(type,fn,capture||false);bound.delete(host)};bound.set(host,record);return record.dispose;
}

globalThis.CivweaveQuestPathwayMapV1=Object.freeze({version:VERSION,render,bind,project,canOpenPath,hasGovernance});
})();
