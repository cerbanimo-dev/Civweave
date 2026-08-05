# Commonweave v1.0.7

- Caps the five themed system-navigation buttons at 200 × 100 pixels so wider screens stop enlarging or clipping them.
- Centers the five-button rail on wide displays and preserves proportional shrinking on smaller devices.
- Keeps the selected-system glow without scaling the artwork outside its slot.
- Aligns package, hosted-gateway, local-runtime, PWA-manifest, installer display, and active family-surface metadata with v1.0.7.
- Treats the currently running app and host build as installed, immediately clearing stale update banners.
- Records a release as seen when the user opens either update path, not only when pressing Later.
- Removes stale banner markup and styles once the current release is detected.
- Preserves stable versioned filenames and component compatibility markers as required by `AGENTS.md`.