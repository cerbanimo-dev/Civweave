(()=>{
'use strict';
const VERSION='1.0.109-shared-chat-face-icons-v255-expressive-v344';
const ROOT_ID='cw-persistent-guide-chat-v215',SHARED_ROOT_ID='cw-shared-guide-surface-v236',LAUNCHER_ID='cwp215-launcher',STYLE_ID='cw-shared-chat-face-icons-v255-style';
const EXPRESSION_DIRECTOR='/app/avatar-expression-director-v343.js?v=1.2.0-avatar-hardening';
const ICONS=Object.freeze({civweave:'/app/assets/ai/chat/weaveling-face-v255.webp','living-school':'/app/assets/ai/chat/moss-face-v255.webp',cerbanimo:'/app/assets/ai/chat/kamiya-face-v255.webp',fellowfare:'/app/assets/ai/chat/rook-face-v255.webp',anarchadia:'/app/assets/ai/chat/merlin-face-v255.webp'});
const ALT_TO_SYSTEM=Object.freeze({weaveling:'civweave',moss:'living-school',kamiya:'cerbanimo',rook:'fellowfare',merlin:'anarchadia'});
const OLD_SRC_TO_SYSTEM=Object.freeze({'weaveling.png':'civweave','moss.png':'living-school','kamiya.png':'cerbanimo','rook.png':'fellowfare','merlin.png':'anarchadia'});
if(globalThis.CivweaveSharedChatFaceIconsV255?.version===VERSION)return;
let directorPromise=null;
function ensureExpressionDirector(){
  if(globalThis.CivweaveAvatarExpressionDirectorV343)return Promise.resolve(globalThis.CivweaveAvatarExpressionDirectorV343);
  if(directorPromise)return directorPromise;
  directorPromise=new Promise(resolve=>{
    const existing=[...document.scripts].find(node=>String(node.src||'').includes('/app/avatar-expression-director-v343.js'));
    if(existing){existing.addEventListener('load',()=>resolve(globalThis.CivweaveAvatarExpressionDirectorV343||null),{once:true});existing.addEventListener('error',()=>resolve(null),{once:true});return}
    const script=document.createElement('script');script.src=EXPRESSION_DIRECTOR;script.async=true;script.dataset.cwAvatarExpressionDirector='v344';
    script.addEventListener('load',()=>resolve(globalThis.CivweaveAvatarExpressionDirectorV343||null),{once:true});script.addEventListener('error',()=>resolve(null),{once:true});document.head?.append(script)
  });return directorPromise
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${ROOT_ID} .cw242-window-switcher{gap:6px!important;padding:8px 8px 9px!important}
#${ROOT_ID} .cw242-window{gap:4px!important;padding:5px 2px!important}
#${ROOT_ID} .cw242-window img{width:60px!important;height:60px!important;border-radius:14px!important;object-fit:cover!important;border:2px solid var(--window-accent)!important;box-shadow:0 3px 12px #0008!important}
#${ROOT_ID} .cw242-window[aria-pressed="true"] img{transform:scale(1.035);box-shadow:0 0 16px color-mix(in srgb,var(--window-accent) 58%,transparent),0 3px 12px #0009!important}
#${ROOT_ID} .cw242-window span{font-size:10px!important}
#${ROOT_ID} header [data-guide-avatar]{width:76px!important;height:76px!important;min-width:76px!important;border-radius:16px!important;object-fit:cover!important}
#${ROOT_ID} [data-log] article>img{border-radius:11px!important;object-fit:cover!important}
#${LAUNCHER_ID}{position:fixed!important;right:max(12px,env(safe-area-inset-right))!important;bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px)!important;width:52px!important;height:52px!important;min-width:52px!important;max-width:52px!important;min-height:52px!important;max-height:52px!important;margin:0!important;padding:0!important;display:grid!important;place-items:center!important;box-sizing:border-box!important;border:2px solid var(--guide-accent,#d8dde7)!important;border-radius:50%!important;background:var(--guide-panel,#111827)!important;box-shadow:0 6px 18px #0009,0 0 0 1px #ffffff24!important;overflow:hidden!important;appearance:none!important;-webkit-appearance:none!important;line-height:0!important;z-index:2147483643!important;pointer-events:auto!important;touch-action:manipulation!important}
#${LAUNCHER_ID} img{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;border:0!important;border-radius:50%!important;object-fit:cover!important}
#${SHARED_ROOT_ID} img[data-cwsg-avatar],#${SHARED_ROOT_ID} .cwsg236-avatar img{border-radius:14px!important;object-fit:cover!important}
#${ROOT_ID} img[data-cw-expression-sprite="v344"],#${SHARED_ROOT_ID} img[data-cw-expression-sprite="v344"],#${LAUNCHER_ID} img[data-cw-expression-sprite="v344"]{object-fit:contain!important;background:transparent!important}
@media(max-width:620px){#${ROOT_ID} .cw242-window-switcher{gap:4px!important;padding:7px 5px 8px!important}#${ROOT_ID} .cw242-window img{width:54px!important;height:54px!important;border-radius:12px!important}#${ROOT_ID} .cw242-window span{font-size:9px!important}#${ROOT_ID} header [data-guide-avatar]{width:68px!important;height:68px!important;min-width:68px!important;border-radius:14px!important}#${LAUNCHER_ID}{right:max(10px,env(safe-area-inset-right))!important;bottom:calc(var(--cw-themed-nav-height,58px) + env(safe-area-inset-bottom) + 10px)!important;width:48px!important;height:48px!important;min-width:48px!important;max-width:48px!important;min-height:48px!important;max-height:48px!important}}
@media(max-width:390px){#${ROOT_ID} .cw242-window img{width:50px!important;height:50px!important}#${ROOT_ID} .cw242-window-switcher{gap:2px!important;padding-left:3px!important;padding-right:3px!important}#${LAUNCHER_ID}{width:46px!important;height:46px!important;min-width:46px!important;max-width:46px!important;min-height:46px!important;max-height:46px!important}}
`;document.head.append(style)
}
function explicitSystem(img){
  const windowButton=img.closest?.('[data-cw242-window]');if(windowButton&&ICONS[windowButton.dataset.cw242Window])return windowButton.dataset.cw242Window;
  const shared=img.closest?.(`#${SHARED_ROOT_ID}`);if(shared&&ICONS[shared.dataset.system])return shared.dataset.system;
  const root=img.closest?.(`#${ROOT_ID}`);if(root&&img.matches?.('[data-guide-avatar]')&&ICONS[root.dataset.guide])return root.dataset.guide;
  const launcher=img.closest?.(`#${LAUNCHER_ID}`);if(launcher){const page=root?.dataset?.pageSystem||document.documentElement.dataset.civweaveSystemRoute;if(ICONS[page])return page}
  const alt=String(img.getAttribute?.('alt')||'').trim().toLowerCase().replace(/^open\s+/,'');if(ALT_TO_SYSTEM[alt])return ALT_TO_SYSTEM[alt];
  const src=String(img.getAttribute?.('src')||'').split('?')[0].split('/').pop()?.toLowerCase()||'';return OLD_SRC_TO_SYSTEM[src]||img.dataset.cwExpressionSystem||''
}
function apply(scope=document){
  const images=scope instanceof HTMLImageElement?[scope]:Array.from(scope.querySelectorAll?.('img')||[]);
  for(const img of images){
    if(!img.closest?.(`#${ROOT_ID},#${SHARED_ROOT_ID},#${LAUNCHER_ID}`))continue;
    const system=explicitSystem(img),src=ICONS[system];if(!src)continue;
    if(img.dataset.cwExpressionSprite==='v344'&&img.dataset.cwExpressionSystem===system)continue;
    if(img.dataset.cwExpressionSprite){delete img.dataset.cwExpressionSprite;delete img.dataset.cwExpression;delete img.dataset.cwExpressionSystem}
    if(img.getAttribute('src')===src)continue;img.src=src;img.dataset.cwFaceIcon='v255'
  }
}
function applyExpression(detail={}){
  const system=String(detail.system||''),asset=String(detail.asset||'');if(!ICONS[system]||!asset)return false;
  const images=Array.from(document.querySelectorAll(`#${ROOT_ID} img,#${SHARED_ROOT_ID} img,#${LAUNCHER_ID} img`));let changed=0;
  for(const img of images){
    if(explicitSystem(img)!==system)continue;
    const same=img.dataset.cwExpression===String(detail.expression||'neutral')&&img.getAttribute('src')===asset;
    img.dataset.cwExpressionSprite='v344';img.dataset.cwExpressionSystem=system;img.dataset.cwExpression=String(detail.expression||'neutral');
    if(!same){
      img.src=asset;
      try{img.animate([{opacity:.52,transform:'scale(.985)'},{opacity:1,transform:'scale(1)'}],{duration:220,easing:'ease-out'})}catch{}
    }
    changed+=1
  }
  return changed>0
}
function refresh(){installStyle();apply(document);void ensureExpressionDirector().then(api=>api?.classify&&api?.status?.())}
function start(){
  refresh();const observer=new MutationObserver(records=>{for(const record of records){for(const node of record.addedNodes){if(node instanceof Element)apply(node)}if(record.type==='attributes'&&record.target instanceof HTMLImageElement)apply(record.target)}});
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  addEventListener('civweave:avatar-expression',event=>applyExpression(event.detail||{}));
  ['civweave:guide-workspace-ready','civweave:guide-workspace-state','civweave:realm-guide-thread-changed','civweave:chat-single-owner-ready'].forEach(name=>addEventListener(name,refresh));
  globalThis.CivweaveSharedChatFaceIconsV255=Object.freeze({version:VERSION,icons:ICONS,refresh,applyExpression,ensureExpressionDirector,destroy:()=>observer.disconnect(),switcherDesktopPx:60,switcherMobilePx:54,launcherShape:'circle',launcherPosition:'fixed',launcherDesktopPx:52,launcherMobilePx:48,expressiveSprites:true,crossfadeMs:220});
  dispatchEvent(new CustomEvent('civweave:shared-chat-face-icons-ready',{detail:{version:VERSION,expressiveSprites:true,crossfadeMs:220}}))
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();