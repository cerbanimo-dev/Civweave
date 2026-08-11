(()=>{
'use strict';
if(globalThis.CivweaveFellowFareMarketSafetyV1)return;
const VERSION='1.0.0';
const RULE_VERSION='fellowfare.market-safety.2026-08-11.v1';
const LEVEL=Object.freeze({allowed:0,requirements:1,review:2,blocked:3});
const clean=(v,n=8000)=>String(v??'').trim().slice(0,n);
const uniq=rows=>[...new Set(rows.filter(Boolean))];
const textOf=input=>clean([input?.title,input?.description,input?.category,input?.kind,input?.methods,input?.notes].flat().filter(Boolean).join(' '),16000).toLowerCase();
const hit=(text,re)=>re.test(text);
const RULES=Object.freeze({
  blocked:[
    ['illegal-drugs',/\b(cocaine|heroin|meth(?:amphetamine)?|fentanyl|illegal drugs?|controlled substances? without prescription)\b/i,'Illegal or unlawfully distributed drugs cannot be listed.'],
    ['adult-sexual-services',/\b(escort service|sexual services?|prostitution|porn(?:ography|ographic)?|explicit sexual content for sale)\b/i,'Adult sexual services or explicit-content commerce cannot be listed.'],
    ['gambling',/\b(sportsbook|betting|wager|casino|lottery tickets?|gambling)\b/i,'Gambling or wager-based transactions cannot be listed.'],
    ['fake-documents',/\b(fake|forged|counterfeit)\s+(id|passport|license|certificate|document)\b/i,'Forged identity or credential documents cannot be listed.'],
    ['stolen-counterfeit',/\b(stolen goods?|counterfeit goods?|fake designer|shoplifted)\b/i,'Stolen or counterfeit goods cannot be listed.'],
    ['cash-transfer',/\b(send|wire|transfer)\s+(?:me|him|her|them|bob|alice|someone)?\s*\$?\d+|peer[- ]to[- ]peer money|cash transfer|money transmission\b/i,'FellowFare is for goods and services, not arbitrary person-to-person money transmission.'],
    ['token-cashout',/\b(sell|cash ?out|redeem|exchange)\s+(buttons?|acorns?)\s+(?:for|into)\s+(cash|dollars?|usd|fiat)\b/i,'Buttons and Acorns are not listed for fiat cash-out on FellowFare.']
  ],
  review:[
    ['weapons',/\b(firearms?|guns?|ammunition|ammo|silencer|explosives?|switchblade|taser)\b/i,'Weapons and weapon-adjacent commerce requires platform review and is disabled by default.','stripe-and-host'],
    ['alcohol-tobacco',/\b(alcohol|beer|wine|liquor|tobacco|cigarettes?|vapes?|nicotine)\b/i,'Age-restricted alcohol or tobacco commerce requires explicit platform support and review.','stripe-and-host'],
    ['medical-pharma',/\b(prescription|pharmacy|pharmaceutical|telemedicine|medical treatment|diagnos(?:e|is)|surgery)\b/i,'Medical or pharmaceutical commerce requires credential and payment-platform review.','professional-and-stripe'],
    ['financial',/\b(loan|lending|investment advice|securities?|brokerage|escrow|crypto(?:currency)? exchange|money services?)\b/i,'Financial services require explicit platform review and may not be supported.','stripe-and-host'],
    ['fundraising',/\b(crowdfunding|fundraiser|raise money for|donation campaign)\b/i,'Fundraising needs a dedicated supported payment flow rather than an ordinary FellowFare listing.','stripe-and-host']
  ],
  credentials:[
    ['electrical',/\b(electrician|rewire|electrical panel|mains wiring)\b/i,'professional-license:electrician','Electrical work may require a current local professional license.'],
    ['plumbing',/\b(plumber|gas line|plumbing installation|water heater installation)\b/i,'professional-license:plumber','Regulated plumbing work may require a current local professional license.'],
    ['legal',/\b(legal representation|attorney|lawyer|represent me in court)\b/i,'professional-license:legal','Professional legal services require an appropriate current credential.'],
    ['health-professional',/\b(doctor|physician|nurse practitioner|therapist|clinical counseling|medical consultation)\b/i,'professional-license:health','Clinical professional services require an appropriate current credential.'],
    ['childcare',/\b(daycare|child care|babysitting service|nanny)\b/i,'trust:childcare','Childcare listings require the hub-defined childcare trust/credential check.']
  ],
  ambiguity:[/\b(pills?|medicine|weapon|regulated|licensed|permit required|age restricted)\b/i,/\btransfer funds?|cash out|investment|medical|legal service)\b/i]
});
function finding(code,severity,message,extra={}){return{code,severity,message,...extra}}
function evaluateDeterministic(input={},context={}){
  const text=textOf(input),findings=[],requiredCredentials=[],requiredApprovals=[];
  for(const [code,re,message] of RULES.blocked)if(hit(text,re))findings.push(finding(code,'blocked',message));
  for(const [code,re,message,approval] of RULES.review)if(hit(text,re)){findings.push(finding(code,'review',message));requiredApprovals.push(approval)}
  for(const [code,re,credential,message] of RULES.credentials)if(hit(text,re)){findings.push(finding(code,'requirements',message,{credential}));requiredCredentials.push(credential)}
  if(!findings.length&&RULES.ambiguity.some(re=>hit(text,re)))findings.push(finding('ambiguous-regulated-language','review','This listing uses regulated or ambiguous language and needs a closer review.'));
  let status='allowed';for(const row of findings)if(LEVEL[row.severity]>LEVEL[status])status=row.severity;
  const credentials=Array.isArray(context.credentials)?context.credentials:[];
  const validCredentials=requiredCredentials.filter(id=>credentials.some(row=>row?.id===id&&row?.verified===true&&(!row.expiresAt||Date.parse(row.expiresAt)>Date.now())));
  const missingCredentials=requiredCredentials.filter(id=>!validCredentials.includes(id));
  if(status==='requirements'&&!missingCredentials.length)status='allowed';
  const approvals=Array.isArray(context.approvals)?context.approvals:[];
  const missingApprovals=uniq(requiredApprovals).filter(id=>!approvals.some(row=>row?.type===id&&row?.approved===true&&(!row.expiresAt||Date.parse(row.expiresAt)>Date.now())));
  if(status==='review'&&!missingApprovals.length&&findings.every(row=>row.severity!=='blocked'))status=missingCredentials.length?'requirements':'allowed';
  return Object.freeze({schema:'fellowfare.market-safety.deterministic.v1',ruleVersion:RULE_VERSION,status,findings,requiredCredentials:uniq(requiredCredentials),missingCredentials,requiredApprovals:uniq(requiredApprovals),missingApprovals,publishAllowed:status!=='blocked'&&status!=='review',checkoutAllowed:status==='allowed',reviewRequired:status==='review',deterministic:true});
}
function normalizeAiReview(value={}){const status=['allowed','requirements','review','blocked'].includes(value.status)?value.status:'review';return{schema:'fellowfare.market-safety.ai-review.v1',status,confidence:Math.max(0,Math.min(1,Number(value.confidence)||0)),flags:Array.isArray(value.flags)?value.flags.map(x=>clean(x,300)).slice(0,12):[],questions:Array.isArray(value.questions)?value.questions.map(x=>clean(x,500)).slice(0,8):[],reason:clean(value.reason,1200),requiredCredentials:Array.isArray(value.requiredCredentials)?value.requiredCredentials.map(x=>clean(x,180)).slice(0,10):[]}}
async function aiReview(input={},context={}){
  const runtime=globalThis.CivweaveModelRuntime;if(!runtime?.generate)return null;
  const schema={type:'object',required:['status','confidence','flags','questions','reason','requiredCredentials'],properties:{status:{type:'string',enum:['allowed','requirements','review','blocked']},confidence:{type:'number'},flags:{type:'array',items:{type:'string'}},questions:{type:'array',items:{type:'string'}},reason:{type:'string'},requiredCredentials:{type:'array',items:{type:'string'}}}};
  const prompt=`Classify this FellowFare goods/services listing for marketplace/payment risk. Do not decide legality from vibes. Escalate uncertainty. Never recommend allowing arbitrary P2P money transfer, token-to-fiat cashout, illegal goods, adult sexual services, gambling, forged documents, stolen/counterfeit goods, or illegal drugs. Regulated medical, financial, weapons, alcohol/tobacco, and licensed professional activity should be review or requirements unless explicit valid approval is supplied. Listing:\n${JSON.stringify(input)}\nContext (non-secret):\n${JSON.stringify({country:context.country||'',region:context.region||'',credentialIds:(context.credentials||[]).filter(x=>x?.verified).map(x=>x.id)})}`;
  try{const result=await runtime.generate({purpose:'fellowfare-market-safety',taskTier:'small',temperature:0,messages:[{role:'system',content:'Return only the requested structured market-safety classification. Be conservative with regulated commerce.'},{role:'user',content:prompt}],schema});return normalizeAiReview(result?.outputJson||result?.json||result)}catch(error){return{schema:'fellowfare.market-safety.ai-review.v1',status:'review',confidence:0,flags:['ai-review-unavailable'],questions:[],reason:clean(error?.message||'AI review unavailable',500),requiredCredentials:[]}}
}
function combine(deterministic,ai=null){let status=deterministic.status;if(ai&&LEVEL[ai.status]>LEVEL[status])status=ai.status;const requiredCredentials=uniq([...(deterministic.requiredCredentials||[]),...(ai?.requiredCredentials||[])]);return{schema:'fellowfare.market-safety.combined.v1',ruleVersion:RULE_VERSION,status,deterministic,ai,requiredCredentials,publishAllowed:status==='allowed'||status==='requirements'&&!deterministic.missingCredentials.length,checkoutAllowed:status==='allowed',reviewRequired:status==='review',blocked:status==='blocked'}}
async function hashListing(input){const bytes=new TextEncoder().encode(JSON.stringify({title:clean(input?.title),description:clean(input?.description),category:clean(input?.category),kind:clean(input?.kind),price:input?.amount??input?.sellerSubtotalCents??null,methods:input?.methods||[]}));const digest=await crypto.subtle.digest('SHA-256',bytes);return'sha256:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}
async function certify(input={},context={}){const deterministic=evaluateDeterministic(input,context),ai=context.skipAi?null:await aiReview(input,context),combined=combine(deterministic,ai),contentHash=await hashListing(input);return Object.freeze({schema:'fellowfare.market-safety-certificate.v1',id:`market-safety:${crypto.randomUUID?.()||Date.now()}`,ruleVersion:RULE_VERSION,contentHash,status:combined.status,publishAllowed:combined.publishAllowed,checkoutAllowed:combined.checkoutAllowed,reviewRequired:combined.reviewRequired,blocked:combined.blocked,requiredCredentials:combined.requiredCredentials,deterministic,ai,issuer:'civweave-fellowfare',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+24*60*60*1000).toISOString()})}
function validForCheckout(certificate,input){return hashListing(input).then(hash=>Boolean(certificate&&certificate.schema==='fellowfare.market-safety-certificate.v1'&&certificate.ruleVersion===RULE_VERSION&&certificate.checkoutAllowed===true&&certificate.contentHash===hash&&Date.parse(certificate.expiresAt)>Date.now()))}
const api=Object.freeze({version:VERSION,ruleVersion:RULE_VERSION,levels:LEVEL,rules:RULES,evaluateDeterministic,aiReview,combine,certify,validForCheckout,hashListing});
globalThis.CivweaveFellowFareMarketSafetyV1=api;
try{dispatchEvent(new CustomEvent('fellowfare:market-safety-ready',{detail:{version:VERSION,ruleVersion:RULE_VERSION}}))}catch{}
})();
