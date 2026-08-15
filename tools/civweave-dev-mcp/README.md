# Civweave Dev Tools MCP

Local, source-first development bridge for inspecting Civweave PWAs through Chrome DevTools Protocol (CDP) and editing the canonical git worktree through constrained repository tools.

## Local staging first

Use the local staging lane for normal browser debugging instead of the legacy local host-node runtime or production URLs:

```bash
node scripts/start-local-staging.mjs
```

The stable local staging origin is `http://127.0.0.1:8788`. It serves `public/` with the repository's Cloudflare Pages Functions through Wrangler, so localhost exercises the same staging fixtures and production-isolation branches as `https://civweave-staging.pages.dev` without waiting for a deployment.

The launcher runs `scripts/verify-local-staging-isolation.mjs` before starting. That verifier requires localhost to remain a staging request, refuses the production Pages project name in the local config, and rejects new production service targets inside Pages Functions unless they are explicitly routed through the staging boundary.

`127.0.0.1:8788` is intentionally distinct from the older local host-node/debug ports. Use it as the MCP browser target for application work.

## Start MCP

Run the PWA in a dedicated Chromium/Opera development profile with CDP exposed on loopback, then start the bridge with Node 22+:

```bash
CIVWEAVE_REPO_ROOT=/path/to/Civweave \
CIVWEAVE_CDP_ENDPOINT=http://127.0.0.1:9222 \
node tools/civweave-dev-mcp/server.mjs
```

The MCP endpoint is `http://127.0.0.1:7331/mcp` by default. Its `/health` response also publishes the configured local staging origin, which defaults to `http://127.0.0.1:8788`. The bridge binds to loopback unless explicitly configured otherwise. A bearer token is mandatory for non-loopback binds, and browser-origin requests are rejected unless their origin is loopback or explicitly allowlisted.

The CDP endpoint is server configuration, not a model-controlled tool argument. Run a dedicated debug browser/profile so unrelated personal tabs are never part of the debuggable target set.

Once local staging is running, MCP browser actions should navigate or select the `http://127.0.0.1:8788` target. Source changes still go through the repository tools, then a normal reload verifies the changed source. No runtime code injection is part of this loop.

## Tool boundary

Read-only browser inspection:

- `pwa.list_targets`
- `pwa.snapshot`
- `pwa.runtime_state`
- `pwa.query`
- `pwa.screenshot`

Browser interaction for reproduction and verification:

- `pwa.navigate` (`http`/`https` only)
- `pwa.reload`
- `pwa.click` (CDP pointer input)
- `pwa.type` (CDP keyboard/input events)
- `pwa.scroll` (CDP mouse-wheel input)
- `pwa.watch` (console, exceptions, failed requests, lifecycle, and bounded CDP performance metrics)

Canonical repository work:

- `repo.read_file`
- `repo.search`
- `repo.status`
- `repo.diff`
- `repo.apply_patch` (`git apply --check` before mutation)
- `repo.run_npm_script` (allowlisted check/test/lint/audit plus `build:install` only)

There is intentionally no arbitrary browser JavaScript evaluation tool, runtime patch tool, arbitrary shell tool, deploy tool, secret tool, or merge tool. Browser actions reproduce user behavior; persistent fixes must be made in source through the git worktree.

`pwa.runtime_state` returns storage key names, not stored values. CDP calls are bounded by timeouts so a frozen renderer reports a diagnostic failure instead of hanging the agent indefinitely. `pwa.watch` installs no observer or instrumentation inside the application page.

## Verify

```bash
node scripts/verify-local-staging-isolation.mjs
node --check scripts/start-local-staging.mjs
node --check tools/civweave-dev-mcp/server.mjs
node --check tools/civweave-dev-mcp/lib/cdp-client.mjs
node --check tools/civweave-dev-mcp/lib/repo-tools.mjs
node --check tools/civweave-dev-mcp/lib/tool-registry.mjs
node --test tools/civweave-dev-mcp/test/dev-tools-mcp.test.mjs
```

For application changes made through the bridge, run the targeted repository verification first, then the broader gates required by `AGENTS.md` for the affected system.
