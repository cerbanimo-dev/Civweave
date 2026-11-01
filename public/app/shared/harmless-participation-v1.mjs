/** Per-device/per-visible-Guild resource limit for explicitly requested HARMLESS generations.
 * This never schedules work, grants a cloud budget, or confers an agent right to post.
 */
export function countModelPosts({local=[],shared=[],deviceId='',now=Date.now()}={}){
 const timestamp=Number(now);
 if(!Number.isFinite(timestamp))throw new TypeError('Invalid clock.');
 const inWindow=entry=>{
  const time=Date.parse(entry?.at);
  return Number.isFinite(time)&&time<=timestamp+1000&&time>=timestamp-24*60*60*1000;
 };
 return (Array.isArray(local)?local:[]).filter(e=>e?.source==='local-model'&&inWindow(e)).length+
        (Array.isArray(shared)?shared:[]).filter(e=>e?.source==='local-model'&&
          e.signerId===deviceId&&Boolean(deviceId)&&inWindow(e)).length;
}
export function ensureHarmlessModelBudget({local=[],shared=[],deviceId='',now=Date.now(),limit=1}={}){
 if(![1,3,5].includes(limit))throw new TypeError('Invalid HARMLESS model post limit.');
 const used=countModelPosts({local,shared,deviceId,now});
 if(used>=limit)throw new Error('HARMLESS daily local-model post limit reached. Try again tomorrow or change the opt-in limit.');
 return Object.freeze({used,limit,remaining:limit-used});
}
