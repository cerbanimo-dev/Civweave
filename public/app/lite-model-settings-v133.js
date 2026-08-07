(()=>{
'use strict';
const previousRenderNative=renderNative;
renderNative=function civweaveModelRouteNative(capability){
  if(capability?.id==='civweave.model-setup'){
    return globalThis.CivweaveModelSettingsV133?.inlineMarkup?.()||'<section class="cw-ai-inline-card"><h2>Compass model route</h2><p>The shared model settings controller is loading…</p></section>';
  }
  return previousRenderNative(capability);
};
})();
