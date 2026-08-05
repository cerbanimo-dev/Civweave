const isRender=process.env.RENDER==='true';
if(isRender){
  console.log('[Commonweave] Public gateway mode: Gateway fast start, serving packaged assets immediately.');
}else{
  console.log('[Commonweave] Local campus mode: deterministic fast start.');
}
console.log('[Commonweave] Deterministic local mode is the default AI route.');
console.log('[Commonweave] Fixed ONNX Runtime Web WASM assets are staged locally. MiniLM remains dormant until the user explicitly activates the local semantic reflex.');
