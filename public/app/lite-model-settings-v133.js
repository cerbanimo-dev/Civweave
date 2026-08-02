(()=>{
'use strict';
const previousRenderNative=renderNative;
renderNative=function commonweaveModelRouteNative(capability){
  if(capability?.id==='commonweave.model-setup'){
    return globalThis.CommonweaveModelSettingsV133?.inlineMarkup?.()||'<section class="cw-ai-inline-card"><h2>Compass model route</h2><p>The shared model settings controller is loading…</p></section>';
  }
  return previousRenderNative(capability);
};
})();
