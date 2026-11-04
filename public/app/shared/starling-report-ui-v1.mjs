import {readDailyGuildReport,publishDailyGuildReport,appendGuildReportAction} from './starling-daily-report-v1.mjs';
import {createStarlingReportProducerRegistry,createStarlingReportProducerVerifier} from './starling-report-producers-v1.mjs';

const REPORT_KINDS=new Set([
  'civweave.starling-collective-turn.v1',
  'civweave.starling-collective-work-receipt.v1',
  'civweave.starling-report-event.v1',
  'civweave.starling-daily-report-file.v1',
  'civweave.starling-report-producer-grant.v1'
]);
const message=(error,max=180)=>String(error?.message||error||'Unknown error').slice(0,max);

/**
 * An owner-scoped report view. The signed Guild mesh is the only record store.
 * No prompts or outputs are sent to a secondary logging service.
 */
export function createStarlingGuildReportPanel({host,guild,mesh,founder,verifyReader}={}){
  if(!host||!guild?.id||!mesh?.getObject||typeof founder!=='function'||typeof verifyReader!=='function')
    throw new TypeError('Report panel needs selected Guild, canonical mesh, founder and verified read permission.');
  let closed=false,busy=false,queued=false,queuedPublish=false,lastReport=null;
  let grants=[],isFounder=false,notice='Reading signed Guild activity…';
  const select=q=>host.querySelector(q);
  host.innerHTML=`<section class="sl-report-panel" aria-label="Daily signed Guild report">
    <h3>Daily Guild report · UTC</h3>
    <p class="sl-sub">PvE scenes, worker attempts and observed model-host states are signed and synced as Guild metadata, not as approved book canon or completed Quests.</p>
    <div class="sl-flex"><button type="button" data-report-action="sync">Sync report</button>
    <button type="button" data-report-action="save">Save .md on this phone</button></div>
    <p data-report-status role="status" class="sl-status">Reading report…</p>
    <details><summary>Read today's activity log</summary><pre data-report-preview class="sl-host-output"></pre></details>
    <details><summary>Authorize remote report-only devices</summary>
      <p class="sl-sub">Founding Guildkeeper only. Seven-day grant; report metadata only. No AI inference, credits, task claims or membership authority.</p>
      <label>Signed device ID <input data-report-device maxlength="220" placeholder="device:…"></label>
      <label>Source <select data-report-source>
        <option value="community-local">Community local model</option><option value="cloud-ai">Cloud model</option><option value="trusted-tool">Approved tool</option>
      </select></label>
      <div class="sl-flex"><button type="button" data-report-action="trust">Authorize 7 days</button>
        <button type="button" data-report-action="revoke">Revoke</button>
        <button type="button" data-report-action="device">Copy this device ID</button></div>
      <p data-report-grants class="sl-sub"></p>
    </details>
  </section>`;
  const verifier=createStarlingReportProducerVerifier({mesh,guildId:guild.id});
  const registry=createStarlingReportProducerRegistry({mesh,founder});
  function render(){
    if(closed)return;
    const status=select('[data-report-status]');if(status)status.textContent=notice;
    const preview=select('[data-report-preview]');if(preview)preview.textContent=lastReport?.markdown||'No signed report available.';
    const save=select('[data-report-action=save]');if(save)save.disabled=!lastReport||busy;
    for(const action of ['trust','revoke']){
      const button=select('[data-report-action='+action+']');if(button)button.disabled=!isFounder||busy;
    }
    const grantInfo=select('[data-report-grants]');
    if(grantInfo)grantInfo.textContent=grants.length?grants.map(p=>
      p.deviceId+' · '+p.source+' · '+(!p.enabled?'revoked':p.expired?'expired':'until '+p.expiresAt.slice(0,10))
    ).join(' | '):'No authorized remote report producers.';
  }
  async function refresh({publish=false}={}){
    if(closed)return;
    if(busy){queued=true;queuedPublish=queuedPublish||publish;return}
    busy=true;
    try{
      isFounder=Boolean(founder()?.guildId===guild.id&&founder()?.deviceId===await mesh.deviceId());
      const reader=()=>Boolean(isFounder||verifyReader(guild));
      if(publish&&isFounder)await publishDailyGuildReport({mesh,guildId:guild.id,founder,verifyProducer:verifier});
      const data=await readDailyGuildReport({mesh,guildId:guild.id,verifyReader:reader,verifyProducer:verifier});
      const entries=await registry.list({guildId:guild.id,verifyReader:reader});
      if(closed)return;
      lastReport=data;grants=entries;
      notice=data.day+' · '+data.eventCount+' signed activity records · '+(data.source==='signed-replicated-file'?'synced founder file':'reconstructed');
    }catch(error){notice='Report unavailable: '+message(error,220)}
    finally{
      busy=false;render();
      if(queued&&!closed){const next=queuedPublish;queued=false;queuedPublish=false;queueMicrotask(()=>void refresh({publish:next}))}
    }
  }
  async function syncNow(){
    let cloudWarning='';
    try{
      const pocket=await import('../pocket-guild-node-v1.mjs');
      const state=pocket.CivweavePocketGuildNodeV1.state();
      if(state?.guildId===guild.id&&state.primaryOrigin){
        const outcome=await pocket.CivweavePocketGuildNodeV1.syncPrimary();
        if(outcome.status!=='synced')cloudWarning='Cloud sync: '+message(outcome.status,60);
      }
    }catch(error){cloudWarning='Cloud sync unavailable: '+message(error,110)}
    await refresh({publish:true});
    if(cloudWarning&&!closed){notice+=' · '+cloudWarning;render()}
  }
  function download(){
    if(!lastReport||closed)return;
    const blob=new Blob([lastReport.markdown],{type:'text/markdown;charset=utf-8'});
    const uri=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=uri;a.download=lastReport.filename;a.style.display='none';document.body.append(a);
    try{a.click();notice='Requested '+lastReport.filename+' · signed report remains in the Guild mesh.'}
    finally{a.remove();setTimeout(()=>URL.revokeObjectURL(uri),5000);render()}
  }
  async function grant(action){
    if(!isFounder||busy||closed)return;
    const deviceId=String(select('[data-report-device]')?.value||'').trim();
    const source=select('[data-report-source]')?.value;
    try{
      if(action==='trust')await registry.issue({guildId:guild.id,deviceId,source,days:7,
        confirmConsent:({deviceId,source})=>globalThis.confirm?.('Authorize '+deviceId+' to publish signed '+source+' report metadata for this Guild for seven days?')===true});
      else await registry.revoke({guildId:guild.id,deviceId});
      await refresh({publish:true});
    }catch(error){notice='Report host permission rejected: '+message(error);render()}
  }
  async function copyDevice(){
    try{const id=await mesh.deviceId();await navigator.clipboard.writeText(id);notice='Copied this signed device ID; never share private signing keys.'}
    catch(error){notice='Device ID could not be copied: '+message(error)}
    render();
  }
  async function onClick(event){
    const action=event.target.closest('[data-report-action]')?.dataset.reportAction;
    if(!action)return;
    if(action==='sync')await syncNow();
    else if(action==='save')download();
    else if(action==='trust'||action==='revoke')await grant(action);
    else if(action==='device')await copyDevice();
  }
  async function recordHostJobs(jobs,{kind='termux'}={}){
    if(closed||!Array.isArray(jobs)||!['termux','android'].includes(kind))return 0;
    const owner=founder();
    if(owner?.guildId!==guild.id||owner?.deviceId!==await mesh.deviceId())return 0;
    const states={queued:'proposed',running:'started',completed:'completed',failed:'failed',cancelled:'blocked',interrupted:'blocked'};
    let count=0;
    for(const job of jobs.slice(0,30)){
      if(job?.guildId!==guild.id||!/^[0-9a-f]{32}$/.test(job?.jobId||'')||!states[job.state])continue;
      await appendGuildReportAction({mesh,guildId:guild.id,source:'community-local',
        action:'inference',status:states[job.state],actor:String(job.personaId||'Starling host').slice(0,50),
        summary:'Paired '+kind+' host reported '+job.state+' for a review-only model draft. No story canon or Quest completion verified.',
        referenceId:job.jobId,idempotencyKey:job.jobId+'_'+job.state,
        verifyProducer:verifier
      });count++;
    }
    if(count)await refresh({publish:true});
    return count;
  }
  const listener=e=>void onClick(e).catch(error=>{notice='Report action failed: '+message(error);render()});
  host.addEventListener('click',listener);
  const unsubscribe=typeof mesh.subscribe==='function'?mesh.subscribe(event=>{
    if(closed||!['object-created','object-received'].includes(event?.type)||!REPORT_KINDS.has(event.detail?.kind))return;
    void refresh({publish:event.type==='object-created'&&event.detail.kind!=='civweave.starling-daily-report-file.v1'});
  }):null;
  render();
  void refresh({publish:true});
  return Object.freeze({
    refresh,syncNow,recordHostJobs,
    dispose(){closed=true;host.removeEventListener('click',listener);if(typeof unsubscribe==='function')unsubscribe();host.replaceChildren()}
  });
}
