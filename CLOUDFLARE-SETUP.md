# Commonweave on Cloudflare Pages with R2

Commonweave uses Cloudflare Pages for the static PWA and a Pages Function for the oversized mobile installer. The installer stays at the same site-relative URL, but its bytes live in R2 instead of the Pages asset bundle.

## Why this boundary exists

Cloudflare Pages allows individual static site assets up to 25 MiB. This repository contains:

```text
public/downloads/Commonweave-Mobile-Install-Kit.zip
```

The file is approximately 65.6 MiB. `scripts/build-cloudflare-pages.mjs` stages the site into `.cloudflare-pages` without that ZIP. The Pages Function at:

```text
functions/downloads/Commonweave-Mobile-Install-Kit.zip.ts
```

serves the matching URL from the `DOWNLOADS` R2 binding, including HEAD, ETag, and resumable byte-range support.

## Existing Git-connected Pages project

Keep the existing Pages project connected to `cerbanimo-dev/Commonweave` and use these build settings:

```text
Production branch: main
Build command: node scripts/build-cloudflare-pages.mjs
Build output directory: .cloudflare-pages
Root directory: /
```

The committed `wrangler.jsonc` defines:

```text
Default Pages project: commonweave-cloudflare-node
R2 binding: DOWNLOADS
R2 bucket: commonweave-downloads
```

When the actual Pages project has a different name, pass that exact name to the setup command below. For an existing Git-integrated project, the command reuses the project and creates a manual production deployment; it does not disconnect the Git integration.

Also verify the binding in the dashboard:

```text
Workers & Pages > your Pages project > Settings > Bindings
Variable name: DOWNLOADS
R2 bucket: commonweave-downloads
```

Redeploy after adding or changing a binding.

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

On Windows PowerShell, the same commands work unchanged.

The script:

1. verifies Cloudflare authentication;
2. creates `commonweave-downloads` when absent;
3. reuses or creates the named Pages project;
4. uploads the ZIP to R2 with download metadata;
5. builds `.cloudflare-pages` without the ZIP;
6. deploys the static site and Pages Functions to the production `main` branch.

## Manual publishing commands

Create the bucket once:

```bash
wrangler r2 bucket create commonweave-downloads
```

Upload or replace the installer:

```bash
wrangler r2 object put commonweave-downloads/Commonweave-Mobile-Install-Kit.zip --file public/downloads/Commonweave-Mobile-Install-Kit.zip --content-type application/zip --content-disposition 'attachment; filename="Commonweave-Mobile-Install-Kit.zip"' --cache-control 'public, max-age=3600' --remote
```

Build the Pages-safe static output:

```bash
node scripts/build-cloudflare-pages.mjs
```

Deploy to the default Pages project:

```bash
wrangler pages deploy .cloudflare-pages --project-name commonweave-cloudflare-node --branch main --config wrangler.jsonc
```

Replace `commonweave-cloudflare-node` with the exact existing Pages project name when necessary.

## Updating the installer later

Rebuild the install kit, upload the stable R2 key, and leave the public URL unchanged:

```bash
npm run build:install
wrangler r2 object put commonweave-downloads/Commonweave-Mobile-Install-Kit.zip --file public/downloads/Commonweave-Mobile-Install-Kit.zip --content-type application/zip --content-disposition 'attachment; filename="Commonweave-Mobile-Install-Kit.zip"' --cache-control 'public, max-age=3600' --remote
```

A Pages redeploy is only required when the Function, Wrangler configuration, or static site changes. Replacing the object at the same R2 key updates the download without changing links.

## Verification

After deployment, open:

```text
https://YOUR-PAGES-DOMAIN/api/health
https://YOUR-PAGES-DOMAIN/downloads/Commonweave-Mobile-Install-Kit.zip
```

Or check headers from a terminal:

```bash
curl -I https://YOUR-PAGES-DOMAIN/downloads/Commonweave-Mobile-Install-Kit.zip
```

The health response reports whether the R2 object is present and its byte size.

## Local Pages testing

Build the static output, seed local R2, and start Pages development:

```bash
node scripts/build-cloudflare-pages.mjs
wrangler r2 object put commonweave-downloads/Commonweave-Mobile-Install-Kit.zip --file public/downloads/Commonweave-Mobile-Install-Kit.zip --content-type application/zip --content-disposition 'attachment; filename="Commonweave-Mobile-Install-Kit.zip"' --cache-control 'public, max-age=3600' --local
wrangler pages dev --config wrangler.jsonc
```

Wrangler normally serves Pages development on port 8788.

## Optional GitHub Actions credentials

For automated Wrangler publishing, add these repository secrets rather than committing credentials:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

The API token must be scoped only to the intended Cloudflare account and include permission to edit Cloudflare Pages and R2 storage. Never commit the token or place it in `.dev.vars` tracked by Git.
