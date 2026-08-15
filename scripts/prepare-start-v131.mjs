try{
  await import('./apply-confidence-weighted-validation-v1-safe.mjs');
}catch(error){
  if(error?.code!=='ERR_MODULE_NOT_FOUND')throw error;
}

await import('./stage-maplibre-v275.mjs');
await import('./stage-federation-finder-data-v274.mjs');

const isRender=process.env.RENDER==='true';
console.log(isRender
  ? '[Civweave] Public gateway mode: serving packaged assets immediately.'
  : '[Civweave] Local campus mode: deterministic fast start.');
console.log('[Civweave] Federation map assets are staged for offline use.');
console.log('[Civweave] MiniLM remains independent semantic infrastructure; generative model startup is submit-only.');
