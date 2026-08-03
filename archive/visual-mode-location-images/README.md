# Visual-mode location image archive

Commonweave v1.0.31 now calls the image-framed workstation experience **Cabinet Mode**.

The older per-room illustrated location scenes are retained in the source repository as design history, but they are not part of the current downloadable seed, mobile install kit, service-worker precache, or normal runtime navigation. The Commonweave main hub scene remains active, as do all five cabinet shell images.

## Source-side archive roots

- `public/app/services/living-school/visual-assets/`
- `public/app/services/cerbanimo/assets/visual/`
- `public/app/services/fellowfare/assets/mall/`
- `public/app/services/anarchadia/assets/screens/`

These binary trees stay in their existing source paths so Git history and prior design references remain intact. `scripts/build-install-artifacts.sh` is the release boundary that excludes them from Cabinet Mode downloads.

## Assets that still ship

- `public/app/assets/world/town-square-home.webp`
- `public/app/assets/cabinets/commonweave.webp`
- `public/app/assets/cabinets/living-school.webp`
- `public/app/assets/cabinets/cerbanimo.webp`
- `public/app/assets/cabinets/fellowfare.webp`
- `public/app/assets/cabinets/anarchadia.webp`

Legacy visual URLs redirect into `/app/cabinet-mode-v142.html` without loading a room scene first.
