const isRender=process.env.RENDER==='true';
if(isRender){
  console.log('[Commonweave] Public gateway mode: Gateway fast start, serving packaged assets immediately.');
}else{
  console.log('[Commonweave] Local campus mode: deterministic fast start.');
}
console.log('[Commonweave] Deterministic local mode is the default AI route.');
console.log('[Commonweave] Transformer and MiniLM laboratory files are dormant and are never staged, downloaded, checked, or started by normal application commands.');
