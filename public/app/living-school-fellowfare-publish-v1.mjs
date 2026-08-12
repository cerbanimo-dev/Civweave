import market,{trialSummary,publishLivingSchoolToFellowFare} from './shared/community-learning-market-v1.mjs?v=community-learning-market-v1';

const REVISION='living-school-fellowfare-publish-v1';
const STYLE_ID='ls-fellowfare-publish-style-v1';
const HOST_ID='ls-fellowfare-publish-host-v1';
const DIALOG_ID='ls-fellowfare-publish-dialog-v1';
const clean=(value,max=2000)=>String(value??'').trim().slice(0,max);
let lastSignature='';

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
  .lsff-publish-cta{border:1px solid #f7d37b!important;background:linear-gradient(135deg,#2e4f3b,#6d5427)!important;color:#fff7da!important;box-shadow:0 8px 24px #00150c55!important;font-weight:850!important}
  .lsff-publish-host{display:flex;align-items:center;gap:8px}
  .lsff-dialog{width:min(680px,calc(100vw - 24px));max-height:min(820px,calc(100dvh - 28px));padding:0;border:1px solid #e8cb79;border-radius:20px;background:#102a22;color:#f8f4df;box-shadow:0 28px 80px #000a;overflow:hidden}
  .lsff-dialog::backdrop{background:#04100bd4;backdrop-filter:blur(6px)}
  .lsff-form{display:grid;gap:16px;padding:20px;overflow:auto;max-height:inherit}
  .lsff-form header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.lsff-form h2{margin:2px 0 4px;font-size:clamp(1.35rem,4vw,2rem)}.lsff-form p{margin:0;color:#d6e8da;line-height:1.45}.lsff-form small{color:#b9cfbf}
  .lsff-close{border:1px solid #ffffff33;border-radius:999px;background:#ffffff0b;color:#fff;width:38px;height:38px;font-size:22px;cursor:pointer}
  .lsff-field{display:grid;gap:6px}.lsff-field>span{font-weight:800}.lsff-field input,.lsff-field textarea{box-sizing:border-box;width:100%;border:1px solid #90b69b66;border-radius:12px;background:#061812;color:#fff;padding:11px 12px;font:inherit}.lsff-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .lsff-tutor{padding:14px;border:1px solid #90b69b44;border-radius:16px;background:#ffffff08;display:grid;gap:12px}.lsff-toggle{display:flex;gap:10px;align-items:flex-start}.lsff-toggle input{margin-top:4px}.lsff-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}.lsff-actions button{border-radius:12px;padding:10px 15px;font:inherit;font-weight:850;cursor:pointer}.lsff-secondary{border:1px solid #ffffff33;background:#ffffff0a;color:#fff}.lsff-primary{border:1px solid #f5d47e;background:#d7a93d;color:#1a1204}.lsff-status{padding:10px 12px;border-radius:12px;background:#061812;color:#dff6e4}.lsff-status[data-error="1"]{background:#3a1714;color:#ffd8d1}
  @media(max-width:620px){.lsff-grid{grid-template-columns:1fr}.lsff-dialog{width:calc(100vw - 14px);max-height:calc(100dvh - 14px);border-radius:16px}.lsff-form{padding:15px}.lsff-publish-cta{font-size:.78rem!important;padding-inline:9px!important}}
  `;document.head.append(style);
}
function workbench(){return globalThis.LivingSchoolCleanroomV218}
function state(){try{return workbench()?.getState?.()||null}catch{return null}}
function signature(value){const school=value?.school,trial=trialSummary(value);return JSON.stringify([school?.id,school?.updatedAt,trial.eligible,trial.rows.map(row=>[row.moduleId,row.lessonComplete,row.assessmentPassed,row.attemptCount])])}
function eligibleState(){const value=state();return value&&trialSummary(value).eligible?value:null}

function ensureHost(){
  installStyle();
  const header=document.querySelector('.lsc218-header');if(!header)return null;
  let host=document.getElementById(HOST_ID);if(!host){host=document.createElement('span');host.id=HOST_ID;host.className='lsff-publish-host';header.append(host)}
  return host;
}
function updateCta(){
  const value=state();if(!value)return;
  const nextSignature=signature(value);if(nextSignature===lastSignature&&document.getElementById(HOST_ID))return;lastSignature=nextSignature;
  const host=ensureHost();if(!host)return;const trial=trialSummary(value);host.replaceChildren();
  if(!trial.eligible)return;
  const button=document.createElement('button');button.type='button';button.className='lsff-publish-cta';button.dataset.lsFellowfarePublish='1';button.textContent='Sell / Tutor';button.title='Post this tested interactive learning package to FellowFare';host.append(button);
}
function dialog(){
  let node=document.getElementById(DIALOG_ID);if(node)return node;
  node=document.createElement('dialog');node.id=DIALOG_ID;node.className='lsff-dialog';node.innerHTML=`<form class="lsff-form" method="dialog" data-lsff-form>
    <header><div><small>FELLOWFARE · COMMUNITY LEARNING</small><h2>Share the learning you tested</h2><p>The module stays interactive. FellowFare carries the Living School curriculum object, quizzes/tests, practice, visualizations, provenance, and video/media references. Your personal attempts and progress never become part of the product.</p></div><button class="lsff-close" type="button" data-lsff-close aria-label="Close">×</button></header>
    <label class="lsff-field"><span>Listing title</span><input name="title" maxlength="180" required></label>
    <label class="lsff-field"><span>Acorn price for the interactive module</span><input name="acornPrice" type="number" inputmode="numeric" min="1" step="1" value="3" required><small>Buyers receive a fresh learner instance in Living School, not a PDF or static export.</small></label>
    <section class="lsff-tutor"><label class="lsff-toggle"><input name="tutorEnabled" type="checkbox"><span><strong>Also offer tutoring for this module</strong><br><small>Creates a linked FellowFare tutoring offer backed by the module you completed and tested.</small></span></label>
      <div class="lsff-grid"><label class="lsff-field"><span>USD price</span><input name="usdPrice" type="number" inputmode="decimal" min="0" step="0.01" value="20"></label><label class="lsff-field"><span>Button price</span><input name="buttonPrice" type="number" inputmode="decimal" min="0" step="1" value="5"></label></div>
      <label class="lsff-field"><span>Price unit</span><input name="priceUnit" value="session" maxlength="80" placeholder="session, hour, module"></label>
      <label class="lsff-field"><span>Availability</span><input name="availability" maxlength="300" placeholder="Evenings, weekends, remote, local…"></label>
    </section>
    <div class="lsff-status" data-lsff-status>Ready to publish when you are.</div>
    <div class="lsff-actions"><button type="button" class="lsff-secondary" data-lsff-close>Not now</button><button type="submit" class="lsff-primary">Post to FellowFare</button></div>
  </form>`;
  document.body.append(node);
  node.addEventListener('click',event=>{if(event.target?.dataset?.lsffClose!==undefined)node.close()});
  node.querySelector('[data-lsff-form]').addEventListener('submit',publish);
  return node;
}
function openDialog(){
  const value=eligibleState();if(!value)return;
  const node=dialog(),form=node.querySelector('[data-lsff-form]');form.elements.title.value=clean(value.school?.title,180)||'Interactive learning module';node.querySelector('[data-lsff-status]').textContent=`Tested: ${value.school.modules.length} module${value.school.modules.length===1?'':'s'} completed and passed.`;node.querySelector('[data-lsff-status]').dataset.error='0';node.showModal();
}
async function publish(event){
  event.preventDefault();const value=eligibleState(),form=event.currentTarget,status=form.querySelector('[data-lsff-status]');if(!value){status.dataset.error='1';status.textContent='This curriculum is no longer publication-ready.';return}
  const data=new FormData(form),tutorEnabled=data.get('tutorEnabled')==='on',usdPrice=Number(data.get('usdPrice')||0),buttonPrice=Number(data.get('buttonPrice')||0),acornPrice=Number(data.get('acornPrice')||0);
  if(acornPrice<1){status.dataset.error='1';status.textContent='Choose an Acorn price of at least 1.';return}
  if(tutorEnabled&&usdPrice<=0&&buttonPrice<=0){status.dataset.error='1';status.textContent='Add a USD price, a Button price, or both for tutoring.';return}
  const submit=form.querySelector('[type="submit"]');submit.disabled=true;status.dataset.error='0';status.textContent='Packaging the interactive curriculum for FellowFare…';
  try{
    const result=await publishLivingSchoolToFellowFare(value,{title:clean(data.get('title'),180),acornPrice,author:{id:value.passport?.learnerId,name:value.passport?.displayName},tutor:{enabled:tutorEnabled,usdPrice,buttonPrice,priceUnit:clean(data.get('priceUnit'),80)||'session',availability:clean(data.get('availability'),300)}});
    status.textContent=`Posted “${result.learning.title}” for ${result.learning.acornPrice} Acorns${result.tutor?` and a linked tutoring offer for $${result.tutor.usdPrice} + ${result.tutor.buttonPrice} Buttons / ${result.tutor.priceUnit}`:''}.`;
    try{globalThis.dispatchEvent(new CustomEvent('civweave:toast',{detail:{message:status.textContent}}))}catch{}
    setTimeout(()=>form.closest('dialog')?.close(),900);
  }catch(error){console.error('[Living School → FellowFare]',error);status.dataset.error='1';status.textContent=clean(error?.message||error,1200)||'FellowFare publication failed.'}
  finally{submit.disabled=false}
}

document.addEventListener('click',event=>{if(event.target?.closest?.('[data-ls-fellowfare-publish]'))openDialog()},true);
addEventListener('civweave:living-school-workbench-ready',()=>updateCta());
addEventListener('civweave:community-learning-market-changed',()=>updateCta());
const observer=new MutationObserver(()=>queueMicrotask(updateCta));observer.observe(document.documentElement,{subtree:true,childList:true});
const timer=setInterval(updateCta,1200);setTimeout(()=>clearInterval(timer),120000);queueMicrotask(updateCta);

globalThis.CivweaveLivingSchoolFellowFarePublishV1=Object.freeze({revision:REVISION,marketVersion:market.version,trialSummary,update:updateCta,open:openDialog});
