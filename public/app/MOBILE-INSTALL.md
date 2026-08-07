# Install Civweave on Android

The **Civweave Mobile Install Kit** is a small, reproducible bootstrap bundle
for the current five-system software package. It downloads exactly the files
declared by the current service worker plus the active shared extensions.

It excludes retired room-scene trees, cabinet marketing and calibration artwork,
duplicate legacy runtimes, and optional MiniLM ONNX graphs. The local model
remains device-side and downloads only after the user enables it.

## Install with Termux

1. Download `Civweave-Mobile-Install-Kit.zip` from the current Civweave node.
2. Install a maintained Termux build.
3. Run:

```sh
termux-setup-storage
pkg update
pkg install -y python curl unzip
cd ~/storage/downloads
unzip -o Civweave-Mobile-Install-Kit.zip
cd civweave-mobile-install-kit
bash install-mobile.sh
```

The installer downloads the current core package, validates that its allowlist
still matches the live service worker, replaces the previous local application
files atomically, and starts a loopback-only server.

Open:

```text
http://127.0.0.1:8790/app/installed-entry-v146.html
```

Use the browser menu to choose **Install app** or **Add to Home screen**.

## Portable `.cwseed`

`civweave-pocket-campus.cwseed` is now a compact ZIP-compatible carrier rather
than a second copy of the full application. It contains:

- the current mobile install kit and SHA-256 checksum
- a dependency-free Node 20+ host node
- Render configuration and a seed manifest

The node hub serves the bundled mobile installer and provides health/config,
release broadcasts, node registration, heartbeat, presence, relay envelopes,
and the session-key-only Gemini Interactions proxy. It never hosts MiniLM and is
not the canonical data store.

After extracting the seed:

```sh
cd civweave-seed/node-hub
npm start
```

Open `http://localhost:8787`.

## Update without deleting local data

Download the newest kit and run `bash install-mobile.sh` again. Do not uninstall
the PWA or clear browser storage first. Application files refresh while IndexedDB
and localStorage remain in the browser profile.

## Start and stop later

```sh
bash "$PREFIX/var/lib/civweave/start-civweave.sh"
bash "$PREFIX/var/lib/civweave/stop-civweave.sh"
```

## Alternate node or port

```sh
CIVWEAVE_SOURCE_URL=https://your-node.example \
CIVWEAVE_PORT=8791 \
bash install-mobile.sh
```

The application server binds only to `127.0.0.1`. Narrow `/api/` requests can be
relayed to the selected source node, and optional model files are mirrored locally
only after the user enables them.

## Release boundary

`scripts/build-mobile-install-kit.mjs` derives the mobile hydration allowlist,
rebuilds the mobile kit from clean templates, then packs that kit with the
portable node hub into the `.cwseed`. Both downloadable artifacts must remain
below the 24 MiB safety boundary used for hosts with a 25 MiB per-asset limit.
