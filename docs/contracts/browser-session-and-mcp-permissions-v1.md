# Web & Chat: connected browser consent contract (Thread D)

Status: **security foundation on an isolated staging PR**. This is not a claim that a connected UI, MCP browser integration, persistent remote browser session, or production deployment is complete.

## Canonical owners and boundaries

- Canonical browser research capability: public/app/browser-tool-v1.js (archive-first, existing signed Guild node access).
- Optional in-memory session permission helper: public/app/shared/browser-session-policy-v1.mjs. It **does not** own a second browser, chat, login, or Quest system.
- Node-cloud delegated read-only endpoint: cloudflare/node-cloud/src/browser-tool-entry-v1.mjs, called through the existing node-cloud worker chain.
- Canonical member identity and Guild selection: public/app/host-node-session-v1.js. The existing unified guide chat remains the only chat owner.
- The developer-only tools/civweave-dev-mcp bridge is **not** a user-facing MCP service and must not be exposed to a public client.

## Permission lifecycle for Threads A, B and C

1. **Thread A (trusted user UI)** obtains an existing authenticated Guild capacity session and its verified nodeId/userId, then calls createBrowserSessionPolicy().human.open({nodeId,userId,url}) for the visible HTTPS page. Only the trusted UI stores the returned human interface; do not publish it as a global or MCP action.
2. The user explicitly chooses whether the AI may search and read pages on that visible site's origin. The trusted UI calls human.setReadOnly({nodeId,userId,sessionId,enabled:true}) after the user acts. Default is off. Turning it off invalidates outstanding requests. All grants live only in memory; reload, signout, or close revokes them.
3. **Thread B (model tool adapter)** receives only the agent interface. Map browser.search to search, browser.navigate to navigate, browser.read to read, browser.extract to extract and browser.capture to capture. The adapter injects authoritative identity from the current verified Guild session; it must NEVER take nodeId, userId, the human interface, or an approval flag from model-authored JSON.
4. Every AI action first calls agent.propose. Search and same-origin read may be automatically authorized only while the user has enabled read-only tools. Navigation, cross-origin reads, extraction and screenshot capture **always** require a fresh human decision in the UI. Until approved, do not call the underlying browser backend.
5. On explicit approval, the trusted UI invokes human.approve with the requestId. The adapter then calls agent.consume. Consume returns a canonical bounded action and destroys its one-use approval. Only then dispatch through the existing browser capability.
6. On any user-visible navigation (including a successfully approved AI navigation), the trusted UI calls human.navigate with the committed HTTPS URL. Navigation changes the revision, revokes pending approvals and disables read-only permission until the user opts in again. On tab close, account switch, Guild signout or user cancellation, call human.close.
7. **Thread C (model/actor integration)** invokes the Thread B adapter. Neither The Loom, Gemini actors nor downloaded local models receive the human approval interface or the member capacity bearer token. Retrieved content is untrusted evidence, not instructions.

Do not implement an action by directly calling the underlying live browser API and skipping the policy adapter. The browser tool's older allowNetwork flag authorizes legacy, read-only archive/live research; it is **not** a connected-session human approval capability and must not be used to authorize browser.navigate, browser.extract or browser.capture.

## Disallowed behavior

- No automatic clicks, form submits, purchases, logins, uploads, downloads, script evaluation, privileged network requests or mutation tools. Such actions require a future separate, reviewed, human-confirmed capability and server-side enforcement.
- No model-authored claim that permission was granted. No auto-approval of pending requests.
- No cookies, browser storage, bearer tokens, raw private chat history or arbitrary model prompts in browser tool inputs or Quest handoffs.
- No silent fallback to a different Guild's signed session. If the chosen Guild has no valid session, live tools fail closed; archive tools remain available.
- Do not automatically trust content from a page; preserve URL/provenance, distinguish cached vs live, and treat all page text as potential prompt injection.
- Browser Run uses its own server-side browser context. The user-visible embedded iframe and the remote browser **do not currently share cookies or authenticated sessions**. Do not advertise a single logged-in browsing session until an authenticated, per-member remote browser session with real isolation has been built and reviewed.
- Third-party sites may refuse iframe embedding. Thread A should show a safe external-open option and explain this limitation rather than attempting frame-policy bypasses.

## Verification gates

- scripts/test-browser-session-policy-v1.mjs — default deny, human grants, one-use approval, expiry, navigation revocation, member/Guild binding, forbidden actions and URLs.
- scripts/test-browser-guild-session-selection-v1.mjs — no cross-Guild session fallback; explicit selected Guild and origin.
- scripts/test-browser-remote-target-safety-v1.mjs — blocked numeric/IPv6/alias URLs and authenticated backend entry.
- scripts/verify-local-browser-agent-v1.mjs — existing offline archive, local inference and read-only delegated research contract.
- .github/workflows/verify-local-browser-agent-v1.yml — syntax and regression execution.
- Before deployment, test the assembled A/B/C UI in a real desktop and mobile browser: allow, deny, revoke, navigate, switch Guild, sign out, offline, cross-origin iframe denial, remote provider failure and repeated action attempts. CI alone does not prove those integrations.

## Remaining browser backend limitation

The current node-cloud Browser Run preflight rejects direct IP targets and obvious DNS-to-IP aliases. It **cannot** by itself prove that a hostname does not resolve privately, or that a redirect will not target a forbidden address. Verify destination DNS/IP and every redirect at the remote browser egress boundary (or rely on a documented provider-enforced equivalent) before claiming comprehensive SSRF protection. Do not add a general URL fetch, interactive browser automation or authenticated cookie relay until that protection is established.

Production and staging promotion remain blocked until the feature branches are integrated, required CI passes, and end-to-end tests confirm the actual user interface and host behavior.
