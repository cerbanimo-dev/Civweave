import test from 'node:test';
import assert from 'node:assert/strict';
import {autonomousTaskPolicy,validateAutonomousProject,parseAutonomousProject,findNextAutonomousTask}
 from '../public/app/shared/starling-autonomous-projects-v1.mjs';

const goal='Reduce neighborhood litter through creative communications and locally actionable educational resources.';
const project={title:'Neighborhood litter education kit',outcome:'Publishable draft awareness materials for human review',tasks:[
 {assignee:'ai',kind:'writing',title:'Draft a litter prevention article',deliverable:'Draft a 500-word article for human review'},
 {assignee:'human',requiredSkill:'environmental-services',title:'Lead a community street cleanup',deliverable:'Coordinate a physical cleanup'},
 {assignee:'ai',kind:'storyboard',title:'Storyboard a litter outreach slideshow',deliverable:'Draft storyboard text and visual cues'}
]};
const input={guildId:'g:1',goal};
test('unknown human skills produce only AI-capable draft tasks without physical assignment',()=>{
 const v=validateAutonomousProject(project,input);
 assert.equal(v.aiOnly,true);assert.equal(v.tasks.length,2);
 assert.equal(v.tasks.every(t=>t.assignee==='ai'),true);
 assert.equal(v.completed,false);assert.equal(v.reviewRequired,true);
 assert.equal(v.canonicalQuestId,null);
});
test('silo mode overrides otherwise verified human skill info',()=>{
 const v=validateAutonomousProject(project,{...input,siloMode:true,verifiedHumanSkills:['environmental-services']});
 assert.equal(v.aiOnly,true);
 assert.equal(v.tasks.length,2);
});
test('human suggestions require matching trusted skills and are always unassigned',()=>{
 const candidates={...project,tasks:[project.tasks[0],{assignee:'human',requiredSkill:'technical-writing',title:'Review with a qualified volunteer',deliverable:'Review and annotate the draft writing'}]};
 const v=validateAutonomousProject(candidates,{...input,verifiedHumanSkills:['technical-writing']});
 assert.equal(v.aiOnly,false);assert.equal(v.tasks.length,2);
 assert.equal(v.tasks[1].status,'unassigned-human-review');
 assert.equal(v.tasks[1].assignee,'human');
});
test('model cannot disguise physical jobs or payments as an AI task',()=>{
 const malformed={...project,tasks:[
  {assignee:'ai',kind:'writing',title:'Pick up trash in the park',deliverable:'Draft notes about physical removal'},
  {assignee:'ai',kind:'writing',title:'Write and mail an invoice',deliverable:'Purchase equipment and send payment'},
  {assignee:'ai',kind:'writing',title:'Write the public outreach flyer',deliverable:'Draft flyer text'}
 ]};
 const v=validateAutonomousProject(malformed,input);
 assert.equal(v.tasks.length,1);assert.match(v.tasks[0].title,/flyer/);
});
test('strict JSON and bounded AI task kinds are required',()=>{
 assert.throws(()=>parseAutonomousProject('Here are some ideas, not JSON'));
 assert.equal(parseAutonomousProject('{"title":"Project"}').title,'Project');
 assert.throws(()=>validateAutonomousProject({...project,tasks:[{assignee:'ai',kind:'purchase',title:'Buy supplies for event',deliverable:'Purchase supplies'}]},input),/AI-executable/);
});
test('next task recovery excludes only signed reviewable AI draft outputs',()=>{
 const a=validateAutonomousProject(project,input);
 const p={...a,id:'auto-project:1'};
 assert.equal(findNextAutonomousTask([p],[]).task.id,'task-0');
 const one={projectId:p.id,taskId:'task-0',reviewRequired:true};
 assert.equal(findNextAutonomousTask([p],[one]).task.id,'task-1');
 assert.equal(findNextAutonomousTask([p],[one,{...one,taskId:'task-1'}]),null);
});
