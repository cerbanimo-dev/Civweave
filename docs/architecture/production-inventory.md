# Civweave production inventory

**Status: RE-AUDIT REQUIRED BEFORE MERGE.**

The previous draft incorrectly reconstructed the retired Visual/Spatial mode into a new simplified sitemap. That assumption is withdrawn.

## Current interface direction

Civweave is not using the retired full-screen Visual/Spatial mode as its canonical interface. Recent history explicitly restored flat application content without introducing spatial mode, and later work removed runtime visual-asset repair and post-paint presentation repair. The active product direction is responsive HTML/application UI enhanced by intentional imagery and game-like character, not a separate world-map/spatial renderer.

This inventory must be rebuilt from the newest actively exercised application files on `main`, cross-checked against the newest twenty commits, before destructive cleanup resumes.

## Audit rules

1. Start from `main`, not from ancestral cabinet/world/spatial directories.
2. Identify screens by recent execution/reference and recent commit activity, not by old route names.
3. Treat old `visual`, `world`, `spatial`, `cabinet`, `room`, and `working-campus` naming as historical evidence only unless the current active dependency graph proves the file is still required.
4. Preserve ordinary HTML/CSS/JS screens currently being tested and iterated on, including their intentionally referenced images.
5. Delete versioned repair/injector/hardening/orchestrator layers after extracting any genuinely reusable Merlin user-customization behavior.
6. Keep only images referenced by the resulting current code/manifest.
7. Git history is the archive. Do not keep source snapshots, release-source trees, `.seed`, `.cwseed`, source ZIPs, hash-selected code, or runtime source restoration.
8. The final report must list the actual sitemap and every production/build/runtime file with purpose, caller, execution time, and reason kept.

## Historical evidence that must not be misread again

- Commit `b2f714cf51be695cf447c5e24340713b5dbb6867` restored the flat Living School interface **without introducing spatial mode**.
- Commit `7c6b3f312cdc872a516b6e4d63a50c5bc12c052d` retired runtime canonical visual asset repair.
- Commit `15412f6e04f32816e98873b71e66b5884998552b` eradicated post-paint static presentation repair.

The final inventory replaces this re-audit marker only after the active dependency graph has been reconstructed from current `main`.
