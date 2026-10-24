# Civweave Craft + Business Tools (initial integration contract)

## Scope
- Exclude the hosted ArtCraft AI service and its proprietary/source-available service code.
- Include PhotoCraft, VectorCraft, FilmCraft, LightCraft, PdfCraft, EffectCraft, DesignCraft, CADCraft, WordCraft, GridCraft and DeckCraft.
- Make FigCraft and SoundCraft optional future additions.
- Optional self-hosted services: Gotenberg (conversion), Paperless-ngx (OCR/archive), Stirling PDF (advanced PDF; inspect mixed licensing), Collabora Online (co-editing; copyleft), Documenso (e-sign; copyleft).
- The discovery catalog is **NOT a connection**, authorization, integrated editor, model tool call, offline download or proof of browser compatibility.

## Existing local integration points
- Creator Suite entry: `public/creator-suite/index.html`.
- Creator Suite AI registry: `public/creator-suite/shared/ai-tools-v1.js`; only validated registered editors may execute.
- Provenance: `public/app/content-provenance-v1.js`, `public/creator-suite/shared/guild-provenance-v1.js`.
- Package: `public/creator-suite/package-v1.json`; keep this an optional separate download, not part of the core offline package.
- Runtime discovery data: `public/creator-suite/shared/craft-catalog-v1.js`.
- UI discovery route: `/creator-suite/tools.html`.

## Proposed capability contract
1. `discover` returns metadata and a *verified* runtime connection status.
2. `open` resolves a user-owned input using an explicit file grant. Never accept unrestricted filesystem paths.
3. `inspect` returns bounded document/page/cell/layer metadata; no leaking private document contents into catalogs.
4. `preview` returns an isolated preview, never overwrites the editable original.
5. `apply` accepts typed and allowlisted commands only on a draft copy; requires a session actor and undoable edit log.
6. `verify` parses/reopens output, checks format invariants and generates a diff or review preview.
7. `commit` saves a new version and provenance receipt; user approval required for overwriting originals, external publication, sending and signing.
8. `publish` optionally attaches a copy to the guild, subject to membership, consent and the resource ACL.

Never confuse `CivweaveCreatorToolsV1.registerEditor` with tool authorization. Registration is local availability only. Authenticate the account, validate role-based ACLs, quotas and storage scope server-side before allowing privileged operations. Use a least-privilege local MCP bridge for native applications. Do not expose unauthenticated stdio services or loopback control ports to other users.

## Business workflow MVP
- Create/edit letters, proposals, contracts, minutes, invoices, forms and reports using WordCraft or an approved alternative.
- Create/edit budgets, attendance, inventory and financial trackers using GridCraft.
- Create/edit slides and educational material with DeckCraft.
- Read, combine, annotate, convert, OCR and archive documents with PdfCraft and optional separate services.
- Import/export DOCX, XLSX, PPTX, PDF, CSV, ODT and Markdown with sample-based fidelity testing; retain originals and produce explicit loss warnings.
- No external signatures, email sends, guild publishing or document deletion without explicit consent.

## Delivery sequence (not completed by catalog PR)
1. Package verified per-app web builds as optional assets, evaluate mobile touch and size limits; do not cache all WASM packages in core.
2. Implement one audited end-to-end native MCP bridge (WordCraft or CADCraft) with a sandboxed work directory and explicit per-file approval.
3. Add in-browser command adapters individually where browser engine interfaces are documented and tested; do not claim native MCP is directly accessible in a PWA.
4. Add user-private document vault, versions, per-file ACLs, schema checks and provenance receipts; test offline re-open and storage pressure recovery.
5. Optional service connectors (Gotenberg, Paperless-ngx, Collabora, Stirling, Documenso) with per-guild host configuration, trusted endpoints, timeouts and SSRF protection.
6. Promote proven capabilities to Capability Lock after the actual integration tests pass.

## Acceptance checklist
- Discovery shows all 11 requested upstream apps plus 5 optional services; no hosted ArtCraft entry.
- All entries report not-connected until an actual adapter handshake succeeds.
- A failed MCP or document service connection does not freeze the main Civweave shell.
- Untrusted model output cannot write arbitrary paths or exceed document ownership rights.
- Verify real DOCX/XLSX/PPTX/PDF round trips and mobile browser performance before release.
- No invented tool execution success: receipt and UI show whether the operation was simulated, drafted, verified or committed.

## WordCraft first executable adapter (PR #861 follow-up)
- Local Node bridge: tools/creator-craft-bridge/server.mjs; bounded WordCraft CLI operations inspect, text, PDF conversion.
- Setup: tools/creator-craft-bridge/README.md. Browser consent UI: /creator-suite/tools.html.
- Requires independently installed WordCraft CLI and trusted exact origin configuration. It does not automatically connect a guild or AI model router.
- Native CLI and HTTP tests use a stub executable. Real upstream CLI and browser/PNA tests remain manual acceptance gates.
