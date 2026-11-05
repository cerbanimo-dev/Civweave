# Loom Parcels — tiny, lossless source snapshots

The canonical encrypted ABBA Node Host backup remains at lib/node-reconstruction-backup-v1.mjs. This tool has a different purpose: public GitHub source distribution as small, verifiable **binary** parcels. It does not export personal memory, private chat logs, credentials, user device state, or model weights from untracked storage.

## Format

- loom-seed.json: tiny human-readable bootstrap (source commit, tier, manifest SHA-256).
- manifest.json.br: Brotli-compressed inventory of exact file paths, sizes, modes, SHA-256 hashes and chunk references.
- loom-restore.mjs: an **uncompressed self-contained decoder** shipped with each kit, so restoring never depends on fetching the original repository.
- parts/<sha256>.lmp: independently verifiable binary chunks, each **at most 64, 128 or 256 KiB**. Brotli is used only when the compressed chunk is smaller; exact duplicate chunks are deduplicated.

A seed or hash alone cannot recreate missing information. For actual reconstruction, retain the entire manifest **and all referenced parcels**. Checksums detect damage but are not digital signatures or proof of authorship.

## Tiers

- **seed**: tiny documentation, architecture contract, and existing ABBA backup code needed to understand recovery. This is not a runnable app.
- **source**: tracked text and source code, excluding binary media, model weights, selected generated areas, and known sensitive-name paths. This is not a runnable app.
- **full**: all eligible tracked files, including images and libraries, except sensitive-name paths. This is not a clone of Git history and is not a personal memory backup.

The current Git repository snapshot is distinct from Git history. Keep a separate git clone --mirror for commits, branches and earlier versions.

## Commands

Node 22+ and Git are required to pack. Restoring needs only Node 22+ and the packer script.

~~~sh
node scripts/loom-parcel.mjs pack --root . --out ../loom-seed --tier seed --chunk-kib 64
node ../loom-seed/loom-restore.mjs verify --out ../loom-seed
node ../loom-seed/loom-restore.mjs restore --out ../loom-seed --into ../loom-restored
~~~

For broader code distribution:

~~~sh
node scripts/loom-parcel.mjs pack --root . --out ../loom-source --tier source --chunk-kib 128
~~~

Use a new empty output directory and a new empty restore directory. Restore performs full integrity verification before writing and refuses to overwrite an existing destination. Keep all parts alongside the seed and manifest; .lmp files are raw data, not executables.

## GitHub CI, downloads and retention

The .github/workflows/loom-parcels.yml CI test packages a small seed on staging pushes or PRs. On the default branch, **Actions → Loom Tiny Parcels → Run workflow** permits seed, source, or full at 64/128/256-KiB parcel sizes. The downloadable Actions artifact is an *outer ZIP*, so extract it to access each little binary .lmp part. This is a packaging feature, not a current claim of a published release.

Actions artifacts expire after 30 days. They are not a long-term archive. Export the parcels to independent storage and periodically verify an offline restore. The Internet Archive's Wayback Machine can help recover some **public** pages, but it cannot be relied upon as a complete repository or private memory backup.

## Private continuity and story canon

Keep lore, author notes, character engine configurations, consensually exported personal/Quest histories, and any private chat archives in separate, access-controlled storage. For authorized private Node Host records use the existing ABBA encrypted backup system and established permissions; do not publish private datasets in a public repository or CI artifact.

The Loom's fictional pattern reconstruction is distinct from software recovery. This implementation can exactly restore recorded **files**, not a person, consciousness, or memories that were never saved.
