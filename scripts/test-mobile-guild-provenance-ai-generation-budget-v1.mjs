import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const mobileGuild=readFileSync(new URL('../cloudflare/mobile-guild-edge/src/creator-provenance-entry.mjs',import.meta.url),'utf8');
const clientRouter=readFileSync(new URL('../public/app/server-ai-router-v301.js',import.meta.url),'utf8');
const livingSchoolBudget=readFileSync(new URL('../public/app/living-school-generation-budget-v3.js',import.meta.url),'utf8');

assert.match(mobileGuild,/const MAX_GENERATION_TOKENS=16384;/,'Mobile Guild edge must allow the full 16,384-token generation budget.');
assert.match(clientRouter,/const MAX_GENERATION_TOKENS=16384;/,'Client server-AI router must preserve the 16,384-token generation budget.');
assert.match(livingSchoolBudget,/const DESIGN_MAX_TOKENS=16384;/,'Living School design budget must request 16,384 tokens.');

assert.match(mobileGuild,/max_completion_tokens:maxTokens/,'Mobile Guild Workers AI must send the current Cloudflare completion-budget field.');
assert.doesNotMatch(mobileGuild,/\bmax_tokens:maxTokens\b/,'Mobile Guild Workers AI must not regress to the deprecated max_tokens output field.');
assert.match(mobileGuild,/input\.max_completion_tokens\?\?input\.max_tokens\?\?input\.maxTokens/,'Mobile Guild edge must accept current, legacy, and Civweave token-budget inputs in that order.');

assert.match(mobileGuild,/const DEFAULT_AI_MODEL='@cf\/zai-org\/glm-4\.7-flash';/,'Mobile Guild default model must remain GLM-4.7-Flash.');
assert.match(mobileGuild,/const WORKERS_INPUT_NEURONS_PER_MILLION=5500;/,'GLM-4.7-Flash input neuron accounting must match the current Cloudflare rate.');
assert.match(mobileGuild,/const WORKERS_OUTPUT_NEURONS_PER_MILLION=36400;/,'GLM-4.7-Flash output neuron accounting must match the current Cloudflare rate.');

assert.match(livingSchoolBudget,/const MIN_LESSON_WORDS=120;/,'The long-form curriculum quality gate must remain intact; serving capacity, not pedagogy, owns the truncation fix.');

console.log('Mobile Guild AI generation budget regression checks passed.');
