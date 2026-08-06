# Civweave v1.0.14

## Render release-verifier repair

Cloudflare confirmed that the v1.0.13 canonical core-only startup works. Render then stopped during its build-time release verification with:

> Install boundary does not load the visible-version synchronizer.

That assertion described the retired startup architecture. The canonical Working Campus intentionally does not load the global visible-version runtime or any other legacy compatibility script. Its visible version is synchronized directly into the generated HTML before deployment.

v1.0.14 updates the release contract:

- legacy realm pages must retain `/app/release-version-v1.js` in their compatibility bundle
- the canonical Working Campus must retain `canonicalAutoScripts: 0`
- the verifier rejects reintroducing the old `RELEASE_VERSION_SCRIPT` boot path
- the boundary runtime version, exported version, and legacy bundle cache key all advance together
- the release synchronizer now updates all three boundary version surfaces on every future release

No runtime features are removed. The canonical campus remains core-only, while legacy pages keep their visible-version synchronization and compatibility bundle.
