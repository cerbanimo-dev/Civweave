export const GUILD_NEURON_FLOW_SCHEMA='civweave.guild-neuron-flow.v1';
const safeCount=value=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):0;
const dayKey=timestamp=>new Date(timestamp).toISOString().slice(0,10);
const utcDays=(at,count=7)=>Array.from({length:count},(_,i)=>dayKey(at-(count-1-i)*86400000));

/**
 * Read-only projection of the canonical Guild Cloud resident_usage ledger.
 * This does not represent device-local inference, third-party server usage,
 * prepayment, model tokens, or the account-wide Cloudflare entitlement.
 */
export function buildGuildNeuronFlow({now=Date.now(),capacity={},members=[],usageRows=[]}={}){
  if(!Number.isFinite(now))throw new RangeError('now must be a valid timestamp');
  const days=utcDays(now),day=days.at(-1),accepted=new Set(days);
  const nodes=(Array.isArray(capacity.starterNodes)?capacity.starterNodes:[])
    .filter(row=>row&&typeof row.nodeId==='string'&&row.nodeId).map(row=>row.nodeId);
  const nodeIds=new Set(nodes);
  const enrolled=(Array.isArray(members)?members:[])
    .filter(row=>row&&nodeIds.has(row.nodeId)&&typeof row.userId==='string'&&row.userId);
  const enrolledKeys=new Set(enrolled.map(row=>row.nodeId+'\n'+row.userId));
  const perDay=new Map(days.map(value=>[value,0]));
  const byNode=new Map(nodes.map(value=>[value,0]));
  const byMember=new Map(enrolled.map(row=>[row.nodeId+'\n'+row.userId,0]));
  let unassigned=0;
  for(const row of Array.isArray(usageRows)?usageRows:[]){
    if(!accepted.has(row?.day)||!nodeIds.has(row.node_id))continue;
    const amount=safeCount(row.neurons);
    if(amount<1)continue;
    // A member can leave after consuming compute. The Guild total still
    // includes their ledger entries without revealing deleted identities.
    const key=row.node_id+'\n'+row.user_id;
    perDay.set(row.day,perDay.get(row.day)+amount);
    if(row.day!==day)continue;
    byNode.set(row.node_id,byNode.get(row.node_id)+amount);
    if(enrolledKeys.has(key))byMember.set(key,byMember.get(key)+amount);
    else unassigned+=amount;
  }
  const includedPerResident=safeCount(capacity.includedDailyNeurons);
  const ceiling=safeCount(capacity.dailyCeilingNeurons);
  const todayUsed=perDay.get(day)||0;
  const remaining=Math.max(0,ceiling-todayUsed);
  const next=new Date(now);next.setUTCHours(24,0,0,0);
  const utilization=ceiling?Math.round(100*Math.min(todayUsed,ceiling)/ceiling):0;
  return Object.freeze({
    schema:GUILD_NEURON_FLOW_SCHEMA,
    day,asOf:new Date(now).toISOString(),resetsAt:next.toISOString(),
    source:'guild-cloud-workers-ai-charged-usage',
    today:Object.freeze({chargedNeurons:todayUsed,includedDailyCeilingNeurons:ceiling,
      includedRemainingNeurons:remaining,utilizationPercent:utilization,
      overdrawnNeurons:Math.max(0,todayUsed-ceiling),unassignedNeurons:unassigned}),
    history:days.map(value=>({day:value,chargedNeurons:perDay.get(value)||0})),
    nodes:nodes.map(nodeId=>({nodeId,chargedNeuronsToday:byNode.get(nodeId)||0})),
    residents:enrolled.map(row=>{
      const used=byMember.get(row.nodeId+'\n'+row.userId)||0;
      return {nodeId:row.nodeId,userId:row.userId,seatClass:row.seatClass,
        chargedNeuronsToday:used,remainingNeuronsToday:Math.max(0,includedPerResident-used)};
    }),
    coverage:Object.freeze({
      deviceLocalModelsIncluded:false,externalNodesIncluded:false,
      cloudflareAccountFreePoolIncluded:false,hostedPaidCreditsIncluded:false,
      historyDays:7,accuracy:'settled Guild Cloud daily charges only',
      note:'Does not measure model time, in-flight generations, device-local AI, external physical nodes, or other services on the same Cloudflare account.'
    })
  });
}
