# RC22.2.6 — minimization and optimization pass

- Converted 55 large opaque scene/background PNG files to high-quality WebP while preserving dimensions and visual routing.
- Converted four large transparent platform logos to lossless WebP.
- Removed an unused Anarchadia source-art directory that was never referenced at runtime.
- Removed exact duplicate artwork where a canonical copy already existed.
- Slimmed the outer mobile install kit to one canonical code payload (`.cwseed`) instead of shipping the same project twice.
- Regenerated the seed manifest and cache generations after asset-path changes.

No feature, route, visual room, fallback, or offline entry point was intentionally removed.
