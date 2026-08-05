# Commonweave Cloudflare Pages Node Install Guide

This guide installs and publishes the current Commonweave static node to Cloudflare Pages.

## Current deployment shape

```text
Repository: cerbanimo-dev/Commonweave
Production branch: main
Pages project: commonweave
Production URL: https://commonweave.pages.dev
Hosted source: public/
Generated Pages output: .cloudflare-pages/
Health endpoint: /api/health
```

The build copies the complete `public/` tree, prepares required generated files, audits every hosted asset, and writes a fresh `.cloudflare-pages/` directory. Do not edit `.cloudflare-pages/` directly.

Cloudflare Pages allows individual static assets up to 25 MiB. Commonweave enforces a 24 MiB project boundary so deployments fail locally with a complete file list before Wrangler begins uploading.

Official references:

- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Wrangler Pages commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/)

## Requirements

Install these first:

- Git
- Node.js 20 or newer
- npm
- A Cloudflare account with permission to create or deploy the `commonweave` Pages project

The build is cross-platform. Windows uses PowerShell's built-in archive support. macOS and Linux use the system `zip` command.

## Fresh installation

Clone the connected repository and enter it:

```bash
git clone https://github.com/cerbanimo-dev/Commonweave.git
cd Commonweave
```

Install dependencies:

```bash
npm install
```

Install Wrangler locally if it is not already present:

```bash
npm install --save-dev wrangler
```

Authenticate with Cloudflare:

```bash
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
3. reuses or creates the `commonweave` Pages project;
4. builds the complete Pages output;
5. audits all hosted assets against the 24 MiB project boundary;
6. deploys the `main` production branch.

A different existing Pages project can be selected explicitly:

```bash
node scripts/setup-cloudflare-node.mjs YOUR_PROJECT_NAME
```

## Manual build and deployment

Use the manual path when you want to inspect each stage.

### 1. Audit the hosted source

```bash
node scripts/audit-cloudflare-assets.mjs
```

This recursively scans `public/`, reports every file above 24 MiB, and separately lists files between 20 and 24 MiB.

### 2. Build the Pages output

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

Wrangler's Pages deployment command uploads the specified static directory and accepts both `--project-name` and `--branch`.

## Cloudflare dashboard settings

For a Git-connected Pages project, use:

```text
Repository: cerbanimo-dev/Commonweave
Production branch: main
Build command: node scripts/build-cloudflare-pages.mjs
Build output directory: .cloudflare-pages
Root directory: /
```

The repository's root `wrangler.jsonc` identifies the project as `commonweave` and points Pages at `.cloudflare-pages`.

## Publishing an update

From the connected repository:

```bash
git pull --ff-only origin main
npm install
node scripts/build-cloudflare-pages.mjs
npx wrangler pages deploy .cloudflare-pages --project-name commonweave --branch main --commit-dirty=true
```

Run the standalone audit first when adding or replacing large binary assets:

```bash
node scripts/audit-cloudflare-assets.mjs
```

## Local Pages preview

Build first, then serve the exact generated output:

```bash
node scripts/build-cloudflare-pages.mjs
npx wrangler pages dev .cloudflare-pages
```

Wrangler normally serves the local Pages preview on port `8788`.

## Production verification

After deployment, check:

```text
https://commonweave.pages.dev/
https://commonweave.pages.dev/api/health
```

PowerShell verification:

```powershell
Invoke-WebRequest https://commonweave.pages.dev/ -UseBasicParsing
Invoke-RestMethod https://commonweave.pages.dev/api/health
```

Expected health behavior:

- HTTP status `200`
- JSON response
- `ok` is `true`
- service identifies the Commonweave Cloudflare Pages node

## Safe working rules

- Treat `public/` as the hosted source of truth.
- Treat `.cloudflare-pages/` as generated output.
- Pull from `origin/main` before publishing.
- Do not force-reset a working folder that contains uncommitted assets.
- Keep every hosted file below the repository's 24 MiB boundary.
- Never commit Cloudflare credentials or API tokens.

## Common failures

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

The builder prints the complete list. Replace, optimize, or split every listed file, then rerun:

```bash
node scripts/audit-cloudflare-assets.mjs
node scripts/build-cloudflare-pages.mjs
```

### The build reports a missing required file

Update the checkout and reinstall dependencies before rebuilding:

```bash
git pull --ff-only origin main
npm install
node scripts/build-cloudflare-pages.mjs
```

### The local checkout is no longer connected to GitHub

Do not overwrite the folder containing local work. Clone a fresh connected copy beside it, then copy only the intended local changes into the clean clone:

```bash
git clone https://github.com/cerbanimo-dev/Commonweave.git commonweave-connected
cd commonweave-connected
```

Confirm the connection before deploying:

```bash
git remote -v
git branch --show-current
```

The expected remote is `https://github.com/cerbanimo-dev/Commonweave.git` and the production branch is `main`.
