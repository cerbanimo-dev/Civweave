import {createWorkspace, SPACE_TEMPLATES, WORKSPACE_STORAGE_KEY} from '../shared/worldweaver-workspace-v1.mjs';
import {NPC_TOOLS} from '../shared/worldweaver-core-v1.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const label=value=>String(value).replaceAll('-',' ').replace(/^./,char=>char.toUpperCase());
const GUIDES={moss:'Moss',kamiya:'Kamiya',rook:'Rook',merlin:'Merlin'};
const TOOLS={moss:['Living School','Learning Journeys, assessments, and credentials stay in Living School.'],kamiya:['Cerbanimo','Endeavors, accepted proof, and progress stay in Cerbanimo.'],rook:['FellowFare','Listings, orders, and purchases stay in FellowFare.'],merlin:['Anarchadia','Proposals, ballots, and binding decisions stay in Anarchadia.']};
const PATHS={'living-school':'/app/cabinets/living-school/index.html?cabinet=1',cerbanimo:'/app/realm-console-v140.html?system=cerbanimo&cabinet=1',fellowfare:'/app/fellowfare-cabinet-v144.html?cabinet=1',anarchadia:'/app/anarchadia-console-v139.html?cabinet=1'};

/** Presentation only: all saved changes delegate to the existing manifest core. */
export function mountWorkspace({document,window,workspace,download}={}){
  const root=document.getElementById('ww-workspace');
  if(!root)throw new Error('Worldweaver workspace is missing.');
  const $=selector=>root.querySelector(selector),listeners=[];
  let selectedId=null,stationId=null,newGuide='moss',activeTab='plan',creating=false,blocked=false;
  const on=(target,type,handler)=>{target.addEventListener(type,handler);listeners.push(()=>target.removeEventListener(type,handler))};
  function message(text,error=false){
    const node=$('#ww-message');node.textContent=text;node.hidden=!text;
    node.classList.toggle('is-error',error);node.setAttribute('role',error?'alert':'status');
  }
  function block(error){blocked=true;$('#ww-new-space').disabled=true;message(error.message||String(error),true);for(const form of root.querySelectorAll('form'))for(const field of form.elements)field.disabled=true}
  if(!workspace){try{workspace=createWorkspace()}catch(error){block(error)}}
  const snapshot=()=>workspace?.snapshot()||{instances:[],stations:[],links:[],npcs:[]};
  const selected=()=>snapshot().instances.find(row=>row.id===selectedId);
  const templateFor=space=>SPACE_TEMPLATES.find(template=>template.guide===space?.guide);
  function route(template,feature){
    const options={source:'worldweaver',feature};
    const routes=window.CivweaveSystemRoutesV227;
    if(routes?.urlFor)return routes.urlFor(template.system,options).href;
    const url=new URL(PATHS[template.system],window.location.href);url.searchParams.set('installed','1');url.searchParams.set('source','worldweaver');url.searchParams.set('feature',feature);return url.href;
  }
  function templates(){
    $('#ww-templates').innerHTML=SPACE_TEMPLATES.map(template=>`<button type="button" class="ww-template" data-template="${template.guide}" style="--space-color:${template.color}" aria-pressed="${template.guide===newGuide}"><span class="ww-eyebrow">${GUIDES[template.guide]} / ${TOOLS[template.guide][0]}</span><strong>${esc(template.label)}</strong><small>${esc(template.description)}</small></button>`).join('');
  }
  function library(){
    const state=snapshot(),query=$('#ww-search').value.trim().toLowerCase();
    const rows=state.instances.filter(space=>`${space.title} ${space.description} ${templateFor(space)?.label}`.toLowerCase().includes(query));
    $('#ww-space-count').textContent=String(state.instances.length);
    $('#ww-spaces').innerHTML=rows.length?rows.map(space=>`<button type="button" class="ww-space-card${space.id===selectedId&&!creating?' is-selected':''}" data-space="${esc(space.id)}" style="--space-color:${templateFor(space).color}" aria-pressed="${space.id===selectedId&&!creating}"><strong>${esc(space.title)}</strong><small>${esc(templateFor(space).label)} · ${GUIDES[space.guide]}</small><span class="ww-badge">Device draft</span></button>`).join(''):`<p><small>${query?'No spaces match your search.':'Your spaces will appear here. Start with a new space.'}</small></p>`;
  }
  function tabs(focus=false){
    for(const button of root.querySelectorAll('[data-tab]')){const current=button.dataset.tab===activeTab;button.setAttribute('aria-selected',String(current));button.tabIndex=current?0:-1;$('#ww-tab-'+button.dataset.tab).hidden=!current;if(current&&focus)button.focus()}
  }
  function stationDetail(){
    const space=selected(),station=snapshot().stations.find(row=>row.id===stationId&&row.instanceId===space?.id);
    const panel=$('#ww-station-detail');panel.hidden=!station;
    panel.innerHTML=station?`<span class="ww-eyebrow">${esc(label(station.stationType))} station</span><h3>${esc(station.title)}</h3><p class="ww-instructions">${esc(station.instructions)}</p><small>Preview instructions · Assessment results and task proof remain in the original tool.</small>`:'';
    for(const node of root.querySelectorAll('[data-station]'))node.setAttribute('aria-pressed',String(node.dataset.station===stationId));
  }
  function render(){
    const state=snapshot();if(!state.instances.some(row=>row.id===selectedId))selectedId=state.instances[0]?.id||null;
    if(!selectedId)creating=true;
    const space=selected(),template=templateFor(space),show=Boolean(space)&&!creating;
    $('#ww-create').hidden=!creating;$('#ww-selected').hidden=!show;$('#ww-tools').hidden=!show;$('#ww-source-tools').hidden=!show;$('#ww-welcome').hidden=show;
    $('#ww-export').disabled=!show||blocked;
    library();templates();tabs();
    if(!show)return;
    $('#ww-space-title').textContent=space.title;$('#ww-space-description').textContent=space.description||'A space waiting to take shape.';
    $('#ww-space-kind').textContent=`${template.label} / ${GUIDES[space.guide]}`;
    $('#ww-space-status').textContent='Device draft';
    const stations=state.stations.filter(row=>row.instanceId===space.id),links=state.links.filter(row=>row.instanceId===space.id),npcs=state.npcs.filter(row=>row.instanceId===space.id);
    $('#ww-stats').innerHTML=[[stations.length,'Stations'],[links.length,'References'],[npcs.length,'Character drafts']].map(([count,name])=>`<div class="ww-stat"><strong>${count}</strong><span>${name}</span></div>`).join('');
    $('#ww-floor').innerHTML=stations.length?stations.map((station,index)=>`<button type="button" class="ww-preview-station" data-station="${esc(station.id)}" aria-pressed="${station.id===stationId}"><small>${String(index+1).padStart(2,'0')} / ${esc(label(station.stationType))}</small><strong>${esc(station.title)}</strong><span aria-hidden="true">↗</span></button>`).join(''):'<div class="ww-empty"><span class="ww-eyebrow">A place for possibilities</span><h3>Your first station starts here.</h3><p>Add instructions in the Stations panel to shape the experience.</p></div>';
    $('#station-type').innerHTML=template.stationTypes.map(type=>`<option value="${type}">${label(type)}</option>`).join('');
    $('#ww-link-heading').textContent=`Link ${TOOLS[space.guide][0]} work`;
    $('#ww-reference-label').textContent=`Existing ${label(template.refType).toLowerCase()} ID`;
    $('#ww-links').innerHTML=links.length?links.map(link=>`<div class="ww-record"><strong>${esc(link.refId)}</strong><small>${esc(label(link.refType))} · Reference only, not verified here</small></div>`).join(''):'<p><small>No records linked yet.</small></p>';
    $('#ww-npcs').innerHTML=npcs.length?npcs.map(npc=>`<details class="ww-record"><summary>${esc(npc.name)}</summary><small>${esc(npc.modelId)} · Draft configuration, not running</small><p class="ww-instructions">${esc(npc.pilotPrompt)}</p><small>Suggested tools: ${esc(npc.capabilities.join(', '))}</small></details>`).join(''):'<p><small>No character drafts yet.</small></p>';
    $('#ww-tool-label').textContent=TOOLS[space.guide][0];$('#ww-tool-description').textContent=TOOLS[space.guide][1];
    $('#ww-open-tool').href=route(template,template.feature);$('#ww-open-guide').href=route(template,'chat');$('#ww-open-guide').textContent=`Talk to ${GUIDES[space.guide]} ↗`;
    stationDetail();
  }
  function save(command,form,after){
    if(blocked)return;
    try{const receipt=workspace.dispatch(command);form?.reset();after?.(receipt);render();message('Saved on this device.');if(command.type==='create'){$('#ww-space-title').setAttribute('tabindex','-1');$('#ww-space-title').focus()}return receipt}catch(error){message(error.message||'The draft could not be saved.',true)}
  }
  on($('#ww-create-form'),'submit',event=>{
    event.preventDefault();const form=event.currentTarget;
    save({type:'create',guide:newGuide,title:form.elements.title.value,description:form.elements.description.value,scope:'standalone'},form,receipt=>{selectedId=receipt.instance.id;stationId=null;creating=false;activeTab='plan'});
  });
  on($('#ww-station-form'),'submit',event=>{
    event.preventDefault();if(!selected()||creating)return;const form=event.currentTarget;
    save({type:'add-station',instanceId:selectedId,stationType:form.elements.stationType.value,title:form.elements.title.value,instructions:form.elements.instructions.value},form,receipt=>{stationId=receipt.station.id});
  });
  on($('#ww-link-form'),'submit',event=>{event.preventDefault();if(!selected()||creating)return;const form=event.currentTarget;save({type:'link',instanceId:selectedId,refType:templateFor(selected()).refType,refId:form.elements.refId.value},form)});
  $('#ww-npc-tools').innerHTML=NPC_TOOLS.map(tool=>`<label class="ww-tool-choice"><input type="checkbox" name="capabilities" value="${tool}"${['observe','speak','move'].includes(tool)?' checked':''}> ${label(tool)}</label>`).join('');
  on($('#ww-npc-form'),'submit',event=>{
    event.preventDefault();if(!selected()||creating)return;const form=event.currentTarget;
    const capabilities=[...form.querySelectorAll('input[name="capabilities"]:checked')].map(input=>input.value);
    save({type:'rig-npc',instanceId:selectedId,name:form.elements.name.value,modelId:form.elements.modelId.value,pilotPrompt:form.elements.pilotPrompt.value,capabilities},form);
  });
  on($('#ww-search'),'input',library);
  on($('#ww-new-space'),'click',()=>{if(blocked)return;creating=true;stationId=null;message('');render();$('#space-title').focus()});
  on($('#ww-reload'),'click',()=>{
    try{if(!workspace)workspace=createWorkspace();else workspace.reload();blocked=false;$('#ww-new-space').disabled=false;for(const form of root.querySelectorAll('form'))for(const field of form.elements)field.disabled=false;render();message('Device drafts reloaded.')}catch(error){block(error)}
  });
  on(root,'click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.template){newGuide=button.dataset.template;for(const item of root.querySelectorAll('[data-template]'))item.setAttribute('aria-pressed',String(item===button));}
    if(button.dataset.space){selectedId=button.dataset.space;stationId=null;creating=false;message('');render();$('#ww-space-title').setAttribute('tabindex','-1');$('#ww-space-title').focus();}
    if(button.dataset.station){stationId=button.dataset.station;stationDetail();}
    if(button.dataset.tab){activeTab=button.dataset.tab;tabs();}
  });
  on(root,'keydown',event=>{
    const button=event.target.closest('[data-tab]');if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const ids=['plan','connections','characters'],index=ids.indexOf(activeTab);
    activeTab=ids[event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3];tabs(true);
  });
  function exportPacket(packet){
    const blob=new window.Blob([JSON.stringify(packet,null,2)],{type:'application/json'}),url=window.URL.createObjectURL(blob);
    const anchor=document.createElement('a');anchor.href=url;anchor.download=`worldweaver-${selectedId}.json`;document.body.append(anchor);anchor.click();anchor.remove();window.setTimeout(()=>window.URL.revokeObjectURL(url),1000);
  }
  on($('#ww-export'),'click',()=>{if(!selected()||creating||blocked)return;try{(download||exportPacket)(workspace.exportInstance(selectedId));message('Selected space exported. Review its notes and character prompts before sharing.')}catch(error){message(error.message||'Export failed.',true)}});
  on(window,'storage',event=>{if(event.key!==null&&event.key!==WORKSPACE_STORAGE_KEY)return;message('Device drafts changed in another tab. Reload device drafts before saving; your current form text is still here.',true)});
  if(!blocked){selectedId=snapshot().instances[0]?.id||null;render()}else{render();block(new Error($('#ww-message').textContent))}
  return Object.freeze({refresh:render,destroy:()=>listeners.splice(0).forEach(remove=>remove())});
}

if(typeof document!=='undefined'&&document.getElementById('ww-workspace'))mountWorkspace({document,window});
