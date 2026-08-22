# Mobile Guild Cloud automatic updates v1

## Product invariant

A Guildkeeper deploys a mobile Guild Cloud once. Routine Civweave releases must not require the Guildkeeper to create Cloudflare API tokens, copy account IDs, run Wrangler, edit GitHub secrets, or manually redeploy the Worker.

## Why this uses the Deploy to Cloudflare repository

Cloudflare's Deploy to Cloudflare flow creates a Guildkeeper-owned Git repository and connects that repository to Cloudflare Workers Builds. That existing deployment relationship is the update authority. Civweave does not retain a Guildkeeper Cloudflare API token and does not gain general write access to the Guildkeeper's Cloudflare account.

## Update path

1. Initial Deploy to Cloudflare creates the Guildkeeper-owned repository and Worker.
2. The template includes `.github/workflows/civweave-auto-update.yml`.
3. Every six hours the workflow fetches only `cloudflare/mobile-guild-edge` from the configured Civweave channel.
4. It compares the upstream subtree SHA with `civweave-update-lock.json`; unrelated monorepo changes are ignored.
5. On a real Guild Cloud release, `.civweave/sync-upstream.mjs` copies Civweave-managed files and merges canonical Wrangler runtime declarations into the Guildkeeper repository.
6. The merge preserves account/deployment ownership fields such as Worker name, account ID, routes, `workers_dev`, preview settings, placement, and Guildkeeper variable overrides.
7. The workflow commits the synchronized release with the repository-scoped GitHub Actions credential.
8. Cloudflare Workers Builds observes that normal repository push and deploys the new Worker version.
9. Durable Object state is retained because the existing Worker deployment and class bindings remain in place; migrations are update-managed.

## Scheduler continuity

Public GitHub repositories can have scheduled workflows disabled after long periods without repository activity. The updater therefore records a 30-day heartbeat when no Guild Cloud release has landed. This produces repository activity before the inactivity window can disable the scheduler. A heartbeat contains no Guild state or credentials.

## Ownership boundary

Civweave-managed:

- Worker source (`src/`)
- updater implementation and workflow
- package metadata
- compatibility/runtime declarations
- Workers AI binding declaration
- Durable Object bindings and migrations
- template documentation

Guildkeeper-owned/preserved:

- Cloudflare account
- Worker name
- account ID if written into Wrangler
- routes/custom-domain deployment settings
- `workers_dev` and preview choices
- placement
- explicit environment-variable overrides
- Durable Object data
- Cloudflare secrets
- Guild identity and founding-device state

## Channels

The deploy template carries its release channel in `civweave-update.json`. Staging deployments follow `staging`; production deployments must follow `main`. Promotion checks should preserve that distinction.

## Legacy Guild Clouds

Guild Clouds deployed before this mechanism existed do not contain the updater workflow. They need one final bootstrap deployment that installs this version of the template. After that bootstrap, routine Worker upgrades are automatic.
