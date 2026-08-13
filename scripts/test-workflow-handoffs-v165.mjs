import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [followthrough,anarchadia,attachments,anarchadiaHtml,fellowfareHtml,realmHtml,worker,boundary]=await Promise.all([
  read('public/app/action-followthrough-v165.js'),
  read('public/app/anarchadia-change-review-v165.js'),
  read('public/app/cerbanimo-proof-attachments-v165.js'),
  read('public/app/anarchadia-console-v139.html'),
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/realm-console-v140.html'),
  read('public/service-worker.js'),
  read('public/app/install-boundary-v146.js')
]);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
for(const source of [followthrough,anarchadia,attachments])new Function(source);

class Storage{
  constructor(){this.map=new Map()}
  getItem(key){return this.map.has(String(key))?this.map.get(String(key)):null}
  setItem(key,value){this.map.set(String(key),String(value))}
  removeItem(key){this.map.delete(String(key))}
}
function context(extra={}){
  const sandbox={console,Date,Math,JSON,Object,Array,Set,Map,RegExp,String,Number,Boolean,Promise,URL,localStorage:new Storage(),CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},dispatchEvent(){return true},addEventListener(){},setTimeout,clearTimeout,...extra};
  sandbox.globalThis=sandbox;sandbox.window=sandbox;return vm.createContext(sandbox);
}

// Rook must treat explicit approval as execution of the current saved request, not a fresh model turn.
let approvalCalls=0;
const rook=context();
rook.localStorage.setItem('civweave.realm-actions.v141',JSON.stringify([{
  id:'materials-1',system:'fellowfare',kind:'trade-request',title:'Resource request',state:'review',sourceText:'I need reclaimed windows and lumber for the workshop.',
  fields:{category:'Other',need:'I need reclaimed windows and lumber for the workshop.',buttonBudget:8,availableButtons:8,fundingGap:0},missingRequired:[],approval:{required:true,label:'Approve & publish request'},updatedAt:'2026-08-04T16:00:00Z'
}]));
rook.CivweaveGuideContractsV141={approve(id){approvalCalls++;const rows=JSON.parse(rook.localStorage.getItem('civweave.realm-actions.v141'));const item=rows.find(row=>row.id===id);item.state='published';item.updatedAt=new Date().toISOString();rook.localStorage.setItem('civweave.realm-actions.v141',JSON.stringify(rows));return{ok:true,action:item}}};
rook.CivweaveAssistantV141={async respond(){throw new Error('The model must not be called for explicit approval.')}};
rook.CivweaveFamilyAILoaderV105={async ensure(){return true}};
vm.runInContext(followthrough,rook,{filename:'action-followthrough-v165.js'});
const approved=await rook.CivweaveAssistantV141.respond({text:'Go ahead and submit this draft',systemId:'fellowfare',history:[]});
assert(approvalCalls===1,'Rook did not execute the saved request exactly once.');
assert(approved.action?.state==='published','Rook did not publish the approved request.');
assert(/published the approved materials request/i.test(approved.response?.answer||''),'Rook did not confirm the material request publication canonically.');
assert(approved.action?.fields?.category==='Materials'&&approved.action?.kind==='materials-request','Rook did not normalize the request as materials.');

// A model refusal cannot overwrite a canonical request that was actually created.
const rookDraft=context();
rookDraft.CivweaveGuideContractsV141={approve(){return{ok:false}}};
rookDraft.CivweaveAssistantV141={async respond(){const action={id:'materials-2',system:'fellowfare',kind:'trade-request',title:'Resource request',state:'review',sourceText:'Need soil, seedlings, lumber, and hand tools for a community garden.',fields:{category:'Other',need:'Need soil, seedlings, lumber, and hand tools for a community garden.'},missingRequired:[],approval:{required:true,label:'Approve & publish request'}};rookDraft.localStorage.setItem('civweave.realm-actions.v141',JSON.stringify([action]));return{action,response:{answer:"I don't publish for you."},provider:'gemini',model:'gemini-test'}}};
rookDraft.CivweaveFamilyAILoaderV105={async ensure(){return true}};
vm.runInContext(followthrough,rookDraft,{filename:'action-followthrough-v165.js'});
const drafted=await rookDraft.CivweaveAssistantV141.respond({text:'I need soil, seedlings, lumber, and hand tools for a community garden.',systemId:'fellowfare'});
assert(drafted.action?.fields?.category==='Materials','The created Rook draft was not categorized as Materials.');
assert(/created a reviewable materials request/i.test(drafted.response?.answer||''),'A Gemini refusal was allowed to replace the canonical Rook draft result.');

// Merlin must import a feature request into REVIEW and only generate after explicit approval.
let pipelineRuns=0;
const merlin=context();
merlin.localStorage.setItem('civweave.realm-actions.v141',JSON.stringify([{
  id:'feature-1',system:'anarchadia',kind:'feature-request',title:'Add a platform dark mode',state:'review',sourceText:'Add an export button to the Anarchadia ledger.',
  fields:{problem:'The interface needs a user-selectable dark appearance.',proposedChange:'Add dark mode.'},acceptanceCriteria:[],approval:{required:true,label:'Approve request & begin rails'},execution:{status:'not-started',events:[]},updatedAt:'2026-08-04T16:00:00Z'
}]));
merlin.AnarchadiaCitizenConsoleV158={async runPipeline(id){pipelineRuns++;const state=JSON.parse(merlin.localStorage.getItem('civweave.anarchadia.citizen-console.v139'));const item=state.proposals.find(row=>row.id===id);item.status='preview-ready';item.stage='preview-ready';item.preview={srcdoc:'<!doctype html><p>preview</p>',generator:'test'};merlin.localStorage.setItem('civweave.anarchadia.citizen-console.v139',JSON.stringify(state))}};
vm.runInContext(anarchadia,merlin,{filename:'anarchadia-change-review-v165.js'});
const imported=merlin.AnarchadiaChangeReviewV165.importPendingActions();
assert(imported?.status==='review'&&imported?.approval?.state==='review','Merlin did not put the feature request into review.');
assert(!imported.preview,'Merlin generated a preview before approval.');
assert(/export button/i.test(imported.title)&&!/dark mode/i.test(imported.title),'Merlin preserved the unrelated hard-coded dark-mode title.');
const run=await merlin.AnarchadiaChangeReviewV165.approveAndRun(imported.id);
assert(run.ok&&pipelineRuns===1,'Merlin approval did not invoke preview generation exactly once.');
const reviewedState=JSON.parse(merlin.localStorage.getItem('civweave.anarchadia.citizen-console.v139'));
assert(reviewedState.proposals[0].approval.state==='approved','Merlin did not persist the approval receipt.');
assert(reviewedState.proposals[0].preview?.srcdoc,'Merlin did not retain the generated preview.');
assert(reviewedState.proposals[0].authority.level==='device','Merlin escalated a bounded Anarchadia export control beyond the device.');
const governed=merlin.AnarchadiaChangeReviewV165.classifyAuthority({title:'Change mesh quorum rules',problem:'The mesh protocol needs a new quorum policy for all hubs.',expected:'Update the federated schema.',area:'Civweave',impact:'auto'});
assert(governed.level==='mesh'&&governed.requiresConsensus,'Merlin did not route a mesh protocol change through consensus.');

// Cerbanimo attachment acceptance and local delivery contract.
const proof=context();
vm.runInContext(attachments,proof,{filename:'cerbanimo-proof-attachments-v165.js'});
const proofApi=proof.CivweaveCerbanimoProofAttachmentsV165;
assert(proofApi.validProofUrl('https://example.test/proof')&&!proofApi.validProofUrl('javascript:alert(1)'),'Cerbanimo proof link validation is unsafe.');
assert(proofApi.validateFiles([{name:'gitingest.txt',size:1024},{name:'work.png',size:2048}]).ok,'Cerbanimo rejected valid text/image proof files.');
assert(!proofApi.validateFiles([{name:'oversized.png',size:16*1024*1024}]).ok,'Cerbanimo accepted an oversized proof file.');

for(const token of ['approveAndRun','submitToHub','selectPreview','revertPreview','Keep this preview','Revert to current look','consensusState','classifyAuthority'])assert(anarchadia.includes(token),`Merlin flow is missing ${token}.`);
for(const token of ['indexedDB','proofFiles','proofLink','attachment:','15 MB per-file proof limit','40 MB attachment limit'])assert(attachments.includes(token),`Cerbanimo attachment flow is missing ${token}.`);
for(const token of ['/app/action-followthrough-v165.js','/app/anarchadia-change-review-v165.js'])assert(anarchadiaHtml.includes(token),`Anarchadia page is missing ${token}.`);
assert(fellowfareHtml.includes('/app/action-followthrough-v165.js'),'FellowFare does not load explicit approval followthrough.');
assert(realmHtml.includes('/app/cerbanimo-proof-attachments-v165.js'),'Cerbanimo does not load proof attachments.');
for(const token of ['/app/action-followthrough-v165.js','/app/anarchadia-change-review-v165.js','/app/anarchadia-consensus-v145.js'])assert(worker.includes(token),`Installed PWA package is missing ${token}.`);
assert(boundary.includes('canonicalSystemCount:5'),'Install boundary lost the canonical five-system contract.');

console.log(JSON.stringify({
  ok:true,
  rook:{explicitApproval:'published-current-draft',materials:'canonical-request'},
  merlin:{gates:['review','approve-generation','preview','keep-or-revert'],pipelineRuns},
  cerbanimo:{proofTypes:['text','link','file','image'],storage:'indexeddb-local'},
  installedPackage:'device-package-r44-anarchadia-consensus'
},null,2));
