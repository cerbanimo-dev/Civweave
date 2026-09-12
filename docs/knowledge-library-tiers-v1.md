# Tiered offline knowledge library v1

Civweave keeps the existing 1,001-article Knowledge Schools as the compact **Foundation Library** and adds two explicitly optional, additive layers:

| Layer | Membership | Stored payload |
| --- | --- | --- |
| Foundation | shipped Vital Level 3 corpus | existing 11 school ZIPs |
| Expanded | current Vital Level 4 minus the exact titles already shipped in Foundation | chunked school delta packs |
| Deep | current Vital Level 5 minus current Level 4 | chunked school delta packs |

Expanded depends on Foundation. Deep depends on Foundation and Expanded. The client stages dependencies before the selected layer so a downloaded tier is cumulative without storing the same article three times.

## Source

The intended article-body source is `wikimedia/structured-wikipedia`, English `enwiki_namespace_0`, distributed as Parquet by Wikimedia through Hugging Face. The tier compiler also accepts compatible JSONL/NDJSON input so a prefiltered or mirrored source corpus can be used without changing the app contract.

`fetch-vital-memberships-v1.py` refreshes only the Vital-list membership pages through the MediaWiki API. It does not crawl article bodies. `reconcile-foundation-vital-membership-v1.py` then replaces fetched Level-3 membership with provenance extracted from the exact Foundation ZIPs in the release. This prevents a later edit to the Vital lists from creating duplicate or missing downloads relative to the Foundation corpus users actually have.

## Build pipeline

1. Run **Build optional knowledge library tiers** with an Actions artifact containing Wikimedia-compatible English source files.
2. The workflow refreshes Level 3/4/5 membership, proves the shipped Foundation title set, and compiles only the selected Expanded/Deep deltas.
3. Every output pack contains `knowledge.sqlite`, `source-manifest.json`, and `RIGHTS.md`.
4. SQLite contains article metadata, section text, and a section-level FTS5 index.
5. ZIPs are recursively split until each is below the 24 MiB optional-asset boundary.
6. Each pack receives SHA-256, byte count, article count, and compact routing terms so local retrieval can open only a few relevant chunks.
7. The build artifact contains the tier catalogs, checksums, membership/build manifests, and the chunk payloads.

The build fails if the source corpus misses more than the configured selected-title ratio. The default maximum is 2%.

## Distribution

Run **Publish optional knowledge library tiers** with the build artifact ID, R2 bucket, public HTTPS base URL, and object prefix.

The publish workflow:

- configures the bucket for public browser `GET`/`HEAD` CORS;
- uploads ZIP payloads to Cloudflare R2;
- rewrites catalogs with HTTPS `download_url` values;
- probes a published pack through the public URL with an `Origin` header;
- commits only small catalogs, checksums, and provenance manifests to `staging`;
- leaves the multi-gigabyte payload bodies out of Git history.

A tier remains `build-required` in `public/downloads/knowledge-schools/tiers.json` until a successful materialization/publish run marks it ready.

## Client behavior

`knowledge-library-tier-installer-v1.mjs` mounts beside the existing Knowledge Schools controls. Expanded and Deep schools start **unchecked** and do not download without an explicit user action. The UI shows article counts and compressed byte totals before download.

`knowledge-library-tiers-v1.mjs` verifies every staged chunk against its catalog byte count and SHA-256 before saving it in the optional tier cache. `stageCumulative()` stages prerequisite layers first.

`knowledge-school-runtime-v243.mjs` continues to search Foundation and supplemental sources, then consults downloaded Expanded/Deep packs. Pack routing terms narrow a query to a small number of relevant chunks so a phone does not byte-scan an entire gigabyte-scale library for each learning request.

## Verification

`verify-knowledge-library-tiers-v1.mjs` protects:

- all 11 existing Foundation ZIPs and the exact 1,001-article Foundation total;
- Foundation/Expanded/Deep dependency and Vital-level contracts;
- the 24 MiB per-pack boundary;
- SHA-256 and byte counts for repository-hosted packs;
- HTTPS-only external payload URLs;
- per-school and per-layer article/byte totals;
- required compiler, membership, reconciliation, and client-runtime contracts.

The staging optional-knowledge workflow syntax-checks the browser modules and Python compilers and runs this verifier on every relevant `staging` push.
