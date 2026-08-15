(()=>{
'use strict';
if(typeof renderNative!=='function')return;
const previousRenderNative=renderNative;
renderNative=function civweaveModelRouteNative(capability){
  if(capability?.id==='civweave.model-setup')return '<section class="cw-ai-inline-card"><h2>Compass settings</h2><p>Model routing is managed in the single shared Settings menu.</p><button type="button" data-open-unified-ai-settings>Open Settings</button></section>';
  return previousRenderNative(capability);
};
})();
