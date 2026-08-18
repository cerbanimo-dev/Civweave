const STYLE_ID = 'civweave-weave-history-wall-v1-style';
function markerName(index) { let n = Math.max(0, Math.floor(Number(index) || 0)) + 1, name = ''; while (n > 0) { n -= 1; name = String.fromCharCode(65 + (n % 26)) + name; n = Math.floor(n / 26); } return name; }
function rgbaCss(code) { const value = String(code || '#000000FF').replace('#', '').padEnd(8, 'F'), r = Number.parseInt(value.slice(0, 2), 16), g = Number.parseInt(value.slice(2, 4), 16), b = Number.parseInt(value.slice(4, 6), 16), a = Number.parseInt(value.slice(6, 8), 16) / 255; return `rgba(${r},${g},${b},${a})`; }
function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style'); style.id = STYLE_ID;
  style.textContent = `.cw-weave-history{display:grid;gap:3px;width:100%;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}.cw-weave-history-chord{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;min-height:58px;position:relative}.cw-weave-history-chord[data-seed="true"]{outline:1px solid rgba(255,255,255,.52);outline-offset:2px;margin:3px 0 4px}.cw-weave-history-cell{position:relative;display:grid;place-items:center;overflow:hidden;min-width:0;border:1px solid rgba(255,255,255,.11);background-color:#11141b;background-image:linear-gradient(45deg,rgba(255,255,255,.05) 25%,transparent 25%),linear-gradient(-45deg,rgba(255,255,255,.05) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(255,255,255,.05) 75%),linear-gradient(-45deg,transparent 75%,rgba(255,255,255,.05) 75%);background-size:14px 14px;background-position:0 0,0 7px,7px -7px,-7px 0;isolation:isolate}.cw-weave-history-swatch{position:absolute;inset:0;z-index:-2;background:var(--cw-rgba)}.cw-weave-history-shade{position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(0,0,0,.03),rgba(0,0,0,.38))}.cw-weave-history-letter{font-size:clamp(20px,3vw,34px);line-height:1;font-weight:950;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.8)}@media(max-width:680px){.cw-weave-history{gap:2px}.cw-weave-history-chord{gap:2px;min-height:44px}.cw-weave-history-letter{font-size:20px}}`;
  document.head.append(style);
}
function titleFor(chord, position, letter) { return [chord.isSeedChord ? 'Seed Chord' : `Chord ${chord.chordIndex}`, `letter: ${letter}`, `color: ${position.colorCode}`, `weave position: ${position.positionUid}`, `Chord UID: ${chord.chordUid}`, `Chord hash: ${chord.chordHash}`, `binary structure: ${chord.structure?.bitString || ''} / ${chord.structure?.roleString || ''}`, `color lineage: ${chord.color?.roleString || ''}`, position.stitchUid ? `Stitch: ${position.stitchUid}` : 'Stitch: none'].join('\n'); }
export function renderWeaveHistoryWall(container, weave, options = {}) {
  if (!(container instanceof Element)) throw new TypeError('A DOM container is required.'); installStyles();
  const chords = Array.isArray(weave) ? weave : (Array.isArray(weave?.chords) ? weave.chords : []), root = document.createElement('div'); root.className = 'cw-weave-history'; root.dataset.weaveUid = String(weave?.weaveUid || '');
  const colorLetters = new Map(); let nextLetter = 0;
  for (const chord of chords) {
    const row = document.createElement('div'); row.className = 'cw-weave-history-chord'; row.dataset.chordUid = chord.chordUid; row.dataset.seed = chord.isSeedChord ? 'true' : 'false'; row.setAttribute('aria-label', `${chord.isSeedChord ? 'Seed Chord' : `Chord ${chord.chordIndex}`}: ${chord.color?.roleString || ''}`);
    for (const position of chord.positions || []) {
      if (!colorLetters.has(position.colorUid)) colorLetters.set(position.colorUid, markerName(nextLetter++));
      const letter = colorLetters.get(position.colorUid), cell = document.createElement('div'); cell.className = 'cw-weave-history-cell'; cell.style.setProperty('--cw-rgba', rgbaCss(position.colorCode)); cell.dataset.positionUid = position.positionUid; cell.dataset.colorUid = position.colorUid; cell.dataset.letter = letter; cell.title = titleFor(chord, position, letter);
      const swatch = document.createElement('span'); swatch.className = 'cw-weave-history-swatch'; const shade = document.createElement('span'); shade.className = 'cw-weave-history-shade'; const marker = document.createElement('span'); marker.className = 'cw-weave-history-letter'; marker.textContent = letter; cell.append(swatch, shade, marker); row.append(cell);
    }
    root.append(row);
  }
  container.replaceChildren(root); return { element: root, weave, colorLetters, destroy() { container.replaceChildren(); } };
}
globalThis.CivweaveWeaveHistoryWallV1 = Object.freeze({ renderWeaveHistoryWall });
