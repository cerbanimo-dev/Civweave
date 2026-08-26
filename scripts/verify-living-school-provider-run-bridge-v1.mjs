import fs from'node:fs';
const index=fs.readFileSync(new URL('../public/app/cabinets/living-school/index.html',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../public/app/living-school-provider-run-bridge-v1.js',import.meta.url),'utf8');
const activeIndex=index.indexOf('/app/living-school-active-run-ui-v1.js');
const bridgeIndex=index.indexOf('/app/living-school-provider-run-bridge-v1.js');
const checks=[
  ['provider bridge is loaded',bridgeIndex>=0],
  ['provider bridge loads after active run UI',activeIndex>=0&&bridgeIndex>activeIndex],
  ['generic model runtime events are observed',bridge.includes("civweave:model-event")],
  ['Gemini is excluded to avoid duplicate accounting',bridge.includes("provider==='gemini'")],
  ['provider calls are forwarded into the run rail',bridge.includes('onRouteSelected')&&bridge.includes('onRouteCompleted')],
  ['preflight validation aborts suppress empty run rails',bridge.includes("session.status==='ended'")&&bridge.includes("preflight-validation")],
];
const failed=checks.filter(([,ok])=>!ok);
for(const [label,ok]of checks)console.log(`${ok?'PASS':'FAIL'} ${label}`);
if(failed.length)process.exitCode=1;
