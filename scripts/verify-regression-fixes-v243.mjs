import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [viewport,repairs,workspace,sharedLoader,sharedCore,entry,localResearch,localActions,knowledge,pkg]=await Promise.all([
  read('public/app/persistent-guide-viewport-v216.js'),
  read('public/app/regression-fixes-v243.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/app/shared-guide-surface-v236-core-v244.js'),
  read('public/app/cabinets/living-school/living-school-cleanroom-v218.mjs'),
  read('public/app/living-school-local-research-v243.mjs'),
  read('public/app/living-school-cleanroom-actions-v243.mjs'),
  read('public/app/knowledge-school-runtime-v243.mjs'),
  read('package.json')
]);
const sharedGuide=`${sharedLoader}\n${sharedCore}`;

assert(viewport.includes("const REGRESSION_FIXES='/app/regression-fixes-v243.js?v=guide-interaction-r2'"),'Legacy viewport compatibility does not load the cache-busted proof/dialog interaction repair.');
assert(viewport.includes('installRegressionFixes()'),'Legacy viewport compatibility does not activate the proof/dialog repair loader.');
assert(!viewport.includes('CHAT_OWNER_REPAIR')&&!viewport.includes('chat-single-owner-v245.js'),'Viewport compatibility resurrects a second chat event owner.');
assert(repairs.includes("dialog button[data-close]")&&repairs.includes("control.type='button'"),'Proof dialog close controls are not repaired.');
assert(!repairs.includes("document.addEventListener('pointerup',onPointerUp,true)"),'Retired pointerup relay is still installed.');
assert(!repairs.includes('queueMicrotask(()=>control.click())'),'Synthetic chat click relay is still present.');
assert(repairs.includes('/app/assets/ai/kamiya-welcoming-v243.png'),'Kamiya does not use the refreshed avatar asset.');
assert((await stat(path.join(root,'public/app/assets/ai/kamiya-welcoming-v243.png'))).size>1000,'Kamiya avatar asset is missing or empty.');

assert(workspace.includes("document.addEventListener('pointerdown',onPointerDownCapture,true)"),'Canonical workspace does not own pointer-down gestures.');
assert(workspace.includes('suppressClickUntil=performance.now()+500'),'Workspace does not suppress the targeted compatibility click after a handled pointer gesture.');
assert(workspace.includes('suppressedControl=switchControl||closeControl||minimizeControl'),'Compatibility click suppression is not scoped to the control that owned pointerdown.');
assert(workspace.includes('if(closeControl)closeWorkspace();else toggleMinimize()'),'Close/minimize gestures do not invoke canonical workspace state directly.');
assert(workspace.includes("if(switchControl){switchWindow(switchControl.dataset.cw242Window,{open:true});return}"),'Persona pointer gesture does not invoke canonical workspace switching directly.');
assert(workspace.includes("new CustomEvent('civweave:guide-workspace-state'"),'Workspace does not publish state for embedded-surface exclusivity.');
assert(workspace.includes('submitText:async(text,system=activeWindow)'),'Canonical direct text submission API is missing.');
assert(workspace.includes('canonicalOwner:true'),'Workspace does not advertise canonical ownership.');

assert(sharedLoader.includes('/app/shared-guide-surface-v236-core-v244.js'),'Shared guide loader no longer mounts the canonical inline implementation.');
assert(sharedGuide.includes('await api.submitText(value,currentSystem)'),'Inline chat does not submit directly through the canonical chat API.');
assert(!sharedGuide.includes('form.requestSubmit()'),'Inline chat still tunnels submission through the hidden floating form.');
assert(!sharedGuide.includes("api.open?.({guide:currentSystem,prefill:value})"),'Inline chat still opens the full composer as a submission side effect.');
assert(sharedGuide.includes('syncInlineVisibility'),'Inline/full chat mutual exclusion is missing.');
assert(sharedGuide.includes("addEventListener('civweave:guide-workspace-state'"),'Inline surface does not react to canonical workspace state.');
assert(!sharedGuide.includes('input.focus();'),'Inline Send still forces keyboard focus after submission.');

assert(entry.includes("../../living-school-cleanroom-actions-v243.mjs"),'Living School is not routed through the local-source action adapter.');
assert(localActions.includes("packet.mode==='local-downloaded'"),'Living School actions do not recognize downloaded research.');
assert(localActions.includes('await researchCapability(data.capability,{force:false})'),'Curriculum generation does not research before generation.');
assert(localResearch.includes('searchDownloadedKnowledge'),'Downloaded knowledge is not queried.');
assert(localResearch.includes("provenance:'knowledge-school-downloaded'"),'Downloaded-source provenance is missing.');
assert(localResearch.includes('ARCHIVE VERIFIED · NOT LIVE-CHECKED'),'Downloaded references overstate or omit verification status.');
assert(localResearch.includes('dependency-free cached SQLite passage search'),'Local research does not report the dependency-free reader.');

for(const token of ['openSeed(slug)','DecompressionStream','databaseBytes','findPassages','windows-1252','SQLite format 3','dependency-free-sqlite-byte-search'])assert(knowledge.includes(token),`Offline knowledge reader is missing ${token}.`);
const parsed=JSON.parse(pkg),dependencies=Object.entries(parsed.dependencies||{});
assert.equal(dependencies.length,1,'v243 must preserve Civweave’s single production dependency contract.');
assert.equal(parsed.dependencies?.['onnxruntime-web'],'1.27.0','Pinned ONNX Runtime dependency changed unexpectedly.');
assert(!('sql.js' in (parsed.dependencies||{})),'Local knowledge search must not add sql.js to production dependencies.');
assert(!String(parsed.scripts?.prestart||'').includes('sqljs'),'Normal startup must not stage a second production runtime.');

console.log(JSON.stringify({ok:true,revision:'v243.1-proof-dialog-v250-chat-owner',proofDialogEscapes:true,syntheticClickRelay:false,pointerControlsOwnedByWorkspace:true,personaPointerOwnedByWorkspace:true,singleInteractiveChatSurface:true,directInlineSubmit:true,sharedGuideLoaderAware:true,forcedKeyboardRefocus:false,kamiyaAvatarFresh:true,downloadedKnowledgeQueryable:true,downloadedResearchBeforeModelFallback:true,dependencyFreeLocalReader:true,productionDependencyCount:dependencies.length,provenanceExplicit:true},null,2));
