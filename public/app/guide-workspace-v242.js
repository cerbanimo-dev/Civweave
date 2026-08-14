(()=>{
'use strict';
// v350 tombstone: the retired five-window workspace presentation was deleted.
// This filename remains only as a short-lived dependency pointer for installed
// packages that still request it. It loads the one canonical current chat surface
// and contains no view markup, styles, state owner, observers, or event handlers.
const VERSION='1.0.160-retired-guide-workspace-pointer-v350';
const TARGET='/app/guide-chat-surface-v350.js';
if(globalThis.CivweaveGuideChatSurfaceV350)return;
const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===TARGET);
if(existing)return;
const script=document.createElement('script');
script.src=`${TARGET}?v=${encodeURIComponent(VERSION)}`;
script.async=false;
script.dataset.civweaveRetiredViewPointer='guide-workspace-v242';
script.onerror=()=>console.error('[Civweave] Canonical guide chat surface v350 could not load.');
document.head.append(script);
})();
