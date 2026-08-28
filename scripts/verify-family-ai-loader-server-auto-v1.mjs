import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [loader, livingSchool, router, spine] = await Promise.all([
  read('public/app/family-ai-loader-v105.js'),
  read('public/app/cabinets/living-school/living-school-cleanroom-core-v218.mjs'),
  read('public/app/server-ai-router-v301.js'),
  read('public/app/fast-interactive-runtime-v192.js'),
]);

for (const source of [loader, router, spine]) new Function(source);

assert.match(loader, /1\.0\.133-server-auto-shared-loader/);
assert.match(loader, /const SERVER_AI_ROUTER=\['\/app\/server-ai-router-v301\.js\?v=1\.0\.117-guild-handoff'/);
assert.match(loader, /CivweaveServerAIRouterV301\?\.status\?\.\(\)\.registered===true/);

const orderedLoads = 'await loadScript(...FAST_RUNTIME);await loadScript(...SERVER_AI_ROUTER);await loadScript(...RESPONSE_ROUTER)';
assert.equal(
  loader.split(orderedLoads).length - 1,
  2,
  'Both warm and cold family-AI loader paths must register server-side routing after the runtime spine and before response routing.',
);

assert.match(router, /const MIDDLEWARE_ID='server-auto-v301'/);
assert.match(router, /const WORKERS_AI_ROUTES=new Set\(\['cloudflare-workers-ai','workers-ai','cloudflare'\]\)/);
assert.match(router, /s\.register\(MIDDLEWARE_ID,\{handle\},60\)/);
assert.match(router, /function routeMode\(request=\{\}\)\{const route=selectedRoute\(request\);if\(route===ROUTE\)return ROUTE;if\(WORKERS_AI_ROUTES\.has\(route\)\)return'cloudflare-workers-ai';return''\}/);
assert.match(router, /function isServerAuto\(request=\{\}\)\{return routeMode\(request\)===ROUTE\}/);
assert.match(router, /function isDirectWorkersAI\(request=\{\}\)\{return routeMode\(request\)==='cloudflare-workers-ai'\}/);
assert.match(router, /modelEvent\(next,'generating'/);
assert.match(router, /modelEvent\(next,'completed'/);
assert.match(spine, /function serverAuto\(request=\{\}\)/);
assert.match(spine, /if\(handledBy==='base-runtime'\)result=await base\.generate\(request\)/);

assert.match(livingSchool, /const curriculumConfig=\{\.\.\.config,maxTokens:/);
assert.match(livingSchool, /runtime\.generate\(\{purpose:'living-school-research-grounded-curriculum-v218\.1',executionProfile:'interactive',config:curriculumConfig/);
assert.match(livingSchool, /refusing deterministic module padding/);

console.log(JSON.stringify({
  ok: true,
  revision: 'family-ai-loader-server-auto-v1',
  loaderOwnsServerAutoReadiness: true,
  serverAutoMiddlewareRequired: true,
  directWorkersAiMiddlewareRequired: true,
  sharedModelEventTelemetryRequired: true,
  livingSchoolUsesSharedConfig: true,
  deterministicCurriculumPaddingBlocked: true,
}, null, 2));