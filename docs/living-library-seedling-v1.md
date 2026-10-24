# Living Library: Seedling Edition — Manual Learning Journey Studio (v1)

Status: prototype in pull request; not a released Seedling firmware or completed native Living School import service.

## Browser authoring

Entry: `/app/living-library-seedling-v1.html`.

1. Enter title, capability, proof, and 3–8 modules (title / focus / observable demonstration).
2. Research using Wikipedia/OpenAlex lookups or provide a URL manually. The operator, not the search service, chooses and evaluates sources.
3. Enter image and video URLs with attribution and licensing notes. Only remote link previews are supported now. YouTube/Vimeo have allowlisted embed transforms. No media is downloaded automatically.
4. Validate and export a `civweave.learning-journey-plan.v2` JSON or a full `civweave.seedling.guild-learning-submission.v1` JSON bundle.
5. Choose **Stage for Moss REVIEW**. This writes an unapproved review plan to the existing local origin key `civweave.chat.capability.pending.living-school.plan.v1` and stores a linked evidence record at `civweave.seedling.living-school-evidence.v1.<planId>`.
6. Open the normal Civweave Working Campus **on the same HTTPS origin**, switch to Moss, and request **Review plan**. Review, Revise, Deny, or Approve with the existing Living School controls. Nothing is generated until explicit approval. Moss materialization still uses the user's configured AI provider and can fail independently. The high-level Seedling module outline is not yet guaranteed to be enforced by the downstream lesson generator.

## Guild handoff

**Send to Guild** requires a selected Guild and an authenticated member session on the same Civweave browser origin. The sender shows the exact destination and requires an explicit confirmation.

The client creates a signed `civweave.community-object.v1` with kind `civweave.seedling.guild-learning-submission.v1`, group consent and audience `guild:<guildId>`. It queues an outbox delivery through Civweave Local Mesh. If a matching Pocket Guild Node primary is already attached, it attempts Cloud Guild sync and checks the specific signed object's relay acknowledgment.

The sender reports three distinct states:

- **Signed local outbox**: The object exists on this browser; no Cloud Guild receipt.
- **Cloud relay acknowledged**: Cloud Guild accepted the signed object envelope; no Guild approval or canonical curriculum import is implied.
- **Guild review**: Another authenticated client with access to that Guild can open Seedling's review inbox, sync with its configured Cloud primary, and inspect signed submissions. Selecting a submission verifies the signature again before staging an unapproved Moss plan.

A Community Object is *not* an Anarchadia vote, permission grant, published Guild artifact or proof of review. The Guild's own membership/authorization and publication rules remain authoritative.

## Limits

- Drafts, imported review plans and evidence are currently stored per-browser/per-origin. They do not travel with the user's Passport automatically.
- `Stage for Moss REVIEW` is a local-state bridge to the canonical Living School plan gate, not a Guild-backed storage adapter or guaranteed curriculum import.
- External source validity is not fact checked or license verified; references remain flagged human-curated/unverified.
- E-paper and CrossPoint firmware builds, EPUB conversion, offline media cache, Cloudflare device authorization and automatic Passport synchronization remain future integration milestones.
- Do not use a Guild member's private credential as a device-pairing credential. Use scoped, revocable authorization when Passport integration is built.
- No AI spending, voting, publication or course approval happens through Seedling's import or handoff.

## Verification

Run:

```sh
node --test scripts/test-living-library-seedling-v1.mjs
```

Manual browser acceptance checklist:

- Create the sample tarot plan with 3 modules and verify validation succeeds.
- Remove a module or proof and verify the draft is blocked.
- Search Wikipedia/OpenAlex; add references; preview an image and YouTube video.
- Confirm no page script initiates paid AI requests while entering/editing the plan.
- Stage the plan and confirm canonical REVIEW state and evidence source/media IDs are stored on the same origin.
- Open Moss and request “Review plan”; confirm normal Approve / Revise / Deny gate, without auto approval.
- Attempt to stage a second plan; confirm warning and no silent replacement.
- Select a real Guild and send once; confirm a signed local outbox record; repeat identical content and confirm deduplication.
- With a configured Pocket Guild Cloud primary, confirm the exact delivery acknowledgment and retrieval by another authorized client.
- Tamper with a signed object's payload and confirm the Guild inbox's import verifier rejects it.
- Validate download JSON with an external parser; assess Android storage and X4 Pro export when hardware arrives.

## Files

- `public/app/living-library-seedling-v1.html`: standalone authoring and review UI.
- `public/app/living-library-seedling-core-v1.mjs`: strict manual plan and evidence/bundle formats.
- `public/app/living-library-seedling-bridge-v1.mjs`: canonical unapproved Moss staging and evidence preservation.
- `public/app/living-library-seedling-ui-v1.mjs`: browser authoring, sourcing, media preview, Guild mesh handoff/inbox.
- `scripts/test-living-library-seedling-v1.mjs`: contract and conflict/rollback tests.
