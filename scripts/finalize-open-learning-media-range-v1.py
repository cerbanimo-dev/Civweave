#!/usr/bin/env python3
"""Add byte-range support to Civweave's cached Open Learning Media playback route.

The script updates both the generated service-worker route and the core launch finalizer so
future finalizer runs reproduce the same range-aware behavior.
"""
from pathlib import Path

SIMPLE_ROUTE = """self.addEventListener('fetch', event => {
  const request = event.request;
  if (!['GET', 'HEAD'].includes(request.method)) return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith(OPEN_MEDIA_ROUTE_PREFIX)) {
    event.respondWith((async () => {
      const cache = await caches.open(OPEN_MEDIA_CACHE);
      const cached = await cache.match(new Request(url.href, { method: 'GET' }));
      if (!cached) return new Response('Open learning media is not cached on this device.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      if (request.method === 'HEAD') return new Response(null, { status: cached.status, statusText: cached.statusText, headers: cached.headers });
      return cached;
    })());
    return;
  }"""

RANGE_ROUTE = """self.addEventListener('fetch', event => {
  const request = event.request;
  if (!['GET', 'HEAD'].includes(request.method)) return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith(OPEN_MEDIA_ROUTE_PREFIX)) {
    event.respondWith((async () => {
      const cache = await caches.open(OPEN_MEDIA_CACHE);
      const cached = await cache.match(new Request(url.href, { method: 'GET' }));
      if (!cached) return new Response('Open learning media is not cached on this device.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      const baseHeaders = new Headers(cached.headers);
      baseHeaders.set('accept-ranges', 'bytes');
      const range = request.headers.get('range');
      if (request.method === 'HEAD') return new Response(null, { status: cached.status, statusText: cached.statusText, headers: baseHeaders });
      if (!range) return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers: baseHeaders });
      const blob = await cached.blob();
      const total = blob.size;
      const match = /^bytes=(\\d*)-(\\d*)$/.exec(range.trim());
      const invalid = () => {
        const headers = new Headers(baseHeaders);
        headers.set('content-range', `bytes */${total}`);
        headers.set('content-length', '0');
        return new Response(null, { status: 416, headers });
      };
      if (!match || !total || (!match[1] && !match[2])) return invalid();
      let start;
      let end;
      if (!match[1]) {
        const suffix = Number(match[2]);
        if (!Number.isSafeInteger(suffix) || suffix <= 0) return invalid();
        start = Math.max(0, total - suffix);
        end = total - 1;
      } else {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : total - 1;
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= total) return invalid();
      end = Math.min(end, total - 1);
      const partial = blob.slice(start, end + 1, cached.headers.get('content-type') || 'application/octet-stream');
      const headers = new Headers(baseHeaders);
      headers.set('content-range', `bytes ${start}-${end}/${total}`);
      headers.set('content-length', String(partial.size));
      return new Response(partial, { status: 206, headers });
    })());
    return;
  }"""


def patch_worker() -> None:
    path = Path('public/service-worker-core-v208.js')
    text = path.read_text()
    if "request.headers.get('range')" in text:
        return
    if SIMPLE_ROUTE not in text:
        raise RuntimeError('Simple Open Learning Media service-worker route was not found.')
    path.write_text(text.replace(SIMPLE_ROUTE, RANGE_ROUTE, 1))


def patch_core_finalizer() -> None:
    path = Path('scripts/finalize-open-learning-media-launch-v1.py')
    text = path.read_text()
    if "request.headers.get('range')" in text:
        return
    start = text.index('    fetch_with_media = """')
    end_marker = '    text = replace_once(text, fetch_marker, fetch_with_media, "open media cache fetch route")'
    end = text.index(end_marker, start)
    replacement = '    fetch_with_media = """' + RANGE_ROUTE + '"""\n'
    path.write_text(text[:start] + replacement + text[end:])


def main() -> None:
    patch_worker()
    patch_core_finalizer()
    print('Range-aware Open Learning Media playback finalized.')


if __name__ == '__main__':
    main()
