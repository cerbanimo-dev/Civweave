# Private Quest filesystem archive protocol v1

This protocol describes a reusable, local filesystem catalog for preserving a creation session's permitted visible conversation, explicit source inputs, provider receipts and output versions. It documents the layout and handling rules; the repository does not ship a user-facing archive service or the operator's private archive contents.

It supplements the [creation workflow](../contracts/creation-workflow-v1.md). The canonical Quest, creation-run, document and production owners retain their existing authority. An archive folder is evidence storage, never a second application ledger.

## Identity and authority

Each archive has a stable filesystem identity such as `filesystem-archive:<questSlug>`. That identity identifies only a catalog folder. Preserve the existing canonical intention/Quest reference and creation-run reference; do not manufacture either while archiving.

When a Weaveling intention targets Cerbanimo but has not become a canonical Cerbanimo endeavor, use:

```json
{
  "targetSystem": "cerbanimo",
  "intentionRef": "weave-<existing-reference>",
  "questRef": "weave-<existing-reference>",
  "cerbanimoQuestRef": null,
  "cerbanimoStatus": "not-materialized",
  "canonicalQuestCreatedByArchive": false
}
```

All data records inherit explicit labels: `privacy: private`, user-declared source rights, `trainingConsent: not-granted`, `trainingRelease: not-authorized`, `producerApproval: pending`, `authenticatedProducer: false`, and `worldExecution: false`. Source ownership and training release are separate facts. A directory name, successful copy, model response or receipt cannot activate a Quest or grant producer authority.

## Directory layout

Keep the private root outside Git, public assets, installer inputs and service-worker caches. Do not place raw inputs or conversations in repository documentation.

```text
<private-root>/
  archive-quest.mjs
  archive-config.json
  archive-config.schema.json
  verify-archive.mjs
  Cerbanimo-Quests/
    catalog.jsonl
    index.json
    <questSlug>/runs/<threadId>/
      conversation/
        journal.jsonl
        privacy-repairs.jsonl
        <entry-kind>/<content-id>.txt or .json
      inputs/
        journal.jsonl
        objects/<sha256>/<filename>
      outputs/
        journal.jsonl
        objects/<sha256>/<filename>
      provider-evidence/<sha256>.json
      manifests/<timestamp>-<hash>.json
```

The script names above describe the separately maintained local operator tooling. They are not paths to an installed Civweave capability. Each content file has a metadata sidecar or a labeled manifest entry. Record its SHA256, byte count, MIME type, source label, provenance class, canonical references and consent labels. Multiple source paths can point to identical content bytes; their version metadata remains distinct.

The catalog and per-run journals append records. Output/input copies and timestamped manifests are immutable. Changed files produce new versions. `index.json` is a rebuildable pointer to the newest manifest for each archive/run. Historical safe versions remain available; current-item counts and retained-version counts are reported separately.

## Reusable configuration

Use one configuration per archive/run. A configuration selects an existing thread, intention and creation run, a bounded slug, one private output directory and explicit input files. For example:

```json
{
  "$schema": "./archive-config.schema.json",
  "questSlug": "example-trailer",
  "threadId": "<existing-thread-id>",
  "intentionRef": "weave-<existing-reference>",
  "creationRunRef": "creation-run:<existing-reference>",
  "outputDirectory": "handoff",
  "inputs": [
    {
      "path": "source.md",
      "sourceLabel": "raw-private-source",
      "provenanceClass": "user-owned-input"
    }
  ]
}
```

The angle-bracket values are placeholders; replace them with already existing identifiers. Keep archive writes within the chosen private root. Refuse recursive self-ingestion, input symlink traversal, ambiguous session selection and raw rollout copies. Copy source inputs only when explicitly authorized. Never send them to a provider, training process or external destination merely because they are archived.

A local implementation can refresh and verify the archive using its private tools:

```sh
node archive-quest.mjs --config archive-config.json
node verify-archive.mjs
```

A refresh appends newly eligible conversation items and changed output/input versions without another model call. Adding a future Quest means adding another configuration and catalog entry, with no new database or application shadow state.

## Conversation privacy boundary

Select only persisted visible user messages, assistant `commentary`/`final`, visible tool invocations and visible tool results. Keep user message envelopes distinct from extracted browser/reference attachments. Do not infer human authorship for attached context or treat an attachment as a new instruction.

Exclude hidden reasoning, analysis, system/developer messages, encrypted internal content, internal agent messages and compaction summaries. Do not copy the original session rollout. An API returning thread data is not sufficient evidence that every nested field is public: recursively filter nested JSON objects and JSON strings. Retain eligible visible user/assistant messages when parsing permits. Conservatively drop an unparseable result segment containing private reasoning/analysis markers.

Preserve permitted visible text exactly except when credential redaction or protected-content exclusion is necessary. Structured tool data can be serialized as JSON. Redact credential fields and recognized tokens, authorization values, private keys and environment credential assignments; retain ordinary token-count metrics. Record redaction/exclusion counts and reasons. Sanitization must be idempotent and tested with nested JSON-string reasoning, escaped analysis, credential headers and ordinary visible text. Pattern filtering is bounded; it does not prove the absence of every possible secret format.

Privacy removal takes precedence over immutable retention. If a previous tool-result copy contains protected content, remove those bytes, write a sanitized replacement and append a revocation to `privacy-repairs.jsonl`. Historical journals may retain non-sensitive metadata about the revoked entry. Verification must reject retained revoked content, residual recognized protected content and hash mismatches.

## Distinct evidence sources

Use separate provenance for:

- Visible assistant output from the local conversation.
- Tool-reported observations and receipts, with the actual tool/call identity.
- Saved provider run fields, including explicitly reported provider/model, request/checkpoint references and visible output.
- Raw private source inputs and their independent rights declarations.
- Authored/editorial output files and proposed review packages.
- Public application contract source snapshots, labeled with their observed revision/hash.

A filename, tool name or prose claim does not verify provider execution or make a simulation actual. Public application prompt/composer source is inspectable code; it is distinct from hidden assistant system/developer instructions. A current source snapshot is not automatically the exact source used by an older request.

If an old provider run saved only its objective, source reference, stage contract and prompt digest, preserve those exact fields and the visible response checkpoint. Mark the exact composite provider request unavailable. Do not reconstruct missing document timestamps, initial state or messages and label the result exact. A local assistant transcript and a provider request log are different evidence sources.

## Completeness and verification

Each manifest records its observed source cutoff, complete/malformed line counts, incomplete trailing records, compaction presence, excluded categories, current-item/version counts and content hashes. Claim only eligible records actually present in that observed source. Compaction or unavailable earlier data creates an explicit gap, never a license to archive an internal summary as the missing conversation.

An active turn's final answer cannot be archived before it has been persisted. Refresh after that answer or later exports when an updated snapshot is wanted. This protocol does not imply background monitoring or synchronization.

Verification should check all input/output/conversation hashes, immutable version behavior, authority/consent labels, privacy revocations, nested private-content filtering and the separation between exact provider evidence and missing historical request data. Filesystem access control, encryption and backup policy remain separate operational choices. No archive action publishes content, grants training consent or executes a production/world operation.
