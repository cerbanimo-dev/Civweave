await import('./stage-maplibre-v275.mjs');
await import('./stage-federation-finder-data-v274.mjs');
await import('./generate-prelive-metadata-v281.mjs');

const isRender=process.env.RENDER==='true';
if(isRender){
  console.log('[Civweave] Public gateway mode: Gateway fast start, serving packaged assets immediately.');
}else{
  console.log('[Civweave] Local campus mode: deterministic fast start.');
}
console.log('[Civweave] Civweave Map v1 renderer, PMTiles runtime, and pinned Federation Finder atlas are staged for offline use.');
console.log('[Civweave] Deterministic local mode is the default AI route.');
console.log('[Civweave] Fixed ONNX Runtime Web WASM assets and the local MiniLM package are materialized for explicit semantic-lab use. The semantic worker remains dormant until the user starts a test.');
