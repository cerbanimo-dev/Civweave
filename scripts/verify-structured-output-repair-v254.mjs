import fs from 'node:fs';
import assert from 'node:assert/strict';

const runtime=fs.readFileSync(new URL('../public/app/shared/civweave-model-runtime.js',import.meta.url),'utf8');
const living=fs.readFileSync(new URL('../public/app/cabinets/living-school/living-school-cleanroom-core-v218.mjs',import.meta.url),'utf8');

assert.match(runtime,/responseMimeType: "application\/json"/, 'Gemini structured calls must request JSON MIME mode.');
assert.match(runtime,/responseJsonSchema: schema/, 'Gemini structured calls must attach the sanitized JSON schema when accepted.');
assert.match(runtime,/function stripCodeFence\(text\)/, 'Structured output must retain conservative fenced-JSON cleanup.');
assert.match(runtime,/function firstBalancedJson\(text\)/, 'Structured output must retain bounded JSON extraction.');
assert.match(runtime,/request\.maxRepairAttempts \?\? 1/, 'Structured output must default to one corrective retry.');
assert.match(runtime,/\["MAX_TOKENS", "MAX_OUTPUT_TOKENS"\]\.includes\(finishReason\)/, 'Structured repair must recognize provider truncation.');
assert.match(runtime,/Math\.max\(config\.maxTokens \* 2, 16384\)/, 'A truncated structured repair must receive a larger bounded output budget.');
assert.match(runtime,/reason: "structured-output-truncated"/, 'Truncation repair must be observable in runtime events.');
assert.match(living,/required:\['title','capability','proof','modules'\]/, 'Living School curriculum schema must remain strict.');
assert.match(living,/maxTokens:Math\.max\(Number\(config\.maxTokens\)\|\|0,16384\)/, 'Living School full curriculum generation must reserve enough structured-output budget.');
assert.match(living,/config:curriculumConfig,schema:curriculumSchema\(\)/, 'Living School must use the larger curriculum budget without bypassing its schema.');

console.log('Structured Output Repair v254: JSON mode, strict schema, fenced extraction, one bounded repair, and truncation-aware curriculum budget verified.');
