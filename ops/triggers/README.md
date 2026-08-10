# Workflow triggers

This folder owns deliberate repository sentinel files used by GitHub Actions path filters and materialization workflows.

Rules:

- Use a descriptive `*.trigger` filename.
- Point workflow `paths:` filters here instead of creating hidden files at repository root.
- Treat trigger contents as human-readable breadcrumbs, not state storage.
- If a trigger is renamed, update every workflow path filter in the same commit.
- Do not create versioned root dotfiles for one-off automation nudges.

The root-hygiene verifier enforces this boundary.
