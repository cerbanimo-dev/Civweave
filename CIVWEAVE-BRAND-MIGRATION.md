# Civweave brand migration

The public platform brand is now **Civweave**.

## Canonical identity assets

- Full transparent logo and wordmark: `public/app/logos/civweave.svg`
- Transparent woven-heart symbol: `public/app/logos/civweave-symbol.svg`
- Shared public branding layer: `public/app/civweave-brand.js`

The installer, app entry, PWA metadata, package metadata, repository README, and active installed surfaces now present the Civweave name and logo.

## Compatibility boundary

Lowercase runtime namespaces, cache names, storage keys, JavaScript globals, route names, and legacy asset filenames remain available as compatibility contracts. Renaming them in the same release could orphan installed data or divide mixed-version offline packages. They are implementation identifiers, not the public product name.

## Repository settings step

After this pull request is merged, rename the GitHub repository from `Commonweave` to `Civweave` in **Settings → General → Repository name**. External deployment project names and custom domains should then be reviewed separately.
