/**
 * Staging playtest cost estimation for exact public text-model IDs.
 * Do not infer or silently substitute unlisted model prices.
 * Sources (Standard API, USD per 1M tokens; verified 2026-11-05):
 * https://developers.openai.com/api/docs/models/gpt-6-luna
 * https://ai.google.dev/gemini-api/docs/pricing
 *
 * Pricing may change. This is NOT a provider-enforced billing cap.
 */
const RATES=Object.freeze({
  openai:Object.freeze({
    'gpt-6-luna':Object.freeze({input:0.1,output:0.5})
  }),
  gemini:Object.freeze({
    'gemini-3.1-flash-lite':Object.freeze({input:0.25,output:1.5}),
    'gemini-3.7-flash':Object.freeze({input:0.75,output:3.75})
  })
});
const EXPECTED=Object.freeze({
  openai:{provider:'openai-compatible',endpoint:'https://api.openai.com/v1'},
  gemini:{provider:'gemini',endpoint:'https://generativelanguage.googleapis.com/v1beta'}
});
export function publishedPlaytestRates(provider,model){
  const entry=RATES[provider]?.[model];
  return entry?{input:entry.input,output:entry.output}:null;
}
export function resolvePlaytestPricing(settings){
  if(!settings?.readWorldMode||!settings?.readWorldweaverProviderConfig||!settings?.readState)
    throw new TypeError('Canonical Settings are required to verify provider costs.');
  const mode=settings.readWorldMode();
  if(mode==='local-only')throw new Error('Local-only playtest generation needs an approved local-model route; this cloud playtest stays off.');
  if(mode==='multiverse')throw new Error('Experimental Multiverse providers are not live for this playtest.');
  if(!['binary','system'].includes(mode))throw new RangeError('Unknown operating mode.');
  const selected=settings.readState().route;
  const names=mode==='binary'?['openai','gemini']:selected==='gemini'?['gemini']:selected==='openai-compatible'?['openai']:null;
  if(!names)throw new Error('System mode requires an active OpenAI or Gemini primary route.');
  return Object.fromEntries(names.map(name=>{
    const config=settings.readWorldweaverProviderConfig(name);
    const expected=EXPECTED[name];
    if(!config||!String(config.apiKey||'').trim())throw new Error(name+' API key is missing.');
    if(config.externalConsent!==true)throw new Error(name+' external-request consent is required.');
    if(config.provider!==expected.provider||config.endpoint!==expected.endpoint)
      throw new Error(name+' endpoint or provider identity is not approved.');
    const rates=publishedPlaytestRates(name,config.model);
    if(!rates)throw new Error('Unverified model pricing for '+name+' model '+String(config.model||'(unspecified)')+'. Review current published rates before playtesting.');
    return[name,rates];
  }));
}
