(()=>{
'use strict';

const VERSION='1.0.0-guide-generation-floor-v1';
const MIDDLEWARE_ID='guide-generation-floor-v1';
const FLOOR_TOKENS=900;
let registeredSpine=null;

function guideRequest(request={}){
  const purpose=String(request?.purpose||'').trim().toLowerCase();
  if(/^civweave-guide-response(?:-|$)/.test(purpose))return true;
  return /(?:^|-)guide-(?:chat|guild-handoff|response)(?:-|$)/.test(purpose);
}

function enforce(request={}){
  if(!guideRequest(request))return request;
  const config={...(request.config||{})};
  const current=Math.max(0,Number(config.maxTokens||config.max_tokens||request.maxTokens||0)||0);
  config.maxTokens=Math.max(FLOOR_TOKENS,current);
  config.generationBudgetFloorTokens=FLOOR_TOKENS;
  return {...request,config,__civweaveGuideGenerationFloorTokens:FLOOR_TOKENS};
}

function register(){
  const spine=globalThis.CivweaveFastInteractiveV192;
  if(!spine?.register)return false;
  if(registeredSpine===spine)return true;
  spine.register(MIDDLEWARE_ID,{before(request){
    const next=enforce(request||{});
    if(next===request)return request;
    return {request:next,state:{floorTokens:FLOOR_TOKENS}};
  }},-1000);
  registeredSpine=spine;
  try{dispatchEvent(new CustomEvent('civweave:guide-generation-floor-ready',{detail:{version:VERSION,floorTokens:FLOOR_TOKENS,middleware:MIDDLEWARE_ID,priority:-1000}}))}catch{}
  return true;
}

addEventListener('civweave:runtime-spine-ready',register);
addEventListener('civweave:model-runtime-ready',register);
addEventListener('pageshow',register);
register();

globalThis.CivweaveGuideGenerationFloorV1=Object.freeze({
  version:VERSION,
  floorTokens:FLOOR_TOKENS,
  middleware:MIDDLEWARE_ID,
  priority:-1000,
  guideRequest,
  enforce,
  register,
  styleOnlyLengthClassification:true,
});
})();
