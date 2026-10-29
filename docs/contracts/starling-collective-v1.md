# Starling Collective

Starling is an optional shared planning capability. It calls Civweave's selected model runtime and presents public contributions and concrete results in an activity journal. It does not create another guide chat, private reasoning display, model transport or always-on loop. A user starts one bounded serial planning session; cancellation stops further turns and never silently selects another model.

The first editable example Guild Intentions cover a local readiness checklist, community repair, a shared garden and a food cooperative. Choosing a template only fills a draft. AI suggestions are proposals, and a Learning Journey is specifically the learning path inside or alongside a Quest.

## Capacity and identity

Use the current Passport and canonical reward ledger for the device's skills. Share Passport planning claims only after explicit consent. Guild projections distinguish authenticated residents, reported Passport Heroes, linked account aliases, declared skills and unknown coverage. A missing roster is unknown, never zero; model agents do not count as human members. Device claims are not independent skill verification or Guildmaster authority. Do not use discovery mesh records, billing seats or a local steward preference to grant privileges.

The portable Guild authority is `cloudflare/mobile-guild-edge/src/guild-starling-collective-v1.mjs`. Both existing Worker adapters use that owner. Local planning is available without a Guild; shared reservations require the authenticated selected Guild session and an explicit sharing choice.

## Work limits

- **Manual Collective planning is unlimited**: a user-requested three-perspective plan never consumes the autonomous project slots or rolling 24-hour creation allowance, locally or in a connected Guild. Storage and actual inference availability still apply.
- **Autonomous project creation only**: three active AI-generated projects per Guild, with six new autonomous projects per rolling 24 hours. Abandonment does not refund an autonomous creation. Idempotent retries of the same autonomous reservation never mint a second project.
- Local UI and shared Guild reservation actions carry explicit `manual` / `autonomous` creation modes; legacy UI lines without mode are treated as manual, not retroactively counted against autonomous allowances.
- Reserve before inference. Serialize local admission with Web Locks and shared admission with the Guild's transactional storage. Missing or corrupt required storage fails visibly before generation.
- Preserve terminal records and creation timestamps. A completed or abandoned line cannot reopen under the same identity. Bounded history has a visible storage limit.
- Completion requires matching canonical work evidence. A model's assertion or client-supplied completion flag is insufficient. Shared completion requires server-attested evidence; no public request may supply the trusted attestation option.

Cloud requests remain subject to the existing membership and neuron budget owner. Local inference uses no new hosted allowance. The creation limit controls spam separately from inference budget; it does not promise a number of cloud generations for any membership tier.

## Review and publication

Import a valid plan through the canonical Weaveling normalization, intention persistence and materialization owners. The result stays under review until a human explicitly activates it. Preserve a stable Collective line ID so independent lines cannot collapse through title matching.

Before posting, show the exact allowlisted Quest snapshot and destination. The server stores the proposal revision and hash. A separate confirmation of that exact revision publishes through the existing Guild Quest owner. Every role requires confirmation in this initial integration, including local members whose Guildmaster status is unknown. Changing the proposal invalidates prior confirmation. Local discussion, raw wishes, private evidence, credentials and chat history are not part of the shared Quest snapshot.

Guild Intention proposals remain human proposals. They do not become an adopted shared Intention through AI consensus. Founder authority and human-only voting require their canonical Guild governance integration; no local flag impersonates that authority.

## Executable contracts

`scripts/test-starling-*.mjs` and `scripts/test-guild-starling-*.mjs` run in the Starling Collective contract workflow. They cover templates, inert opening, serial generation, cancellation, provenance, caps, abandonment churn, identity preservation, exact confirmation, authentication and canonical proof projection. Mocked model cases do not count as real Qwen acceptance.

## Persistent Guild main goal and AI-only autonomy

The optional Starling Lounge accepts a durable Guildkeeper **main goal**, e.g. neighborhood trash reduction or humane responses to stray cats. Selecting **Set goal & start autonomous projects** stores a signed local policy and immediately begins a bounded project-generation cycle, using Civweave's single selected local model. Projects are recorded as signed `civweave.starling-autonomous-project.v1` draft records, and subsequent cycles produce actual reviewable text deliverables as signed `civweave.starling-autonomous-task-output.v1` records. The Collective can propose and develop its own projects without manually authoring each one. Its work does not count as a human vote, verified evidence, an activated Cerbanimo Quest, a public post, or a completed physical action.

When **silo mode is enabled**, or **no trustworthy currently available human skill data is provided**, the project validator allows **only AI-capable tasks**: outlines, writing, analysis, editing, code drafts, curricula, storyboards and review. Human assignments and physical execution are excluded. Even with trusted skill data and silo mode off, human tasks remain unassigned review proposals. There is no permission to direct real people, spend funds, run tools or perform field work. The model's declared capabilities cannot grant additional permissions.

Project creation respects the autonomous-only six-per-rolling-day / three-active-project allowance and the worker's per-day inference allowance. It continues working on existing AI tasks instead of needlessly minting a new project. The signed goal identity preserves the backlog across an explicit stop/resume of the same goal. The initial cooperative scheduler runs while the Lounge is active; the existing native Android and Termux host adapters remain separate draft-generation hosts and are not yet wired to this structured project backlog. Continuous closed-window project execution needs that protocol extension and cross-host leases.
