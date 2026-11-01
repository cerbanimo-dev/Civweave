# Tracked hybrid creation and Guild training custody

The existing Creator document owner and `CivweaveCreatorStoreV1` remain the content and persistence authorities. `public/creator-suite/shared/creation-run-v1.mjs` is a bounded orchestration journal under that store, not another Quest or document database. Its schema is `civweave.creation-run.v1`; `creation-workflow-v1.mjs` presents it in the existing Text editor.

## Stage and revision protocol

The document stage contract comes from the existing document agent's `stepPrompt`, with its source module, explicit revision, output shape identifier, and SHA-256 digest. The journal references a saved Weaveling Intention/Quest ID; that reference alone is not proof of activation or authority. Weaveling's explicit authored-import path validates against its actual schema and normalizer with zero inference and accurate declared authorship. Activation and producer decisions stay with their existing owners.

An authored Weaveling revision uses the exact saved revision and import receipt. Historical authored plans are preserved across later authored or model revisions; an old idempotency key may return its saved receipt but cannot replace newer content. The existing intention planner caps this local history at eight retained snapshots and 250,000 serialized characters. Exhaustion fails before a write and asks the user to export saved history before beginning another Quest; it does not trim old revisions or generate a replacement.

### Optional private source

The existing Creator artifact store can retain a complete plain-text or Markdown source, up to 250,000 JavaScript string characters. The file control also caps input at 1 MB. Import requires an explicit owned/licensed/public-domain rights declaration, preserves the original text and newlines, computes its SHA-256 hash, and returns a content/metadata-addressed source ID. Reimporting an unchanged source reuses that identity. No manuscript body is added to Git, the creation-run journal, a default training sample, or a background upload.

`start({sourceId})` binds the source's ID, hash, name, type, character count and rights metadata. It captures the actual document-agent stage prompt plus explicitly marked untrusted source messages in the same prompt digest. Source messages contain every character in Unicode-safe chunks below the transport's per-message limit; no passage is silently truncated. Before a draft, the source is read afresh and its content and metadata hashes must still match. The exact source name, length and hash appear beside the per-run Gemini consent, and `consentSourceHash` must match that source. A provider request remains a separate explicit action. Reloading a saved run restores its original source reference; the source selection preference stores only its ID.

One first-draft attempt is allowed per creation run. It requires the configured Gemini interactive profile, saved provider consent, and explicit per-run remote-data consent. A shared Web Lock prevents concurrent creation drafts across run IDs and tabs. A missing lock fails before inference. The canonical Gemini rate governor and device-direct adapter are loaded before the SSE transport. No API key is stored in the journal.

Creator's AI Settings button is a caller of the existing Settings gateway and its single input owner. The readiness control invokes that owner's `restoreRememberedCredential` before inspecting the shared runtime's configuration. It reports provider/model and credential/consent/lease booleans only; it makes no inference, connection probe, download, or provider request. Remembering a credential does not grant external-data consent in a new tab. Missing current-tab credentials or provider consent fail before recording a model invocation. The user can open the same Settings menu and save the authorized route and consent, then explicitly start a new run.

Incremental visible text is checkpointed through the canonical Creator store, capped at 64,000 characters and 16 checkpoints. Hidden thought parts are excluded by the Gemini adapter. Only a genuine successful stream ending with valid stage-shaped JSON can call the existing `document.apply` tool. Failed, interrupted, truncated, cancelled, and structurally invalid streams keep their partial checkpoint and cannot automatically restart inference. HTTP cancellation never claims that a backend generation slot is idle.

Failures retain bounded provider error codes/messages and HTTP status where available, with URL, credential and request-body redaction. The UI shows that precise sanitized reason instead of replacing it with a generic provider failure. Selected provider/model and actual returned provider/model remain distinct. A pass may record returned input/output/total token counts, stream use, and finish reason; a default zero cost is never billing proof. An attempted request without visible streamed output remains `providerExecution: 'not-proven'`.

An explicit new stage journal may reference a failed or cancelled `previousRunRef` only for the same document and Intention. The old run and checkpoints remain unchanged. Linking it does not retry generation on either run; generation still requires a separate explicit draft action and fresh consent.

All document commits retain immutable revision artifacts and, for tool edits, a persisted receipt containing the exact edit operations, declared actor, base revision, resulting revision, and content digest. Original and revised content are addressable by the same Creator store. Run updates use an IndexedDB transaction with an expected-revision guard. Editorial edits require the exact reviewed artifact revision; newer human edits cannot silently be overwritten. A failed checkpoint can be repaired with explicit authored edits and zero inference. This is a structural validation receipt, not factual or dramatic approval.

Run states, structural validation, human authorization, and execution acknowledgments remain distinct. No orchestration operation finalizes a receipt, signs a producer approval, publishes a Guild Quest, runs OpenSimulator, renders a movie, or starts training. Performance Studio retains its own screenplay, cast, geometry, audience, and film interchange authorities. Its current lab identities and renderer demonstrations are not live Guild or OpenSimulator credentials.

### Portable creation evidence

The explicit **Prepare creation evidence** control reads the current run, saved original/final and referenced document revision artifacts, and exact persisted edit-receipt artifacts from the existing Creator store, then displays the exact JSON for inspection. **Download prepared evidence** is a separate explicit Blob download of that inspected packet. It preserves original text, revised text, declared actors, rationale, exact operations, hashes, and tool outcomes. Missing revision or receipt artifacts are listed honestly. Source metadata is allowlisted; the manuscript artifact body is excluded.

The model-output checkpoint is excluded by default and requires its own visible checkbox. An export can include up to eight linked earlier runs, their available receipts, and optional earlier checkpoints; a longer chain is marked as incomplete. The packet is capped at two million serialized characters and fails without truncation when exceeded. It is inspectable evidence, not cryptographic finalization, producer approval, native editor import, or permission to share or train on its content. Creator's service worker caches the exact versioned Gemini script URL requested by the page, alongside the canonical package dependency.

## Host Guild training custody

Canonical portable owner: `cloudflare/mobile-guild-edge/src/guild-training-contributions-v1.mjs`.
Browser transport: `public/app/guild-training-client-v1.js`.
Route: `/api/node/training`, reused by the existing node-cloud and mobile Guild adapters and their existing authenticated membership/session owners. No parallel login or credential store is created.

Collection is explicit and sample-scoped. The Creator UI can prepare a short visible sample from actual saved revisions and tool receipts, then requires review of the exact payload, an exact purpose ID/revision, a rights declaration, and separate training consent. There is no background harvesting of chats, manuscripts, audience text, system prompts, hidden reasoning, or credentials. A sample is bounded to 64 KiB and contains allowlisted instruction/input/output text, up to eight visible editorial patches, and up to 32 receipt references. These references do not independently attest that a task was completed.

The host assigns contributor identity from the authenticated session and returns a **quarantined custody acknowledgment**. Idempotency binds contributor, content, consent, and purpose revision. A retried withdrawn contribution cannot resurrect its sample. Contributors may inspect and withdraw their own contribution; withdrawal removes the active payload, previous consent detail, release, and negotiation data, retaining a minimal custody tombstone. It cannot erase previously exported copies or trained model weights.

Release, dataset access, and Guildkeeper negotiation require server-owned `authorizeGuildkeeper` and `resolvePurpose` adapters. The resolver must return the same Guild, exact purpose and revision, approved status, training permission, and decision reference. Missing, revoked, stale, or mismatched purpose authority fails closed. The current deployment adapters deliberately supply no permissive policy resolver: custody works independently, while these release operations remain unavailable until real signed collective governance is connected.

Negotiation is a nonexecuting proposal with modes `external-shared-payout` or `civweave-fulfillment-burn`. Agreement on a purpose does not authorize payment or burn. External settlement and internal fulfillment acceptance/burning must use their existing finance, consent, governance, validation, and reward authorities. This capability issues no payout, token, credit, accepted work claim, or training execution receipt.

## Verification

`npm run test:threshold` runs zero-inference authored import, genuine SSE parsing, revision/checkpoint guards, and both authenticated host training route suites. Protocol tests use synthetic text and fake provider transports; they are not live Gemini, host custody, OpenSimulator, editor-import, or training evidence. Record actual staging/device runs separately with exact IDs and receipts. Failed baseline checks stay visible.
