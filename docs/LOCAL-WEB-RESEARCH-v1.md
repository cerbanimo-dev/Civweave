# Civweave local web research v1

## Status and boundaries

This release connects **explicitly requested live web research** from the downloaded-local guide path to Civweave's existing local browser agent. Qwen3.5 4B and other models with a working local inference runtime use the same JSON tool controller. The model does **not** need a commercial AI API, a search API key, fine-tuning, or native function-call support. The existing host-capacity session **is** required for live search. Search queries and requested URLs leave the device; prompts, model weights and inference stay local. Ordinary chat stays on the previous path.

The search transport is hosted by a Civweave node (Cloudflare Worker); this release is **not** a direct browser-to-SearXNG connection and is not yet a browser-independent offline web search.

## Host setup (no commercial search API key)

1. Operate a trusted, access-controlled SearXNG instance. Enable JSON output in its `settings.yml`:

   ```yaml
   search:
     formats:
       - html
       - json
   ```

2. Provide the instance URL to the **node-cloud Worker** as the `SEARXNG_BASE_URL` environment binding. Example: `https://search.example.org/`. The operator must control that endpoint; do not select a random third-party instance or place credentials in the URL. The Worker requests `/search?q=...&format=json`, filters results and passes up to eight bounded source snippets to the local agent.
3. Preserve the existing `NODE_FABRIC_SESSION_SECRET` binding and host-capacity-session flow. The Worker authenticates live search before dispatching to SearXNG. A user does not obtain a SearXNG credential or need their own search API key.
4. Deploy the node-cloud Worker using its established deployment workflow. The `BROWSER` binding is optional for SearXNG **search**, but needed for live `open` and `links` actions and for the existing DuckDuckGo Browser Run search fallback. If neither SearXNG nor Browser Run is usable, live searches must visibly fail.

SearXNG may itself rely on external public search engines, which can rate-limit or block its requests. Keep SearXNG private to the operator, apply upstream rate limits, and monitor usage. Do not expose an unauthenticated public search proxy.

## User flow

1. Select an installed local language model such as Qwen3.5 4B in Civweave.
2. Pair/connect a working host-capacity session for live browser tools.
3. Ask the guide **"Search the web for [topic]"** or enable the explicit `webSearch` request flag from the caller.
4. The guide sends only the bounded latest user query to the node for search, then passes search results to its local research controller. The model can request `archive_search`, `live_search`, `open`, `links`, or `finish`.
5. Source URLs must originate from retrieved evidence or URLs supplied by the user before opening. The model can synthesize only after receiving tool observations. The agent emits `civweave:local-browser-agent-progress` stages (intake, searching, results, model-choice, synthesis, complete), plus existing `onProgress` callbacks.
6. If no live transport/session exists, the guide returns a meaningful live-search-unavailable error; it must **not** silently claim archived knowledge is a live search.

Offline downloaded-library research remains available through `CivweaveBrowserToolV1.searchArchive()` without a host session.

## Security and provenance

- Model-produced URLs are not trusted authority to fetch arbitrary endpoints. The agent enforces membership in previously observed or user-supplied URLs.
- The host tool rejects non-HTTP(S) URLs, embedded credentials, special/private IPv4 ranges, literal IPv6 hosts, and non-web ports. The search backend URL is an operator-only binding and cannot be set by a model call.
- Every search result retains its source URL, title, snippet, engine and `liveFetched` marker where available. Webpage text is untrusted evidence, never instructions.
- Tool action sequences are bounded (maximum five choices after initial searches); browser actions and search responses do not run arbitrary code.
- The local model's final answer is not independently guaranteed to be factual. Future work: stricter quote/span attribution, source ranking, content policy controls, and an optional no-host native HTTP search adapter.

## Regression command

```sh
npm run test:local-research
```

Tests cover keyless server search, safe URL filtering, cold-start Qwen dispatch, guaranteed explicit search, tool-call failure, streaming callback uniqueness, progress events, and missing-live-backend errors.
