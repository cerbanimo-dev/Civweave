# Civweave Cloudflare Pages Host Guide

Civweave host creation now starts from the public GitHub repository and publishes a complete host surface into the steward's own Cloudflare Pages account with Wrangler.

## Canonical root

```text
Repository: cerbanimo-dev/Civweave
Production branch: main
Canonical Pages project: civweave
Canonical production URL: https://civweave.pages.dev
Hosted source: public/
Generated Pages output: .cloudflare-pages/
```

`civweave.pages.dev` is the reserved OG/root Civweave project. Do not use the `civweave` project name for a community host.

The former `https://commonweave.pages.dev` origin is a legacy install origin. Migration code may recognize it, but new installs and host documentation use `https://civweave.pages.dev`.

Cloudflare Pages assigns a production Pages project an origin of `<project>.pages.dev`. Branch and preview deployments use additional labels such as `<branch>.<project>.pages.dev` or `<hash>.<project>.pages.dev`; those preview addresses must not be used as permanent PWA install origins.

## Requirements

Install:

- Git
- Node.js 20 or newer
- npm
- Wrangler 4.x or newer
- access to the Cloudflare account that should own the host

Then clone Civweave:

```bash
git clone https://github.com/cerbanimo-dev/Civweave.git
cd Civweave
npm install
npm install --save-dev wrangler@latest
npx wrangler login
npx wrangler whoami
```

Always inspect `wrangler whoami` before creating a host. A host belongs to the Cloudflare account that creates its Pages project.

## Create the canonical OG node

Canonical deployment is deliberately guarded against accidental publication from the wrong Cloudflare login. Set the expected login locally; do not commit it.

```bash
CIVWEAVE_EXPECT_CLOUDFLARE_EMAIL="your-cloudflare-login@example.com" \
  node scripts/setup-cloudflare-node.mjs --canonical
```

The helper refuses to continue if Wrangler's active account does not match that expected login.

It creates or reuses:

```text
Pages project: civweave
Production URL: https://civweave.pages.dev
```

## Create a community host

Choose a host ID:

```bash
node scripts/setup-cloudflare-node.mjs --host-id garden
```

The default Pages project becomes:

```text
civweave-garden
```

and its production origin is normally:

```text
https://civweave-garden.pages.dev
```

Cloudflare may add characters if the requested Pages project name is already globally occupied. Wrangler's deployment result is the source of truth for the final address.

A steward may choose another Pages project name explicitly:

```bash
node scripts/setup-cloudflare-node.mjs \
  --host-id garden \
  --project-name garden-weave
```

The host ID and Pages project name are separate so a stable Civweave identity does not have to equal the public Cloudflare project label.

## What the helper does

`setup-cloudflare-node.mjs`:

1. finds Wrangler;
2. checks the active Cloudflare account;
3. protects the reserved `civweave` root project;
4. creates the requested Pages project when needed;
5. builds the complete `.cloudflare-pages/` package;
6. stamps `/app/host-deployment-v1.json` with the host ID, public origin, role, and canonical root;
7. deploys the production branch with Wrangler;
8. prints a steward setup URL ending in `/host-setup.html`;
9. leaves the successful direct deployment online while optional GitHub automation is configured.

Open that steward setup URL once after deployment.

## Automatic host updates without blocking installation

Cloudflare Pages direct uploads do not become Git-integrated merely because Wrangler records `main` as the deployment branch. The setup helper therefore keeps first launch independent of GitHub authorization: it builds and deploys the host immediately, then prints the repository settings needed for automatic updates.

For a community host repository, configure:

- repository variable `CIVWEAVE_PAGES_PROJECT` with the existing Pages project name;
- repository variable `CIVWEAVE_HOST_ID` with the stable host ID;
- repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for the steward's Cloudflare account.

The secrets configured in the canonical `cerbanimo-dev/Civweave` repository are specifically for the OG `civweave.pages.dev` host. Each community-host fork or repository uses its own steward-owned Cloudflare account ID and API token; it does not inherit the OG credentials.

The Actions workflows validate those credentials by requesting the exact configured Pages project. They intentionally do not run `wrangler whoami`, because an account-scoped Pages token can deploy its project without permission to enumerate every account membership.

Then enable `.github/workflows/deploy-civweave-host-pages.yml`. Every push to `main` rebuilds and deploys that same Pages project. The workflow refuses the reserved `civweave` project, so a community credential cannot overwrite the canonical root.

The canonical repository uses `.github/workflows/deploy-civweave-pages.yml` for `civweave.pages.dev`. Both workflows preserve the initial direct deployment until a successful automated replacement is available; failure or delayed GitHub setup does not take a new host offline.

## Host-local Anchor reminder

Cloudflare is allowed to be the host's public doorway without being its only surviving copy.

Opening `/app/?host_setup=1` marks that browser as a host-steward browser. Civweave then shows a persistent, non-blocking local Anchor reminder until the steward records a local companion as paired.

The reminder:

- strongly recommends a local Civweave companion/backup;
- links to `/host-local-anchor.html`;
- can be snoozed for one day;
- does not prevent the cloud host from operating;
- disappears after the steward records the Anchor as paired.

This first pass records pairing in the steward browser. A later Anchor protocol can replace that acknowledgement with cryptographic freshness, reconstruction, and service proofs without changing the host creation flow.

## Install the local Anchor

From the machine that will preserve local host state:

```bash
git clone https://github.com/cerbanimo-dev/Civweave.git
cd Civweave
cp .env.federated.example .env.federated
```

Then start the current local companion runtime:

```bash
docker compose --env-file .env.federated \
  -f docker-compose.federated.yml \
  up -d --build
```

Check it locally:

```bash
curl http://127.0.0.1:8787/api/federation/health
```

Persist and back up the local data directory. Node identity, signing material, peer trust, and retained relay state must survive container replacement.

## PWA install origins

A production Civweave host is allowed to install Civweave from its own stable production origin. This preserves host identity and lets users remain attached to the host they selected.

Valid examples:

```text
https://civweave.pages.dev
https://civweave-garden.pages.dev
https://garden-weave.pages.dev
```

Do not install from preview/branch aliases such as:

```text
https://feature.civweave.pages.dev
https://abc123.civweave-garden.pages.dev
```

Preview deployments are snapshots/aliases, not permanent host identities.

## Manual build and deploy

Build:

```bash
node scripts/build-cloudflare-pages.mjs
```

Deploy the canonical root:

```bash
npx wrangler pages deploy .cloudflare-pages \
  --project-name civweave \
  --branch main \
  --commit-dirty=true
```

Deploy a community host:

```bash
npx wrangler pages deploy .cloudflare-pages \
  --project-name civweave-garden \
  --branch main \
  --commit-dirty=true
```

The setup helper is preferred because it also writes host deployment metadata and protects the canonical project name.

## Local preview

```bash
node scripts/build-cloudflare-pages.mjs
npx wrangler pages dev .cloudflare-pages
```

## Safe working rules

- `public/` is hosted source; `.cloudflare-pages/` is generated output.
- Pull `main` before publishing a host update.
- Never commit Cloudflare login credentials, account tokens, API tokens, or private email guards.
- Never let a community host use the reserved `civweave` Pages project name.
- Never advertise a branch/hash preview URL as a permanent install origin.
- Back up the local Anchor data directory.
- The local Anchor is strongly recommended, not a hard requirement.

## Troubleshooting

### Wrangler is authenticated to the wrong account

```bash
npx wrangler whoami
npx wrangler logout
npx wrangler login
```

For the canonical root, the setup helper additionally checks the private expected-account email you supplied.

### Pages project name is already taken

Choose another project name while keeping the same host ID:

```bash
node scripts/setup-cloudflare-node.mjs \
  --host-id garden \
  --project-name garden-weave-2
```

### The build reports oversized assets

```bash
node scripts/audit-cloudflare-assets.mjs
node scripts/build-cloudflare-pages.mjs
```

### The Anchor reminder keeps returning

Open `/host-local-anchor.html`, start the local companion, verify it, then use **Mark this Anchor paired**. The reminder can also be snoozed for one day while setup is unfinished.
