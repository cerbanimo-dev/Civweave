# Anarchadia Charter Forge

A zero-dependency, local-first Progressive Web App for a bounded constitutional charter lifecycle:

- draft and version a charter;
- document proposals and community-declared outcomes without running a binding vote;
- preserve dissent at a dissenter-chosen disclosure level;
- map rights, duty roles, institutional powers, data classes, threats, and offline paths;
- create default-off ecosystem bridge contracts;
- export independently selectable record classes with a manifest and SHA-256 checksum;
- restore and fork records without a server;
- preserve divergent imports as contested records for human reconciliation;
- use deterministic, local-endpoint, Gemini, or Cerbanimo-suite AI for advisory drafting only.

The app never claims that software, AI, timestamps, signatures, cryptography, or stored records establish identity, authority, legitimacy, consensus, rights compliance, voluntariness, or ratification.

## Install and run

### Fast local run

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:4173` in a browser. `npm install` performs no dependency download because the app has no runtime or development dependencies.

### Install as a PWA

1. Run the local server over `localhost` or deploy the folder over HTTPS.
2. Open the app in Chrome, Edge, or another install-capable browser.
3. Use the browser's **Install app** control, or the in-app **Install app** button when it appears.
4. Launch once while connected so the service worker caches the application shell.
5. Disable the network and confirm that the workspace still opens, edits, exports, and restores.

A service worker cannot be registered from a raw `file://` path, so serve the directory rather than double-clicking `index.html`.

## First run

Choose one of three paths:

- **Synthetic Lantern Commons** loads a fictional test journey with deliberate unfinished gates.
- **Candidate community draft** starts empty and remains explicitly unauthorized.
- **Restore a bundle** imports an `anarchadia.bundle.v1` file and verifies its checksum.

The recommended hackathon path is the synthetic fixture. It gives every major workflow something to touch without introducing real personal data.

## Tests

```bash
npm run check
npm test
```

The tests cover:

- non-authority disclaimers and blocked initial readiness;
- rights-critical language surfacing;
- non-executable proposal validation;
- prohibited bridge fields;
- keep-both contested import behavior;
- selective export boundaries;
- checksum tamper detection;
- source-scoped restore behavior;
- `HUMAN_APPROVAL.md` caution language.

## AI providers

AI configuration and API keys stay only in JavaScript memory and disappear on reload. Non-secret accessibility choices may use `sessionStorage`.

### Deterministic local linter

Works fully offline. It performs shallow phrase and missing-protection scans and creates proposal-card scaffolds. It is intentionally limited and says so.

### Cerbanimo suite broker

The app dispatches both a DOM event and, when embedded, a `postMessage` request:

```js
{
  type: "anarchadia:ai-request",
  requestId,
  system,
  prompt,
  capability: "constitutional-advisory",
  model: "suite-default"
}
```

The host returns either a DOM event named `anarchadia:ai-response` or a `postMessage` payload:

```js
{
  type: "anarchadia:ai-response",
  requestId,
  text: "advisory draft text"
}
```

An error response may use `error` instead of `text`.

### OpenAI-compatible endpoint

Point the app at a local or remote `/v1`-style endpoint such as a local model server. The adapter calls `/chat/completions` unless the supplied endpoint already ends with that path.

Browser CORS and private-network rules still apply. For the offline suite, the preferred production design is a trusted local Cerbanimo broker rather than giving every sibling app direct provider access.

### Gemini API

The adapter uses the configurable REST `models/{model}:generateContent` path and an `x-goog-api-key` session header. The default model label is configurable in the UI.

External providers require an explicit session checkbox because selected context leaves the device.

## Cerbanimo integration boundary

Use the Exchange page to download `anarchadia-cerbanimo-handoff.json` or validate against:

- `schemas/anarchadia-cerbanimo-handoff-v1.schema.json`
- `schemas/bridge-contract-template-v1.schema.json`

The handoff is record-only and includes `automaticEffect: false` and `manualReviewRequired: true`.

It may convey a scoped constitutional artifact reference, kind, declared version, declared status, conflict state, expiry, and disclaimer. It must not convey person identifiers, private dissent, motivation, needs, care, work history, eligibility, proof-of-worth, or automatic governance effects.

See [docs/CERBANIMO_INTEGRATION.md](docs/CERBANIMO_INTEGRATION.md).

## Storage and continuity

- Active workspace: browser IndexedDB.
- Accessibility choices: session-local `sessionStorage`.
- AI provider configuration and secrets: tab memory only; never persisted.
- Exchange: user-created JSON files.
- Offline shell: Cache Storage via service worker.
- Telemetry: none.
- Accounts, civil identity, recovery, sync, federation, currency, resource allocation, and executable voting: absent.

The app requests persistent browser storage when available, but export files remain the authoritative continuity mechanism because browser storage can still be cleared or lost.

## Important MVP limits

This is a hackathon capability demonstrator, not a secure governance platform and not evidence of community authorization.

Not implemented:

- authentication, membership, credentials, key recovery, or identity continuity;
- private ballots or executable decision thresholds;
- live collaboration, relays, synchronization, or automatic conflict resolution;
- automatic delegation or recall;
- resource, necessity, labor-credit, contribution, budget, or production allocation;
- live federation;
- cryptographic signatures as authority claims;
- secure handling of sensitive real-person evidence;
- independent security review.

The source constitution explicitly treats unresolved safety, accessibility, labor, continuity, replacement, and rights failures as reasons to narrow or stop a pilot. The Readiness page turns that into a visible product mechanic rather than a footnote.

## Project map

```text
index.html                     App entry
styles.css                     Responsive visual system
manifest.webmanifest           PWA metadata
service-worker.js              Offline application shell
server.mjs                     Tiny static development server
src/app.js                     Interface and workflows
src/domain.js                  Domain model, validation, fixture, merge rules
src/store.js                   IndexedDB persistence
src/export.js                  Selective bundles and checksums
src/ai.js                      Advisory AI adapters and deterministic fallback
schemas/                       Exchange and bridge JSON Schemas
docs/PROVISIONAL_CONSTITUTION.md  Source wish-list constitution
docs/ARCHITECTURE.md           Design and power boundaries
docs/CERBANIMO_INTEGRATION.md  Suite integration contract
tests/                         Node test suite
```

## License

AGPL-3.0-or-later. See `LICENSE`.

## Living Amendment Hall MVP (0.2.0)

The default Anarchadia experience is now a responsive illustrated hall with nine rooms:

- Home Hall
- Proposal Commons
- Bug Triage Board
- Hub Commons
- Federation Chamber
- Rails Engine Room
- The Forge
- Amendment Ledger
- Observatory / Metrics

Each room uses separate portrait and landscape art and routes into a functional local-first workflow. The original Charter Forge remains available through the **Workbench** route for exact text editing, accessibility, debugging, low-bandwidth use, and constitutional inspection.

New MVP records include a persistent bug pipeline, Forge-created improvement proposals, and local Rails conformance checks. Forge output remains a draft proposal until people deliberately discuss, test, review, and declare an outcome.


## Interactive room maps (v0.3.2)

Every portrait and landscape room image now contains a measured overlay map. Doorways navigate between rooms; labeled desks, boards, gauges, rails, and workstations open the existing forms, records, diagnostics, or bounded information panels. Use **Show tap zones** to reveal every active region. The overlay does not replace or duplicate the underlying Charter Forge workflows.

## Civic operations promoted from the illustrated rooms (v0.3.3)

The supplied room art now maps to durable local records instead of information-only panels:

- petition support and concern signals with explicit non-legitimacy disclaimers
- proposal discussion notes and visible workflow stages
- bounded workgroups and expiring commons bulletins
- federation messages linked to default-off bridge contracts
- hub-scoped adoption signals that never bind another hub
- Forge experiments with hypotheses, methods, criteria, and residual uncertainty
- append-only rollback proposals that preserve every predecessor
- privacy-bounded Observatory alerts whose dismissal never edits source records

These records participate in selective exports and conflict-preserving imports.

The canonical Anarchadia logo is shared by the Civweave campus, standalone PWA, Rook surface, manifest icons, install assets, and offline caches.
