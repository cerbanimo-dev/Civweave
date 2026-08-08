# Civweave Cloudflare Pages Node Install Guide

This guide installs and publishes the current Civweave static node to Cloudflare Pages.

## Current deployment shape

```text
Repository: cerbanimo-dev/Civweave
Production branch: main
Pages project: commonweave
Stable production URL: https://commonweave.pages.dev
Hosted source: public/
Generated Pages output: .cloudflare-pages/
Health endpoint: /api/health
```

**Important infrastructure naming:** the product is Civweave, but the existing Cloudflare Pages project remains named `commonweave`. Keep that project identifier and origin stable. A Pages project rename or a new `civweave` project would create a different web origin and would not update PWAs installed from `commonweave.pages.dev`.

**Install only from the stable production origin.** Do not install Civweave as a PWA from a hashed Pages preview such as `https://<deployment>.commonweave.pages.dev`. Cloudflare preview deployments are immutable snapshots. A PWA installed from one stays bound to that preview origin and cannot receive future `main` releases from `commonweave.pages.dev`.

The build copies the complete `public/` tree, prepares required generated files, audits every hosted asset, and writes a fresh `.cloudflare-pages/` directory. Do not edit `.cloudflare-pages/` directly.

Cloudflare Pages allows individual static assets up to 25 MiB. Civweave enforces a 24 MiB project boundary so deployments fail locally with a complete file list before Wrangler begins uploading.

Official references:

- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Wrangler Pages commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/)

## Requirements

Install these first:

- Git
- Node.js 20 or newer
- npm
- A Cloudflare account with permission to deploy the existing `commonweave` Pages project

The build is cross-platform. Windows uses PowerShell's built-in archive support. macOS and Linux use the system `zip` command.

## Fresh installation

```bash
git clone https://github.com/cerbanimo-dev/Civweave.git
cd Civweave
npm install
npm install --save-dev wrangler
npx wrangler login
npx wrangler whoami
```

## Recommended one-command setup

Run:

```bash
node scripts/setup-cloudflare-node.mjs
```

The setup helper:

1. detects the local Wrangler installation;
2. confirms Cloudflare authentication;
3. reuses the stable `commonweave` Pages project by default;
4. builds the complete Pages output;
5. audits all hosted assets against the 24 MiB project boundary;
6. deploys the `main` production branch.

A different existing Pages project can still be selected explicitly for deliberate testing:

```bash
node scripts/setup-cloudflare-node.mjs YOUR_PROJECT_NAME
```

Do not use a temporary/preview project as the install origin for end users.

## Manual build and deployment

### 1. Audit hosted source

```bash
node scripts/audit-cloudflare-assets.mjs
```

### 2. Build Pages output

```bash
node scripts/build-cloudflare-pages.mjs
```

A successful build ends with:

```text
All Cloudflare-hosted files are at or below 24 MiB.
```

### 3. Deploy production

```bash
npx wrangler pages deploy .cloudflare-pages --project-name commonweave --branch main --commit-dirty=true
```

## Cloudflare dashboard settings

For the Git-connected Pages project, use:

```text
Project name: commonweave
Repository: cerbanimo-dev/Civweave
Production branch: main
Build command: node scripts/build-cloudflare-pages.mjs
Build output directory: .cloudflare-pages
Root directory: /
```

The repository's root `wrangler.jsonc` intentionally retains `commonweave` as the Cloudflare infrastructure project name while the application itself is branded Civweave.

## Publishing an update

```bash
git pull --ff-only origin main
npm install
node scripts/build-cloudflare-pages.mjs
npx wrangler pages deploy .cloudflare-pages --project-name commonweave --branch main --commit-dirty=true
```

After deployment, verify the **stable production origin**:

```text
https://commonweave.pages.dev/
https://commonweave.pages.dev/app/manifest.webmanifest
https://commonweave.pages.dev/app/installed-entry-v146.js
https://commonweave.pages.dev/service-worker-v203.js
https://commonweave.pages.dev/api/health
```

Do not use a hashed preview hostname for production verification or PWA installation.

## Local Pages preview

```bash
node scripts/build-cloudflare-pages.mjs
npx wrangler pages dev .cloudflare-pages
```

Wrangler normally serves the local Pages preview on port `8788`.

## Safe working rules

- Treat `public/` as the hosted source of truth.
- Treat `.cloudflare-pages/` as generated output.
- Pull from `origin/main` before publishing.
- Keep `commonweave` as the production Pages project identifier unless intentionally performing a full-origin migration.
- Never tell end users to install from a hashed `*.commonweave.pages.dev` preview deployment.
- Do not force-reset a working folder that contains uncommitted assets.
- Keep every hosted file below the repository's 24 MiB boundary.
- Never commit Cloudflare credentials or API tokens.

## Common failures

### `civweave.pages.dev` does not resolve

That is not the production Pages origin. Use:

```text
https://commonweave.pages.dev
```

### A hashed preview still serves an old version

That is expected for an immutable preview deployment. If a PWA was installed from that preview origin, uninstall that PWA and reinstall from the stable production origin `https://commonweave.pages.dev`.

### Wrangler is missing

```bash
npm install --save-dev wrangler
```

### Cloudflare authentication is missing or belongs to the wrong account

```bash
npx wrangler login
npx wrangler whoami
```

### The build reports oversized assets

```bash
node scripts/audit-cloudflare-assets.mjs
node scripts/build-cloudflare-pages.mjs
```

### The build reports a missing required file

```bash
git pull --ff-only origin main
npm install
node scripts/build-cloudflare-pages.mjs
```

### The local checkout is no longer connected to GitHub

Clone a fresh connected copy beside it rather than overwriting local work:

```bash
git clone https://github.com/cerbanimo-dev/Civweave.git civweave-connected
cd civweave-connected
git remote -v
git branch --show-current
```

The expected remote is `https://github.com/cerbanimo-dev/Civweave.git` and the production branch is `main`.
