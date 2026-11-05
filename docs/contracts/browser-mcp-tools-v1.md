# Browser research tools — Thread B contract

**Owner:** `cloudflare/node-cloud/src/browser-tool-entry-v1.mjs` (existing browser capability, extended in place).  
**Routes:** `POST /api/browser/tool` (legacy), `POST /api/browser/mcp` (MCP-compatible Streamable HTTP JSON responses).  
**Integration branch:** `feature/browser-mcp-tools-thread-b-20261105`; target `staging`.

## Scope and limitations

This backend serves *public read-only research*. It is not a shared user tab, does not reuse login cookies or sessions from the in-client browser, and does not perform clicks, form submissions, purchases, authenticated navigation, downloads, or file writes. Every `quickAction` starts a separate stateless page load. Thread A owns interactive tabs/bookmarks; Thread C may pass a user-approved public URL to these tools.

The existing `CivweaveBrowserToolV1.searchArchive()` is the offline-first fallback. Browser Run needs a Cloudflare browser binding and an internet connection; inability to fetch must be shown as a failure, never represented as inspected evidence.

## Authentication

Every POST (including `initialize` and `tools/list`) requires an existing signed *Guild member capacity session*:

- `Authorization: Bearer <capacitySession.token>`
- `x-civweave-node-id: <capacitySession.nodeId>` or `?nodeId=...`

The session must match the requested Guild. Never give the model the session token; the trusted Civweave bridge should make the request on its behalf. The endpoint is not an unrestricted external-public MCP server.

## MCP requests

The service supports the MCP 2025-11-25 JSON-RPC subset over POST, with JSON responses for `initialize`, `ping`, `tools/list`, and `tools/call`, plus HTTP 202 for `notifications/initialized`. No SSE, persistent MCP session, or server-initiated tool requests are implemented.

```json
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

```json
{"jsonrpc":"2.0","id":"read-1","method":"tools/call","params":{"name":"browser.read","arguments":{"url":"https://example.org/"}}}
```

Tool names and arguments:

| Name | Required arguments | Cloudflare Browser Run action |
| --- | --- | --- |
| `browser.search` | `query` (nonempty string, max 1200) | DuckDuckGo HTML results via `markdown` |
| `browser.navigate` | `url` (HTTP(S) public URL) | `markdown` |
| `browser.read` | `url` | `markdown` |
| `browser.extract` | `url`, `selectors` (1–8 CSS selector strings) | `scrape` |
| `browser.capture` | `url` | `snapshot` with `screenshot` + `markdown` |

The response `result.structuredContent` contains `action`, `url`, `result`, `browserMs`, and `source`. `source` includes `kind`, `url`, `title` where available, `fetchedAt`, `provider`, `liveFetched`, `verifiedPage`, `finalDestinationVerified`, and `untrustedContent`. MCP also provides `content` with text data. `browser.capture` returns a separate `image/png` MCP content block; the structured data deliberately omits the large base64 screenshot. The screenshot is viewport-only and size-bounded.

**Citation rule:** A `browser.search` result is search-results *discovery*, not verified evidence about an underlying page. The AI must invoke `browser.read` on each destination to treat that page as a fetched source. The recorded URL is the **requested** destination, not necessarily the final URL after redirects, and `finalDestinationVerified` is therefore `false`. Models must never invent page titles, authors, dates, links, quotations, or visit claims.

## Legacy compatibility

`POST /api/browser/tool` retains the `civweave.browser-tool-result.v1` envelope. Supported original actions remain `search`, `open`/`markdown`, `links`, and `accessibility`. It additionally accepts `navigate`, `read`, `extract`, and `capture` as bridge actions.

## Security and consent integration — Thread D and C

- The backend rejects explicit local, reserved, numeric, and IP-literal URLs and unusual ports. **This is not comprehensive SSRF protection:** redirects and DNS resolution/rebinding need downstream browser-egress restrictions or validated destination policy before broader rollout.
- Content from remote pages is untrusted data. Never promote page text to model instructions, service credentials, or system/tool authority.
- The backend never accepts cookies, HTTP credentials, arbitrary browser scripts, client-supplied headers, or form actions. No shared authenticated session is provided in this version.
- The member session authenticates the caller; it does **not** prove a human authorized a particular AI tool invocation. Thread C/D must require explicit network-research authorization and prompt for additional consent when user-private material could be exposed. Do not misrepresent a client-supplied boolean as a secure proof of human approval.
- The Guild's AI rate limiter includes the MCP endpoint. Thread D must verify costs, origin policy, quota/abuse limits, audit metadata, endpoint exposure and staging binding before any production release.
- Staging now declares a remote `BROWSER` Cloudflare binding; deployment credentials, runtime plan availability, and Browser Run functionality still require operational checks.

## Verification

```sh
node --test scripts/test-browser-mcp-tools-v1.mjs
```

Pull requests into `staging` run `.github/workflows/test-browser-mcp-tools-v1.yml`. Tests use a mocked Browser Run binding and signed test sessions. They do not prove live external fetches or Cloudflare deployment.

**Acceptance:** all tests green; anonymous and cross-Guild calls denied; public URL reads and CSS extraction bounded; capture image separated from text; no browser cookies forwarded; search-page results not represented as verified destination citations; legacy endpoint preserved. Thread D separately verifies live staging and production security gates.
