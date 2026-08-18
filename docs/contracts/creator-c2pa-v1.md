# Civweave Creator C2PA Interoperability Contract v1

Status: implementation boundary; signing engine not yet vendored.

## Authority

Civweave creation origin remains owned by `public/app/content-provenance-v1.js` and its finalized `civweave.creation-receipt.v1` receipt. C2PA is an interoperability/export layer around that authority. Importing or exporting a Content Credential must never rewrite Civweave event history or origin semantics.

The pure mapping owner is `lib/creator-provenance-c2pa-v1.mjs`.

## Intent is not a credential

`buildC2paManifestIntent()` returns `civweave.c2pa-manifest-intent.v1`. It is deliberately marked:

- `credentialState: unsigned-intent`
- `requiresC2paSigner: true`
- `requiresHardBinding: true`
- `verifiableCredential: false`

This object must never be presented as a Content Credential. A real export is complete only after vetted C2PA tooling creates a standard manifest, creates the asset hard binding, signs the claim, and embeds or otherwise associates the manifest using a C2PA-supported mechanism.

Target specification: C2PA 2.4.

## Public projection

The C2PA layer may export only the compact public receipt plus provenance categories needed to form suitable C2PA actions/ingredients. It must not embed the detailed Civweave creation packet.

Excluded by default:

- draft text or media contents
- prompts or model outputs
- local human/AI actor identifiers
- provider/model/request identifiers
- local filenames
- local content digests from event payloads
- per-event timestamps
- encrypted audit packet material or keys

The compact Civweave receipt remains linkable through `sessionId`, `headHash`, `receiptHash`, origin summary, media/artifact type, event count, AI-use flag, and finalization time.

## C2PA action mapping

The adapter uses current non-retired C2PA/IPTC source categories:

- human digital creation → `digitalCreation`
- real-world camera/microphone capture → `digitalCapture`
- generative AI creation → `trainedAlgorithmicMedia`
- later human edits → `humanEdits`
- later generative AI edits → `compositeWithTrainedAlgorithmicMedia`
- deterministic non-generative transforms → `algorithmicallyEnhanced`
- a new empty project whose first material is an unverified external component → C2PA `empty` plus an unknown `componentOf` ingredient

External/unknown content stays unknown. Importing it into a human-controlled project does not convert it into human-authored content.

`c2pa.created` is the first action for a new Creator Suite project. External components are represented as ingredient intents and `c2pa.placed` actions. The final signer must translate the adapter's stable ingredient references into real C2PA ingredient assertions and hashed-URI references.

## Signing engine boundary

Preferred browser implementation candidate: the Content Authenticity Initiative `contentauth/c2pa-js` project, using `@contentauth/c2pa-web` and its WASM runtime. No CDN runtime is permitted. Approved files must be vendored into the optional Creator Suite only after the vendor/license audit records exact versions, transitive dependencies, licenses, integrity hashes, notices, and redistribution obligations.

Until that vendor pack is present, the product must report C2PA signing as unavailable. It must not fall back to an unsigned JSON sidecar branded as a Content Credential.

## Verification gate

C2PA export is not complete until CI can independently verify representative exported assets using a second compatible verification path (for example the upstream Node tooling or `c2patool`) and assert:

1. the manifest signature validates;
2. the hard binding matches the exported asset;
3. the expected actions and public Civweave receipt assertion survive;
4. no forbidden private fields are embedded;
5. AI, human, capture, and unknown-import scenarios retain their intended source semantics.

## Import rule

A later C2PA import verifier may add trusted external provenance evidence, but invalid, unsupported, or unverifiable credentials remain external/unknown. C2PA claims are additive evidence; they do not replace Civweave's local history.

## References

- C2PA 2.4 technical specification: https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html
- C2PA 2.4 implementation guidance: https://spec.c2pa.org/specifications/specifications/2.4/guidance/Guidance.html
- IPTC Digital Source Type vocabulary: https://cv.iptc.org/newscodes/digitalsourcetype/
- Content Authenticity Initiative JS implementation: https://github.com/contentauth/c2pa-js
