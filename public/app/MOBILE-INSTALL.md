# Install Commonweave on Android

The **Commonweave Mobile Install Kit** is now a small, reproducible bootstrap bundle for the current five-system software package. It no longer carries forward an old Pocket Campus archive and swaps a new seed into it.

The kit downloads exactly the files declared by the current service worker plus the active shared extensions. It excludes retired room-scene trees, cabinet marketing/calibration artwork, duplicate legacy runtimes, and optional MiniLM ONNX graphs. The local model remains available on demand after the core application is installed.

## Install with Termux

1. Download `Commonweave-Mobile-Install-Kit.zip` from the current Commonweave node.
2. Install a maintained Termux build.
3. Run:

```sh
termux-setup-storage
pkg update
pkg install -y python curl unzip
cd ~/storage/downloads
unzip -o Commonweave-Mobile-Install-Kit.zip
cd commonweave-mobile-install-kit
bash install-mobile.sh
```

The installer downloads the current core package, validates that its allowlist still matches the live service worker, replaces the previous local application files atomically, and starts a loopback-only server.

Open:

```text
http://127.0.0.1:8790/app/installed-entry-v146.html
```

Use the browser menu to choose **Install app** or **Add to Home screen**.

## Update without deleting local data

Download the newest kit and run `bash install-mobile.sh` again. Do not uninstall the PWA or clear browser storage first. The application files are refreshed while IndexedDB and localStorage remain in the browser profile.

## Start and stop later

```sh
bash "$PREFIX/var/lib/commonweave/start-commonweave.sh"
bash "$PREFIX/var/lib/commonweave/stop-commonweave.sh"
```

## Alternate node or port

```sh
COMMONWEAVE_SOURCE_URL=https://your-node.example \
COMMONWEAVE_PORT=8791 \
bash install-mobile.sh
```

The application server binds only to `127.0.0.1`. Narrow `/api/` requests can be relayed to the selected source node, and optional model files are mirrored locally only after the user enables them.

## Release boundary

`scripts/build-mobile-install-kit.mjs` derives the mobile core from `public/service-worker.js` and active extension loaders, writes checksummed manifests, rebuilds the portable seed, and rebuilds the mobile kit from clean templates. Both downloadable artifacts must remain below a 24 MiB safety boundary so they can be deployed to hosts with a 25 MiB per-asset limit.
