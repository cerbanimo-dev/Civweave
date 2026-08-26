import fs from'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const index=read('public/app/cabinets/living-school/index.html');
const budget=read('public/app/living-school-generation-budget-v3.js');
const routeLock=read('public/app/living-school-route-lock-v1.js');
const runtimeRoute=read('public/app/living-school-runtime-route-v2.js');
const runUi=read('public/app/living-school-active-run-ui-v2.js');
const reportUi=read('public/app/living-school-generation-report-ui-v1.js');
const checks=[
  ['v3 provider-neutral budget is wired',index.includes('/app/living-school-generation-budget-v3.js')],
  ['legacy Gemini terminal fallback is not wired',!index.includes('/app/living-school-terminal-fallback-v1.js')],
  ['legacy Gemini-specific budget is not wired',!index.includes('/app/living-school-generation-budget-v2.js')],
  ['provider-neutral run UI is wired',index.includes('/app/living-school-active-run-ui-v2.js')],
  ['legacy run UI and compatibility bridge are not wired',!index.includes('/app/living-school-active-run-ui-v1.js')&&!index.includes('/app/living-school-provider-run-bridge-v1.js')],
  ['generation budget never assigns Gemini provider/model',!budget.includes("provider='gemini'")&&!budget.includes("provider:'gemini'")&&!budget.includes('gemini-3.')],
  ['generation budget delegates provider selection to runtime',budget.includes("providerSelectionOwner:'civweave-runtime'")&&budget.includes('providerNeutral:true')],
  ['route lock never assigns a provider model',!routeLock.includes('gemini-3.')&&!routeLock.includes("provider:'gemini'")&&routeLock.includes("strongDesignModel:'runtime-selected'")],
  ['runtime route never assigns a provider model',!runtimeRoute.includes('gemini-3.')&&!runtimeRoute.includes("provider:'gemini'")&&runtimeRoute.includes("providerSelectionOwner:'civweave-runtime'")],
  ['run UI uses generic runtime model events',runUi.includes("civweave:model-event")&&!runUi.includes('3.7 / complex')&&!runUi.includes('3.5 / fallback')&&!runUi.includes('flash-lite')],
  ['run UI counts nested safety/provider calls during generation',runUi.includes("relevant=running||session?.status==='running'||livingSchoolPurpose(purpose)")],
  ['generation report label is runtime-derived',reportUi.includes('runtimeConfig()')&&reportUi.includes('design.provider||config.provider')&&!reportUi.includes('Gemini 3.7 design')],
];
const failed=checks.filter(([,ok])=>!ok);
for(const [label,ok]of checks)console.log(`${ok?'PASS':'FAIL'} ${label}`);
if(failed.length)process.exitCode=1;
