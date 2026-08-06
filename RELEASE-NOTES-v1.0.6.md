# Commonweave Host Node Hub v1.0.7

- Adds a canonical hosted campus seed at `/downloads/commonweave-pocket-campus.cwseed`.
- Preserves `/field/commonweave/seed` as a compatibility alias.
- Removes duplicate service-worker precache requests that prevented installation.
- Forces the official Render host to HTTPS and respects `X-Forwarded-Proto` when generating update links.
- Bumps the PWA cache generation so broken workers are replaced.
