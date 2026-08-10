# Civweave total rename

This migration replaces the former platform identifier throughout tracked source, configuration, documentation, tests, and GitHub Actions. Tracked paths were renamed in the same pass, so imports and verification references move together.

- Release: 1.0.17
- Text files changed: 564
- Text replacements: 5860
- Tracked paths renamed: 122

## Canonical asset collisions

Where an older image path mapped onto an already-present Civweave asset, the Civweave asset won and the older duplicate was removed.

- None

## External deployment names

Repository code now uses Civweave for Worker and Pages configuration values, workflow labels, and check names. Existing Cloudflare dashboard service/project records are external resources and must be renamed or recreated in Cloudflare separately.
