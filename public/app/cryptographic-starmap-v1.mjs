import { buildWeaveIndex, createWeave } from './shared/civweave-cryptographic-map-v1.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STYLE_ID = 'civweave-cryptographic-starmap-v1-style';
const POSITION_OFFSETS = Object.freeze([
  { x: -20, y: -20 },
  { x: 20, y: -20 },
  { x: 20, y: 20 },
  { x: -20, y: 20 },
]);

function svgElement(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  return node;
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .cw-weave-starmap{position:relative;overflow:hidden;min-height:420px;background:radial-gradient(circle at 50% 45%,rgba(63,72,110,.22),rgba(5,7,18,.96) 62%,#02030a 100%);border:1px solid rgba(255,255,255,.12);border-radius:18px;color:#fff;touch-action:none;user-select:none}
    .cw-weave-starmap svg{display:block;width:100%;height:100%;min-height:420px;cursor:grab}
    .cw-weave-starmap svg[data-panning="true"]{cursor:grabbing}
    .cw-chord .cw-chord-core{fill:#070a16;stroke:rgba(255,255,255,.76);stroke-width:1.2}
    .cw-chord .cw-chord-halo{fill:none;stroke:rgba(255,255,255,.12);stroke-width:7}
    .cw-chord[data-seed="true"] .cw-chord-halo{stroke:rgba(255,255,255,.36);stroke-width:9}
    .cw-chord text{fill:rgba(255,255,255,.88);font:11px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;pointer-events:none}
    .cw-weave-position{cursor:pointer;transition:filter .12s ease}
    .cw-weave-position:hover{filter:brightness(1.55)}
    .cw-weave-position .cw-position-ring{fill:none;stroke-width:2.4}
    .cw-weave-position .cw-position-core{stroke:rgba(255,255,255,.72);stroke-width:.8}
    .cw-stitch-backdrop{fill:none;stroke:rgba(255,255,255,.16);stroke-width:5;stroke-linecap:round}
    .cw-stitch{fill:none;stroke-width:2.1;stroke-linecap:round}
    .cw-weave-tooltip{position:absolute;z-index:4;max-width:min(440px,calc(100% - 24px));pointer-events:none;padding:10px 12px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(4,6,16,.94);box-shadow:0 12px 38px rgba(0,0,0,.42);font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#fff;opacity:0;transform:translateY(5px);transition:opacity .1s ease,transform .1s ease;white-space:normal;overflow-wrap:anywhere}
    .cw-weave-tooltip[data-open="true"]{opacity:1;transform:translateY(0)}
    .cw-weave-tooltip strong{display:block;margin-bottom:4px;font-size:12px}
    .cw-weave-tooltip .cw-color-chip{display:inline-block;width:10px;height:10px;margin-right:6px;border:1px solid rgba(255,255,255,.62);border-radius:50%;vertical-align:-1px}
  `;
  document.head.append(style);
}

function shortUid(value, length = 10) {
  const text = String(value || '');
  return text.length <= length ? text : `${text.slice(0, Math.max(4, length - 5))}…${text.slice(-4)}`;
}

function colorRgb(colorCode) {
  const text = String(colorCode || '#FFFFFF').replace('#', '').padEnd(8, 'F');
  return `#${text.slice(0, 6)}`;
}

function alphaFromColor(colorCode) {
  const text = String(colorCode || '#FFFFFFFF').replace('#', '').padEnd(8, 'F');
  return Number.parseInt(text.slice(6, 8), 16) / 255;
}

function chordJitter(chord, amplitude = 26) {
  const hex = String(chord?.chordHash || '').padEnd(8, '0');
  const x = Number.parseInt(hex.slice(0, 4), 16) / 0xffff;
  const y = Number.parseInt(hex.slice(4, 8), 16) / 0xffff;
  return { x: (x - 0.5) * amplitude * 2, y: (y - 0.5) * amplitude * 2 };
}

function normalizeWeave(weaveOrChords) {
  if (weaveOrChords?.chords) return weaveOrChords;
  const chords = Array.isArray(weaveOrChords) ? weaveOrChords : [];
  return { weaveUid: 'cwweave_transient', seedChordUid: chords[0]?.chordUid || null, chords };
}

function computeLayout(chords, width, options = {}) {
  const byUid = new Map(chords.map((chord) => [chord.chordUid, chord]));
  const levelByUid = new Map();
  const resolving = new Set();
  const resolveLevel = (chord) => {
    if (levelByUid.has(chord.chordUid)) return levelByUid.get(chord.chordUid);
    if (!chord.previousChordUid || !byUid.has(chord.previousChordUid)) {
      levelByUid.set(chord.chordUid, 0);
      return 0;
    }
    if (resolving.has(chord.chordUid)) {
      levelByUid.set(chord.chordUid, 0);
      return 0;
    }
    resolving.add(chord.chordUid);
    const level = resolveLevel(byUid.get(chord.previousChordUid)) + 1;
    resolving.delete(chord.chordUid);
    levelByUid.set(chord.chordUid, level);
    return level;
  };
  chords.forEach(resolveLevel);

  const levels = [];
  for (const chord of chords) {
    const level = levelByUid.get(chord.chordUid) || 0;
    if (!levels[level]) levels[level] = [];
    levels[level].push(chord);
  }
  const verticalSpacing = Number(options.levelSpacing) || 126;
  const horizontalSpacing = Number(options.horizontalSpacing) || 136;
  const marginTop = Number(options.marginTop) || 74;
  const centerX = width / 2;
  const positions = new Map();
  levels.forEach((rows, level) => {
    rows.sort((a, b) => String(a.chordUid).localeCompare(String(b.chordUid)));
    const span = horizontalSpacing * Math.max(0, rows.length - 1);
    rows.forEach((chord, index) => {
      const jitter = chordJitter(chord, Number(options.jitter) || 22);
      positions.set(chord.chordUid, {
        x: centerX - span / 2 + index * horizontalSpacing + jitter.x,
        y: marginTop + level * verticalSpacing + jitter.y,
        level,
      });
    });
  });
  return { positions, maxLevel: Math.max(0, levels.length - 1) };
}

function curvedPath(source, target) {
  const middleY = (source.y + target.y) / 2;
  return `M${source.x},${source.y} C${source.x},${middleY} ${target.x},${middleY} ${target.x},${target.y}`;
}

function starPoints(cx, cy, outer = 10, inner = 4.5, spikes = 6) {
  const points = [];
  for (let index = 0; index < spikes * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (Math.PI * index) / spikes;
    points.push(`${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`);
  }
  return points.join(' ');
}

export function renderWeaveStarmap(container, weaveOrChords, options = {}) {
  if (!(container instanceof Element)) throw new TypeError('A DOM container is required.');
  installStyles();
  container.classList.add('cw-weave-starmap');
  container.replaceChildren();

  const weave = normalizeWeave(weaveOrChords);
  const chords = weave.chords.filter((chord) => chord?.chordUid);
  const width = Math.max(Number(options.width) || container.clientWidth || 900, 560);
  const estimatedLevels = Math.max(1, new Set(chords.map((chord) => chord.chordIndex)).size);
  const height = Math.max(Number(options.height) || container.clientHeight || 540, estimatedLevels * 118 + 160);
  const weaveIndex = buildWeaveIndex(weave);
  const layout = computeLayout(chords, width, options);
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': options.ariaLabel || 'Civweave Weave starmap' });
  const viewport = svgElement('g');
  const backdropLayer = svgElement('g', { class: 'cw-stitch-backdrops' });
  const stitchLayer = svgElement('g', { class: 'cw-stitches' });
  const chordLayer = svgElement('g', { class: 'cw-chords' });
  viewport.append(backdropLayer, stitchLayer, chordLayer);
  svg.append(viewport);
  container.append(svg);

  const tooltip = document.createElement('div');
  tooltip.className = 'cw-weave-tooltip';
  tooltip.setAttribute('role', 'status');
  container.append(tooltip);

  const absolutePosition = (chordUid, slotIndex) => {
    const chordPosition = layout.positions.get(chordUid) || { x: width / 2, y: 60 };
    const offset = POSITION_OFFSETS[slotIndex] || { x: 0, y: 0 };
    return { x: chordPosition.x + offset.x, y: chordPosition.y + offset.y };
  };

  for (const chord of chords) {
    if (!chord.stitch) continue;
    const sourceHit = weaveIndex.byPositionUid.get(chord.stitch.fromPositionUid);
    const targetHit = weaveIndex.byPositionUid.get(chord.stitch.toPositionUid);
    if (!sourceHit || !targetHit) continue;
    const source = absolutePosition(sourceHit.chord.chordUid, sourceHit.position.slotIndex);
    const target = absolutePosition(targetHit.chord.chordUid, targetHit.position.slotIndex);
    const d = curvedPath(source, target);
    backdropLayer.append(svgElement('path', {
      class: 'cw-stitch-backdrop', d,
      'data-stitch-uid': chord.stitch.stitchUid,
      'data-from-position-uid': chord.stitch.fromPositionUid,
      'data-to-position-uid': chord.stitch.toPositionUid,
    }));
    stitchLayer.append(svgElement('path', {
      class: 'cw-stitch', d, stroke: chord.stitch.colorCode,
      'data-stitch-uid': chord.stitch.stitchUid,
      'data-from-position-uid': chord.stitch.fromPositionUid,
      'data-to-position-uid': chord.stitch.toPositionUid,
    }));
  }

  const showTooltip = (event, chord, position) => {
    const stitch = position.stitchUid ? weaveIndex.byStitchUid.get(position.stitchUid) : null;
    const stitchLine = stitch ? `<br>Stitch: ${stitch.stitchUid}<br>from: ${stitch.fromPositionUid}` : '';
    const title = chord.isSeedChord ? 'Seed Chord' : (chord.payloadRef || `Chord ${chord.chordIndex}`);
    tooltip.innerHTML = `<strong>${title}</strong><span class="cw-color-chip" style="background:${position.colorCode}"></span>${position.colorCode}<br>${position.positionName} · bit ${position.structuralBit}<br>structure ${chord.structure.roleString} · color ${chord.color.roleString}<br>${position.positionUid}${stitchLine}`;
    const bounds = container.getBoundingClientRect();
    tooltip.style.left = `${Math.min(Math.max(12, event.clientX - bounds.left + 14), Math.max(12, bounds.width - 360))}px`;
    tooltip.style.top = `${Math.min(Math.max(12, event.clientY - bounds.top + 14), Math.max(12, bounds.height - 150))}px`;
    tooltip.dataset.open = 'true';
  };
  const hideTooltip = () => { tooltip.dataset.open = 'false'; };

  for (const chord of chords) {
    const point = layout.positions.get(chord.chordUid) || { x: width / 2, y: 60 };
    const group = svgElement('g', {
      class: 'cw-chord', transform: `translate(${point.x} ${point.y})`,
      'data-chord-uid': chord.chordUid, 'data-seed': chord.isSeedChord ? 'true' : 'false',
    });
    group.append(svgElement('circle', { class: 'cw-chord-halo', r: 31 }));
    group.append(svgElement('circle', { class: 'cw-chord-core', r: 25 }));
    group.append(svgElement('polygon', { points: starPoints(0, 0), fill: 'rgba(255,255,255,.88)' }));

    for (const position of chord.positions || []) {
      const offset = POSITION_OFFSETS[position.slotIndex] || { x: 0, y: 0 };
      const marker = svgElement('g', {
        class: 'cw-weave-position', transform: `translate(${offset.x} ${offset.y})`, tabindex: '0', role: 'button',
        'aria-label': `${position.positionName} ${position.colorCode}`, 'data-position-uid': position.positionUid,
      });
      marker.append(svgElement('circle', { class: 'cw-position-ring', r: 7.2, stroke: colorRgb(position.colorCode), 'stroke-opacity': Math.max(0.34, alphaFromColor(position.colorCode)) }));
      marker.append(svgElement('circle', { class: 'cw-position-core', r: 4.8, fill: position.colorCode }));
      const title = svgElement('title');
      title.textContent = `${position.positionName} ${position.positionUid} ${position.colorCode}`;
      marker.append(title);
      marker.addEventListener('pointerenter', (event) => showTooltip(event, chord, position));
      marker.addEventListener('pointermove', (event) => showTooltip(event, chord, position));
      marker.addEventListener('pointerleave', hideTooltip);
      marker.addEventListener('focus', (event) => showTooltip(event, chord, position));
      marker.addEventListener('blur', hideTooltip);
      marker.addEventListener('click', (event) => {
        event.stopPropagation();
        const stitches = weaveIndex.stitchesFrom(position.positionUid);
        const successors = weaveIndex.stitchedSuccessors(position.positionUid);
        container.dispatchEvent(new CustomEvent('civweave:starmap-position-select', {
          bubbles: true,
          detail: { weave, chord, position, stitches, successors },
        }));
      });
      group.append(marker);
    }

    const label = svgElement('text', { x: 0, y: 43, 'text-anchor': 'middle' });
    label.textContent = chord.isSeedChord
      ? 'Seed Chord'
      : chord.payloadRef ? String(chord.payloadRef).slice(0, 26) : `Chord ${chord.chordIndex} ${shortUid(chord.chordUid, 14)}`;
    group.append(label);
    chordLayer.append(group);
  }

  let transform = { x: 0, y: 0, scale: 1 };
  let pan = null;
  const applyTransform = () => viewport.setAttribute('transform', `translate(${transform.x} ${transform.y}) scale(${transform.scale})`);
  svg.addEventListener('wheel', (event) => {
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const py = ((event.clientY - rect.top) / rect.height) * height;
    const previousScale = transform.scale;
    const nextScale = Math.max(0.3, Math.min(3, previousScale * Math.exp(-event.deltaY * 0.0015)));
    const worldX = (px - transform.x) / previousScale;
    const worldY = (py - transform.y) / previousScale;
    transform.x = px - worldX * nextScale;
    transform.y = py - worldY * nextScale;
    transform.scale = nextScale;
    applyTransform();
  }, { passive: false });
  svg.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest?.('.cw-weave-position')) return;
    pan = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y };
    svg.dataset.panning = 'true';
    svg.setPointerCapture?.(event.pointerId);
  });
  svg.addEventListener('pointermove', (event) => {
    if (!pan || pan.pointerId !== event.pointerId) return;
    const rect = svg.getBoundingClientRect();
    transform.x = pan.originX + ((event.clientX - pan.x) / rect.width) * width;
    transform.y = pan.originY + ((event.clientY - pan.y) / rect.height) * height;
    applyTransform();
  });
  const stopPan = (event) => {
    if (!pan || (event && pan.pointerId !== event.pointerId)) return;
    pan = null;
    svg.dataset.panning = 'false';
  };
  svg.addEventListener('pointerup', stopPan);
  svg.addEventListener('pointercancel', stopPan);

  const focusChord = (chordUid, scale = 1.45) => {
    const point = layout.positions.get(chordUid);
    if (!point) return false;
    transform.scale = Math.max(0.3, Math.min(3, Number(scale) || 1.45));
    transform.x = width / 2 - point.x * transform.scale;
    transform.y = Math.min(height * 0.42, 220) - point.y * transform.scale;
    applyTransform();
    return true;
  };
  const focusPosition = (positionUid, scale = 1.7) => {
    const hit = weaveIndex.byPositionUid.get(positionUid);
    return hit ? focusChord(hit.chord.chordUid, scale) : false;
  };

  return {
    svg, weave, weaveIndex, focusChord, focusPosition,
    reset() { transform = { x: 0, y: 0, scale: 1 }; applyTransform(); },
    destroy() { container.replaceChildren(); container.classList.remove('cw-weave-starmap'); },
  };
}

export async function renderWeavePayloads(container, payloads, options = {}) {
  const weave = await createWeave(payloads, options.weaving || options.chain || {});
  return { weave, starmap: renderWeaveStarmap(container, weave, options) };
}

// Compatibility aliases for the first staging prototype.
export const renderCryptographicStarmap = renderWeaveStarmap;
export const renderCryptographicPayloads = renderWeavePayloads;

globalThis.CivweaveCryptographicStarmapV1 = Object.freeze({
  renderWeaveStarmap,
  renderWeavePayloads,
  renderCryptographicStarmap,
  renderCryptographicPayloads,
});
