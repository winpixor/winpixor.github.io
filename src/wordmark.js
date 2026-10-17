// WINPIXOR wordmark, drawn as routed metal traces: every stroke is a centreline
// on a unit grid using only 0/45/90 degree segments, like real chip layout.
// Shared by the build-time SVG (index.html) and the die texture (canvas).

const H = 8; // cap height in grid units
const GAP = 2.4; // space between glyphs

// Each glyph: advance width + list of polylines ([x,y] points). Closed paths end on their start.
const GLYPHS = {
  W: { w: 6, paths: [[[0, 0], [0, 7], [1, 8], [5, 8], [6, 7], [6, 0]], [[3, 8], [3, 3]]] },
  I: { w: 0, paths: [[[0, 0], [0, 8]]] },
  N: { w: 6, paths: [[[0, 8], [0, 0], [6, 6]], [[6, 0], [6, 8]]] },
  P: { w: 6, paths: [[[0, 8], [0, 0], [5, 0], [6, 1], [6, 3], [5, 4], [0, 4]]] },
  X: { w: 6, paths: [[[0, 0], [0, 1], [6, 7], [6, 8]], [[6, 0], [6, 1], [0, 7], [0, 8]]] },
  O: { w: 6, paths: [[[1, 0], [5, 0], [6, 1], [6, 7], [5, 8], [1, 8], [0, 7], [0, 1], [1, 0]]] },
  R: { w: 6, paths: [[[0, 8], [0, 0], [5, 0], [6, 1], [6, 3], [5, 4], [0, 4]], [[3, 4], [6, 7], [6, 8]]] },
};

export const STROKE = 1.15;

/** Layout a word into absolute polylines. Returns { paths, width, height }. */
export function layout(word = 'WINPIXOR') {
  const paths = [];
  let x = STROKE / 2;
  for (const ch of word) {
    const g = GLYPHS[ch];
    for (const p of g.paths) paths.push(p.map(([px, py]) => [px + x, py + STROKE / 2]));
    x += g.w + GAP;
  }
  return { paths, width: x - GAP + STROKE / 2, height: H + STROKE };
}

/** Inline SVG string for the wordmark. */
export function svg({ className = '', title = 'WINPIXOR' } = {}) {
  const { paths, width, height } = layout();
  const d = paths.map((p) => 'M' + p.map(([x, y]) => `${+x.toFixed(3)} ${y}`).join('L')).join('');
  return (
    `<svg class="${className}" viewBox="0 0 ${+width.toFixed(3)} ${height}" role="img" aria-label="${title}">` +
    `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linejoin="miter" stroke-miterlimit="2" stroke-linecap="square"/></svg>`
  );
}

/** Draw the wordmark onto a 2D canvas context at (x, y) with the given cap height in px. */
export function draw(ctx, x, y, capPx, { pads = false, weight = 1 } = {}) {
  const { paths } = layout();
  const s = capPx / H;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = STROKE * s * weight;
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 2;
  ctx.lineCap = 'square';
  ctx.beginPath();
  for (const p of paths) {
    p.forEach(([px, py], i) => (i ? ctx.lineTo(px * s, py * s) : ctx.moveTo(px * s, py * s)));
  }
  ctx.stroke();
  if (pads) {
    // via landing pads on open trace ends, as a router would leave them
    const r = STROKE * s * weight * 1.1;
    for (const p of paths) {
      const a = p[0], b = p[p.length - 1];
      if (a[0] === b[0] && a[1] === b[1]) continue;
      for (const [px, py] of [a, b]) ctx.strokeRect(px * s - r, py * s - r, r * 2, r * 2);
    }
  }
  ctx.restore();
}
