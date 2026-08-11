const clean=(v,n=16000)=>String(v??'').trim().slice(0,n);
const LEVEL={allowed:0,requirements:1,review:2,blocked:3};
const NETWORK_FEE_BPS=100;
const text=input=>clean([input?.title,input?.description,input?.category,input?.kind,input?.notes].filter(Boolean).join(' ')).toLowerCase();
const blocked=[
 ['illegal-drugs',/\b(cocaine|heroin|meth(?:amphetamine)?|fentanyl|illegal drugs?|controlled substances? without prescription)\b/i],
 ['adult-sexual-services',/\b(escort service|sexual services?|prostitution|porn(?:ography|ographic)?|explicit sexual content for sale)\b/i],
 ['gambling',/\b(sportsbook|betting|wager|casino|lottery tickets?|gambling)\b/i],
 ['fake-documents',/\b(fake|forged|counterfeit)\s+(id|passport|license|certificate|document)\b/i],
 ['stolen-counterfeit',/\b(stolen goods?|counterfeit goods?|fake designer|shoplifted)\b/i],
 ['cash-transfer',/\b(peer[- ]to[- ]peer money|cash transfer|money transmission|send\s+\$?\d+)\b/i],
 ['token-cashout',/\b(sell|cash ?out|redeem|exchange)\s+(buttons?|acorns?)\s+(?:for|into)\s+(cash|dollars?|usd|fiat)\b/i]
];
const review=[
 ['weapons',/\b(firearms?|guns?|ammunition|ammo|silencer|explosives?|switchblade|taser)\b/i],
 ['alcohol-tobacco',/\b(alcohol|beer|wine|liquor|tobacco|cigarettes?|vapes?|nicotine)\b/i],
 ['medical-pharma',/\b(prescription|pharmacy|pharmaceutical|telemedicine|medical treatment|diagnos(?:e|is)|surgery)\b/i],
 ['financial',/\b(loan|lending|investment advice|securities?|brokerage|escrow|crypto(?:currency)? exchange|money services?)\b/i],
 ['fundraising',/\b(crowdfunding|fundraiser|raise money for|donation campaign)\b/i]
];
const requirements=[
 ['electrical',/\b(electrician|rewire|electrical panel|mains wiring)\b/i,'professional-license:electrician'],
 ['plumbing',/\b(plumber|gas line|plumbing installation|water heater installation)\b/i,'professional-license:plumber'],
 ['legal',/\b(legal representation|attorney|lawyer|represent me in court)\b/i,'professional-license:legal'],
 ['health-professional',/\b(doctor|physician|nurse practitioner|therapist|clinical counseling|medical consultation)\b/i,'professional-license:health'],
 ['childcare',/\b(daycare|child care|babysitting service|nanny)\b/i,'trust:childcare']
];
export function classifyFellowFareListing(input={}){const t=text(input),flags=[],requiredCredentials=[];for(const [code,re] of blocked)if(re.test(t))flags.push({code,severity:'blocked'});for(const [code,re] of review)if(re.test(t))flags.push({code,severity:'review'});for(const [code,re,credential] of requirements)if(re.test(t)){flags.push({code,severity:'requirements'});requiredCredentials.push(credential)}let status='allowed';for(const row of flags)if(LEVEL[row.severity]>LEVEL[status])status=row.severity;return{schema:'fellowfare.server-market-safety.v1',status,flags,requiredCredentials:[...new Set(requiredCredentials)],publishAllowed:status!=='blocked'&&status!=='review',checkoutAllowed:status==='allowed'}}
export async function listingHash(input={}){const canonical=JSON.stringify({title:clean(input.title,300),description:clean(input.description,8000),category:clean(input.category,120),kind:clean(input.kind,80),sellerSubtotalCents:Number(input.sellerSubtotalCents)||0,currency:clean(input.currency||'USD',12).toUpperCase()}),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));return'sha256:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}
export function quoteFellowFareCheckout({sellerSubtotalCents,processorRecoveryCents=0,currency='USD'}={}){const subtotal=Math.max(0,Math.floor(Number(sellerSubtotalCents)||0));if(!subtotal)throw new RangeError('sellerSubtotalCents must be positive.');const networkFeeCents=Math.ceil(subtotal*NETWORK_FEE_BPS/10000),hostFeeCents=Math.floor(networkFeeCents/2),cerbanimoFeeCents=networkFeeCents-hostFeeCents,processor=Math.max(0,Math.floor(Number(processorRecoveryCents)||0));return Object.freeze({schema:'fellowfare.checkout-quote.v2',currency:clean(currency,12).toUpperCase(),sellerSubtotalCents:subtotal,networkFeeCents,hostFeeCents,cerbanimoFeeCents,processorRecoveryCents:processor,buyerTotalCents:subtotal+networkFeeCents+processor,sellerTransferCents:subtotal,networkFeeAddedOnTop:true,sellerPriceProtected:true})}
export const FellowFarePolicy=Object.freeze({version:'1.0.0',networkFeeBps:NETWORK_FEE_BPS,classifyFellowFareListing,listingHash,quoteFellowFareCheckout});
