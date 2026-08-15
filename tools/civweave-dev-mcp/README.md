# Civweave Dev Tools MCP

Local, source-first development bridge for inspecting Civweave PWAs through Chrome DevTools Protocol (CDP) and editing the canonical git worktree through constrained repository tools.

## Start

Run the PWA in a dedicated Chromium/Opera development profile with CDP exposed on loopback, then start the bridge with Node 22+:

```bash
CIVWEAVE_REPO_ROOT=/path/to/Civweave \
CIVWEAVE_CDP_ENDPOINT=http://127.0.0.1:9222 \
node tools/civweave-dev-mcp/server.mjs
```

The MCP endpoint is `http://127.0.0.1:7331/mcp` by default. The bridge binds to loopback unless explicitly configured otherwise. A bearer token is mandatory for non-loopback binds, and browser-origin requests are rejected unless their origin is loopback or explicitly allowlisted.

The CDP endpoint is server configuration, not a model-controlled tool argument. Run a dedicated debug browser/profile so unrelated personal tabs are never part of the debuggable target set.

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
node --check tools/civweave-dev-mcp/server.mjs
node --check tools/civweave-dev-mcp/lib/cdp-client.mjs
node --check tools/civweave-dev-mcp/lib/repo-tools.mjs
node --check tools/civweave-dev-mcp/lib/tool-registry.mjs
node --test tools/civweave-dev-mcp/test/dev-tools-mcp.test.mjs
```

For application changes made through the bridge, run the targeted repository verification first, then the broader gates required by `AGENTS.md` for the affected system.
