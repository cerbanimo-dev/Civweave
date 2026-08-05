# Commonweave Knowledge Schools

These are optional offline reference seeds for Living School and local Commonweave nodes. They are deliberately excluded from the core service-worker cache. The installer can stage any selected ZIP in a separate checksum-verified browser cache, while node operators can download and unpack the same schools directly.

## Included schools

People and Lives, History, Geography, Arts, Everyday Life, Philosophy and Religion, Society and Social Sciences, Health/Medicine/Disease, Science, Technology, and Mathematics.

The complete set contains 1,001 foundational articles. Every school includes its own SQLite database, section-level FTS index, source provenance, citations, links, rights information, and manifest.

## Node or desktop installation

Download this script and run:

```bash
python batch_unpack_schools.py \
  --base-url https://commonweave-host-node.onrender.com/downloads/knowledge-schools/ \
  --schools complete-foundations \
  --destination ./knowledge-schools
```

Available batches:

- `human-worlds`
- `making-and-measuring`
- `complete-foundations`
- `all`

You can also pass comma-separated school slugs, such as `science,technology,mathematics`.

## Browser staging

The Commonweave installer shows every school selected by default, but it downloads nothing without an explicit tap. Each selected ZIP is verified against `catalog.json` with SHA-256 and stored in `commonweave-knowledge-schools-v1`, outside the core PWA cache. The compressed seeds can be unpacked by a later Living School runtime without forcing every installation to carry the full library.

## Licensing and provenance

Each school ZIP contains its own `RIGHTS.md`, source manifest, revision IDs, canonical URLs, and source hashes. Wikipedia-derived text remains subject to the licenses recorded in those files.
