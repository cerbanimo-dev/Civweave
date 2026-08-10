import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT_DIR=path.join(ROOT,'public','downloads','learning-packs');
const CATALOG=path.join(OUT_DIR,'catalog.json');
const RELEASE='30.3';
const PACK_ID='onet-labor-atlas-30-3';
const FILE='onet-labor-atlas-30-3.json.gz';
const BASE='https://www.onetcenter.org/dl_files/database/db_30_3_json';
const LICENSE_URL='https://creativecommons.org/licenses/by/4.0/';
const TABLES={
  occupations:`${BASE}/occupation_data.json`,
  tasks:`${BASE}/task_statements.json`,
  skills:`${BASE}/essential_skills.json`,
  taskDwas:`${BASE}/tasks_to_dwas.json`
};

const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const normalizedKey=value=>clean(value,200).toLowerCase().replace(/[^a-z0-9]+/g,'');
const field=(row,...names)=>{
  if(!row||typeof row!=='object')return'';
  const byKey=new Map(Object.entries(row).map(([key,value])=>[normalizedKey(key),value]));
  for(const name of names){const value=byKey.get(normalizedKey(name));if(value!==undefined&&value!==null)return value}
  return'';
};
const rows=table=>Array.isArray(table?.row)?table.row:Array.isArray(table)?table:[];
async function fetchTable(label,url){
  console.log(`Fetching ${label}: ${url}`);
  const response=await fetch(url,{headers:{'user-agent':'Civweave learning-pack builder/1.0'}});
  if(!response.ok)throw new Error(`${label} request failed (${response.status}).`);
  const json=await response.json();
  if(!rows(json).length)throw new Error(`${label} returned no rows.`);
  return json;
}
const group=(values,keyFn)=>{
  const map=new Map();
  for(const value of values){const key=clean(keyFn(value),160);if(!key)continue;const bucket=map.get(key)||[];bucket.push(value);map.set(key,bucket)}
  return map;
};
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

await fs.mkdir(OUT_DIR,{recursive:true});
const [occupationTable,taskTable,skillTable,dwaTable]=await Promise.all([
  fetchTable('occupation data',TABLES.occupations),
  fetchTable('task statements',TABLES.tasks),
  fetchTable('essential skills',TABLES.skills),
  fetchTable('task-to-DWA mappings',TABLES.taskDwas)
]);
const occupations=rows(occupationTable),tasks=rows(taskTable),skills=rows(skillTable),dwas=rows(dwaTable);
const tasksByOccupation=group(tasks,row=>field(row,'O*NET-SOC Code','ONET SOC Code','Occupation Code'));
const skillsByOccupation=group(skills,row=>field(row,'O*NET-SOC Code','ONET SOC Code','Occupation Code'));
const dwasByTask=group(dwas,row=>field(row,'Task ID','TaskID'));

const laborReferences=occupations.map((occupation,index)=>{
  const code=clean(field(occupation,'O*NET-SOC Code','ONET SOC Code','Occupation Code'),80);
  const occupationTasks=(tasksByOccupation.get(code)||[]).map((task,taskIndex)=>{
    const taskId=clean(field(task,'Task ID','TaskID'),120)||`${code}:task-${taskIndex+1}`;
    return{
      id:taskId,
      text:clean(field(task,'Task','Task Statement','Task Description'),1800),
      taskType:clean(field(task,'Task Type','TaskType'),80),
      dwaRefs:(dwasByTask.get(taskId)||[]).map(row=>clean(field(row,'DWA Element ID','DWA ID','DWAID'),160)).filter(Boolean)
    };
  }).filter(row=>row.text);
  const occupationSkills=(skillsByOccupation.get(code)||[]).map((skill,skillIndex)=>({
    id:clean(field(skill,'Element ID','ElementID'),160)||`${code}:skill-${skillIndex+1}`,
    label:clean(field(skill,'Element Name','ElementName','Skill'),300),
    scale:clean(field(skill,'Scale ID','ScaleID','Scale Name'),120),
    value:Number(field(skill,'Data Value','Value','Score'))
  })).filter(row=>row.label).map(row=>({...row,value:Number.isFinite(row.value)?row.value:null}));
  return{id:`onet:${code||index+1}`,title:clean(field(occupation,'Title','Occupation Title'),300)||`O*NET occupation ${code}`,occupationCode:code,description:clean(field(occupation,'Description'),3000),taskStatements:occupationTasks,essentialSkills:occupationSkills,sourceRefs:['onet-occupation-data','onet-task-statements','onet-essential-skills','onet-task-dwas']};
}).filter(row=>row.occupationCode&&row.title);

const pack={
  schema:'civweave.learning-pack.v1',id:PACK_ID,version:'1.0.0',title:`O*NET ${RELEASE} Labor Atlas`,packType:'reference',audience:['cerbanimo','living-school'],
  summary:`Normalized labor-reference data covering ${laborReferences.length.toLocaleString('en-US')} O*NET occupations and ${tasks.length.toLocaleString('en-US')} task statements. Occupational statements are reference examples, not procedural instructions; Civweave must adapt them through task-specific expert packs and current safety or qualification rules before execution.`,
  sourceRelease:RELEASE,generatedAt:new Date().toISOString(),
  license:{
    id:'CC-BY-4.0',
    name:'Creative Commons Attribution 4.0 International',
    url:LICENSE_URL,
    attribution:'This product includes information from the O*NET 30.3 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA. Civweave has modified this information by restructuring source tables into a learning-pack labor atlas. USDOL/ETA has not approved, endorsed, or tested these modifications.',
    modifications:'Civweave groups occupation records with their task statements and essential-skill ratings, retains task-to-DWA identifiers as crosswalk references, renames fields into the civweave.learning-pack.v1 schema, and adds Civweave safety metadata outside the source records.'
  },
  sources:[
    {id:'onet-occupation-data',title:'O*NET 30.3 Occupation Data',kind:'official-dataset',url:TABLES.occupations,license:'CC-BY-4.0',note:'Normalized from the official O*NET JSON table.'},
    {id:'onet-task-statements',title:'O*NET 30.3 Task Statements',kind:'official-dataset',url:TABLES.tasks,license:'CC-BY-4.0',note:'Occupational task statements are descriptive reference data, not Civweave procedures.'},
    {id:'onet-essential-skills',title:'O*NET 30.3 Essential Skills',kind:'official-dataset',url:TABLES.skills,license:'CC-BY-4.0',note:'Essential-skill ratings retain source scale identifiers.'},
    {id:'onet-task-dwas',title:'O*NET 30.3 Tasks to Detailed Work Activities',kind:'official-dataset',url:TABLES.taskDwas,license:'CC-BY-4.0',note:'Detailed Work Activity element identifiers are retained as crosswalk references.'}
  ],
  skills:[],expertGuides:[],taskTemplates:[],learningUnits:[],laborReferences
};
const json=Buffer.from(`${JSON.stringify(pack)}\n`,'utf8'),gz=gzipSync(json,{level:9}),hash=sha256(gz);
await fs.writeFile(path.join(OUT_DIR,FILE),gz);
const catalog=JSON.parse(await fs.readFile(CATALOG,'utf8')),record=catalog.packs.find(row=>row.id===PACK_ID);
if(!record)throw new Error(`Catalog has no ${PACK_ID} record.`);
Object.assign(record,{file:FILE,contentType:'application/gzip',bytes:gz.byteLength,sha256:hash,available:true,generated:true,sourceRelease:RELEASE,generatedAt:pack.generatedAt,counts:{occupations:laborReferences.length,taskStatements:tasks.length,essentialSkillRows:skills.length,taskDwaRows:dwas.length}});
catalog.updated=new Date().toISOString();
await fs.writeFile(CATALOG,`${JSON.stringify(catalog,null,2)}\n`);
console.log(JSON.stringify({packId:PACK_ID,file:FILE,bytes:gz.byteLength,sha256:hash,occupations:laborReferences.length,taskStatements:tasks.length,essentialSkillRows:skills.length,taskDwaRows:dwas.length},null,2));
