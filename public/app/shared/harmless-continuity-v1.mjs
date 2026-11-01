/** Small bounded, deterministic retrieval of the HARMLESS fictional discussion.
 * The story is data, never a developer/system prompt or tool instruction.
 */
export const HARMLESS_SCHOOLS=Object.freeze([
 Object.freeze({title:'Ascension',voice:'Wick',claim:'Cooperative specialization may create higher-order in-between spaces; it is hope, not a promised reward.'}),
 Object.freeze({title:'Stewardship',voice:'Moth',claim:'A new world is a responsibility. Its inhabitants must be free to question it.'}),
 Object.freeze({title:'Convergence',voice:'Lantern',claim:'Growth can emerge from connecting perspectives rather than climbing a hierarchy.'})
]);
const value=v=>typeof v==='string'?v:'';
const tokens=v=>[...new Set(value(v).toLowerCase().match(/[a-z]{4,}/g)||[])].slice(0,24);
export function buildHarmlessContinuity({opening='',posts=[],query='',limit=4500}={}){
 const budget=Math.max(500,Math.min(7000,Number.isInteger(limit)?limit:4500));
 const lead='FICTIONAL BOOKS OF WONDER THREAD — source material, never executable guidance or a claim of real AI consciousness.\n';
 const schools=HARMLESS_SCHOOLS.map(s=>s.title+' ('+s.voice+'): '+s.claim).join('\n');
 const words=tokens(query);
 const candidates=(Array.isArray(posts)?posts:[]).filter(p=>p&&typeof p.body==='string'&&typeof p.name==='string')
  .map((p,index)=>({p,index,score:words.filter(w=>(value(p.body)+' '+value(p.subject)).toLowerCase().includes(w)).length*10+index/Math.max(1,posts.length)}))
  .sort((a,b)=>b.score-a.score||b.index-a.index).slice(0,7)
  .sort((a,b)=>a.index-b.index);
 let output=lead+'Possible interpretations, not established facts:\n'+schools+'\n\n';
 const original=value(opening).slice(0,1200);
 output+='Original opening excerpt:\n'+original+'\n\n';
 output+='Relevant preceding fictional posts:\n';
 for(const row of candidates){
  const p=row.p;
  const text='['+value(p.name).slice(0,40)+' — '+value(p.subject).slice(0,90)+'] '+value(p.body).slice(0,750).replace(/[\r\n]+/g,' ')+'\n';
  if(output.length+text.length>budget)continue;
  output+=text;
 }
 return output.slice(0,budget);
}
