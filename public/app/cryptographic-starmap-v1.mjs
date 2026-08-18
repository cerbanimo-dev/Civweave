import { buildCryptographicMapIndex, createCryptographicChain } from './shared/civweave-cryptographic-map-v1.mjs';

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
    .cw-crypto-starmap{position:relative;overflow:hidden;min-height:420px;background:radial-gradient(circle at 50% 45%,rgba(63,72,110,.22),rgba(5,7,18,.96) 62%,#02030a 100%);border:1px solid rgba(255,255,255,.12);border-radius:18px;color:#fff;touch-action:none;user-select:none}
    .cw-crypto-starmap svg{display:block;width:100%;height:100%;min-height:420px;cursor:grab}
    .cw-crypto-starmap svg[data-panning="true"]{cursor:grabbing}
    .cw-crypto-record .cw-record-core{fill:#070a16;stroke:rgba(255,255,255,.76);stroke-width:1.2}
    .cw-crypto-record .cw-record-halo{fill:none;stroke:rgba(255,255,255,.12);stroke-width:7}
    .cw-crypto-record text{fill:rgba(255,255,255,.88);font:11px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;pointer-events:none}
    .cw-crypto-position{cursor:pointer;transition:filter .12s ease}
    .cw-crypto-position:hover{filter:brightness(1.55)}
    .cw-crypto-position .cw-position-ring{fill:none;stroke-width:2.4}
    .cw-crypto-position .cw-position-core{stroke:rgba(255,255,255,.72);stroke-width:.8}
    .cw-crypto-link-backdrop{fill:none;stroke:rgba(255,255,255,.16);stroke-width:5;stroke-linecap:round}
    .cw-crypto-link{fill:none;stroke-width:2.1;stroke-linecap:round}
    .cw-crypto-tooltip{position:absolute;z-index:4;max-width:min(440px,calc(100% - 24px));pointer-events:none;padding:10px 12px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(4,6,16,.94);box-shadow:0 12px 38px rgba(0,0,0,.42);font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#fff;opacity:0;transform:translateY(5px);transition:opacity .1s ease,transform .1s ease;white-space:normal;overflow-wrap:anywhere}
    .cw-crypto-tooltip[data-open="true"]{opacity:1;transform:translateY(0)}
    .cw-crypto-tooltip strong{display:block;margin-bottom:4px;font-size:12px}
    .cw-crypto-tooltip .cw-color-chip{display:inline-block;width:10px;height:10px;margin-right:6px;border:1px solid rgba(255,255,255,.62);border-radius:50%;vertical-align:-1px}
  `;
  document.head.append(style);
}

function shortUid(value, length = 10) {
  const text = String(value || '');
  if (text.length <= length) return text;
  return `${text.slice(0, Math.max(4, length - 5))}…${text.slice(-4)}`;
}

function colorRgb(colorCode) {
  const text = String(colorCode || '#FFFFFF').replace('#', '').padEnd(8, 'F');
  return `#${text.slice(0, 6)}`;
}

function alphaFromColor(colorCode) {
  const text = String(colorCode || '#FFFFFFFF').replace('#', '').padEnd(8, 'F');
  return Number.parseInt(text.slice(6, 8), 16) / 255;
}

function recordJitter(record, amplitude = 26) {
  const hex = String(record?.recordHash || '').padEnd(8, '0');
  const x = Number.parseInt(hex.slice(0, 4), 16) / 0xffff;
  const y = Number.parseInt(hex.slice(4, 8), 16) / 0xffff;
  return { x: (x - 0.5) * amplitude * 2, y: (y - 0.5) * amplitude * 2 };
}

function computeLayout(records, width, options = {}) {
  const byUid = new Map(records.map((record) => [record.recordUid, record]));
  const levelByUid = new Map();
  const resolving = new Set();

  const resolveLevel = (record) => {
    if (levelByUid.has(record.recordUid)) return levelByUid.get(record.recordUid);
    if (!record.previousRecordUid || !byUid.has(record.previousRecordUid)) {
      levelByUid.set(record.recordUid, 0);
      return 0;
    }
    if (resolving.has(record.recordUid)) {
      levelByUid.set(record.recordUid, 0);
      return 0;
    }
    resolving.add(record.recordUid);
    const level = resolveLevel(byUid.get(record.previousRecordUid)) + 1;
    resolving.delete(record.recordUid);
    levelByUid.set(record.recordUid, level);
    return level;
  };

  records.forEach(resolveLevel);
  const levels = [];
  for (const record of records) {
    const level = levelByUid.get(record.recordUid) || 0;
    if (!levels[level]) levels[level] = [];
    levels[level].push(record);
  }

  const verticalSpacing = Number(options.levelSpacing) || 126;
  const horizontalSpacing = Number(options.horizontalSpacing) || 136;
  const marginTop = Number(options.marginTop) || 74;
  const centerX = width / 2;
  const positions = new Map();

  levels.forEach((rows, level) => {
    rows.sort((a, b) => String(a.recordUid).localeCompare(String(b.recordUid)));
    const span = horizontalSpacing * Math.max(0, rows.length - 1);
    rows.forEach((record, index) => {
      const jitter = recordJitter(record, Number(options.jitter) || 22);
      positions.set(record.recordUid, {
        x: centerX - span / 2 + index * horizontalSpacing + jitter.x,
        y: marginTop + level * verticalSpacing + jitter.y,
        level,
      });
    });
  });

  return { positions, maxLevel: Math.max(0, levels.length - 1), verticalSpacing, marginTop };
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

export function renderCryptographicStarmap(container, records = [], options = {}) {
  if (!(container instanceof Element)) throw new TypeError('A DOM container is required.');
  installStyles();
  container.classList.add('cw-crypto-starmap');
  container.replaceChildren();

  const rows = Array.isArray(records) ? records.filter((record) => record?.recordUid) : [];
  const width = Math.max(Number(options.width) || container.clientWidth || 900, 560);
  const estimatedLevels = Math.max(1, new Set(rows.map((record) => record.recordIndex)).size);
  const height = Math.max(Number(options.height) || container.clientHeight || 540, estimatedLevels * 118 + 160);
  const mapIndex = buildCryptographicMapIndex(rows);
  const layout = computeLayout(rows, width, options);
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': options.ariaLabel || 'Civweave cryptographic starmap' });
  const viewport = svgElement('g');
  const backdropLayer = svgElement('g', { class: 'cw-link-backdrops' });
  const linkLayer = svgElement('g', { class: 'cw-links' });
  const nodeLayer = svgElement('g', { class: 'cw-records' });
  viewport.append(backdropLayer, linkLayer, nodeLayer);
  svg.append(viewport);
  container.append(svg);

  const tooltip = document.createElement('div');
  tooltip.className = 'cw-crypto-tooltip';
  tooltip.setAttribute('role', 'status');
  container.append(tooltip);

  const absolutePosition = (recordUid, slotIndex) => {
    const recordPosition = layout.positions.get(recordUid) || { x: width / 2, y: 60 };
    const offset = POSITION_OFFSETS[slotIndex] || { x: 0, y: 0 };
    return { x: recordPosition.x + offset.x, y: recordPosition.y + offset.y };
  };

  for (const record of rows) {
    for (const targetPosition of record.positions || []) {
      if (!targetPosition.inheritedFromPositionUid) continue;
      const sourceHit = mapIndex.byPositionUid.get(targetPosition.inheritedFromPositionUid);
      if (!sourceHit) continue;
      const source = absolutePosition(sourceHit.record.recordUid, sourceHit.position.slotIndex);
      const target = absolutePosition(record.recordUid, targetPosition.slotIndex);
      const d = curvedPath(source, target);
      const backdrop = svgElement('path', {
        class: 'cw-crypto-link-backdrop',
        d,
        'data-source-position-uid': sourceHit.position.positionUid,
        'data-target-position-uid': targetPosition.positionUid,
      });
      const link = svgElement('path', {
        class: 'cw-crypto-link',
        d,
        stroke: sourceHit.position.colorCode,
        'data-source-position-uid': sourceHit.position.positionUid,
        'data-target-position-uid': targetPosition.positionUid,
      });
      backdropLayer.append(backdrop);
      linkLayer.append(link);
    }
  }

  const showTooltip = (event, record, position) => {
    const inherited = position.inheritedFromPositionUid ? `<br>from: ${position.inheritedFromPositionUid}` : '';
    tooltip.innerHTML = `<strong>${record.payloadRef || `Record ${record.recordIndex}`}</strong><span class="cw-color-chip" style="background:${position.colorCode}"></span>${position.colorCode}<br>${position.positionName} · bit ${position.structuralBit} · ${record.structure.roleString}<br>${position.positionUid}${inherited}`;
    const bounds = container.getBoundingClientRect();
    const left = Math.min(Math.max(12, event.clientX - bounds.left + 14), Math.max(12, bounds.width - 360));
    const top = Math.min(Math.max(12, event.clientY - bounds.top + 14), Math.max(12, bounds.height - 130));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.dataset.open = 'true';
  };
  const hideTooltip = () => { tooltip.dataset.open = 'false'; };

  for (const record of rows) {
    const point = layout.positions.get(record.recordUid) || { x: width / 2, y: 60 };
    const group = svgElement('g', {
      class: 'cw-crypto-record',
      transform: `translate(${point.x} ${point.y})`,
      'data-record-uid': record.recordUid,
    });
    group.append(svgElement('circle', { class: 'cw-record-halo', r: 31 }));
    group.append(svgElement('circle', { class: 'cw-record-core', r: 25 }));
    group.append(svgElement('polygon', { points: starPoints(0, 0), fill: 'rgba(255,255,255,.88)' }));

    for (const position of record.positions || []) {
      const offset = POSITION_OFFSETS[position.slotIndex] || { x: 0, y: 0 };
      const marker = svgElement('g', {
        class: 'cw-crypto-position',
        transform: `translate(${offset.x} ${offset.y})`,
        tabindex: '0',
        role: 'button',
        'aria-label': `${position.positionName} ${position.colorCode}`,
        'data-position-uid': position.positionUid,
      });
      marker.append(svgElement('circle', {
        class: 'cw-position-ring',
        r: 7.2,
        stroke: colorRgb(position.colorCode),
        'stroke-opacity': Math.max(0.34, alphaFromColor(position.colorCode)),
      }));
      marker.append(svgElement('circle', {
        class: 'cw-position-core',
        r: 4.8,
        fill: position.colorCode,
      }));
      const title = svgElement('title');
      title.textContent = `${position.positionName} ${position.positionUid} ${position.colorCode}`;
      marker.append(title);
      marker.addEventListener('pointerenter', (event) => showTooltip(event, record, position));
      marker.addEventListener('pointermove', (event) => showTooltip(event, record, position));
      marker.addEventListener('pointerleave', hideTooltip);
      marker.addEventListener('focus', () => {
        tooltip.innerHTML = `<strong>${record.payloadRef || `Record ${record.recordIndex}`}</strong>${position.positionName}<br>${position.colorCode}<br>${position.positionUid}`;
        tooltip.style.left = '12px';
        tooltip.style.top = '12px';
        tooltip.dataset.open = 'true';
      });
      marker.addEventListener('blur', hideTooltip);
      marker.addEventListener('click', (event) => {
        event.stopPropagation();
        container.dispatchEvent(new CustomEvent('civweave:starmap-position-select', {
          bubbles: true,
          detail: { record, position, successors: mapIndex.successorPositions(position.positionUid) },
        }));
      });
      group.append(marker);
    }

    const label = svgElement('text', { x: 0, y: 43, 'text-anchor': 'middle' });
    label.textContent = record.payloadRef ? String(record.payloadRef).slice(0, 26) : `#${record.recordIndex} ${shortUid(record.recordUid, 14)}`;
    group.append(label);
    nodeLayer.append(group);
  }

  let transform = { x: 0, y: 0, scale: 1 };
  let pan = null;
  const applyTransform = () => {
    viewport.setAttribute('transform', `translate(${transform.x} ${transform.y}) scale(${transform.scale})`);
  };

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
    if (event.button !== 0 || event.target.closest?.('.cw-crypto-position')) return;
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

  const focusRecord = (recordUid, scale = 1.45) => {
    const point = layout.positions.get(recordUid);
    if (!point) return false;
    transform.scale = Math.max(0.3, Math.min(3, Number(scale) || 1.45));
    transform.x = width / 2 - point.x * transform.scale;
    transform.y = Math.min(height * 0.42, 220) - point.y * transform.scale;
    applyTransform();
    return true;
  };

  const focusPosition = (positionUid, scale = 1.7) => {
    const hit = mapIndex.byPositionUid.get(positionUid);
    return hit ? focusRecord(hit.record.recordUid, scale) : false;
  };

  return {
    svg,
    mapIndex,
    focusRecord,
    focusPosition,
    reset() {
      transform = { x: 0, y: 0, scale: 1 };
      applyTransform();
    },
    destroy() {
      container.replaceChildren();
      container.classList.remove('cw-crypto-starmap');
    },
  };
}

export async function renderCryptographicPayloads(container, payloads, options = {}) {
  const records = await createCryptographicChain(payloads, options.chain || {});
  return { records, starmap: renderCryptographicStarmap(container, records, options) };
}

globalThis.CivweaveCryptographicStarmapV1 = Object.freeze({
  renderCryptographicStarmap,
  renderCryptographicPayloads,
});
