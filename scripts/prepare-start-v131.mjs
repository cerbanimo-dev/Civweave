await import('./sync-release-version-assets.mjs');
await import('./sync-release-coherence-v220.mjs');
await import('./stage-maplibre-v275.mjs');

const isRender=process.env.RENDER==='true';
if(isRender){
  console.log('[Civweave] Public gateway mode: Gateway fast start, serving packaged assets immediately.');
}else{
  console.log('[Civweave] Local campus mode: deterministic fast start.');
}
console.log('[Civweave] Deterministic local mode is the default AI route.');
console.log('[Civweave] Fixed ONNX Runtime Web WASM assets and the local MiniLM package are materialized for explicit semantic-lab use. The semantic worker remains dormant until the user starts a test.');
