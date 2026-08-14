(()=>{
'use strict';
const VERSION='1.0.160-saved-chat-ui-v350',ROOT='cw-persistent-guide-chat-v215',STYLE='cw-saved-chat-ui-v295-style';
if(globalThis.CivweaveSavedChatUIV295?.version===VERSION)return;
const store=()=>globalThis.CivweaveSavedChatStoreV295,chat=()=>globalThis.CivweavePersistentGuideChatV215;
let current='civweave';
function active(){const s=chat()?.activeWindow?.()||current;return store()?.systems?.includes(s)?s:'civweave'}
function esc(v){return String(v??'').slice(0,40).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function render(system=active()){
  const root=document.getElementById(ROOT),s=store();if(!root||!s)return false;current=s.systems.includes(system)?system:current;
  let nav=root.querySelector('.cw295-saved-chats');if(!nav){nav=document.createElement('nav');nav.className='cw295-saved-chats';nav.setAttribute('aria-label','Saved chats');const anchor=root.querySelector('[data-context]')||root.querySelector('header');anchor?.insertAdjacentElement('afterend',nav)}
  if(!nav)return false;const {state}=s.ensure(current),rows=state.chats.slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  nav.innerHTML=`<span>Saved</span><div>${rows.map(x=>`<button type="button" data-cw295-chat="${esc(x.id)}" aria-selected="${x.id===state.activeId}" title="${esc(x.title)}">${esc(x.title)}</button>`).join('')}</div><button type="button" data-cw295-new aria-label="New saved chat">+</button>`;return true
}
function style(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`#${ROOT} .cw295-saved-chats{display:flex;align-items:center;gap:6px;min-width:0;padding:6px 8px;border-bottom:1px solid #ffffff20;background:#0004}#${ROOT} .cw295-saved-chats>span{flex:0 0 auto;color:#aeb9c7;font:800 9px/1 system-ui;text-transform:uppercase}#${ROOT} .cw295-saved-chats>div{display:flex;gap:5px;min-width:0;overflow-x:auto;scrollbar-width:none}#${ROOT} .cw295-saved-chats>div::-webkit-scrollbar{display:none}#${ROOT} .cw295-saved-chats button{flex:0 0 auto;min-height:30px;max-width:145px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid #ffffff24;border-radius:999px;padding:4px 9px;background:#ffffff09;color:#d5dbe5;font:800 11px/1 system-ui}#${ROOT} .cw295-saved-chats button[aria-selected="true"]{border-color:var(--guide-accent);background:color-mix(in srgb,var(--guide-accent) 18%,#07111f);color:#fff}#${ROOT} .cw295-saved-chats [data-cw295-new]{width:32px;padding:0;font-size:18px;color:var(--guide-accent)}@media(max-width:720px){#${ROOT} .cw295-saved-chats>span{display:none}}`;document.head.append(s)}
function click(e){const root=e.target instanceof Element?e.target.closest(`#${ROOT}`):null,s=store();if(!root||!s)return;const n=e.target.closest('[data-cw295-new]'),t=e.target.closest('[data-cw295-chat]');if(!n&&!t)return;e.preventDefault();e.stopImmediatePropagation();n?s.create(active()):s.select(active(),t.dataset.cw295Chat);render(active());if(n)queueMicrotask(()=>root.querySelector('textarea')?.focus?.({preventScroll:true}))}
style();document.addEventListener('click',click,true);addEventListener('civweave:guide-chat-ready',()=>queueMicrotask(()=>render(active())));addEventListener('civweave:guide-chat-state',e=>{if(store()?.systems?.includes(e.detail?.activeSystem))current=e.detail.activeSystem;queueMicrotask(()=>render(current))});addEventListener('civweave:realm-guide-thread-changed',()=>queueMicrotask(()=>render(active())));queueMicrotask(()=>render(active()));
globalThis.CivweaveSavedChatUIV295=Object.freeze({version:VERSION,savedTabs:true,render});
})();
