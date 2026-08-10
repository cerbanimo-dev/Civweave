# Civweave v1.0.9

## Release version synchronization

- Advances the canonical Civweave release from 1.0.8 to 1.0.9.
- Updates the public installer, manifest, stable app entry, installed entry, app-shell worker, gateway runtime, local runtime, and Working Campus version display from one canonical `VERSION` source.
- Adds a build/start synchronization pass so release assets cannot remain on an older visible version after `package.json` and `VERSION` are bumped.
- Adds a visible-version runtime that reads the installed manifest and corrects version badges and page titles on cached campus pages.
- Preserves independent component and model-package revision identifiers instead of rewriting them as application release numbers.

This release includes the Living School research-first curriculum work from v1.0.8 and the Render verifier correction from PR #183.
