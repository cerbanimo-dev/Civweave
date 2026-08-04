# Commonweave Cloudflare node

This deployment is a lightweight Cloudflare mirror for the install-first Commonweave experience. The existing Render service remains the full Node host. Cloudflare serves the static PWA globally and streams oversized release artifacts from R2.

## What this fixes

Cloudflare Workers Static Assets rejects any individual asset larger than 25 MiB. The repository currently contains:

```text
public/downloads/Commonweave-Mobile-Install-Kit.zip
```

That installer is approximately 65.6 MiB. `public/.assetsignore` prevents Wrangler from uploading it as a static asset. `src/cloudflare-worker.ts` preserves the same public URL and serves the file from the `DOWNLOADS` R2 binding instead.

## First deployment

Wrangler must be authenticated to the Cloudflare account that will own the Worker and R2 bucket.

```bash
wrangler login
node scripts/setup-cloudflare-node.mjs
```

The setup script performs four operations:

1. Verifies the active Cloudflare account.
2. Creates the `commonweave-downloads` R2 bucket when it does not already exist.
3. Uploads `Commonweave-Mobile-Install-Kit.zip` with download and cache metadata.
4. Deploys `commonweave-cloudflare-node` using `wrangler.jsonc`.

The script works with a globally installed Wrangler and falls back to `npx wrangler` when needed.

## Manual commands

Use these when you prefer to run each step separately.

```bash
wrangler whoami
wrangler r2 bucket create commonweave-downloads
wrangler r2 object put commonweave-downloads/Commonweave-Mobile-Install-Kit.zip \
  --file public/downloads/Commonweave-Mobile-Install-Kit.zip \
  --content-type application/zip \
  --content-disposition 'attachment; filename="Commonweave-Mobile-Install-Kit.zip"' \
  --cache-control 'public, max-age=3600' \
  --remote
wrangler deploy --config wrangler.jsonc
```

On PowerShell, place the command on one line or use PowerShell backticks instead of backslashes.

## Updating the installer

After rebuilding the mobile install kit, upload the replacement object and redeploy only when Worker or static files also changed.

```bash
npm run build:install
wrangler r2 object put commonweave-downloads/Commonweave-Mobile-Install-Kit.zip \
  --file public/downloads/Commonweave-Mobile-Install-Kit.zip \
  --content-type application/zip \
  --content-disposition 'attachment; filename="Commonweave-Mobile-Install-Kit.zip"' \
  --cache-control 'public, max-age=3600' \
  --remote
```

The object key is stable, so existing links continue to work.

## Routes

```text
/api/health
/downloads/Commonweave-Mobile-Install-Kit.zip
```

All other requests use Workers Static Assets from `public/`. Missing navigation routes fall back to `index.html` for the existing application shell.

## Local testing

```bash
wrangler dev --config wrangler.jsonc
```

Wrangler uses local R2 storage during local development by default. To test the download route locally, seed the local bucket:

```bash
wrangler r2 object put commonweave-downloads/Commonweave-Mobile-Install-Kit.zip \
  --file public/downloads/Commonweave-Mobile-Install-Kit.zip \
  --content-type application/zip \
  --content-disposition 'attachment; filename="Commonweave-Mobile-Install-Kit.zip"' \
  --cache-control 'public, max-age=3600' \
  --local
```

Then verify:

```bash
curl http://localhost:8787/api/health
curl -I http://localhost:8787/downloads/Commonweave-Mobile-Install-Kit.zip
```

## Cloudflare dashboard builds

For a Git-connected Workers project, keep `wrangler.jsonc` as the deployment source of truth. The R2 bucket and installer object must exist before the first production deployment. The static asset ignore rule is committed inside `public/`, so the oversized ZIP is excluded during both local and dashboard deployments.
