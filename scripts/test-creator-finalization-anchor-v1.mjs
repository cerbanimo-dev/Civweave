import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const read = relative => fs.readFile(new URL(relative, root), 'utf8');
const [suite, text, audio, video, vault, mesh] = await Promise.all([
  read('./public/creator-suite/creator-suite-v1.js'),
  read('./public/creator-suite/text-editor-v1.js'),
  read('./public/creator-suite/audio-editor-v1.js'),
  read('./public/creator-suite/video-editor-v1.js'),
  read('./public/creator-suite/shared/provenance-vault-v1.js'),
  read('./public/creator-suite/shared/mesh-provenance-v1.js'),
]);

assert.match(suite, /finalizeSession\(value/);
assert.match(suite, /makePacket\(result\.session\)/);
assert.match(suite, /sealSession\?\.\(result\.session\)/);
assert.match(suite, /CivweaveCreatorProvenanceVaultV1\?\.storePacket\(packet,result\.receipt\)/);
assert.match(suite, /CivweaveCreatorMeshProvenanceV1\?\.commitReceipt\(result\.receipt,\{consent:'private',publish:false\}\)/);
assert.match(suite, /putArtifact\(result\.artifact\)/);
assert.doesNotMatch(suite, /CivweaveCanonicalRewardsV2|reward-ledger/i, 'creation provenance must not use the reward ledger');

for (const [kind, source] of [['text', text], ['audio', audio], ['video', video]]) {
  assert.match(source, /sealSession/, `${kind} editor must accept the finalized immutable session`);
  assert.match(source, /finalizedAt/, `${kind} editor must reject post-finalization mutation`);
}

assert.match(vault, /AES-GCM-256/);
assert.match(vault, /storePacket/);
assert.match(mesh, /civweave\.creation-receipt\.v1/);
assert.match(mesh, /Only encrypted Creator Suite provenance packets/);

console.log('Creator Suite finalization anchor contract passed');
