/**
 * Provider-neutral Worldweaver role policy. This is a role plan, not an
 * inference client. World state remains owned by worldweaver-core-v1.mjs.
 * The shared AI runtime must authenticate and authorize each invocation.
 * No model reply may directly execute a Worldweaver mutation.
 */
export const WORLDWEAVER_AI_MODES=Object.freeze(['system','binary','multiverse','local-only']);
const PRIMARY_PROVIDERS=new Set(['openai','gemini']);
const EXPERIMENTAL_PROVIDERS=new Set(['deepseek','grok']);

const role=(provider,enabled,reason=null)=>Object.freeze({provider,enabled:Boolean(enabled),reason:enabled?null:reason});
export function resolveWorldweaverAIRoles({mode='system',primary='gemini',connected=[],tested=[],localModelAvailable=false}={}){
  if(!WORLDWEAVER_AI_MODES.includes(mode))throw new RangeError('Unsupported Worldweaver AI mode.');
  if(mode==='system'&&!PRIMARY_PROVIDERS.has(primary))throw new RangeError('Unsupported system provider.');
  const available=new Set(connected.filter(value=>PRIMARY_PROVIDERS.has(value)||EXPERIMENTAL_PROVIDERS.has(value)));
  const approved=new Set(tested.filter(value=>EXPERIMENTAL_PROVIDERS.has(value)));
  const standard=id=>role(id,available.has(id),available.has(id)?null:'provider-not-configured');
  const experimental=id=>role(id,available.has(id)&&approved.has(id),!approved.has(id)?'provider-testing':'provider-not-configured');
  let roles;
  if(mode==='local-only'){
    const provider=localModelAvailable?'local':'local-rules';
    const local=role(provider,true);
    roles={loom:local,actors:local,lari:local,architect:role('none',false,'not-used')};
  }else if(mode==='system'){
    const one=standard(primary);
    roles={loom:one,actors:one,lari:one,architect:role('none',false,'not-used')};
  }else if(mode==='binary'){
    roles={loom:standard('openai'),actors:standard('gemini'),lari:standard('gemini'),architect:role('none',false,'not-used')};
  }else{
    roles={loom:standard('openai'),actors:standard('gemini'),lari:experimental('grok'),architect:experimental('deepseek')};
  }
  const required=['loom','actors','lari'];
  const missing=[...new Set(required.filter(key=>!roles[key].enabled).map(key=>roles[key].provider))];
  return Object.freeze({
    schema:'civweave.worldweaver-ai-roles.v1',
    mode,
    primary:mode==='system'?primary:null,
    roles:Object.freeze(roles),
    ready:missing.length===0,
    missing:Object.freeze(missing),
    experimental:mode==='multiverse',
    storyAuthority:'worldweaver-core-v1',
    invocationAuthority:'shared-consented-ai-runtime',
    proposalOnly:true
  });
}
