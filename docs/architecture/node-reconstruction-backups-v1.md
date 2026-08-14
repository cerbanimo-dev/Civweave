# Node reconstruction backups v1

## Purpose

Civweave Node Hosts need regular encrypted backups that can be verified, copied between untrusted backup nodes, restored offline, and incrementally reused without turning a backup operator into an authority holder.

This subsystem combines the existing ABBA reconstruction research with conventional cryptographic commitments and authenticated encryption. It does **not** treat ABBA as encryption and does **not** claim that a hash contains enough information to recreate node state.

## Ownership

Canonical owner: `lib/node-reconstruction-backup-v1.mjs` under the Node Host integration boundary.

Operator: `scripts/node-reconstruction-backup-v1.mjs`.

Source applications retain ownership of their canonical data. A backup source only exports a portable snapshot. Restore verifies and reconstructs records, but does not directly mutate Living School, Cerbanimo, FellowFare, Anarchadia, Civweave coordination state, or Passport authority. Each owning system must preview and accept imported state under its own conflict and rollback policy.

## Security boundary

The design separates five jobs:

- **SHA-256 / Merkle root:** commitment to the exact canonical snapshot.
- **ABBA quarter-state residual codec:** optional exact lossless representation when it is shorter than ordinary compression.
- **ABBA expansion of the node root:** deterministic coordinates for chunk and replica placement, never secrecy.
- **AES-256-GCM:** authenticated encryption of compressed chunk payloads in the Node.js host implementation.
- **Node identity / CMLP envelope:** federation-level signing and recipient key wrapping. This remains outside the codec and should use the established CMLP signing/HPKE suite when replicas are exchanged over the mesh.

Compression happens before encryption. Encrypted ciphertext is intentionally high entropy and is never fed back into the ABBA compressor.

The v1 library accepts an already-authorized 32-byte data-encryption key and a non-secret key ID. It does not invent a password KDF, derive signing keys from encryption keys, or serialize the data-encryption key into a manifest.

## Portable record contract

Every exporter must emit records with explicit sensitivity:

```js
{
  system: 'living-school',
  path: 'progress.json',
  sensitivity: 'portable-private', // or portable-public
  mediaType: 'application/json',
  version: 1,
  content: {...}
}
```

The backup owner rejects records without an explicit portable classification and rejects known credential/authority path classes such as API keys, session bearer tokens, browser-bound signing keys, private keys, recovery phrases/secrets, and refresh tokens.

This is defense in depth, not a substitute for source-system export policy. Source systems must never export non-portable authority in the first place.

## Canonical snapshot and checkpoint

1. Exporters return portable records.
2. The coordinator sorts and canonicalizes them into `civweave.node-reconstruction-payload/v1`.
3. The payload is divided into fixed-size chunks.
4. Every plaintext chunk receives a domain-separated SHA-256 commitment.
5. Chunk commitments form a binary SHA-256 Merkle tree.
6. The Merkle root is the `nodeRoot` checkpoint commitment.
7. Each chunk is losslessly encoded, authenticated-encrypted, and stored by ciphertext content ID.
8. The manifest is authenticated with HMAC-SHA256 using the backup data-encryption key. A federated copy should additionally be signed by the Node Host identity using the CMLP envelope.

Restore must reproduce every chunk commitment, the Merkle root, payload commitment, and authenticated manifest before it is considered verified.

## ABBA exact residual codec

The optional ABBA codec uses the canonical quarter mapping:

```text
0 -> 0110
1 -> 1001
```

For each four-bit group, the leading bit is the coarse parent. The three remaining child differences are stored as residual bits. Parent layers are recursively collapsed until a small root remains. Decoding walks the layers in reverse and round-trips the original bytes exactly.

The ABBA capsule and the original chunk are both compressed with conventional DEFLATE. The encoder selects ABBA only when its complete encoded representation is smaller by the configured minimum margin. Random or already-incompressible information therefore falls back to ordinary lossless storage instead of being forced through an ornamental transform.

No lossy mode is allowed for authoritative node backups.

## Whole-node hash expansion and placement

The whole-node `nodeRoot` is expanded through the same ABBA quarter rule to derive deterministic chunk coordinates. These coordinates can be combined with object commitments and candidate replica IDs to select stable replica targets.

This is a placement/addressing function, not a confidentiality or consensus primitive. Replica selection is still committed and hashed, and federation policy decides which nodes are eligible.

## Incremental backups

A new checkpoint compares each plaintext chunk commitment with the previous manifest. If a chunk is unchanged, the same encrypted content-addressed object can be referenced again when the backup key ID is unchanged and the object is still present.

Changed chunks receive fresh random AEAD nonces and new ciphertext objects. This means small state changes can reuse most of an earlier backup without deterministic-nonce encryption.

Retention deletes old manifests first, then garbage-collects ciphertext objects no longer referenced by retained manifests.

## Replication and proof of storage

`replicateBackup()` copies only encrypted content-addressed objects and the authenticated manifest. A target never needs the plaintext key to store a replica.

`answerRetrievalChallenge()` supports a fresh nonce-bound ciphertext retrieval challenge. It demonstrates that the challenged encrypted object can be retrieved at challenge time. It is intentionally **not** described as a formal proof-of-retrievability or proof-of-space scheme.

Backup compensation can require successful recent challenges plus occasional full reconstruction audits by an authorized verifier.

## Regular operation

The operator supports one-shot and scheduled operation:

```text
CIVWEAVE_NODE_BACKUP_KEY_B64=<32-byte-key-base64>
CIVWEAVE_NODE_BACKUP_KEY_ID=<non-secret-id>
CIVWEAVE_NODE_ID=<optional-node-id>

node scripts/node-reconstruction-backup-v1.mjs once \
  --store ./data/node-backups \
  --source ./local/node-backup-source.mjs

node scripts/node-reconstruction-backup-v1.mjs watch \
  --store ./data/node-backups \
  --source ./local/node-backup-source.mjs \
  --interval-minutes 360 \
  --retention 28
```

A source module must export:

```js
export async function exportNodeBackupRecords() {
  return [/* explicitly portable records */];
}
```

The scheduler runs one cycle immediately, then repeats at the configured interval. It coalesces overlapping cycles so a slow backup cannot create concurrent writers.

## Restore boundary

`restoreNodeReconstructionBackup(..., { preview: true })` verifies the entire encrypted backup and returns only record/system counts and checkpoint metadata.

A non-preview restore returns verified portable records to an importer. It does not overwrite live state. Importers must enforce:

- schema/version compatibility;
- current-vs-backup sequence and rollback checks;
- Passport generation/authority rules;
- per-system conflict handling (keep current, use backup, keep both, skip where supported);
- pre-restore safety export when feasible.

This preserves the existing Passport Vault rule that portable data is recoverable while authority remains non-portable.

## v1 limitations and next integration steps

- The filesystem store is the first concrete storage adapter. Mesh transports can wrap the same object/manifest interface.
- Fixed-size chunking is deterministic and simple but can amplify changes when record sizes shift. A future version may add content-defined chunking without changing the checkpoint/AEAD boundary.
- Federated manifests should be wrapped in the existing CMLP signed envelope and replica DEKs should be HPKE-wrapped to authorized recovery principals. The core deliberately does not duplicate that key hierarchy.
- Each system still needs a small exporter/importer adapter. Those adapters belong to the system that owns the data, not this coordinator.
