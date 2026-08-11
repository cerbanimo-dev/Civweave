(()=>{
'use strict';
if(globalThis.CivweaveFellowFareSkillMarketV1)return;
const market=globalThis.CivweaveSkillMarketV1;
if(!market){console.warn('FellowFare skill market bridge is waiting for CivweaveSkillMarketV1.');return;}

const VERSION='1.0.0';
const META_KEY='fellowfare.skill-market-meta.v1';
const STATE_KEYS=['fellowfare.mvp.state.v3','fellowfare.mvp.state.v2','fellowfare.mvp.state.v1'];
const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const fmt=value=>new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(num(value));
let booted=false,pendingMeta=null,decorateQueued=false;

function readMeta(){const value=parse(localStorage.getItem(META_KEY),null);return value?.schema==='fellowfare.skill-market-meta.v1'&&value.threads?value:{schema:'fellowfare.skill-market-meta.v1',threads:{},updatedAt:''};}
function writeMeta(store){store.updatedAt=new Date().toISOString();localStorage.setItem(META_KEY,JSON.stringify(store));try{dispatchEvent(new CustomEvent('fellowfare:skill-market-meta',{detail:store}))}catch{}return store;}
function readState(){for(const key of STATE_KEYS){const value=parse(localStorage.getItem(key),null);if(value?.threads)return value}return null;}
function canonicalSkill(value){return globalThis.CivweaveCanonicalRewardsV2?.skillSlug?.(value)||clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'general-practice';}
function currencyName(currency,units=2){return currency==='button'?(Number(units)===1?'Button':'Buttons'):(Number(units)===1?'Acorn':'Acorns');}
function currencyGlyph(currency){return currency==='button'?'⊙':'●';}
function niceTime(value){if(!value)return 'not pinged';const date=new Date(value);if(Number.isNaN(date.getTime()))return 'not pinged';return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date);}

function injectStyle(){
  if(document.querySelector('style[data-ff-skill-market-v1]'))return;
  const style=document.createElement('style');style.dataset.ffSkillMarketV1='';style.textContent=`
    .ff-skill-market-fields{border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:16px;padding:14px;display:grid;gap:12px;background:color-mix(in srgb,#d79b5a 9%,transparent)}
    .ff-skill-market-head{display:flex;gap:12px;justify-content:space-between;align-items:flex-start}.ff-skill-market-head p{margin:.2rem 0 0;font-size:.82rem;opacity:.78}.ff-skill-market-toggle{display:flex;gap:8px;align-items:center;font-weight:800;white-space:nowrap}
    .ff-skill-market-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ff-skill-market-grid .field:last-child{grid-column:1/-1}.ff-skill-market-currency{padding:10px 12px;border-radius:12px;background:#17100a;color:#f9dd9b;font-weight:900;letter-spacing:.02em}.ff-skill-market-currency small{display:block;color:#f4e7cf;opacity:.72;font-weight:600;margin-top:3px}
    .cw-skill-proof-line{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.cw-skill-proof-pill{font-size:.72rem;font-weight:850;padding:5px 8px;border-radius:999px;background:#20160f;color:#f8e8c9;border:1px solid #c58d4f66}.cw-skill-proof-pill.button{border-color:#5d8dbb99}.cw-skill-proof-pill.acorn{border-color:#68875d99}.cw-skill-proof-stamp{font-size:.68rem;opacity:.72;align-self:center}.cw-skill-proof-note{position:relative;z-index:2;margin:.55rem 0 0;font-size:.72rem;opacity:.72}
    @media(max-width:620px){.ff-skill-market-head{display:grid}.ff-skill-market-grid{grid-template-columns:1fr}}
  `;document.head.append(style);
}

function createFields(){
  const structured=document.querySelector('#structuredFields');
  if(!structured||document.querySelector('#skillMarketFields'))return null;
  const section=document.createElement('section');section.id='skillMarketFields';section.className='ff-skill-market-fields';section.innerHTML=`
    <div class="ff-skill-market-head"><div><strong>Skill exchange</strong><p>Skill requests use Civweave's internal skill currencies. Historical proof comes from paired, signed ledger receipts rather than the user's current wallet balance.</p></div><label class="ff-skill-market-toggle"><input id="skillMarketEnabled" type="checkbox"> Use skill currency</label></div>
    <div class="ff-skill-market-grid">
      <label class="field"><span>What kind of skill exchange?</span><select id="skillMarketIntent"><option value="labor">Labor / doing</option><option value="learning">Learning / teaching</option></select></label>
      <label class="field"><span>Skill</span><input id="skillMarketSkill" maxlength="120" placeholder="Carpentry, coding, mending…"></label>
      <label class="field"><span>Requested / offered amount</span><input id="skillMarketUnits" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="8"></label>
    </div>
    <output id="skillMarketCurrency" class="ff-skill-market-currency">⊙ Labor settles in Buttons<small>Provider proof will show both validated Button and Acorn history for this skill as of the last hub ping.</small></output>`;
  const exchange=document.querySelector('#exchangeMethods')?.closest('fieldset');
  if(exchange)exchange.before(section);else structured.append(section);
  return section;
}

function fields(){return {enabled:document.querySelector('#skillMarketEnabled'),intent:document.querySelector('#skillMarketIntent'),skill:document.querySelector('#skillMarketSkill'),units:document.querySelector('#skillMarketUnits'),currency:document.querySelector('#skillMarketCurrency'),category:document.querySelector('#threadCategory')};}
function selectedMode(){return document.querySelector('.mode-chip.is-active')?.dataset.mode||'need';}
function updateCurrency(){
  const f=fields();if(!f.intent||!f.currency)return;
  const currency=market.currencyForIntent(f.intent.value)||'button';
  f.currency.innerHTML=`${currencyGlyph(currency)} ${f.intent.value==='learning'?'Learning settles in Acorns':'Labor settles in Buttons'}<small>Provider proof shows both validated Button and Acorn history for this skill as of the last hub ping, never the spendable wallet balance.</small>`;
}
function applyCategoryDefault(force=false){
  const f=fields();if(!f.category||!f.enabled||!f.intent)return;
  const category=f.category.value;
  if(category==='Learning'){if(force||!f.enabled.checked)f.intent.value='learning';f.enabled.checked=true;}
  else if(category==='Work'){if(force||!f.enabled.checked)f.intent.value='labor';f.enabled.checked=true;}
  updateCurrency();
}

function ensureTokenMethod(label){
  const host=document.querySelector('#exchangeMethods');if(!host)return;
  host.querySelectorAll('input').forEach(input=>{input.checked=false});
  let input=[...host.querySelectorAll('input')].find(node=>node.value===label);
  if(!input){const wrapper=document.createElement('label');wrapper.className='check-card';wrapper.dataset.skillMarketMethod='';wrapper.innerHTML=`<input type="checkbox"><span></span>`;input=wrapper.querySelector('input');input.value=label;wrapper.querySelector('span').textContent=label;host.prepend(wrapper);}
  input.checked=true;
}

function prepareSkillSubmission(event){
  if(event.target?.id!=='composerForm')return;
  const f=fields();if(!f.enabled?.checked)return;
  const skillName=clean(f.skill?.value,120),units=num(f.units?.value),intent=f.intent?.value||'labor';
  if(!skillName||units<=0){
    event.preventDefault();event.stopImmediatePropagation();
    if(!skillName){f.skill.required=true;f.skill.reportValidity();}else{f.units.required=true;f.units.setCustomValidity('Enter a positive Button or Acorn amount.');f.units.reportValidity();setTimeout(()=>f.units.setCustomValidity(''),0);}return;
  }
  const quote=market.quoteSkill({intent,skillId:skillName,amount:units});
  const label=`${fmt(quote.units)} ${currencyName(quote.currency,quote.units)}`;
  ensureTokenMethod(label);
  const dollar=document.querySelector('#threadAmount');if(dollar)dollar.value='';
  pendingMeta={title:clean(document.querySelector('#threadTitle')?.value,100),mode:selectedMode(),skillId:quote.skillId,skillName,intent:quote.intent,currency:quote.currency,units:quote.units,priceLabel:label,preparedAt:new Date().toISOString()};
  queueMicrotask(finalizeSkillSubmission);
}

function finalizeSkillSubmission(){
  const pending=pendingMeta;pendingMeta=null;if(!pending)return;
  const state=readState();if(!state)return;
  const thread=[...(state.threads||[])].filter(item=>item?.ownerId==='me'&&item?.title===pending.title).sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0))[0];
  if(!thread)return;
  const ping=market.lastPing();
  const proof=ping?.skills?.[pending.skillId]||market.proofForSkill(pending.skillId);
  const store=readMeta();
  store.threads[thread.id]={schema:'fellowfare.skill-thread-meta.v1',threadId:thread.id,skillId:pending.skillId,skillName:pending.skillName,intent:pending.intent,currency:pending.currency,units:pending.units,priceLabel:pending.priceLabel,providerProof:{...proof,pingedAt:ping?.pingedAt||'',ledgerHeadHash:ping?.ledgerHeadHash||'',integrity:ping?.integrity||'local-only'},createdAt:thread.createdAt||pending.preparedAt};
  writeMeta(store);scheduleDecorate();
}

function proofLine(meta){
  const proof=meta?.providerProof||{};
  const buttons=fmt(proof.validatedButtons||0),acorns=fmt(proof.validatedAcorns||0),stamp=proof.pingedAt?`ledger ping ${niceTime(proof.pingedAt)}`:'local ledger · not advertised yet';
  return `<div class="cw-skill-proof-line" data-cw-skill-proof><span class="cw-skill-proof-pill">${clean(meta.skillName)||clean(meta.skillId)}</span><span class="cw-skill-proof-pill button">⊙ ${buttons} validated Buttons</span><span class="cw-skill-proof-pill acorn">● ${acorns} validated Acorns</span><span class="cw-skill-proof-stamp">${stamp}</span></div>`;
}

function decorateCard(card,threadId,meta){
  if(card.querySelector('[data-cw-skill-proof]'))return;
  const target=card.querySelector('.thread-meta')||card.querySelector('p')||card;
  target.insertAdjacentHTML('afterend',proofLine(meta));
}
function decorateDetail(threadId,meta){
  const detail=document.querySelector('#detailContent');if(!detail||detail.dataset.cwSkillThread===threadId)return;
  const open=detail.querySelector(`[data-save-thread="${CSS.escape(threadId)}"], [data-copy-thread="${CSS.escape(threadId)}"], [data-propose="${CSS.escape(threadId)}"]`);if(!open)return;
  detail.dataset.cwSkillThread=threadId;
  const hero=detail.querySelector('.detail-hero');if(hero&&!hero.querySelector('[data-cw-skill-proof]'))hero.insertAdjacentHTML('beforeend',`${proofLine(meta)}<p class="cw-skill-proof-note">Skill history is lifetime validated issuance attributed to this skill, not the provider's currently-held wallet total. Labor requests settle in Buttons; learning requests settle in Acorns.</p>`);
}
function decorate(){
  decorateQueued=false;const store=readMeta();
  for(const [threadId,meta] of Object.entries(store.threads||{})){
    const button=document.querySelector(`[data-open-thread="${CSS.escape(threadId)}"]`);const card=button?.closest('.thread-card');if(card)decorateCard(card,threadId,meta);
    decorateDetail(threadId,meta);
  }
}
function scheduleDecorate(){if(decorateQueued)return;decorateQueued=true;requestAnimationFrame(decorate);}

function refreshOwnProofsFromPing(ping){
  if(!ping?.skills)return;
  const state=readState(),mine=new Set((state?.threads||[]).filter(thread=>thread.ownerId==='me').map(thread=>thread.id));
  const store=readMeta();let changed=false;
  for(const [threadId,meta] of Object.entries(store.threads||{})){
    if(!mine.has(threadId))continue;
    const proof=ping.skills[meta.skillId]||market.proofForSkill(meta.skillId,{skills:{}});
    meta.providerProof={...proof,pingedAt:ping.pingedAt,ledgerHeadHash:ping.ledgerHeadHash,integrity:ping.integrity};changed=true;
  }
  if(changed)writeMeta(store);scheduleDecorate();
}

function attachThreadProof(threadId,metadata){
  if(!clean(threadId)||!metadata)return null;
  const intent=metadata.intent==='learning'?'learning':'labor',currency=market.currencyForIntent(intent),skillId=canonicalSkill(metadata.skillId||metadata.skillName),units=Math.max(0,num(metadata.units));
  const store=readMeta();store.threads[threadId]={schema:'fellowfare.skill-thread-meta.v1',threadId,skillId,skillName:clean(metadata.skillName||skillId,120),intent,currency,units,priceLabel:`${fmt(units)} ${currencyName(currency,units)}`,providerProof:metadata.providerProof||metadata.proof||{},createdAt:metadata.createdAt||new Date().toISOString()};writeMeta(store);scheduleDecorate();return store.threads[threadId];
}
function exportThreadProof(threadId){return copySafe(readMeta().threads?.[threadId]||null);}
function copySafe(value){return value==null?value:JSON.parse(JSON.stringify(value));}

async function pingMarket(){
  try{const ping=await market.recordPing({hubId:clean(document.documentElement.dataset.hubId||'')});refreshOwnProofsFromPing(ping);return ping}catch(error){console.warn('FellowFare kept the previous skill-market ping because the ledger could not be verified.',error);return market.lastPing();}
}

function boot(){
  if(booted)return;booted=true;injectStyle();createFields();applyCategoryDefault(true);updateCurrency();
  document.addEventListener('submit',prepareSkillSubmission,true);
  document.addEventListener('change',event=>{if(event.target?.id==='threadCategory')applyCategoryDefault(true);if(event.target?.id==='skillMarketIntent')updateCurrency();});
  const structured=document.querySelector('#structuredFields');if(structured)new MutationObserver(()=>{createFields();applyCategoryDefault();scheduleDecorate();}).observe(structured,{attributes:true,childList:true,subtree:true});
  new MutationObserver(scheduleDecorate).observe(document.body,{childList:true,subtree:true});
  addEventListener('civweave:skill-market-ping',event=>refreshOwnProofsFromPing(event.detail));
  addEventListener('storage',event=>{if(event.key===META_KEY||event.key===market.pingStorageKey)scheduleDecorate();});
  scheduleDecorate();void pingMarket();
}

const bridge=Object.freeze({version:VERSION,metadataStorageKey:META_KEY,attachThreadProof,exportThreadProof,pingMarket});
globalThis.CivweaveFellowFareSkillMarketV1=bridge;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
