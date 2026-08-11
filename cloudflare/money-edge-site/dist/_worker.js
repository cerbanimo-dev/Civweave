const json = (body, status = 200) => new Response(JSON.stringify(body, null, 2), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (!env.CORE?.fetch) {
        return json({ ok: false, error: 'core-service-binding-unavailable' }, 503);
      }
      const headers = new Headers(request.headers);
      headers.set('x-civweave-money-edge-origin', url.origin);
      const forwarded = new Request(request, { headers });
      const response = await env.CORE.fetch(forwarded);
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('x-civweave-money-edge-front-door', 'cloudflare-pages');
      responseHeaders.set('x-content-type-options', 'nosniff');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    }

    return env.ASSETS.fetch(request);
  }
};
