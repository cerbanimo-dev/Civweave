# Civweave Open Learning Media Seed v1

This directory contains the metadata-first, rights-gated seed for Civweave's outage-ready learning media mesh.

## Sources

- Wikimedia Commons
- federated PeerTube discovery via Sepia Search, revalidated against each origin instance
- Internet Archive items with explicit supported license metadata

No audiovisual binaries are committed to this repository. `files` entries are cache candidates. A Civweave node should compute SHA-256 when it actually stores a permitted media binary locally.

## Default mesh license allowlist

- Public Domain
- CC0
- CC BY
- CC BY-SA

NC, ND, unknown, custom, and all-rights-reserved material is excluded from the default redistributable pool. Provider license declarations are recorded as provenance evidence; they are not a warranty that an uploader had every underlying right.

## Selection pipeline

1. **Harvest** discovers candidates and verifies provider license/download metadata.
2. **Relevance gate** requires independent topical evidence in title/description; provider search rank does not count as evidence.
3. **Pedagogy gate** requires a strong conceptual anchor and rejects weak/clickbait description-only matches.
4. **Automatic-selection gate** requires either a strong topic anchor in the title or a strong description anchor paired with an instructional title.

The first focused seed intentionally prioritizes precision over volume for:

- vibe coding
- prompt engineering
- pseudocoding and algorithm design
- critical thinking and media literacy
- logical frameworks, reasoning, decision frameworks, and systems thinking

See `summary.json` for current counts and top titles, `catalog.json` for full records, `lookup.json` for runtime lookup, and the audit JSON files for each filtering stage.
