import {
  RELATIONAL_COSMOS_SCHEMA,
  buildCosmosProjection,
  normalizeCosmosData,
  preferredScaleForType,
  traceOrigins as traceOriginData,
  visibilityForScale,
} from './shared/civweave-relational-cosmos-v1.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STYLE_ID = 'civweave-relational-cosmos-v1-style';
const MIN_SCALE = 0.28;
const MAX_SCALE = 3.6;
const TYPE_RADIUS = Object.freeze({ guild: 18, quest: 10, beat: 5.5 });
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

function svgElement(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  return node;
}
function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style'); style.id = STYLE_ID;
  style.textContent = `
    .cw-cosmos{position:relative;overflow:hidden;min-height:460px;background:radial-gradient(ellipse at 50% 47%,#101a34 0%,#070b19 42%,#02040b 78%,#010208 100%);border:1px solid rgba(255,255,255,.12);border-radius:18px;color:#fff;touch-action:none;user-select:none;isolation:isolate}
    .cw-cosmos::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 50%,transparent 0 38%,rgba(0,0,0,.12) 66%,rgba(0,0,0,.48) 100%);z-index:1}
    .cw-cosmos svg{position:relative;z-index:0;display:block;width:100%;height:100%;min-height:460px;cursor:grab}.cw-cosmos svg[data-panning="true"]{cursor:grabbing}.cw-cosmos-bg-star{fill:#fff;transition:opacity .12s ease}.cw-cosmos[data-warp="true"] .cw-cosmos-bg-star{opacity:.92}
    .cw-cosmos-edge{fill:none;stroke-linecap:round;vector-effect:non-scaling-stroke;transition:opacity .18s ease,stroke-width .18s ease,filter .18s ease}.cw-cosmos-edge[data-kind="hierarchy"]{stroke:rgba(197,213,255,.21);stroke-width:1.1}.cw-cosmos-edge[data-kind="origin"]{stroke:rgba(255,255,255,.34);stroke-width:1.2;stroke-dasharray:3 6}.cw-cosmos-edge[data-kind="similarity"]{stroke:rgba(133,177,255,.28);stroke-width:1.1;stroke-dasharray:2 5}.cw-cosmos-edge[data-trace="true"]{stroke:#fff;stroke-width:2.5;stroke-dasharray:none;filter:drop-shadow(0 0 5px rgba(255,255,255,.8));opacity:1!important}
    .cw-cosmos-node{cursor:pointer;transition:opacity .18s ease,filter .18s ease}.cw-cosmos-node:hover,.cw-cosmos-node:focus{filter:brightness(1.35) drop-shadow(0 0 8px rgba(255,255,255,.5));outline:none}.cw-cosmos-node[data-trace="true"]{filter:brightness(1.45) drop-shadow(0 0 12px rgba(255,255,255,.92))}.cw-cosmos-halo{fill:none;stroke:rgba(255,255,255,.13);vector-effect:non-scaling-stroke}.cw-cosmos-node[data-type="guild"] .cw-cosmos-halo{stroke-width:8}.cw-cosmos-node[data-type="quest"] .cw-cosmos-halo{stroke-width:5}.cw-cosmos-node[data-type="beat"] .cw-cosmos-halo{stroke-width:3}.cw-cosmos-core{vector-effect:non-scaling-stroke;stroke:rgba(255,255,255,.92);stroke-width:1.2}.cw-cosmos-node[data-type="guild"] .cw-cosmos-core{fill:#f2f5ff}.cw-cosmos-node[data-type="quest"] .cw-cosmos-core{fill:#9db9ff}.cw-cosmos-node[data-type="beat"] .cw-cosmos-core{fill:#fff}
    .cw-cosmos-label{fill:rgba(242,246,255,.94);font:600 11px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;paint-order:stroke;stroke:rgba(2,4,11,.9);stroke-width:3px;stroke-linejoin:round;pointer-events:none}.cw-cosmos-label[data-type="guild"]{font-size:14px;font-weight:800;letter-spacing:.02em}.cw-cosmos-label[data-type="beat"]{font-size:9px;font-weight:500;fill:rgba(235,241,255,.8)}
    .cw-cosmos-tooltip{position:absolute;z-index:5;max-width:min(390px,calc(100% - 24px));pointer-events:none;padding:10px 12px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(3,6,16,.94);box-shadow:0 14px 42px rgba(0,0,0,.5);font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#fff;opacity:0;transform:translateY(5px);transition:opacity .1s ease,transform .1s ease;overflow-wrap:anywhere}.cw-cosmos-tooltip[data-open="true"]{opacity:1;transform:translateY(0)}.cw-cosmos-tooltip strong{display:block;font:800 13px/1.3 system-ui,sans-serif;margin-bottom:4px}
    .cw-cosmos-depth{position:absolute;z-index:3;left:12px;bottom:10px;padding:6px 9px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(3,6,16,.66);backdrop-filter:blur(10px);font:10px ui-monospace,SFMono-Regular,Menlo,monospace;color:rgba(255,255,255,.72);pointer-events:none}.cw-cosmos-depth strong{color:#fff}@media(max-width:680px){.cw-cosmos{border-radius:12px}.cw-cosmos-label[data-type="guild"]{font-size:12px}.cw-cosmos-depth{left:8px;bottom:8px}}
  `; document.head.append(style);
}
function curve(source, target, bend = 0.24) {
  const dx = target.x - source.x, dy = target.y - source.y, distance = Math.hypot(dx, dy) || 1, nx = -dy / distance, ny = dx / distance, offset = Math.min(70, distance * bend), mx = (source.x + target.x) / 2 + nx * offset, my = (source.y + target.y) / 2 + ny * offset;
  return `M${source.x},${source.y} Q${mx},${my} ${target.x},${target.y}`;
}
function starPoints(outer = 18, inner = 8, spikes = 7) {
  const points = []; for (let index = 0; index < spikes * 2; index += 1) { const radius = index % 2 === 0 ? outer : inner, angle = -Math.PI / 2 + (Math.PI * index) / spikes; points.push(`${Math.cos(angle) * radius},${Math.sin(angle) * radius}`); } return points.join(' ');
}
function eventPoint(svg, event, viewWidth, viewHeight) { const rect = svg.getBoundingClientRect(); return { x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * viewWidth, y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * viewHeight }; }
function pointerPairDistance(left, right) { return Math.hypot(right.clientX - left.clientX, right.clientY - left.clientY); }
function pointerPairCenter(left, right) { return { clientX: (left.clientX + right.clientX) / 2, clientY: (left.clientY + right.clientY) / 2 }; }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function createBackgroundStars(width, height, count = 160) {
  const layer = svgElement('g', { class: 'cw-cosmos-background' }); let seed = 0x7f4a7c15;
  const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 0xffffffff; };
  for (let index = 0; index < count; index += 1) layer.append(svgElement('circle', { class: 'cw-cosmos-bg-star', cx: rand() * width, cy: rand() * height, r: 0.35 + rand() * 1.15, opacity: 0.15 + rand() * 0.62 }));
  return layer;
}
function nodeVisible(type, visibility) { if (type === 'guild') return visibility.guilds; if (type === 'quest') return visibility.quests; return visibility.beats; }
function labelVisible(type, visibility) { if (type === 'guild') return visibility.guildLabels; if (type === 'quest') return visibility.questLabels; return visibility.beatLabels; }

export function renderRelationalCosmos(container, input = {}, options = {}) {
  if (!(container instanceof Element)) throw new TypeError('A DOM container is required.');
  installStyles(); container.classList.add('cw-cosmos'); container.replaceChildren();
  const normalized = normalizeCosmosData(input);
  const width = Math.max(Number(options.width) || container.clientWidth || 1100, 560), height = Math.max(Number(options.height) || container.clientHeight || 660, 460);
  const projection = buildCosmosProjection(normalized, { width, height, deriveTagSimilarities: options.deriveTagSimilarities !== false, similarity: options.similarity, similarityIterations: options.similarityIterations });
  const byUid = new Map(projection.nodes.map((node) => [node.uid, node]));
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': options.ariaLabel || 'Civweave relational cosmos of Guilds, Quests, and Quest Beats' });
  svg.append(createBackgroundStars(width, height, Number(options.backgroundStars) || 160));
  const viewport = svgElement('g', { class: 'cw-cosmos-viewport' }), edgeLayer = svgElement('g', { class: 'cw-cosmos-edges' }), nodeLayer = svgElement('g', { class: 'cw-cosmos-nodes' }); viewport.append(edgeLayer, nodeLayer); svg.append(viewport); container.append(svg);
  const tooltip = document.createElement('div'); tooltip.className = 'cw-cosmos-tooltip'; tooltip.setAttribute('role', 'status'); container.append(tooltip);
  const depth = document.createElement('div'); depth.className = 'cw-cosmos-depth'; depth.innerHTML = '<strong>Guilds</strong> · warp inward for Quests and Beats'; container.append(depth);

  const edgeElements = new Map();
  for (const edge of projection.edges) {
    const source = byUid.get(edge.sourceUid), target = byUid.get(edge.targetUid); if (!source || !target) continue;
    const path = svgElement('path', { class: 'cw-cosmos-edge', d: curve(source, target, edge.kind === 'similarity' ? 0.18 : 0.08), 'data-edge-uid': edge.uid, 'data-kind': edge.kind, 'data-source-uid': edge.sourceUid, 'data-target-uid': edge.targetUid, 'data-weight': edge.weight }); edgeLayer.append(path); edgeElements.set(edge.uid, path);
  }
  const nodeElements = new Map();
  const showTooltip = (event, node) => {
    const tags = node.tags?.length ? `<br>tags: ${node.tags.join(' · ')}` : '', history = node.chordUid ? `<br>Chord: ${node.chordUid}` : '';
    tooltip.innerHTML = `<strong>${node.label}</strong>${node.type.toUpperCase()} · ${node.uid}${node.summary ? `<br>${node.summary}` : ''}${tags}${history}`;
    const bounds = container.getBoundingClientRect(); tooltip.style.left = `${Math.min(Math.max(12, event.clientX - bounds.left + 14), Math.max(12, bounds.width - 370))}px`; tooltip.style.top = `${Math.min(Math.max(12, event.clientY - bounds.top + 14), Math.max(12, bounds.height - 145))}px`; tooltip.dataset.open = 'true';
  };
  const hideTooltip = () => { tooltip.dataset.open = 'false'; };
  for (const node of projection.nodes) {
    const radius = TYPE_RADIUS[node.type] || 6;
    const group = svgElement('g', { class: 'cw-cosmos-node', transform: `translate(${node.x} ${node.y})`, 'data-node-uid': node.uid, 'data-type': node.type, tabindex: '0', role: 'button', 'aria-label': `${node.type}: ${node.label}` });
    group.append(svgElement('circle', { class: 'cw-cosmos-halo', r: radius + 5 }));
    group.append(node.type === 'guild' ? svgElement('polygon', { class: 'cw-cosmos-core', points: starPoints(radius, radius * 0.44, 7) }) : svgElement('circle', { class: 'cw-cosmos-core', r: radius }));
    const label = svgElement('text', { class: 'cw-cosmos-label', 'data-type': node.type, x: 0, y: radius + (node.type === 'beat' ? 13 : 18), 'text-anchor': 'middle' }); label.textContent = node.label.length > 36 ? `${node.label.slice(0, 33)}…` : node.label; group.append(label);
    group.addEventListener('pointerenter', (event) => showTooltip(event, node)); group.addEventListener('pointermove', (event) => showTooltip(event, node)); group.addEventListener('pointerleave', hideTooltip); group.addEventListener('focus', (event) => showTooltip(event, node)); group.addEventListener('blur', hideTooltip);
    group.addEventListener('click', (event) => { event.stopPropagation(); api.focusNode(node.uid); container.dispatchEvent(new CustomEvent('civweave:cosmos-select', { bubbles: true, detail: { node, projection } })); });
    nodeLayer.append(group); nodeElements.set(node.uid, group);
  }

  let transform = { x: width * 0.08, y: height * 0.08, scale: clamp(Number(options.initialScale) || 0.84, MIN_SCALE, MAX_SCALE) };
  const pointers = new Map(); let panStart = null, pinchStart = null, animationFrame = 0, warpTimer = 0;
  const markWarp = () => { container.dataset.warp = 'true'; clearTimeout(warpTimer); warpTimer = setTimeout(() => { container.dataset.warp = 'false'; }, 120); };
  const applyVisibility = () => {
    const visibility = visibilityForScale(transform.scale);
    for (const node of projection.nodes) { const element = nodeElements.get(node.uid); if (!element) continue; const visible = nodeVisible(node.type, visibility); element.style.opacity = visible ? '1' : '0'; element.style.pointerEvents = visible ? 'auto' : 'none'; const label = element.querySelector('.cw-cosmos-label'); if (label) label.style.opacity = labelVisible(node.type, visibility) ? '1' : '0'; }
    for (const edge of projection.edges) { const element = edgeElements.get(edge.uid); if (!element) continue; const source = byUid.get(edge.sourceUid), target = byUid.get(edge.targetUid), endpointsVisible = source && target && nodeVisible(source.type, visibility) && nodeVisible(target.type, visibility), strongEnough = edge.kind !== 'similarity' || !visibility.strongSimilarityOnly || edge.weight >= 0.72; element.style.opacity = endpointsVisible && strongEnough ? String(edge.kind === 'similarity' ? 0.28 + edge.weight * 0.48 : 0.78) : '0'; }
    const mode = visibility.beats ? 'Quest Beats' : visibility.quests ? 'Quests' : 'Guilds', hint = visibility.beats ? 'warp outward to recover origins' : visibility.quests ? 'warp inward for Quest Beats · outward for Guilds' : 'warp inward for Quests and Beats'; depth.innerHTML = `<strong>${mode}</strong> · ${hint}`; container.dispatchEvent(new CustomEvent('civweave:cosmos-depth', { detail: visibility }));
  };
  const applyTransform = () => { viewport.setAttribute('transform', `translate(${transform.x} ${transform.y}) scale(${transform.scale})`); applyVisibility(); };
  const setScaleAt = (nextScale, point) => { const previousScale = transform.scale, scale = clamp(nextScale, MIN_SCALE, MAX_SCALE), worldX = (point.x - transform.x) / previousScale, worldY = (point.y - transform.y) / previousScale; transform.x = point.x - worldX * scale; transform.y = point.y - worldY * scale; transform.scale = scale; applyTransform(); };
  const animateTo = (target, duration = 620) => {
    cancelAnimationFrame(animationFrame); const start = { ...transform }, started = performance.now();
    const tick = (now) => { const t = clamp((now - started) / Math.max(1, duration), 0, 1), eased = easeInOutCubic(t); transform = { x: start.x + (target.x - start.x) * eased, y: start.y + (target.y - start.y) * eased, scale: start.scale + (target.scale - start.scale) * eased }; applyTransform(); container.dataset.warp = t < 1 ? 'true' : 'false'; if (t < 1) animationFrame = requestAnimationFrame(tick); }; animationFrame = requestAnimationFrame(tick);
  };
  const targetForNode = (node, scale) => { const targetScale = clamp(Number(scale) || Math.max(preferredScaleForType(node.type), transform.scale), MIN_SCALE, MAX_SCALE); return { scale: targetScale, x: width / 2 - node.x * targetScale, y: height / 2 - node.y * targetScale }; };
  const clearTrace = () => { for (const element of nodeElements.values()) element.dataset.trace = 'false'; for (const element of edgeElements.values()) element.dataset.trace = 'false'; };
  const highlightTrace = (uids) => { clearTrace(); const set = new Set(uids); for (const uid of set) if (nodeElements.has(uid)) nodeElements.get(uid).dataset.trace = 'true'; for (const edge of projection.edges) if (set.has(edge.sourceUid) && set.has(edge.targetUid)) { const sourceIndex = uids.indexOf(edge.sourceUid), targetIndex = uids.indexOf(edge.targetUid); if (Math.abs(sourceIndex - targetIndex) === 1) edgeElements.get(edge.uid)?.setAttribute('data-trace', 'true'); } };

  svg.addEventListener('wheel', (event) => { event.preventDefault(); markWarp(); const point = eventPoint(svg, event, width, height), factor = Math.exp(-event.deltaY * 0.00145); setScaleAt(transform.scale * factor, point); }, { passive: false });
  svg.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0 && event.pointerType === 'mouse') return;
    pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY }); svg.setPointerCapture?.(event.pointerId);
    if (pointers.size === 1 && !event.target.closest?.('.cw-cosmos-node')) { panStart = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: transform.x, y: transform.y }; svg.dataset.panning = 'true'; }
    else if (pointers.size === 2) { const [left, right] = [...pointers.values()], center = pointerPairCenter(left, right), point = eventPoint(svg, center, width, height); pinchStart = { distance: Math.max(1, pointerPairDistance(left, right)), scale: transform.scale, worldX: (point.x - transform.x) / transform.scale, worldY: (point.y - transform.y) / transform.scale }; panStart = null; svg.dataset.panning = 'false'; }
  });
  svg.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return; pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    if (pointers.size >= 2) { const [left, right] = [...pointers.values()].slice(0, 2); if (!pinchStart) return; markWarp(); const center = pointerPairCenter(left, right), point = eventPoint(svg, center, width, height), ratio = pointerPairDistance(left, right) / pinchStart.distance, scale = clamp(pinchStart.scale * ratio, MIN_SCALE, MAX_SCALE); transform.scale = scale; transform.x = point.x - pinchStart.worldX * scale; transform.y = point.y - pinchStart.worldY * scale; applyTransform(); return; }
    if (panStart && panStart.pointerId === event.pointerId) { const rect = svg.getBoundingClientRect(); transform.x = panStart.x + ((event.clientX - panStart.clientX) / Math.max(1, rect.width)) * width; transform.y = panStart.y + ((event.clientY - panStart.clientY) / Math.max(1, rect.height)) * height; applyTransform(); }
  });
  const finishPointer = (event) => { pointers.delete(event.pointerId); if (panStart?.pointerId === event.pointerId) panStart = null; if (pointers.size < 2) pinchStart = null; if (pointers.size === 0) svg.dataset.panning = 'false'; };
  svg.addEventListener('pointerup', finishPointer); svg.addEventListener('pointercancel', finishPointer); svg.addEventListener('lostpointercapture', finishPointer);

  const api = {
    schema: RELATIONAL_COSMOS_SCHEMA, svg, projection,
    focusNode(uid, scale) { const node = byUid.get(String(uid)); if (!node) return false; clearTrace(); animateTo(targetForNode(node, scale), Number(options.warpDuration) || 620); return true; },
    traceOrigins(uid) { const path = traceOriginData(normalized, uid); if (!path.leafToRoot.length) return path; const ids = path.rootToLeaf.map((node) => node.uid); highlightTrace(ids); const root = byUid.get(path.root.uid); if (root) animateTo(targetForNode(root, Math.max(MIN_SCALE, preferredScaleForType(root.type))), Number(options.originWarpDuration) || 840); container.dispatchEvent(new CustomEvent('civweave:cosmos-origin-trace', { bubbles: true, detail: { ...path, projection } })); return path; },
    showSimilar(uid, minimumWeight = 0.34) { clearTrace(); const related = new Set([String(uid)]); for (const edge of projection.edges) { if (edge.kind !== 'similarity' || edge.weight < minimumWeight) continue; if (edge.sourceUid === uid) related.add(edge.targetUid); if (edge.targetUid === uid) related.add(edge.sourceUid); } for (const relatedUid of related) nodeElements.get(relatedUid)?.setAttribute('data-trace', 'true'); return [...related]; },
    clearTrace, setScale(scale) { setScaleAt(scale, { x: width / 2, y: height / 2 }); },
    reset() { clearTrace(); animateTo({ x: width * 0.08, y: height * 0.08, scale: clamp(Number(options.initialScale) || 0.84, MIN_SCALE, MAX_SCALE) }, 540); },
    destroy() { cancelAnimationFrame(animationFrame); clearTimeout(warpTimer); container.replaceChildren(); container.classList.remove('cw-cosmos'); delete container.dataset.warp; },
  };
  applyTransform(); return api;
}
export function mountRelationalCosmos(selectorOrElement, input, options = {}) { const container = typeof selectorOrElement === 'string' ? document.querySelector(selectorOrElement) : selectorOrElement; return renderRelationalCosmos(container, input, options); }
globalThis.CivweaveRelationalCosmosV1 = Object.freeze({ renderRelationalCosmos, mountRelationalCosmos });
