(()=>{
'use strict';
const REVISION='video-atlas-installer-v2-unified-source-pack-shim';
const MODULE='/app/learning-source-pack-runtime-v1.mjs?v=unified-source-packs-v1';
import(MODULE).then(runtime=>{
  const api=Object.freeze({
    revision:REVISION,
    stage:runtime.stageLearningSourcePacks,
    status:runtime.learningSourcePackStatus,
    remove:runtime.removeLearningSourcePacks,
    clear:runtime.clearLearningSourcePacks,
    export:runtime.exportLearningSourcePacks,
    cacheName:runtime.cachesUsed?.video||'cw-video-learning-atlas-v1'
  });
  globalThis.CivweaveVideoAtlasPacksV2=api;
  try{dispatchEvent(new CustomEvent('civweave:learning-source-packs-ready',{detail:{revision:REVISION,merged:true}}))}catch{}
}).catch(error=>console.warn('[Civweave] Unified learning source packs unavailable.',error));
})();
