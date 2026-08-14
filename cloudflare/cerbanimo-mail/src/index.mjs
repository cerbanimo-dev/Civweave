const BACKING_GMAIL = 'cerbanimo@gmail.com';
const GMAIL_INBOX = `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(BACKING_GMAIL)}`;
const GOOGLE_ACCOUNT_CHOOSER = `https://accounts.google.com/AccountChooser?Email=${encodeURIComponent(BACKING_GMAIL)}&continue=${encodeURIComponent(GMAIL_INBOX)}`;

const securityHeaders = Object.freeze({
  'cache-control': 'no-store, max-age=0',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()'
});

function html() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#160929">
<title>Cerbanimo Mail</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#10071c;color:#f7f2ff}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 18% 20%,#8b2aff33,transparent 34%),radial-gradient(circle at 82% 70%,#18d8ff25,transparent 36%),linear-gradient(145deg,#10071c,#18122e 60%,#0a1824)}main{width:min(620px,100%);padding:34px;border:1px solid #b27cff55;border-radius:28px;background:#171027e8;box-shadow:0 30px 90px #0009,0 0 80px #8b2aff18}small{display:block;color:#b9a8d3;letter-spacing:.16em;font-weight:800}h1{margin:.35rem 0 .8rem;font-size:clamp(2rem,7vw,4rem);line-height:.95}p{color:#d8cfe4;line-height:1.6}.badge{display:inline-flex;align-items:center;gap:8px;margin:12px 0 22px;padding:8px 11px;border:1px solid #70e5ff55;border-radius:999px;color:#a8f0ff;background:#0d273855;font:700 .84rem ui-monospace,SFMono-Regular,Consolas,monospace}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 18px;border-radius:14px;text-decoration:none;font-weight:850}.primary{background:linear-gradient(135deg,#a34bf0,#e74da9);color:white;box-shadow:0 12px 30px #a34bf044}.secondary{border:1px solid #8d80ac88;color:#f7f2ff;background:#24203a}.note{margin-top:25px;padding-top:18px;border-top:1px solid #ffffff17;font-size:.88rem;color:#a9a0b8}.fox{font-size:1.35rem}
</style>
</head>
<body>
<main>
<small>CERBANIMO LLC · SECURE MAIL DOORWAY</small>
<h1>Mail, without another password.</h1>
<p>This portal does not collect or store email credentials. Authentication stays entirely with Google, and the inbox behind this doorway is the Cerbanimo Gmail account.</p>
<div class="badge"><span class="fox">🦊</span>${BACKING_GMAIL}</div>
<div class="actions">
<a class="primary" href="/open">Open Cerbanimo inbox ↗</a>
<a class="secondary" href="/switch-account">Choose Google account</a>
</div>
<p class="note">If Google asks you to sign in, use the Cerbanimo Google account there. Cerbanimo Mail never sees the password or session cookie.</p>
</main>
</body>
</html>`;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: securityHeaders });
    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, schema: 'cerbanimo.mail-portal.v1', provider: 'gmail', backingAccount: BACKING_GMAIL }, { headers: securityHeaders });
    }
    if (url.pathname === '/open') return Response.redirect(GMAIL_INBOX, 302);
    if (url.pathname === '/switch-account') return Response.redirect(GOOGLE_ACCOUNT_CHOOSER, 302);
    if (url.pathname !== '/' && url.pathname !== '/index.html') return new Response('Not found', { status: 404, headers: securityHeaders });
    return new Response(request.method === 'HEAD' ? null : html(), { status: 200, headers: { ...securityHeaders, 'content-type': 'text/html; charset=utf-8' } });
  }
};
