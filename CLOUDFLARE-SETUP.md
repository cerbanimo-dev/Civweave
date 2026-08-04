# Commonweave on Cloudflare Pages

Commonweave deploys as a static Cloudflare Pages site with lightweight Pages Functions for health checks. The compact mobile install kit ships as a normal Pages asset.

The optional full Pocket Campus seed is a separate large recovery artifact. It remains on the Render host node and is intentionally omitted from the Cloudflare Pages output.

## Artifact boundary

Cloudflare Pages accepts individual static assets up to 25 MiB.

Current release roles:

```text
Cloudflare Pages:
  public/downloads/Commonweave-Mobile-Install-Kit.zip

Render host node:
  public/downloads/commonweave-pocket-campus.cwseed
```

The current mobile installer is approximately 8 KiB. The Pocket Campus seed is approximately 65.6 MiB.

`scripts/build-cloudflare-pages.mjs`:

1. validates that the compact installer exists and is below the Pages limit;
2. copies `public/` into `.cloudflare-pages`;
3. excludes only `commonweave-pocket-campus.cwseed` and its checksum;
4. scans every copied file and fails before deployment if any included asset exceeds 25 MiB.

`scripts/build-mobile-install-kit.mjs` may rebuild both artifacts, but only the compact kit is checked against the Cloudflare release boundary. The seed is labeled Render-only in its build output.

## Git-connected Pages settings

Keep the Pages project connected to `cerbanimo-dev/Commonweave` and use:

```text
Production branch: main
Build command: node scripts/build-cloudflare-pages.mjs
Build output directory: .cloudflare-pages
Root directory: /
```

No R2 binding is required.

## One-command setup and deployment

Wrangler must be authenticated to the Cloudflare account that owns the Pages project.

Default project name:

```bash
wrangler login
node scripts/setup-cloudflare-node.mjs
```

Existing project with another name:

```bash
wrangler login
node scripts/setup-cloudflare-node.mjs YOUR_EXISTING_PAGES_PROJECT_NAME
```

The setup script:

1. finds a local or global Wrangler installation, including Windows installs;
2. verifies Cloudflare authentication;
3. reuses or creates the named Pages project;
4. validates and builds the Pages-safe static output;
5. deploys the `main` production build;
6. passes `--commit-dirty=true` so generated output does not produce a warning.

## Manual publishing commands

Build the Pages output:

```bash
node scripts/build-cloudflare-pages.mjs
```

Deploy to the default project:

```bash
npx wrangler pages deploy .cloudflare-pages --project-name commonweave-cloudflare-node --branch main --commit-dirty=true
```

Replace `commonweave-cloudflare-node` with the exact existing Pages project name when necessary. Do not pass `--config`; Pages automatically reads the root `wrangler.jsonc` and rejects custom config paths.

## Updating release artifacts

Rebuild both release artifacts:

```bash
npm run build:install
```

Then rebuild and deploy the Pages-safe output:

```bash
node scripts/build-cloudflare-pages.mjs
npx wrangler pages deploy .cloudflare-pages --project-name commonweave-cloudflare-node --branch main --commit-dirty=true
```

The Pages build excludes the full seed automatically while preserving the compact mobile kit.

## Local MiniLM source checkout

The application-owned MiniLM runtime belongs at:

```text
public/app/models/all-minilm-l6-v2/
```

A separately cloned model repository at the project root, such as:

```text
all-MiniLM-L6-v2/
```

is local source material and is ignored by `.gitignore`. If Git already staged it as an embedded repository, remove only the staged gitlink while keeping the local files:

```bash
git rm --cached -r --ignore-unmatch all-MiniLM-L6-v2
```

Do not run that command against `public/app/models/all-minilm-l6-v2`.

## Verification

After deployment, open:

```text
https://YOUR-PAGES-DOMAIN/api/health
https://YOUR-PAGES-DOMAIN/downloads/Commonweave-Mobile-Install-Kit.zip
```

The full seed remains at:

```text
https://commonweave-host-node.onrender.com/downloads/commonweave-pocket-campus.cwseed
```

## Local Pages testing

```bash
node scripts/build-cloudflare-pages.mjs
npx wrangler pages dev
```

Wrangler normally serves Pages development on port 8788.

## Optional automated publishing

For GitHub Actions publishing, store these as repository secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

Scope the token only to the intended Cloudflare account and Pages project. Never commit credentials.
