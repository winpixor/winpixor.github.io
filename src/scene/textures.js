// Procedural layer artwork for the die, drawn on 2D canvases at runtime.
// Canvas coordinates map straight onto the die: x → world x, y → world z.
import { draw as drawWordmark, layout } from '../wordmark.js';

export const BLOCKS = [
  [0.08, 0.08, 0.38, 0.3], // nt_internals
  [0.5, 0.08, 0.42, 0.22], // linux_sys
  [0.5, 0.34, 0.2, 0.26], // web_appsec
  [0.74, 0.34, 0.18, 0.26], // vuln_research
  [0.08, 0.42, 0.38, 0.22], // reverse_eng
  [0.08, 0.68, 0.3, 0.24], // exploit_dev
  [0.42, 0.64, 0.5, 0.28], // tooling
];

// one large test structure per project, stacked down the centre of the die
export const PROBE_HALF = 0.17; // half-width of a structure (pad to pad), die fraction
export const probeSpot = (i, n) => [0.5, n < 2 ? 0.5 : 0.24 + (0.52 * i) / (n - 1)];

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = g.fillStyle = '#fff';
  return [c, g];
}

function frame(g, S) {
  // seal ring + scribe edge, the outline every die carries
  g.globalAlpha = 0.9;
  g.lineWidth = S * 0.0035;
  g.strokeRect(S * 0.012, S * 0.012, S * 0.976, S * 0.976);
  g.globalAlpha = 0.45;
  g.lineWidth = S * 0.0015;
  g.strokeRect(S * 0.022, S * 0.022, S * 0.956, S * 0.956);
  g.globalAlpha = 1;
}

/** Manhattan routing: short wires with jogs and vias, inside a rect (fractions). */
function route(g, S, r, { count, pitch, width, alpha, rand, vias = true }) {
  const [rx, ry, rw, rh] = r.map((v) => v * S);
  const step = pitch * S;
  const snap = (v, o) => o + Math.round((v - o) / step) * step;
  g.lineWidth = width * S;
  g.globalAlpha = alpha;
  for (let k = 0; k < count; k++) {
    let x = snap(rx + rand() * rw, rx);
    let y = snap(ry + rand() * rh, ry);
    g.beginPath();
    g.moveTo(x, y);
    const segs = 2 + Math.floor(rand() * 4);
    let horiz = rand() < 0.5;
    const corners = [];
    for (let s = 0; s < segs; s++) {
      const len = (2 + Math.floor(rand() * 14)) * step * (rand() < 0.5 ? -1 : 1);
      if (horiz) x = Math.min(rx + rw, Math.max(rx, x + len));
      else y = Math.min(ry + rh, Math.max(ry, y + len));
      g.lineTo(x, y);
      corners.push([x, y]);
      horiz = !horiz;
    }
    g.stroke();
    if (vias) {
      const v = width * S * 1.6;
      for (const [cx, cy] of corners) if (rand() < 0.35) g.fillRect(cx - v, cy - v, v * 2, v * 2);
    }
  }
  g.globalAlpha = 1;
}

/** Top passivation: the die-mark, bond pads, seal ring. */
export function passTexture(S) {
  const [c, g] = canvas(S);
  const rand = rng(7);
  frame(g, S);
  // bond pads around the perimeter
  const n = 18;
  g.lineWidth = S * 0.002;
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < n; i++) {
      const t = 0.1 + (0.8 * i) / (n - 1);
      const p = S * 0.034;
      const a = S * 0.045;
      const [x, y] = [[t * S, a], [S - a, t * S], [t * S, S - a], [a, t * S]][side];
      g.globalAlpha = 0.85;
      g.strokeRect(x - p / 2, y - p / 2, p, p);
      g.globalAlpha = 0.25;
      g.fillRect(x - p / 2 + 3, y - p / 2 + 3, p - 6, p - 6);
    }
  }
  g.globalAlpha = 1;
  // faint underlying routing showing through the glass
  route(g, S, [0.1, 0.1, 0.8, 0.8], { count: 90, pitch: 0.01, width: 0.0024, alpha: 0.16, rand, vias: false });
  // the die-mark itself
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.fillRect(S * 0.12, S * 0.6, S * 0.76, S * 0.17);
  g.fillStyle = '#fff';
  const cap = S * 0.105;
  const wmW = (cap / 8) * layout().width;
  drawWordmark(g, (S - wmW) / 2, S * 0.625, cap, { pads: true, weight: 0.5 });
  // alignment marks
  g.globalAlpha = 0.8;
  g.lineWidth = S * 0.002;
  for (const [x, y] of [[0.14, 0.14], [0.86, 0.14], [0.14, 0.5]]) {
    g.beginPath();
    g.moveTo(x * S - S * 0.018, y * S);
    g.lineTo(x * S + S * 0.018, y * S);
    g.moveTo(x * S, y * S - S * 0.018);
    g.lineTo(x * S, y * S + S * 0.018);
    g.stroke();
  }
  return c;
}

/** Top metal: thick power straps. */
export function m7Texture(S) {
  const [c, g] = canvas(S);
  const rand = rng(11);
  frame(g, S);
  g.globalAlpha = 0.85;
  for (let i = 0; i < 9; i++) {
    const y = S * (0.1 + i * 0.1);
    g.fillRect(S * 0.06, y, S * 0.88, S * 0.022);
    g.globalAlpha = 0.25;
    g.fillRect(S * 0.06, y + S * 0.034, S * 0.88, S * 0.006);
    g.globalAlpha = 0.85;
  }
  g.globalAlpha = 0.5;
  for (let i = 0; i < 6; i++) g.fillRect(S * (0.12 + i * 0.152), S * 0.06, S * 0.012, S * 0.88);
  // via stacks where the straps cross
  g.globalAlpha = 1;
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 9; j++) {
      const x = S * (0.12 + i * 0.152), y = S * (0.1 + j * 0.1);
      g.fillRect(x - S * 0.004, y + S * 0.004, S * 0.02, S * 0.014);
    }
  route(g, S, [0.06, 0.06, 0.88, 0.88], { count: 40, pitch: 0.02, width: 0.004, alpha: 0.35, rand });
  return c;
}

/** Mid metal: the floorplan, one outlined block per interest. */
export function m4Texture(S) {
  const [c, g] = canvas(S);
  const rand = rng(23);
  frame(g, S);
  // routing channels between blocks
  route(g, S, [0.04, 0.04, 0.92, 0.92], { count: 160, pitch: 0.008, width: 0.0026, alpha: 0.45, rand });
  for (const [bx, by, bw, bh] of BLOCKS) {
    const [x, y, w, h] = [bx * S, by * S, bw * S, bh * S];
    g.fillStyle = '#000';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#fff';
    // standard-cell rows
    g.globalAlpha = 0.2;
    const row = S * 0.012;
    for (let yy = y + row; yy < y + h - row * 0.5; yy += row) g.fillRect(x + S * 0.008, yy, w - S * 0.016, row * 0.42);
    route(g, S, [bx + 0.01, by + 0.01, bw - 0.02, bh - 0.02], { count: Math.round(bw * bh * 900), pitch: 0.006, width: 0.0014, alpha: 0.55, rand });
    g.globalAlpha = 1;
    g.lineWidth = S * 0.003;
    g.strokeRect(x, y, w, h);
    // block pin
    g.fillRect(x - S * 0.004, y - S * 0.004, S * 0.012, S * 0.012);
  }
  return c;
}

/** Bottom metal: a quiet field of local interconnect around a clear centre lane
 *  holding one serpentine test structure per project. */
export function m1Texture(S, probes) {
  const [c, g] = canvas(S);
  const rand = rng(31);
  frame(g, S);
  // sparse interconnect on both flanks, the centre lane left clean
  route(g, S, [0.05, 0.05, 0.22, 0.9], { count: 160, pitch: 0.006, width: 0.0016, alpha: 0.28, rand });
  route(g, S, [0.73, 0.05, 0.22, 0.9], { count: 160, pitch: 0.006, width: 0.0016, alpha: 0.28, rand });
  g.globalAlpha = 0.5;
  g.lineWidth = S * 0.0015;
  g.strokeRect(S * 0.29, S * 0.06, S * 0.42, S * 0.88); // lane boundary
  g.globalAlpha = 1;
  for (let i = 0; i < probes; i++) {
    const [u, v] = probeSpot(i, probes);
    const px = u * S, py = v * S;
    const half = PROBE_HALF * S, pad = S * 0.07;
    for (const x of [px - half, px + half - pad]) {
      g.globalAlpha = 1;
      g.lineWidth = S * 0.003;
      g.strokeRect(x, py - pad / 2, pad, pad);
      g.globalAlpha = 0.3;
      g.fillRect(x + S * 0.008, py - pad / 2 + S * 0.008, pad - S * 0.016, pad - S * 0.016);
    }
    // serpentine resistor between the pads
    g.globalAlpha = 0.95;
    g.lineWidth = S * 0.0022;
    const x0 = px - half + pad, x1 = px + half - pad, amp = pad * 0.42, turns = 12, step = (x1 - x0) / turns;
    g.beginPath();
    g.moveTo(x0, py);
    for (let t = 0; t < turns; t++) {
      const y = py + (t % 2 ? -amp : amp);
      g.lineTo(x0 + t * step, y);
      g.lineTo(x0 + (t + 1) * step, y);
    }
    g.lineTo(x1, py);
    g.stroke();
    // structure index, etched beside it
    g.globalAlpha = 0.6;
    g.font = `500 ${S * 0.018}px "JetBrains Mono Variable", monospace`;
    g.fillText(`TS-${String(i + 1).padStart(2, '0')}`, px - half, py - pad * 0.75);
  }
  g.globalAlpha = 1;
  return c;
}
