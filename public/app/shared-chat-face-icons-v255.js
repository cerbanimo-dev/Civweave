(()=>{
'use strict';

const VERSION='1.0.119-shared-chat-face-icons-v255-expressive-v313';
const ROOT_ID='cw-persistent-guide-chat-v215';
const SHARED_ROOT_ID='cw-shared-guide-surface-v236';
const LAUNCHER_ID='cwp215-launcher';
const STYLE_ID='cw-shared-chat-face-icons-v255-style';
const DIRECTOR_SRC='/app/avatar-expression-director-v313.js?v=1.0.0-v313';
const FALLBACK_ICONS=Object.freeze({
  civweave:'/app/assets/ai/chat/weaveling-face-v255.webp',
  'living-school':'/app/assets/ai/chat/moss-face-v255.webp',
  cerbanimo:'/app/assets/ai/chat/kamiya-face-v255.webp',
  fellowfare:'/app/assets/ai/chat/rook-face-v255.webp',
  anarchadia:'/app/assets/ai/chat/merlin-face-v255.webp'
});
const ALT_TO_SYSTEM=Object.freeze({weaveling:'civweave',moss:'living-school',kamiya:'cerbanimo',rook:'fellowfare',merlin:'anarchadia'});
const OLD_SRC_TO_SYSTEM=Object.freeze({'weaveling.png':'civweave','moss.png':'living-school','kamiya.png':'cerbanimo','rook.png':'fellowfare','merlin.png':'anarchadia','weaveling-face-v255.webp':'civweave','moss-face-v255.webp':'living-school','kamiya-face-v255.webp':'cerbanimo','rook-face-v255.webp':'fellowfare','merlin-face-v255.webp':'anarchadia'});
const expressions=new Map(Object.keys(FALLBACK_ICONS).map(system=>[system,'neutral']));

if(globalThis.CivweaveSharedChatFaceIconsV255?.version===VERSION)return;

function director(){return globalThis.CivweaveAvatarExpressionDirectorV313}
function installDirector(){
  if(director())return Promise.resolve(true);
  const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname==='/app/avatar-expression-director-v313.js'}catch{return false}});
  if(existing)return new Promise(resolve=>{if(director())resolve(true);else{existing.addEventListener('load',()=>resolve(Boolean(director())),{once:true});existing.addEventListener('error',()=>resolve(false),{once:true})}});
  const head=document.head;if(!head?.isConnected)return Promise.resolve(false);const script=document.createElement('script');script.src=DIRECTOR_SRC;script.async=false;
  return new Promise(resolve=>{script.onload=()=>resolve(Boolean(director()));script.onerror=()=>resolve(false);head.append(script)});
}
const TRANSPARENT_PIXEL='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const CHARACTER=Object.freeze({civweave:'weaveling','living-school':'moss',cerbanimo:'kamiya',fellowfare:'rook',anarchadia:'merlin'});
function atlasDescriptor(system){const api=director(),expression=expressions.get(system)||'neutral',list=api?.expressions?.[system]||[],index=Math.max(0,list.indexOf(expression)),shard=Math.floor(index/10)+1,local=index%10,col=local%5,row=Math.floor(local/5),character=CHARACTER[system];if(!character||!list.length)return null;return{expression,src:`/app/assets/ai/chat/expressions/atlases/${character}-expressions-${shard}-v313.webp`,x:`${col*25}%`,y:`${row*100}%`}}
function clearAtlas(img){delete img.dataset.cwExpressionAtlas;img.style.removeProperty('background-image');img.style.removeProperty('background-size');img.style.removeProperty('background-position');img.style.removeProperty('background-repeat')}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const head=document.head;if(!head)return;const style=document.createElement('style');style.id=STYLE_ID;
  style.textContent=`
#${ROOT_ID} .cw242-window-switcher{gap:6px!important;padding:8px 8px 9px!important}
#${ROOT_ID} .cw242-window{gap:4px!important;padding:5px 2px!important}
#${ROOT_ID} .cw242-window img{width:60px!important;height:60px!important;border-radius:14px!important;object-fit:contain!important;border:2px solid var(--window-accent)!important;box-shadow:0 3px 12px #0008!important;background:#07132166!important}
#${ROOT_ID} .cw242-window[aria-pressed="true"] img{transform:scale(1.035);box-shadow:0 0 16px color-mix(in srgb,var(--window-accent) 58%,transparent),0 3px 12px #0009!important}
#${ROOT_ID} .cw242-window span{font-size:10px!important}
#${ROOT_ID} header [data-guide-avatar]{width:76px!important;height:76px!important;min-width:76px!important;border-radius:16px!important;object-fit:contain!important}
#${ROOT_ID} [data-log] article>img{border-radius:11px!important;object-fit:contain!important}
#${LAUNCHER_ID}{position:fixed!important;right:max(12px,env(safe-area-inset-right))!important;bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px)!important;width:52px!important;height:52px!important;min-width:52px!important;max-width:52px!important;min-height:52px!important;max-height:52px!important;margin:0!important;padding:0!important;display:grid!important;place-items:center!important;box-sizing:border-box!important;border:2px solid var(--guide-accent,#d8dde7)!important;border-radius:50%!important;background:var(--guide-panel,#111827)!important;box-shadow:0 6px 18px #0009,0 0 0 1px #ffffff24!important;overflow:hidden!important;appearance:none!important;-webkit-appearance:none!important;line-height:0!important;z-index:2147483643!important;pointer-events:auto!important;touch-action:manipulation!important}
#${LAUNCHER_ID} img{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;border:0!important;border-radius:50%!important;object-fit:contain!important}
#${SHARED_ROOT_ID} img[data-cwsg-avatar],#${SHARED_ROOT_ID} .cwsg236-avatar,#${SHARED_ROOT_ID} .cwsg236-avatar img{border-radius:14px!important;object-fit:contain!important;background:#07132155!important}
@media(max-width:620px){#${ROOT_ID} .cw242-window-switcher{gap:4px!important;padding:7px 5px 8px!important}#${ROOT_ID} .cw242-window img{width:54px!important;height:54px!important;border-radius:12px!important}#${ROOT_ID} .cw242-window span{font-size:9px!important}#${ROOT_ID} header [data-guide-avatar]{width:68px!important;height:68px!important;min-width:68px!important;border-radius:14px!important}#${LAUNCHER_ID}{right:max(10px,env(safe-area-inset-right))!important;bottom:calc(var(--cw-themed-nav-height,58px) + env(safe-area-inset-bottom) + 10px)!important;width:48px!important;height:48px!important;min-width:48px!important;max-width:48px!important;min-height:48px!important;max-height:48px!important}}
@media(max-width:390px){#${ROOT_ID} .cw242-window img{width:50px!important;height:50px!important}#${ROOT_ID} .cw242-window-switcher{gap:2px!important;padding-left:3px!important;padding-right:3px!important}#${LAUNCHER_ID}{width:46px!important;height:46px!important;min-width:46px!important;max-width:46px!important;min-height:46px!important;max-height:46px!important}}
`;
  head.append(style);
}

function explicitSystem(img){
  const tagged=img.dataset?.cwAvatarSystem;if(FALLBACK_ICONS[tagged])return tagged;
  const windowButton=img.closest?.('[data-cw242-window]');if(windowButton&&FALLBACK_ICONS[windowButton.dataset.cw242Window])return windowButton.dataset.cw242Window;
  const shared=img.closest?.(`#${SHARED_ROOT_ID}`);if(shared&&FALLBACK_ICONS[shared.dataset.system])return shared.dataset.system;
  const root=img.closest?.(`#${ROOT_ID}`);if(root&&img.matches?.('[data-guide-avatar]')&&FALLBACK_ICONS[root.dataset.guide])return root.dataset.guide;
  const launcher=img.closest?.(`#${LAUNCHER_ID}`);if(launcher){const page=root?.dataset?.pageSystem||document.documentElement.dataset.civweaveSystemRoute;if(FALLBACK_ICONS[page])return page}
  const alt=String(img.getAttribute?.('alt')||'').trim().toLowerCase().replace(/^open\s+/,'');if(ALT_TO_SYSTEM[alt])return ALT_TO_SYSTEM[alt];
  const src=String(img.getAttribute?.('src')||'').split('?')[0].split('/').pop()?.toLowerCase()||'';return OLD_SRC_TO_SYSTEM[src]||'';
}
function apply(scope=document){
  const images=scope instanceof HTMLImageElement?[scope]:Array.from(scope.querySelectorAll?.('img')||[]);
  for(const img of images){
    if(!img.closest?.(`#${ROOT_ID},#${SHARED_ROOT_ID},#${LAUNCHER_ID}`))continue;
    const system=explicitSystem(img);if(!system)continue;img.dataset.cwAvatarSystem=system;
    const atlas=atlasDescriptor(system);
    if(atlas){
      if(img.getAttribute('src')!==TRANSPARENT_PIXEL)img.src=TRANSPARENT_PIXEL;
      img.dataset.cwExpressionAtlas='v313';
      img.style.setProperty('background-image',`url("${atlas.src}")`);
      img.style.setProperty('background-size','500% 200%');
      img.style.setProperty('background-position',`${atlas.x} ${atlas.y}`);
      img.style.setProperty('background-repeat','no-repeat');
      img.dataset.cwExpression=atlas.expression;
    }else{
      clearAtlas(img);const src=FALLBACK_ICONS[system];if(src&&img.getAttribute('src')!==src)img.src=src;img.dataset.cwExpression=expressions.get(system)||'neutral';
    }
    img.dataset.cwFaceIcon='v313';
  }
}
function refresh(){installStyle();apply(document)}
function expressionEvent(event){const detail=event?.detail||{},system=detail.system;if(!FALLBACK_ICONS[system])return;expressions.set(system,detail.expression||'neutral');refresh()}
function start(){
  refresh();void installDirector().then(ok=>{if(ok){const snapshot=director()?.status?.()?.state||{};for(const [system,row] of Object.entries(snapshot))if(row?.expression)expressions.set(system,row.expression);refresh();director()?.refresh?.()}});
  const observer=new MutationObserver(records=>{for(const record of records){for(const node of record.addedNodes){if(node instanceof Element)apply(node)}if(record.type==='attributes'&&record.target instanceof HTMLImageElement)apply(record.target)}});
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  addEventListener('civweave:avatar-expression',expressionEvent);
  ['civweave:guide-workspace-ready','civweave:guide-workspace-state','civweave:realm-guide-thread-changed','civweave:chat-single-owner-ready'].forEach(name=>addEventListener(name,refresh));
  globalThis.CivweaveSharedChatFaceIconsV255=Object.freeze({version:VERSION,icons:FALLBACK_ICONS,expressions,refresh,directorSrc:DIRECTOR_SRC,destroy:()=>{observer.disconnect();removeEventListener('civweave:avatar-expression',expressionEvent)},switcherDesktopPx:60,switcherMobilePx:54,launcherShape:'circle',launcherPosition:'fixed',launcherDesktopPx:52,launcherMobilePx:48,expressiveAvatars:true});
}

if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
