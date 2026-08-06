# Convergence pull request checklist

Copy this checklist into convergence pull requests.

## Ownership

- [ ] Name the single runtime owner retained or introduced.
- [ ] Name every duplicate owner removed.
- [ ] Confirm no new version-suffixed runtime boundary was created.
- [ ] Confirm canonical realm code lives under `public/app/realms/<realm>/`, or explain the temporary Living School clean-room exception.

## State and compatibility

- [ ] Identify every preserved storage key and schema.
- [ ] Describe migration behavior.
- [ ] Declare the compatibility window.
- [ ] Confirm canonical runtimes do not contain compatibility choreography.

## Deletion

- [ ] List retired runtime files.
- [ ] Report runtime lines added and deleted.
- [ ] Meet or explain any exception to the 2:1 deleted-to-added runtime-line target.
- [ ] Confirm Git history, not executable source, is serving as the archive.

## Verification

- [ ] Run `node scripts/build-convergence-inventory.mjs`.
- [ ] Run `node scripts/verify-convergence-guardrails.mjs`.
- [ ] Run the narrow domain verifier.
- [ ] Exercise the affected installed golden-path steps.
- [ ] Exercise offline reload and supported state migration.

## Result

- Single owner:
- Duplicate owners deleted:
- State preserved:
- Compatibility expires:
- Golden-path evidence:
