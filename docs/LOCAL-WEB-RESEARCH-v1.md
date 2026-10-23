# Civweave local web research v1

## Status and boundaries

This release makes web research a **standard, local-first capability** of Civweave's downloaded-local guides. Explicit searches and clear current-information questions are routed to Civweave's existing local browser agent. Qwen3.5 4B and other models with a working local inference runtime use the same JSON tool controller. The model does **not** need a commercial AI API, a search API key, fine-tuning, or native function-call support. The existing host-capacity session **is** required for live search. Search queries and requested URLs leave the device; prompts, model weights and inference stay local. Ordinary chat stays on the previous path.

The search transport is hosted by a Civweave node (Cloudflare Worker); this release is **not** a direct browser-to-SearXNG connection and is not yet a browser-independent offline web search.

## Default: search without a separate search server

**SearXNG is optional, not required.** The existing Civweave node-cloud Worker
already has a `BROWSER` binding. When `SEARXNG_BASE_URL` is unset, its
`web_search` tool uses that Cloudflare Browser Run binding to retrieve the
DuckDuckGo HTML results page. No commercial search API key or SearXNG
installation is required. On currently supported Cloudflare plans, Browser Run
has a limited included usage allowance; search engines may block automated
requests and failure must be disclosed.

The existing host-capacity session remains an access-control requirement in
the browser/PWA application. The external service is not required for language
model inference, only for access to arbitrary third-party web pages where
browser CORS rules prevent direct reads.

If the optional SearXNG endpoint returns 403 (or any other upstream failure),
the Worker now tries its existing Browser Run path. If both fail, the user sees
an explicit error; the model may not claim live search succeeded.

## Optional operator-hosted SearXNG

Operators who prefer a separate search index aggregator can add a *trusted*,
rate-limited SearXNG instance by setting `SEARXNG_BASE_URL` in the
node-cloud Worker environment. If chosen, ensure JSON format is enabled:

```yaml
search:
  formats:
    - html
    - json
```

Public SearXNG instances commonly return 403 for JSON access. Do **not**
default all users to a third-party instance without obtaining operator
permission and verifying the service's permitted usage.

Cloudflare Browser Run's `open` and `links` actions remain available
through the existing binding. The Worker continues to validate source URLs
and require member sessions for live tools.

## User flow

1. Select an installed local language model such as Qwen3.5 4B in Civweave.
2. Pair/connect a working host-capacity session for live browser tools.
3. Ask a guide a current-information question such as **"What's the latest Qwen release?"** or **"What's the weather today?"**. An explicit **"Search the web for [topic]"** also works. General conversation and planning don't trigger an internet request.
4. For clear research intent (or an explicit `webSearch:true` caller flag), the guide sends only a bounded query to the connected node for search. A caller can disable all automatic research with `allowNetwork:false`, `webSearch:false`, or `offlineOnly:true`. No conversation history is sent to the search backend. The model can request `archive_search`, `live_search`, `open`, `links`, or `finish`.
5. The Browser Run default extracts bounded, validated web result URLs from DuckDuckGo HTML without an external SearXNG instance. Source URLs must originate from retrieved evidence or URLs supplied by the user before opening. The model can synthesize only after receiving tool observations. The agent emits `civweave:local-browser-agent-progress` stages (intake, searching, results, model-choice, synthesis, complete), plus existing `onProgress` callbacks.
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
