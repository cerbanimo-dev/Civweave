# Commonweave v1.0.11

## Redirect-safe PWA navigation

This release fixes service-worker navigation failures shared by Render and Cloudflare Pages.

A browser navigation request reaches a service worker with redirect mode `manual`. The Commonweave worker could internally fetch or cache a response that had followed a host redirect, then return that response directly to the original manual navigation. Browsers reject that response before page JavaScript runs, producing:

> The FetchEvent resulted in a network error response: a redirected response was used for a request whose redirect mode is not "follow".

v1.0.11 adds `navigation-redirect-safety-v224` as the final service-worker response policy. It:

- follows redirects only inside the worker
- rebuilds navigation responses as fresh non-redirected `Response` objects
- removes `Location`, stale encoding, and stale content-length headers
- caches only normalized navigation responses
- normalizes readable responses preserved from older caches
- rejects unreadable `opaqueredirect` entries instead of returning an illegal response
- applies equally to Render, Cloudflare Pages, and offline navigation fallback

An executable VM regression test covers fresh redirected responses, cached redirected responses, and rejected opaque redirects.
