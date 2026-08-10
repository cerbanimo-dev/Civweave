# Civweave Host Node Hub v1.0.5

- Sets the default public host node to `https://civweave-host-node.onrender.com`.
- Adds `/api/releases/current` for stable release metadata.
- Adds server-sent `release` broadcasts to every connected client.
- Adds `/api/releases/broadcast` to rebroadcast the currently deployed release.
- Connected PWAs check periodically and show a non-blocking update banner when the host build, app version, or install-kit hash changes.
- Registration, health, and configuration responses now include release metadata.
