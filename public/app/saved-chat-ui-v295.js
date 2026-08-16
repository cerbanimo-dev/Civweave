(()=>{
'use strict';
const VERSION='1.0.165-saved-chat-ui-v353',ROOT='cw-persistent-guide-chat-v215',STYLE='cw-saved-chat-ui-v295-style';
if(globalThis.CivweaveSavedChatUIV295?.version===VERSION)return;
const store=()=>globalThis.CivweaveSavedChatStoreV295,chat=()=>globalThis.CivweavePersistentGuideChatV215;
let current='civweave';
function active(){const s=chat()?.activeWindow?.()||current;return store()?.systems?.includes(s)?s:'civweave'}
function esc(v){return String(v??'').slice(0,40).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function click(e){
  const s=store(),root=document.getElementById(ROOT);if(!s||!root)return;
  const target=e.target instanceof Element?e.target:null;if(!target)return;
  const n=target.closest('[data-cw295-new]'),t=target.closest('[data-cw295-chat]');if(!n&&!t)return;
  e.preventDefault();e.stopPropagation();
  const system=active(),changed=n?s.create(system):s.select(system,t.dataset.cw295Chat);if(!changed)return;
  const surface=chat();if(surface?.render)surface.render();else render(system);
}
function render(system=active()){
  const root=document.getElementById(ROOT),s=store();if(!root||!s)return false;current=s.systems.includes(system)?system:current;
  root.classList.add('cw295-has-saved-chats');
  let nav=root.querySelector('.cw295-saved-chats');if(!nav){nav=document.createElement('nav');nav.className='cw295-saved-chats';nav.setAttribute('aria-label','Saved chats');const anchor=root.querySelector('[data-context]')||root.querySelector('header');anchor?.insertAdjacentElement('afterend',nav)}
  if(!nav)return false;
  if(nav.dataset.cw295Bound!=='true'){nav.dataset.cw295Bound='true';nav.addEventListener('click',click,true)}
  const {state}=s.ensure(current),rows=state.chats.slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  nav.innerHTML=`<span>Saved</span><div>${rows.map(x=>`<button type="button" data-cw295-chat="${esc(x.id)}" aria-selected="${x.id===state.activeId}" title="${esc(x.title)}">${esc(x.title)}</button>`).join('')}</div><button type="button" data-cw295-new aria-label="New saved chat">+</button>`;return true
}
function style(){
  if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`
#${ROOT}.cw295-has-saved-chats{grid-template-rows:max-content max-content max-content max-content minmax(0,1fr) max-content!important}
#${ROOT}.cw295-has-saved-chats>.cw295-saved-chats{grid-row:4;align-self:start!important;justify-self:stretch!important;position:relative!important;inset:auto!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;z-index:2;display:grid!important;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;align-content:center;gap:6px;width:100%!important;min-width:0;height:auto!important;min-height:52px!important;max-height:52px!important;margin:0!important;padding:6px 8px;overflow:hidden;box-sizing:border-box!important;float:none!important;transform:none!important;border:0!important;border-bottom:1px solid #ffffff20!important;border-radius:0!important;background:#0004!important;isolation:isolate}
#${ROOT}.cw295-has-saved-chats>[data-log]{grid-row:5}
#${ROOT}.cw295-has-saved-chats>[data-persistent-form]{grid-row:6}
#${ROOT} .cw295-saved-chats>span{flex:0 0 auto;color:#aeb9c7;font:800 9px/1 system-ui;text-transform:uppercase}
#${ROOT} .cw295-saved-chats>div{display:flex;align-items:center;gap:5px;min-width:0;width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
#${ROOT} .cw295-saved-chats>div::-webkit-scrollbar{display:none}
#${ROOT} .cw295-saved-chats button{position:relative!important;inset:auto!important;flex:0 0 auto;height:40px!important;min-height:40px!important;max-height:40px!important;max-width:145px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0!important;border:1px solid #ffffff24!important;border-radius:999px!important;padding:4px 10px!important;background:#ffffff09!important;color:#d5dbe5!important;font:800 11px/1 system-ui!important;pointer-events:auto!important;touch-action:manipulation}
#${ROOT} .cw295-saved-chats button[aria-selected="true"]{border-color:var(--guide-accent)!important;background:color-mix(in srgb,var(--guide-accent) 18%,#07111f)!important;color:#fff!important}
#${ROOT} .cw295-saved-chats [data-cw295-new]{width:40px!important;min-width:40px!important;max-width:40px!important;padding:0!important;font-size:20px!important;color:var(--guide-accent)!important}
@media(max-width:720px){#${ROOT} .cw295-saved-chats>span{display:none}}
`;document.head.append(s)
}
style();addEventListener('civweave:guide-chat-ready',()=>queueMicrotask(()=>render(active())));addEventListener('civweave:guide-chat-state',e=>{if(store()?.systems?.includes(e.detail?.activeSystem))current=e.detail.activeSystem;queueMicrotask(()=>render(current))});addEventListener('civweave:realm-guide-thread-changed',()=>queueMicrotask(()=>render(active())));queueMicrotask(()=>render(active()));
globalThis.CivweaveSavedChatUIV295=Object.freeze({version:VERSION,revision:'contained-threadbar-v353',savedTabs:true,render,focusOnCreate:false});
})();
