# Commonweave on Cloudflare Pages

Commonweave deploys as a static Cloudflare Pages site with lightweight Pages Functions for health checks. Both downloadable release artifacts are intended to ship from the same Pages domain:

```text
public/downloads/Commonweave-Mobile-Install-Kit.zip
public/downloads/commonweave-pocket-campus.cwseed
```

## Artifact boundary

Cloudflare Pages accepts individual static assets up to 25 MiB. Both release artifacts must stay below that limit.

Current state:

```text
Mobile install kit: approximately 8 KiB
Pocket Campus seed currently in main: approximately 65.6 MiB
```

The current checked-in seed is therefore not deployable to Pages yet. Replace or regenerate it below 25 MiB before deploying.

`scripts/build-cloudflare-pages.mjs` copies the complete `public/` tree into `.cloudflare-pages`, includes both download artifacts, scans every copied file, and fails before Wrangler upload if any included asset exceeds 25 MiB.

`scripts/build-mobile-install-kit.mjs` rebuilds both artifacts and uses a 24 MiB release boundary to leave safety margin below Cloudflare's hard ceiling.

## Git-connected Pages settings

Keep the Pages project connected to `cerbanimo-dev/Commonweave` and use:

```text
Production branch: main
Build command: node scripts/build-cloudflare-pages.mjs
Build output directory: .cloudflare-pages
Root directory: /
```

No R2 binding is required while both artifacts remain below 25 MiB.

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
4. validates and builds the full Pages output;
5. deploys the `main` production build;
6. passes `--commit-dirty=true` so generated output does not produce a warning.

## Rebuilding the artifacts

```bash
npm run build:install
```

The command must complete without reporting that either artifact exceeds the 24 MiB release boundary.

Then build and deploy:

```bash
node scripts/build-cloudflare-pages.mjs
npx wrangler pages deploy .cloudflare-pages --project-name commonweave --branch main --commit-dirty=true
```

Do not pass `--config`; Pages automatically reads the root `wrangler.jsonc` and rejects custom configuration paths.

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
https://YOUR-PAGES-DOMAIN/downloads/commonweave-pocket-campus.cwseed
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
