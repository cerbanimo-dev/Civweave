# Commonweave Host Node Hub v1.0.9

- Enforces the cardinal visual contract across the host gateway and all five realms.
- Makes supplied artwork the visible application surface with invisible semantic hotspots.
- Removes user-facing classic and legacy launch paths.
- Hosts existing workflows in illustrated projections rather than exposing browser-style shells.
- Repairs Anarchadia IndexedDB upgrades and wires all supplied FellowFare mall scenes.
- Bundles Commonweave RC22.3.9 and updated offline caches.

# Commonweave Host Node Hub v1.0.2

- Bundles Commonweave RC22.3.2 with restored Weaveling guided intention stewardship.
- Keeps the Antigravity host-node proxy and install workflow from v1.0.1.
- Refreshes the downloadable offline install kit and application service-worker generation.

# Commonweave Host Node Hub 1.0.0

- Hosts the complete RC22.3.1 Commonweave Pocket Campus at `/app/`.
- Provides a minimal installation landing page and an in-PWA guided setup dialog.
- Registers stable browser node IDs and stores the selected host-node connection locally.
- Adds host APIs for health, node registration, heartbeat, presence, relay envelopes, acknowledgements, and SSE notices.
- Includes a downloadable offline mobile install ZIP.
- Runs with Node.js built-ins only, locally, in Docker, or as a Render Web Service.
- Includes an optional `HUB_TOKEN` boundary and JSON persistence adapter.

## v1.0.1 Antigravity proxy hotfix

- Routes browser Antigravity Interactions API calls through the same-origin host node to avoid browser CORS failures.
- The Gemini API key is forwarded per request and is never persisted by the host node.
- Adds GET polling and DELETE support for interaction resources.
- Adds a favicon redirect to remove the harmless 404.
- Keeps direct calls only for non-hosted/file deployments where no host-node proxy exists.
