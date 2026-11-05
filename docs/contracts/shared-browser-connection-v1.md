# Shared browser connection — v1

## Canonical ownership

Civweave has **one guide chat** at `public/app/guide-chat-surface-v350.js`. The Connected browser is an optional shared capability, `public/app/browser-connection-v1.js`, opened from the existing chat header. It does not create a second chat composer, model lifecycle, thread store, or event owner.

Policy and the MCP-style read-only tool catalog live at `public/app/shared/browser-connection-core-v1.mjs`. Offline archive retrieval and authenticated hosted browsing reuse `public/app/browser-tool-v1.js`. The existing local downloaded-model browser controller at `public/app/local-ai/browser-agent-v1.js` continues using the same browser tool owner; no inference is moved to Browser Run.

## Device/browser ➜ PWA receiving

The installed PWA declares a GET Web Share Target in `public/app/manifest.webmanifest`. Chrome/Android browsers that support Web Share Target can share a URL to `/app/browser-receiver-v1.html`. The receiver:

1. Bounds the incoming title, text and URL; accepts only public HTTP(S) addresses.
2. Removes query parameters from its own address bar, stores the bounded share **only in tab-scoped sessionStorage**, and launches the normal persistent Civweave shell.
3. The parent-shell Connected browser consumes the one-time share and removes the pending record. Sharing does not automatically start AI inference, transmit page text to a model, post to a Guild, or activate a Quest.

Browsers without Web Share Target can paste an address into the Connected browser manually. The receiver is not a privileged browser extension, native WebView, or full browser-tab takeover. Such capabilities need a separately reviewed companion adapter.

## In-app browser

- Public URLs are previewed in a sandboxed iframe. Sites that prohibit embedding may appear blank; the **Read page** action offers a text-based Browser Run view, when user-authorized and the current Guild node has a valid host-capacity session.
- Back/Forward reflect URLs entered or selected in the Connected browser, not link navigation performed inside an opaque cross-origin frame. Cross-origin page DOM is never inspected directly by the PWA.
- Live web search uses the existing Browser Run search and presents safe extracted result links that can be opened in the in-app browser. Unavailable hosts, embedded-page restrictions, or failed searches are presented as limitations, not invented results.
- Offline knowledge search is always available when the relevant downloaded archive is present. A failed archive/host request must be shown as failure, not as fabricated results.
- **Discuss in chat** pre-fills the canonical current guide chat with the page URL and, if the user explicitly read it, a bounded untrusted excerpt. The user still submits the message; incoming text is never silently transmitted to an AI.
- The iframe is untrusted third-party content and must not receive Guild session tokens, application storage, app origin privileges, or automatic access to user data.

## AI/MCP-style tools

`CivweaveBrowserConnectionV1.listTools()` returns standard MCP tool descriptions with JSON input schemas. `CivweaveBrowserConnectionV1.callTool({name,arguments})` returns MCP-style `content`, `isError`, and optional `structuredContent` payloads. Supported read-only operations:

| Tool | Transport | Network permission |
| --- | --- | --- |
| `browser.archive_search` | downloaded knowledge archive | no |
| `browser.search` | existing Browser Run search | yes |
| `browser.open` | Browser Run text/markdown | yes |
| `browser.links` | Browser Run link extraction | yes |
| `browser.accessibility` | Browser Run accessibility tree | yes |

Live tool invocation requires the **current browser panel's user-checked session permission**. The underlying Browser Run endpoint additionally requires an authenticated capacity session. Model text cannot approve access. The permission resets on reload. There are no browser click, arbitrary JavaScript execution, credential capture, page write, or navigation automation tools in v1.

These are **MCP-compatible tool definitions and tool-call results within the installed PWA**, not an advertised external MCP HTTP server. The developer-only MCP bridge at `tools/civweave-dev-mcp/` remains separate and private. A future externally exposed MCP endpoint requires a new authentication/origin/tenant-isolation review.

## Known restrictions and acceptance

Some websites block iframe rendering or automated retrieval; never claim universal website access. Browser Run may incur hosted compute costs. Its existing server-side URL safety policy must also guard against redirects to private networks before general-purpose remote browsing can be considered fully hardened.

Test: `npm run test:browser-connection`. Also run `npm run check` before staging merge and check Android installed-PWA share intent manually. Do not deploy directly to production without staging browser/permission/redirect tests.
