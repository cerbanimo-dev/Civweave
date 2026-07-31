# Host Node v1.0.7 — update banner state hotfix

- Treats the currently running app and host build as installed, immediately clearing stale update banners.
- Records a release as seen when the user opens either update path, not only when pressing Later.
- Removes stale banner markup and styles once the current release is detected.
- Bumps the PWA cache generation so installed clients receive the corrected release-state logic.
