import { WorkerEntrypoint } from 'cloudflare:workers';

const BACKING_GMAIL = 'cerbanimo@gmail.com';
const GMAIL_INBOX = `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(BACKING_GMAIL)}`;
const GOOGLE_ACCOUNT_CHOOSER = `https://accounts.google.com/AccountChooser?Email=${encodeURIComponent(BACKING_GMAIL)}&continue=${encodeURIComponent(GMAIL_INBOX)}`;
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const securityHeaders = Object.freeze({
  'cache-control': 'no-store, max-age=0',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()'
});
function b64url(text) { const bytes = new TextEncoder().encode(text); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, ''); }
function validEmail(value) { const email = clean(value, 320).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw Object.assign(new Error('Invalid destination.'), { status: 400 }); return email; }
function headerText(value, max = 240) { const text = clean(value, max).replace(/[\r\n]+/g, ' '); if (!text) throw Object.assign(new Error('Message field is required.'), { status: 400 }); return text; }
async function googleAccessToken(env) {
  const clientId = clean(env?.CERBANIMO_GMAIL_CLIENT_ID, 4000), clientSecret = clean(env?.CERBANIMO_GMAIL_CLIENT_SECRET, 4000), refreshToken = clean(env?.CERBANIMO_GMAIL_REFRESH_TOKEN, 8000);
  if (!clientId || !clientSecret || !refreshToken) throw Object.assign(new Error('Cerbanimo Gmail sender is not configured.'), { status: 503 });
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }) });
  const packet = await response.json().catch(() => ({}));
  if (!response.ok || !packet.access_token) throw Object.assign(new Error('Cerbanimo Gmail authorization could not be refreshed.'), { status: 502 });
  return clean(packet.access_token, 8000);
}
async function sendGmail(env, input = {}) {
  const to = validEmail(input.to), subject = headerText(input.subject || 'Your Civweave account verification code'), text = clean(input.text, 30_000);
  if (!text) throw Object.assign(new Error('Message body is required.'), { status: 400 });
  const token = await googleAccessToken(env);
  const mime = [`From: Cerbanimo <${BACKING_GMAIL}>`, `To: ${to}`, `Subject: ${subject}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit', '', text].join('\r\n');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ raw: b64url(mime) }) });
  const packet = await response.json().catch(() => ({}));
  if (!response.ok || !packet.id) throw Object.assign(new Error('Cerbanimo Gmail could not send the recovery message.'), { status: 502 });
  return Object.freeze({ ok: true, provider: 'gmail', messageId: clean(packet.id, 240) });
}
function html() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#160929"><title>Cerbanimo Mail</title><style>:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#10071c;color:#f7f2ff}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 18% 20%,#8b2aff33,transparent 34%),radial-gradient(circle at 82% 70%,#18d8ff25,transparent 36%),linear-gradient(145deg,#10071c,#18122e 60%,#0a1824)}main{width:min(620px,100%);padding:34px;border:1px solid #b27cff55;border-radius:28px;background:#171027e8;box-shadow:0 30px 90px #0009,0 0 80px #8b2aff18}small{display:block;color:#b9a8d3;letter-spacing:.16em;font-weight:800}h1{margin:.35rem 0 .8rem;font-size:clamp(2rem,7vw,4rem);line-height:.95}p{color:#d8cfe4;line-height:1.6}.badge{display:inline-flex;align-items:center;gap:8px;margin:12px 0 22px;padding:8px 11px;border:1px solid #70e5ff55;border-radius:999px;color:#a8f0ff;background:#0d273855;font:700 .84rem ui-monospace,SFMono-Regular,Consolas,monospace}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 18px;border-radius:14px;text-decoration:none;font-weight:850}.primary{background:linear-gradient(135deg,#a34bf0,#e74da9);color:white;box-shadow:0 12px 30px #a34bf044}.secondary{border:1px solid #8d80ac88;color:#f7f2ff;background:#24203a}.note{margin-top:25px;padding-top:18px;border-top:1px solid #ffffff17;font-size:.88rem;color:#a9a0b8}.fox{font-size:1.35rem}</style></head><body><main><small>CERBANIMO LLC · SECURE MAIL DOORWAY</small><h1>Mail, without another login.</h1><p>This portal does not collect or store email credentials. Authentication stays entirely with Google, and the inbox behind this doorway is the Cerbanimo Gmail account.</p><div class="badge"><span class="fox">🦊</span>${BACKING_GMAIL}</div><div class="actions"><a class="primary" href="/open">Open Cerbanimo inbox ↗</a><a class="secondary" href="/switch-account">Choose Google account</a></div><p class="note">If Google asks you to sign in, use the Cerbanimo Google account there. Cerbanimo Mail never sees the Google sign-in secret or session cookie.</p></main></body></html>`;
}

export default class CerbanimoMail extends WorkerEntrypoint {
  async sendRecovery(input = {}) { return sendGmail(this.env, input); }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: securityHeaders });
    if (url.pathname === '/api/health') return Response.json({ ok: true, schema: 'cerbanimo.mail-portal.v1', provider: 'gmail', backingAccount: BACKING_GMAIL, systemMailerConfigured: Boolean(this.env?.CERBANIMO_GMAIL_CLIENT_ID && this.env?.CERBANIMO_GMAIL_CLIENT_SECRET && this.env?.CERBANIMO_GMAIL_REFRESH_TOKEN) }, { headers: securityHeaders });
    if (url.pathname === '/open') return Response.redirect(GMAIL_INBOX, 302);
    if (url.pathname === '/switch-account') return Response.redirect(GOOGLE_ACCOUNT_CHOOSER, 302);
    if (url.pathname !== '/' && url.pathname !== '/index.html') return new Response('Not found', { status: 404, headers: securityHeaders });
    return new Response(request.method === 'HEAD' ? null : html(), { status: 200, headers: { ...securityHeaders, 'content-type': 'text/html; charset=utf-8' } });
  }
}
