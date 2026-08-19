import { renderRelationalCosmos } from './relational-cosmos-v1.mjs';
import { loadCivweaveRelationalCosmos } from './shared/civweave-relational-cosmos-source-v1.mjs';

const STYLE_ID = 'civweave-relational-cosmos-surface-v1-style';
let map = null, selectedUid = '', open = false, refreshTimer = 0;
function style() {
  if (document.getElementById(STYLE_ID)) return;
  const sheet = document.createElement('style'); sheet.id = STYLE_ID;
  sheet.textContent = `.cw-cosmos-launch{position:fixed;z-index:2147482100;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));border:1px solid rgba(255,255,255,.24);border-radius:999px;background:rgba(6,12,25,.92);color:#f4f7ff;padding:10px 14px;box-shadow:0 12px 32px rgba(0,0,0,.34);backdrop-filter:blur(14px);font:800 11px system-ui,sans-serif;letter-spacing:.03em;cursor:pointer}.cw-cosmos-surface{position:fixed;z-index:2147483000;inset:0;display:grid;grid-template-rows:auto minmax(0,1fr);background:#02040b;color:#f4f7ff;padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))}.cw-cosmos-surface[hidden]{display:none}.cw-cosmos-surface-bar{display:flex;gap:8px;align-items:center;padding:5px 2px 9px}.cw-cosmos-surface-title{min-width:0;flex:1}.cw-cosmos-surface-title strong{display:block;font:800 14px system-ui,sans-serif}.cw-cosmos-surface-title span{display:block;margin-top:2px;color:#8f9ab1;font:10px ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cw-cosmos-surface button{border:1px solid rgba(255,255,255,.16);border-radius:999px;background:#11182a;color:#edf3ff;padding:8px 10px;font:800 10px system-ui,sans-serif;cursor:pointer}.cw-cosmos-surface-map{min-height:0;height:100%}.cw-cosmos-empty{height:100%;display:grid;place-items:center;text-align:center;border:1px solid rgba(255,255,255,.1);border-radius:18px;background:radial-gradient(circle at 50% 45%,#101a34,#02040b 68%);color:#9ba6ba;font:12px/1.5 system-ui,sans-serif;padding:24px}.cw-cosmos-empty strong{display:block;color:#fff;font-size:16px;margin-bottom:5px}@media(max-width:640px){.cw-cosmos-surface-bar{flex-wrap:wrap}.cw-cosmos-surface-title{flex-basis:100%}.cw-cosmos-surface button{padding:7px 9px}}`;
  document.head.append(sheet);
}
function createSurface() {
  style();
  const launch = document.createElement('button'); launch.type = 'button'; launch.className = 'cw-cosmos-launch'; launch.textContent = 'COSMOS'; launch.setAttribute('aria-label', 'Open relational cosmos');
  const surface = document.createElement('section'); surface.className = 'cw-cosmos-surface'; surface.hidden = true; surface.setAttribute('aria-label', 'Civweave Relational Cosmos');
  surface.innerHTML = `<div class="cw-cosmos-surface-bar"><div class="cw-cosmos-surface-title"><strong>Relational Cosmos</strong><span id="cw-cosmos-status">Guilds · Quests · Quest Beats</span></div><button type="button" data-action="similar">SIMILAR</button><button type="button" data-action="origin">TRACE ORIGINS</button><button type="button" data-action="refresh">REFRESH</button><button type="button" data-action="close">BACK</button></div><div class="cw-cosmos-surface-map" id="cw-cosmos-live-map"></div>`;
  document.body.append(launch, surface);
  launch.addEventListener('click', () => show(surface));
  surface.addEventListener('click', (event) => {
    const action = event.target.closest?.('[data-action]')?.dataset.action; if (!action) return;
    if (action === 'close') hide(surface); if (action === 'refresh') refresh(surface, true); if (action === 'origin' && selectedUid) map?.traceOrigins(selectedUid); if (action === 'similar' && selectedUid) map?.showSimilar(selectedUid, 0.34);
  });
  surface.addEventListener('civweave:cosmos-select', (event) => { selectedUid = event.detail?.node?.uid || ''; const status = surface.querySelector('#cw-cosmos-status'); if (status && event.detail?.node) status.textContent = `${event.detail.node.type.toUpperCase()} · ${event.detail.node.label}`; });
  addEventListener('popstate', () => { if (open && !new URLSearchParams(location.search).has('cosmos')) hide(surface, false); });
  if (new URLSearchParams(location.search).get('cosmos') === '1') show(surface, false);
  return surface;
}
async function refresh(surface, forceNetwork = false) {
  if (!open && !forceNetwork) return;
  const holder = surface.querySelector('#cw-cosmos-live-map'); if (!holder) return;
  const data = await loadCivweaveRelationalCosmos({ includeNetwork: forceNetwork || navigator.onLine !== false });
  map?.destroy?.(); map = null; selectedUid = '';
  if (!data.nodes.length) { holder.className = 'cw-cosmos-surface-map'; holder.innerHTML = '<div class="cw-cosmos-empty"><div><strong>No relational stars yet</strong>Join or discover a Guild, publish a Quest, or record Quest Beats. Civweave will not invent missing relationships.</div></div>'; return; }
  holder.replaceChildren(); map = renderRelationalCosmos(holder, data, { deriveTagSimilarities: true, initialScale: 0.84 });
  const status = surface.querySelector('#cw-cosmos-status'); if (status) { const counts = ['guild','quest','beat'].map((type) => data.nodes.filter((node) => node.type === type).length); status.textContent = `${counts[0]} Guilds · ${counts[1]} Quests · ${counts[2]} Quest Beats`; }
}
function show(surface, pushState = true) { open = true; surface.hidden = false; document.documentElement.style.overflow = 'hidden'; if (pushState && new URLSearchParams(location.search).get('cosmos') !== '1') { const url = new URL(location.href); url.searchParams.set('cosmos', '1'); history.pushState({ cosmos: true }, '', url); } refresh(surface, false); }
function hide(surface, updateHistory = true) { open = false; surface.hidden = true; document.documentElement.style.overflow = ''; if (updateHistory && new URLSearchParams(location.search).has('cosmos')) { const url = new URL(location.href); url.searchParams.delete('cosmos'); history.pushState({}, '', url); } }
function scheduleRefresh(surface) { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => refresh(surface, false), 120); }
function boot() { if (document.querySelector('.cw-cosmos-launch')) return; const surface = createSurface(); ['civweave:intentions-changed','civweave:quest-arc-changed','civweave:hub-map-directory','civweave:host-node-selected'].forEach((name) => addEventListener(name, () => scheduleRefresh(surface))); addEventListener('storage', () => scheduleRefresh(surface)); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
