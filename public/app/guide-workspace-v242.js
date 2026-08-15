(()=>{
'use strict';

// Compatibility loader only. The retired five-window workspace implementation is gone.
// Installed packages that still request this historical filename are forwarded to the
// current single guide surface without recreating any workspace DOM, observers, styles,
// state ownership, or event-capture layer.
const VERSION='1.0.161-guide-workspace-compat-v350';
const TARGET='/app/guide-chat-surface-v350.js';
if(globalThis.CivweaveGuideChatSurfaceV350)return;
const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===TARGET);
if(existing)return;
const script=document.createElement('script');
script.src=`${TARGET}?v=${encodeURIComponent(VERSION)}`;
script.async=false;
script.dataset.civweaveCompatibilityLoader='guide-workspace-v242';
script.onerror=()=>console.error('[Civweave] Canonical guide chat surface v350 could not load.');
document.head?.append(script);
})();
