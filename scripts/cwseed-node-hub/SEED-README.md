# Civweave portable seed

This `.cwseed` is a ZIP-compatible carrier with two payloads:

- `mobile/`: the compact Civweave Mobile Install Kit and checksum
- `node-hub/`: a dependency-free Node 20+ host, relay, presence, and release hub

It intentionally does not duplicate the full visual application, retired room
trees, cabinet marketing or calibration art, or local model graphs. The mobile
kit hydrates the current service-worker core from the selected release node.
MiniLM remains device-side and opt-in.

## Start the node hub

```sh
cd node-hub
npm start
```

Then open `http://localhost:8787`.

## Deploy to Render

Commit the extracted `civweave-seed/` directory as a repository root and use
the included top-level `render.yaml`. The service runs from `node-hub/` while
serving the sibling mobile installer.
