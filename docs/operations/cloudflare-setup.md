# Civweave Cloudflare Pages Host Guide

Civweave host creation starts from the public GitHub repository and publishes a complete host surface into the steward's own Cloudflare Pages account with Wrangler. Civweave separates the human-facing public address from the durable Cloudflare Pages underlay so a friendly domain never becomes the host's identity or only copy.

## Canonical root

```text
Repository: cerbanimo-dev/Civweave
Production branch: main
Canonical Pages project: civweave
Public canonical URL: https://civweave.cc
Canonical Pages underlay: https://civweave.pages.dev
Hosted source: public/
Generated Pages output: .cloudflare-pages/
```

`civweave.cc` is the canonical public/install origin for the Civweave root. `civweave.pages.dev` remains the reserved OG/root Pages project, deployment underlay, and compatibility ingress. Do not use the `civweave` Pages project name for a community host.

The former `https://commonweave.pages.dev` origin is a legacy install origin. Migration code may recognize both it and the previous `https://civweave.pages.dev` canonical address, but new root installs use `https://civweave.cc`.

Cloudflare Pages assigns a production Pages project an origin of `<project>.pages.dev`. Branch and preview deployments use additional labels such as `<branch>.<project>.pages.dev` or `<hash>.<project>.pages.dev`; those preview addresses must not be used as permanent PWA install origins.

## Hub hosting plans

Free community servers keep their Cloudflare Pages address and the free 28-member admission ceiling:

```text
$0/month
up to 28 admitted members
https://civweave-<host-id>.pages.dev
```

A paid hub-hosting subscription raises the server admission ceiling to 400 and unlocks a Civweave-managed alias:

```text
$5/month while the renewal snapshot is 0-199 members
$10/month when the renewal snapshot is 200-400 members
https://<host-id>.civweave.cc
```

Both paid bands permit up to 400 admitted members. Crossing member 200 does not create a mid-cycle charge and does not block admission. Before renewal, Civweave snapshots total hub membership and updates the Stripe subscription from one $5 unit to two $5 units, or back down, with proration disabled. The current paid period is always honored.

The `*.civweave.cc` address is an alias, never the storage or identity layer. If hosting expires, the shared alias disables and the durable Pages origin remains online. Admission returns to the free 28-member ceiling, but existing residents above 28 are grandfathered rather than deleted or evicted; new admissions wait until the hub is within capacity or hosting resumes.

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

### Cloudflare API token permissions

For GitHub automation, create a custom token scoped to the account that will own the host and select both:

- `Account` → `Cloudflare Pages` → `Edit` for the stable Pages host;
- `Account` → `Workers Scripts` → `Edit` for `civweave-host-edge` and its three Durable Object starter nodes.

Under **Account resources**, include the specific Cloudflare account that owns the host. There is no separate Durable Objects permission row; Cloudflare documents Durable Object namespace access under Workers Scripts permissions.

The setup helper and GitHub workflow attempt the Worker and all three nodes automatically. If the Workers permission is absent, Pages still deploys and `/host-setup.html` shows the incomplete layer, exact permission, and retry command instead of silently hiding it.

The canonical repository additionally needs the zone/DNS permissions used by the separate `civweave.cc` shared-domain rollout. Those permissions are intentionally not required for an ordinary community Pages host.

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
Pages underlay: https://civweave.pages.dev
Public canonical: https://civweave.cc
```

The direct setup establishes the Pages deployment. The canonical GitHub workflow owns the guarded custom-domain cutover and refuses to treat `civweave.cc` as ready until Cloudflare reports the Pages custom domain active.

## Create a community host

Choose a host ID:

```bash
node scripts/setup-cloudflare-node.mjs --host-id garden
```

The default Pages project becomes:

```text
civweave-garden
```

and its durable free production origin is normally:

```text
https://civweave-garden.pages.dev
```

Cloudflare may add characters if the requested Pages project name is already globally occupied. Wrangler's deployment result is the source of truth for the final Pages address.

A steward may choose another Pages project name explicitly:

```bash
node scripts/setup-cloudflare-node.mjs \
  --host-id garden \
  --project-name garden-weave
```

The host ID and Pages project name are separate so a stable Civweave identity does not have to equal the Cloudflare project label. An active hosting subscription may later expose that same hub as `https://garden.civweave.cc`; the Pages address remains underneath it.

## What the helper does

`setup-cloudflare-node.mjs`:

1. finds Wrangler;
2. checks the active Cloudflare account;
3. protects the reserved `civweave` root project;
4. creates or reuses the requested Pages project;
5. automatically deploys `civweave-host-edge` and creates or reuses exactly three starter nodes;
6. health-checks all three starter nodes and records a `ready` or `pending` account-edge status;
7. builds the complete `.cloudflare-pages/` package;
8. stamps `/app/host-deployment-v1.json` with the host, Pages underlay, account-edge status, role, and canonical Civweave root;
9. deploys the production branch with Wrangler;
10. prints the Pages-underlay `/host-setup.html`, where the steward can see the Worker and each starter node or the exact remediation step;
11. leaves the successful Pages deployment online while optional GitHub automation is configured.

Open that steward setup URL once after deployment.

## Automatic host updates without blocking installation

Cloudflare Pages direct uploads do not become Git-integrated merely because Wrangler records `main` as the deployment branch. The setup helper therefore keeps first launch independent of GitHub authorization: it builds and deploys the host immediately, then prints the repository settings needed for automatic updates.

For a community host repository, configure:

- repository variable `CIVWEAVE_PAGES_PROJECT` with the existing Pages project name;
- repository variable `CIVWEAVE_HOST_ID` with the stable host ID;
- repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for the steward's Cloudflare account.

The secrets configured in the canonical `cerbanimo-dev/Civweave` repository are specifically for the OG `civweave.pages.dev` Pages underlay and its associated canonical Cloudflare resources. Each community-host fork or repository uses its own steward-owned Cloudflare account ID and API token; it does not inherit the OG credentials.

The Actions workflows validate those credentials by requesting the exact configured Pages project. They intentionally avoid account-membership enumeration, because an account-scoped Pages token can deploy its project without that broader permission.

Then enable `.github/workflows/deploy-civweave-host-pages.yml`. Every push to `main` rebuilds and deploys that same Pages project, automatically retries the account Worker and three starter nodes, and verifies the stable community Pages hostname. The workflow refuses the reserved `civweave` project, so a community credential cannot overwrite the canonical root. Missing Workers permission produces a visible warning and pending status on `/host-setup.html`; it does not take the Pages host offline.

The canonical repository uses `.github/workflows/deploy-civweave-pages.yml` for the `civweave.pages.dev` underlay and the guarded `civweave.cc` attachment. Both canonical and community workflows preserve the initial direct Pages deployment until a successful automated replacement is available; failure or delayed GitHub setup does not take a new host offline.

The OG workflow can also provision an optional account Worker and three starter-node records when its token has `Account > Workers Scripts > Edit`. That broader permission is not required for the Pages host: provisioning failure is reported as a warning and cannot prevent `civweave.pages.dev` from building or deploying.

After upload, the OG workflow polls `https://civweave.pages.dev/app/host-deployment-v1.json` until the Pages underlay reports the pushed Git commit. It then ensures Cloudflare has attached `civweave.cc` to the `civweave` Pages project and waits for that custom domain to report active. A green workflow therefore proves the Pages underlay updated before civweave.cc is treated as canonical, instead of merely proving that Cloudflare accepted a preview deployment.

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
https://civweave.cc
https://civweave-garden.pages.dev
https://garden-weave.pages.dev
https://garden.civweave.cc    # while garden's hub-hosting entitlement is active
```

`https://civweave.pages.dev` remains a compatibility/deployment ingress for the OG root. New root installs are escorted to `https://civweave.cc`; community Pages origins remain legitimate permanent host origins.

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

Deploy the canonical Pages underlay:

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

The setup helper is preferred because it also writes host deployment metadata and protects the canonical project name. The `civweave.cc` public root and paid wildcard aliases are managed centrally and should not be hand-created in a community steward's DNS.

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
- Never treat a `*.civweave.cc` alias as the hub's storage or identity layer.
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
