# Civweave Mobile Install Kit

This kit installs the current five-system Civweave software package on Android through Termux. It is intentionally a small bootstrap bundle: it downloads only the core files declared by the live service worker, then serves them from a private loopback address.

It does **not** include retired room-scene trees, cabinet marketing artwork, duplicate legacy runtimes, or the optional MiniLM ONNX graphs. Model files download only after you explicitly enable the local model.

## Install on Android

1. Install a maintained Termux build.
2. In Termux, run:

```sh
termux-setup-storage
pkg update
pkg install -y python curl unzip
cd ~/storage/downloads
unzip -o Civweave-Mobile-Install-Kit.zip
cd civweave-mobile-install-kit
bash install-mobile.sh
```

Civweave opens at `http://127.0.0.1:8790/app/installed-entry-v146.html`. Use the browser menu to install it to the home screen.

## Update

Download the newest kit and rerun `bash install-mobile.sh`. The installer replaces application files atomically and leaves browser-local Civweave data intact.

## Alternate source or port

```sh
CIVWEAVE_SOURCE_URL=https://your-node.example \
CIVWEAVE_PORT=8791 \
bash install-mobile.sh
```

Start later:

```sh
bash "$PREFIX/var/lib/civweave/start-civweave.sh"
```

Stop:

```sh
bash "$PREFIX/var/lib/civweave/stop-civweave.sh"
```
