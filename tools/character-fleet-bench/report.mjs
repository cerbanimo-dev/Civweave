#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
const input=process.argv[2]||'character-fleet-results.jsonl';
const lines=(await readFile(input,'utf8')).split('\n').filter(Boolean);
const rows=lines.map(x=>JSON.parse(x)),recent=new Map();
for(const r of rows)recent.set(r.caseId,r);
const grouped=new Map(),sheet=['caseId,variant,character,question,model,status,voice,canon,agency,action,uncertainty,distinctiveness,notes'];
const esc=x=>'"'+String(x??'').replaceAll('"','""').replaceAll('\n',' ')+'"';
for(const r of recent.values()){
 const key=r.variant+'|'+r.character;
 const g=grouped.get(key)||{variant:r.variant,character:r.character,attempted:0,success:0,errors:0,totalLatencyMs:0,totalTokens:0};
 g.attempted++;if(r.status==='success'){g.success++;g.totalLatencyMs+=r.elapsedMs||0;g.totalTokens+=r.tokens||0;}else g.errors++;grouped.set(key,g);
 sheet.push([r.caseId,r.variant,r.character,r.question,r.model,r.status,'','','','','','',''].map(esc).join(','));
}
const summary=[...grouped.values()].map(g=>({...g,successRate:g.success/g.attempted,meanLatencyMs:g.success?Math.round(g.totalLatencyMs/g.success):null}));
await writeFile(input+'.summary.json',JSON.stringify({source:input,cases:recent.size,note:'Runtime metrics only. Human scores in review sheet are not fabricated.',summary},null,2)+'\n');
await writeFile(input+'.review.csv',sheet.join('\n')+'\n');
console.log('Wrote '+input+'.summary.json and '+input+'.review.csv ('+recent.size+' unique cases).');
