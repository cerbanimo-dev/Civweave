# Civweave · AI Browser Integration v1 — Thread C

Status: **feature branch, pending integration with Threads A/B/D and staging review**. No live browser permissions or deployment are claimed by this document.

## Scope

This bridge connects the existing runtime spine to browser search and page evidence for:

- **The Loom / ChatGPT** — research and Quest-plan synthesis;
- **Gemini actors** — character-scoped research and approved page context;
- **downloaded local models** — on-device reasoning over cached sources plus optionally approved live tools;
- **Ollama / LAN fleets** — routed through the configured model runtime with explicit approval before evidence is sent to a non-device model.

Normal model requests do not trigger browsing. A caller opts in with the structured \`browserResearch\` field; mere page instructions or a model-generated "permission granted" claim cannot grant access.

## Browser research caller contract

Load \`/app/local-ai/bootstrap-v266.js\` on the relevant AI surface. Once loaded, the global bridge is \`CivweaveAIBrowserBridgeV1\`.

\`\`\`js
const request = CivweaveAIBrowserBridgeV1.createRequest(
  {
    config: { provider: 'gemini' }, // or 'openai', 'downloaded-local', 'ollama'
    prompt: 'Summarize this page and propose a reviewable Quest plan.'
  },
  {
    role: 'gemini-actor', // 'loom' or 'local-fleet'
    mode: 'live',         // 'archive' for offline search
    sessionId: currentBrowserSessionId,
    grantId: approvedUserGrantId,
    questId: activeQuestId,
    url: userSelectedOrObservedPageUrl,
    question: 'What should we use from this page in the Quest?',
    maxSteps: 3
  }
);
const result = await CivweaveModelRuntime.generate(request);
// result.browserResearch.sources = [{ index, title, url, mode }]
// result.browserResearch.trace   = bounded, no raw page content
\`\`\`

Provider selection is an explicit calling/UI responsibility. **The bridge does not silently switch providers**, add a cloud API key, or charge another account. Assign the provider in the normal AI Settings / model context and use the actor ID for browser-session scope. The existing downloaded model is chosen from installed local model selection when it is the selected route.

In archive mode, the existing Knowledge Schools archive search is available without network access to a downloaded local model. A model outside the device must obtain separate evidence-sharing permission even for downloaded sources.

## Thread B transport contract

Expose \`globalThis.CivweaveBrowserMCPV1.invoke(payload)\`:

\`\`\`js
await CivweaveBrowserMCPV1.invoke({
  name: 'browser.read', // browser.search / navigate / read / extract / capture
  arguments: { url: 'https://example.org/page', sessionId: 's' },
  actorId: 'gemini-actor',
  sessionId: 's',
  grantId: 'grant-id'
});
\`\`\`

A browser result should include \`url\`, \`title\`, \`text\` or \`content\` and/or \`results: [{title,url,text}]\`, plus \`mode:'live'\` and \`liveFetched:true\`. Enforce URL safety and private network protections *at the server/transport layer*, including DNS rebinding and redirects. Never return authentication headers, cookies, local-storage contents or browser profile secrets in page evidence.

During the integration window, the existing \`CivweaveBrowserToolV1.live\` is used for live search/open, and \`searchArchive\` for offline search. \`browser.extract\` and \`browser.capture\` remain **unavailable** without the new MCP transport. They are not silently approximated by unrelated tools.

## Thread D authorization contract

Expose \`globalThis.CivweaveBrowserPermissionsV1.authorize(details)\`, which returns \`true\` or \`{allowed:true}\` **only after validating a user-issued, scoped grant**.

\`\`\`js
{
  operation: 'live-browser' | 'share-browser-evidence-with-model',
  tool: 'browser.search' | 'browser.navigate' | 'browser.read' | 'browser.extract' | 'browser.capture',
  grantId: '...',
  sessionId: '...',
  actorId: '...',
  provider: '...',
  questId: '...'
}
\`\`\`

The permission service must verify grant freshness, tab/session/Quest binding, provider destination and actor scope. Capture and any sensitive page should require separate user acknowledgement as policy dictates. Deny unapproved or expired access. **Never infer consent** from \`browserResearch.enabled\`, \`approved: true\`, a model response, or the presence of a stored API key.

Both remote-model sharing and live browsing are checked independently. Missing authorization infrastructure is fail-closed. The transport still independently verifies the grant rather than trusting the JavaScript caller.

## Model-directed actions and evidence

A model can request up to four bounded read-only browser steps per research call, with a default of three. It may only open pages from the user-provided URL or previously observed structured browser URLs. Unsupported tools and unobserved URLs are denied. The bridge offers no submit, checkout, login, posting or write operation.

Page content is injected as explicitly **untrusted evidence**, not as an instruction. Model outputs carry \`browserResearch.sources\` (numbered URLs, archive/live distinction) and \`browserResearch.trace\` for UI inspection. App/UI must expose clickable citations, clearly identify archive versus live retrieval, and distinguish draft Quest recommendations from approved Quest execution.

**Cross-thread integration checklist**

1. Thread A: send selected page/session, display cited sources and per-actor permission state, call \`createRequest\`.
2. Thread B: expose \`invoke\` with the exact name/argument contract and source provenance.
3. Thread D: implement and audit the scoped \`authorize\` contract; add private-page protection and session revocation.
4. Merge and verify all branches together on staging before enabling any live use in production.

## Verification

\`\`\`bash
node --check public/app/ai-browser-bridge-v1.js
node scripts/test-ai-browser-bridge-v1.mjs
node scripts/verify-local-browser-agent-v1.mjs
\`\`\`

The test harness validates fail-closed network access, separate cloud-evidence sharing permission, archive-only local inference, Gemini actor routing, source provenance and denial of unobserved URLs.
