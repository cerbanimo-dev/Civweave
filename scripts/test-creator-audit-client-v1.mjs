import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source=await fs.readFile(new URL('../public/creator-suite/audit/client-v1.js',import.meta.url),'utf8');
assert.match(source,/MAX_AUTO_RELEASE\s*=\s*3/,'automatic selected evidence release must remain bounded');
assert.match(source,/POLL_COOLDOWN_MS\s*=\s*10\*60\*1000/,'audit client must not become a tight polling loop');
assert.match(source,/request\.status===['"]pending-evidence['"]/,'only selected requests still awaiting evidence may open a local packet');
assert.match(source,/receipt\?\.sessionId.*headHash/s,'vault evidence release must match both selected session and head commitment');
assert.match(source,/signDeviceProof/);
assert.match(source,/encryptAuditEvidence/);
assert.match(source,/action:['"]appeal['"]/,'appeals must use a signed device proof');
assert.match(source,/audit\/human\/pending/);
assert.match(source,/audit\/human\/finding/);
assert.match(source,/CivweaveHostNodeSessionV1/,'Creator audit must reuse canonical Guild member authentication');
assert.doesNotMatch(source,/localStorage\.(?:setItem|removeItem)|sessionStorage\.(?:setItem|removeItem)/,'audit client must not create a second credential/session store');
assert.doesNotMatch(source,/setInterval\(/,'audit client must not install a polling interval');
assert.doesNotMatch(source,/style detector|ai detector|classif(?:y|ier).*style/i,'audit client must not add stylistic AI detection');
console.log('Creator audit client bounded privacy contract passed');
