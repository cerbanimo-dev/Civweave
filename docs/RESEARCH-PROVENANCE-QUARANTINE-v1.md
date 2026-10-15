# Research provenance and training-corpus quarantine (project B, v1)

## Purpose

Keep material originating *directly* from publisher-identified coordinated inauthentic behavior accounts and sites out of ordinary research source packets. Offer a non-destructive, reproducible way to inspect historical JSONL training corpora. This tool does **not** determine which opinions are true and does **not** remove data from pretrained model weights.

## Implemented in this patch

- `public/app/research-source-indicators-v1.mjs`: 22 exact source-identity indicators from [Meta's H2 2026 Russia-based Western-audiences investigation](https://github.com/facebook/threat-research/blob/main/indicators/meta-h2-2026-russia-cib-based-network-2.md) and [Meta's H2 2026 Europe/Middle East/Africa investigation](https://github.com/facebook/threat-research/blob/main/indicators/meta-h2-2026-russia-cib-based-network.md). Each entry retains the reporting organization, evidence URL, and a stable ID. **These are published network indicators, not an assertion that every page on the internet discussing them is disinformation.**
- `public/app/research-source-policy-v1.mjs`: deterministic exact identity/hostname and author-URL matching, a compact research-system-prompt rule, and filtering. No keyword, ideology, topic, country, quoted username, or network-neighbor guilt-by-association matching.
- Moss's **Living School** research path: policy appears in live agent research prompt and is enforced again on accepted opened URL outputs. The downloaded local knowledge-school path screens canonical source URLs before synthesis. Stored manual research sources are screened before inclusion in generated packets. Evidence and excluded-source counts are attached to the research state where available. Previously cached packets are invalidated by a policy revision bump.
- `scripts/scan-research-provenance-v1.mjs`: read JSONL locally and produce *retained*, *quarantined*, invalid-record and exact-text-duplicate candidate reports, with SHA-256s. This is quarantine, never deletion. The original records remain untouched.
- `scripts/test-research-source-provenance-v1.mjs`: tests for exact/alias matches, near-name collisions, independent reporting, quotations, and guilt-by-association.
  
## Run

```bash
node --test scripts/test-research-source-provenance-v1.mjs
node scripts/verify-living-school-selected-ai-research-fallback-v1.mjs
node scripts/scan-research-provenance-v1.mjs /path/to/corpus.jsonl /path/to/report-dir
```

Each input line should be a JSON object; the scanner recognizes `url`, `canonicalUrl`, `source_url`, `sourceUrl`, `articleUrl`, `permalink`, `authorUrl`, `author_url`, `creatorUrl`, `creator_url`, `accountUrl`, and `account_url`. Optional: `text`/`content`, `publishedAt`/`timestamp`, `id`/`document_id`. The output directory will contain `retained.jsonl`, `quarantined.jsonl`, `invalid-records.jsonl`, `lineage-candidates.json`, and `manifest.json`. **Do not commit personal or licensed corpus data to the repository.**

## Historical 2012–2018 IRA archive (separate from current-account source gate)

The new `scripts/ira-provenance-index-v1.py` lets you index the [FiveThirtyEight/Clemson archive](https://github.com/fivethirtyeight/russian-troll-tweets) offline, without bundling millions of historical posts into the phone app. Download the original `IRAhandle_tweets_*.csv` files yourself, then:

```bash
python scripts/ira-provenance-index-v1.py index --csv-dir /path/to/ira-csv --db /path/to/ira.sqlite
python scripts/ira-provenance-index-v1.py scan --db /path/to/ira.sqlite --jsonl /path/to/training.jsonl --out /path/to/ira-report
```

This uses stable **historical tweet IDs** to quarantine an originating post, and high-length **exact text duplicates** only as *review candidates*. A current account with an old username is **not** excluded simply for sharing the historical handle. Output remains local, with retained, review and quarantine files. It is a historical research aid, not a live username blacklist, and it does not imply that copies in independent reporting must be removed.

## Evidence rules and limits

1. Confirmed *source identity* means a named URL/handle/domain published in an independent platform's documented network investigation. It is not proof that every item ever published there is false or that a current username still belongs to the same operator. Revalidate handles when ownership could have changed.
2. The policy checks URL/author *metadata*, not incidental text. A journalist investigating the operation remains usable as an independent source. It does not forbid discussing or quoting the excluded material as the object of study.
3. A no-match result is **not verified trustworthy**. Missing URLs and uncertain attribution require continued ordinary fact-checking. Suspected accounts must be reviewed and corroborated, never automatically excluded based solely on a bot detector's score.
4. Model training leakage requires dataset-specific matching. A document's exact-text SHA-256 matches can suggest syndication or duplication, **not causal direction or origin**. Quotes and independent sources must be preserved appropriately.
5. It cannot scrub model weights. To change a model's training inputs, apply the reviewed exclusions to a *new* curated dataset before pretraining or fine-tuning. To improve present answers, enforce the retrieval/source policy.
6. Current enforcement is **Living School's Moss research path**, not every search provider or all five guides. Other research paths and ingestion points need their own deterministic gates, not only additional prompt wording.
7. Evaluation should compare baseline and filtered research on accuracy, source diversity, false exclusions and false inclusions, across political viewpoints and subject areas. Include a documented false-positive appeal and indicator expiry/reverification process before a large rollout.

## Expansion sources and governance

Candidate upstream sources for documented, multi-country influence-operation *indicators*, not automatic wholesale blacklists:

- [Meta's published IOC repository](https://github.com/facebook/threat-research) (specific account/domain entries only; check revisions and licenses).
- [X information-operations archives](https://blog.x.com/en_us/topics/company/2018/enabling-further-research-of-information-operations-on-twitter) (released historical account and tweet data, including hashed identifiers; interpret carefully).
- [FiveThirtyEight's 2018 IRA tweets dataset](https://github.com/fivethirtyeight/russian-troll-tweets) (historical posts for URL and content-level matching, not a current-account directory).
- [Reddit's 2018 IRA-linked suspicious account announcement](https://www.reddit.com/wiki/suspiciousaccounts/) (historical account list).
- [FineWeb dataset card](https://huggingface.co/datasets/HuggingFaceFW/fineweb) for URL-level training-corpus evaluation when that corpus is actually used.

Next: build a versioned reviewed-indicator import job (source URL + license + original observation date + identifier stability + reviewer), a content lineage graph with context-aware quotation/republishing labels, and a cross-realm ingest gate before any local knowledge-school archive or retrieval index is accepted. Keep a small **policy summary** in prompts; the large blacklist belongs in deterministic code or a local index, never in a token-heavy system prompt.
