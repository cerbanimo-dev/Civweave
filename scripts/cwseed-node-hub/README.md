# Civweave portable node hub

This dependency-free Node 20+ hub serves the mobile install kit from the sibling
`../mobile/` directory and provides the current lightweight host-node surfaces:

- health and configuration
- release metadata and server-sent release events
- node registration and heartbeat
- bounded relay envelopes and acknowledgements
- presence
- session-key-only Gemini Interactions proxy

It does not host MiniLM or become the canonical database. Device data remains
local-first and only explicitly submitted relay records are stored here.

## Run locally

```sh
npm start
```

Open `http://localhost:8787`.

Optional environment variables:

```text
PORT=8787
HOST=0.0.0.0
HUB_NAME=My Civweave Node
HUB_TOKEN=a-long-random-secret
DATA_DIR=/durable/path
MAX_ENVELOPES=5000
```

The hub expects the seed directory structure to remain intact because the mobile
kit lives at `../mobile/Civweave-Mobile-Install-Kit.zip`.

## Render

Commit the extracted `civweave-seed/` directory as a repository root. Its
top-level `render.yaml` starts this folder while preserving access to `../mobile/`.
