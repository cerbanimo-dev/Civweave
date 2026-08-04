# Commonweave on Cloudflare Pages

Commonweave deploys as a static Cloudflare Pages site with lightweight Pages Functions for health checks. The mobile install kit is now small enough to ship as a normal Pages asset.

## Installer size boundary

The current file is:

```text
public/downloads/Commonweave-Mobile-Install-Kit.zip
```

Validated size:

```text
8,171 bytes
```

Cloudflare Pages permits individual static assets up to 25 MiB, so this installer no longer needs R2, an asset ignore rule, or a download proxy Function.

`scripts/build-cloudflare-pages.mjs` verifies that the installer exists and remains below the 25 MiB limit before copying the complete `public/` tree into `.cloudflare-pages`.

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

The setup script now detects a locally installed Wrangler directly, including on Windows. It then:

1. verifies Cloudflare authentication;
2. reuses or creates the named Pages project;
3. validates and builds the complete static site;
4. deploys the `main` production build.

## Manual publishing commands

Build the Pages output:

```bash
node scripts/build-cloudflare-pages.mjs
```

Deploy to the default project:

```bash
npx wrangler pages deploy .cloudflare-pages --project-name commonweave-cloudflare-node --branch main --config wrangler.jsonc
```

Replace `commonweave-cloudflare-node` with the exact existing Pages project name when necessary.

## Updating the installer

Rebuild the kit and redeploy Pages:

```bash
npm run build:install
node scripts/build-cloudflare-pages.mjs
npx wrangler pages deploy .cloudflare-pages --project-name commonweave-cloudflare-node --branch main --config wrangler.jsonc
```

The build stops with a clear error if a future installer exceeds 25 MiB.

## Verification

After deployment, open:

```text
https://YOUR-PAGES-DOMAIN/api/health
https://YOUR-PAGES-DOMAIN/downloads/Commonweave-Mobile-Install-Kit.zip
```

Or inspect the installer response:

```bash
curl -I https://YOUR-PAGES-DOMAIN/downloads/Commonweave-Mobile-Install-Kit.zip
```

The health endpoint reports `pages-static-assets` as the installer storage mode.

## Local Pages testing

```bash
node scripts/build-cloudflare-pages.mjs
npx wrangler pages dev --config wrangler.jsonc
```

Wrangler normally serves Pages development on port 8788.

## Optional automated publishing

For GitHub Actions publishing, store these as repository secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

Scope the token only to the intended Cloudflare account and Pages project. Never commit credentials.
