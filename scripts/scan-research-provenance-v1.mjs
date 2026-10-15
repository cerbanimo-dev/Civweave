#!/usr/bin/env node
// Offline JSONL training-corpus audit. No deletion, network calls or truth-by-topic judgments.
// Example: node scripts/scan-research-provenance-v1.mjs corpus.jsonl audit-dir
import {createReadStream,createWriteStream,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {evaluateResearchSource,INDICATOR_REVISION} from '../public/app/research-source-policy-v1.mjs';
const [input,destination]=process.argv.slice(2);
if(!input||!destination||!existsSync(input)){
  console.error('Usage: node scripts/scan-research-provenance-v1.mjs <corpus.jsonl> <output-directory>');
  process.exitCode=2;
}else{
  mkdirSync(destination,{recursive:true});
  const retained=createWriteStream(join(destination,'retained.jsonl'));
  const quarantined=createWriteStream(join(destination,'quarantined.jsonl'));
  const failures=createWriteStream(join(destination,'invalid-records.jsonl'));
  const counts={records:0,retained:0,quarantined:0,invalid:0,missingUrl:0};
  const groups=new Map();
  const hash=value=>createHash('sha256').update(value).digest('hex');
  for await(const line of createInterface({input:createReadStream(input,{encoding:'utf8'}),crlfDelay:Infinity})){
    if(!line.trim())continue;
    counts.records++;
    let record;
    try{record=JSON.parse(line);if(!record||typeof record!=='object'||Array.isArray(record))throw Error('Not a JSON object');}
    catch{
      counts.invalid++;
      failures.write(JSON.stringify({lineNumber:counts.records,rawSha256:hash(line),reason:'invalid-json-object'})+'\n');
      continue;
    }
    const verdict=evaluateResearchSource(record);
    const body=typeof record.text==='string'?record.text:typeof record.content==='string'?record.content:'';
    const sourceUrl=record.canonicalUrl||record.url||record.source_url||record.authorUrl||'';
    if(!sourceUrl)counts.missingUrl++;
    const audit={
      sourceId:record.id||record.document_id||null,
      sourceUrl,
      publishedAt:record.publishedAt||record.timestamp||null,
      bodySha256:body?hash(body.normalize('NFC').replace(/\s+/g,' ').trim()):null,
      documentSha256:hash(line),
      sourcePolicy:verdict
    };
    // Repeated normalized content is a lineage candidate, NOT evidence of a bot origin.
    if(audit.bodySha256){
      const group=groups.get(audit.bodySha256)||{firstSeenAt:audit.publishedAt,examples:[],count:0};
      group.count++;
      if(group.examples.length<4)group.examples.push({id:audit.sourceId,url:sourceUrl,time:audit.publishedAt});
      if(audit.publishedAt&&(!group.firstSeenAt||String(audit.publishedAt)<String(group.firstSeenAt)))group.firstSeenAt=audit.publishedAt;
      if(groups.size<50000||groups.has(audit.bodySha256))groups.set(audit.bodySha256,group);
    }
    const payload=JSON.stringify({record,audit})+'\n';
    if(verdict.action==='exclude'){counts.quarantined++;quarantined.write(payload);}
    else{counts.retained++;retained.write(payload);}
  }
  for(const stream of [retained,quarantined,failures])await new Promise((resolve,reject)=>{stream.on('error',reject);stream.end(resolve);});
  const lineageCandidates=[...groups.entries()].filter(([,group])=>group.count>1).map(([bodySha256,group])=>({bodySha256,...group})).slice(0,10000);
  writeFileSync(join(destination,'lineage-candidates.json'),JSON.stringify({schema:'civweave.research-lineage-candidates.v1',note:'Exact-text duplicates, not causal attribution; verify independently.',groups:lineageCandidates},null,2)+'\n');
  const manifest={schema:'civweave.research-corpus-audit.v1',scannedAt:new Date().toISOString(),indicatorRevision:INDICATOR_REVISION,counts,outputFiles:['retained.jsonl','quarantined.jsonl','invalid-records.jsonl','lineage-candidates.json'],policy:'Non-destructive quarantine of exact, publisher-reported source identities; manual provenance review before dataset changes.'};
  writeFileSync(join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify(manifest,null,2));
}
