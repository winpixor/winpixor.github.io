// The WINPIXOR die: a real-time chip whose layers separate as the visitor
// scrolls down through it. Every visual state is a pure function of scroll
// position (plus a little damping), so fast scrolling, jumping to an anchor or
// scrolling backwards always lands on the same frame.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, PlaneGeometry, BoxGeometry, EdgesGeometry,
  LineSegments, LineBasicMaterial, MeshStandardMaterial, ShaderMaterial, CanvasTexture, Color, Vector2, Vector3,
  BufferGeometry, Float32BufferAttribute, Points, AmbientLight, DirectionalLight, PointLight, SRGBColorSpace,
  LinearMipmapLinearFilter, AdditiveBlending, NormalBlending, MathUtils, QuadraticBezierCurve3,
} from 'three';
import { BLOCKS, PROBE_HALF, probeSpot, passTexture, m7Texture, m4Texture, m1Texture } from './textures.js';

const DIE = 10; // die edge, world units
const VOID = new Color('#0c1117');
const ICE = new Color('#cfe3f2');
const SIGNAL = new Color('#4b93ff');

// Camera + scene state at the centre of each chapter.
// az/el in radians around `target`; shift = horizontal lens shift (fraction of width);
// show = opacity of [PASS, M7, M4, M1]; body = die body; lat = crystal lattice; wire = bond wires.
const KEYS = [
  { target: [0, -3.4, 0], az: 0.72, el: 0.62, dist: 33, shift: 0.2, explode: 0, show: [1, 0.14, 0.06, 0.04], body: 1, lat: 0, wire: 0.06 },
  { target: [0, 2.2, 0], az: 1.05, el: 0.34, dist: 27, shift: 0.22, explode: 1, show: [0.6, 1, 0.6, 0.45], body: 1, lat: 0, wire: 0 },
  { target: [0, 1.5, 0.4], az: 0.18, el: 1.12, dist: 22.5, shift: 0.26, explode: 1, show: [0.04, 0.1, 1, 0.3], body: 1, lat: 0, wire: 0 },
  { target: [0, 0.1, -0.9], az: 0, el: 1.02, dist: 15.5, shift: 0.27, explode: 1, show: [0.03, 0.05, 0.1, 1], body: 1, lat: 0, wire: 0 },
  // looking down a <110> axis of the silicon lattice, so its hexagonal channels line up
  { target: [0.31, -8.63, -0.31], az: Math.PI / 4 + 0.035, el: 0, dist: 7.5, shift: 0, explode: 1.25, show: [0, 0, 0, 0], body: 0, lat: 1, wire: 0 },
  { target: [0, -0.6, 0], az: 0.5, el: 0.98, dist: 54, shift: 0.22, explode: 0, show: [1, 0.6, 0.5, 0.4], body: 1, lat: 0, wire: 1 },
];
const NUM = ['az', 'el', 'dist', 'shift', 'explode', 'body', 'lat', 'wire'];
const MOBILE_SHIFT = 0; // die stays centred behind the text on narrow screens

const plateVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const plateFrag = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uColor;
  uniform float uOpacity, uSweep, uTime, uReveal;
  uniform vec2 uLight;
  uniform vec4 uHot;
  uniform float uHotAmt;
  varying vec2 vUv;
  void main() {
    float m = texture2D(map, vUv).r;
    // cold light sweeping diagonally across the layer
    float d = dot(vUv - 0.5, normalize(vec2(1.0, 0.55)));
    float band = exp(-pow((d - uSweep) * 5.0, 2.0));
    vec2 dl = vUv - uLight;
    float spot = exp(-dot(dl, dl) * 14.0);
    float lit = 0.85 + 1.3 * band + 0.6 * spot;
    // etch reveal: the layer is drawn in from one corner during the intro
    float rv = 1.0 - smoothstep(uReveal - 0.08, uReveal, vUv.x * 0.5 + (1.0 - vUv.y) * 0.5);
    vec3 col = uColor * m * lit * rv;
    float inHot = step(uHot.x, vUv.x) * step(vUv.x, uHot.z) * step(uHot.y, vUv.y) * step(vUv.y, uHot.w);
    col = mix(col, vec3(0.29, 0.58, 1.0) * (0.35 + m * 1.8), inHot * uHotAmt);
    // plain hairline at the layer edge
    float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float fr = smoothstep(0.006, 0.0, edge) * rv;
    col += uColor * fr * 0.35;
    float a = clamp(0.3 + m * 0.7 + fr, 0.0, 1.0) * uOpacity;
    gl_FragColor = vec4(col, a);
  }
`;

const pointVert = /* glsl */ `
  attribute float aSeed;
  uniform float uSize, uTime, uPix;
  varying float vFade, vSeed;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.15 + aSeed * 6.28) * 0.15;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    vFade = smoothstep(46.0, 4.0, dist) * smoothstep(0.4, 2.2, dist);
    vSeed = aSeed;
    gl_PointSize = uSize * uPix * (10.0 / dist);
    gl_Position = projectionMatrix * mv;
  }
`;
const pointFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade, vSeed;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = dot(c, c);
    if (r > 0.25) discard;
    float a = smoothstep(0.25, 0.0, r) * vFade * uOpacity * (0.45 + 0.55 * vSeed);
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const latticeLineFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  void main() { gl_FragColor = vec4(uColor * vFade * uOpacity, 1.0); }
`;
const latticeLineVert = /* glsl */ `
  varying float vFade;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = -mv.z;
    vFade = smoothstep(16.0, 2.5, dist) * smoothstep(0.6, 2.0, dist);
    gl_Position = projectionMatrix * mv;
  }
`;

const wireVert = /* glsl */ `
  attribute float aAlong, aWire;
  varying float vAlong, vWire;
  void main() { vAlong = aAlong; vWire = aWire; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const wireFrag = /* glsl */ `
  uniform float uTime, uOpacity, uHot;
  uniform vec3 uColor, uHotColor;
  varying float vAlong, vWire;
  void main() {
    float hot = 1.0 - step(0.5, abs(vWire - uHot));
    float speed = 0.22 + hot * 0.5;
    float ph = fract(vAlong - uTime * speed - vWire * 0.137);
    float pulse = smoothstep(0.08, 0.0, abs(ph - 0.5)) ;
    vec3 col = mix(uColor, uHotColor, hot) * (0.4 + pulse * (1.1 + hot * 1.4) + hot * 0.5);
    gl_FragColor = vec4(col * uOpacity, 1.0);
  }
`;

const ease = (t) => t * t * (3 - 2 * t);
const hold = (t) => ease(MathUtils.clamp((t - 0.12) / 0.76, 0, 1)); // dwell at each chapter, travel between

export function createScene({ canvas, pins, chapters, reduced, ready }) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = () => innerWidth < 900;
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || coarse;
  const TEX = lowPower ? 1024 : 2048;
  let dprCap = lowPower ? 1.25 : 1.75;

  const renderer = new WebGLRenderer({ canvas, antialias: !lowPower, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(VOID, 1);
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 200);

  // ── lights for the die body ──
  scene.add(new AmbientLight(0x8fb0d0, 0.45));
  const key = new DirectionalLight(0xdcecff, 1.4);
  scene.add(key);
  const rim = new PointLight(0x4b93ff, 30, 40, 1.6);
  rim.position.set(-8, -2, -6);
  scene.add(rim);

  const world = new Group();
  scene.add(world);

  // ── die body ──
  const bodyMat = new MeshStandardMaterial({ color: 0x2a3848, metalness: 0.35, roughness: 0.55, transparent: true });
  const body = new Mesh(new BoxGeometry(DIE, 1.4, DIE), bodyMat);
  body.position.y = -0.7;
  world.add(body);
  const bodyEdges = new LineSegments(new EdgesGeometry(body.geometry), new LineBasicMaterial({ color: ICE, transparent: true, opacity: 0.32 }));
  body.add(bodyEdges);

  // ── metal layers ──
  const probeCount = Math.max(1, document.querySelectorAll('.probe').length);
  const plateDefs = [
    { name: 'PASS', canvas: passTexture(TEX), base: 0.62, color: ICE },
    { name: 'M7', canvas: m7Texture(TEX), base: 0.44, color: new Color('#a9c4dc') },
    { name: 'M4', canvas: m4Texture(TEX), base: 0.27, color: new Color('#bcd3e6') },
    { name: 'M1', canvas: m1Texture(TEX, probeCount), base: 0.1, color: new Color('#9fb8cf') },
  ];
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const plates = plateDefs.map((def, i) => {
    const tex = new CanvasTexture(def.canvas);
    tex.anisotropy = aniso;
    tex.minFilter = LinearMipmapLinearFilter;
    const mat = new ShaderMaterial({
      vertexShader: plateVert,
      fragmentShader: plateFrag,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        map: { value: tex }, uColor: { value: def.color }, uOpacity: { value: 1 }, uSweep: { value: 0 },
        uTime: { value: 0 }, uReveal: { value: reduced.matches ? 2 : 0 }, uLight: { value: new Vector2(0.5, 0.5) },
        uHot: { value: [0, 0, 0, 0] }, uHotAmt: { value: 0 },
      },
    });
    const mesh = new Mesh(new PlaneGeometry(DIE, DIE), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 10 - i;
    world.add(mesh);
    return { ...def, mesh, mat, index: i };
  });
  const plateY = (p, explode) => p.base + explode * (3 - p.index) * 1.55;

  // ── crystal lattice (diamond cubic silicon) below the die ──
  const latN = lowPower ? 5 : 7;
  const A = 1.7; // lattice constant, world units
  const basis = [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0], [0.25, 0.25, 0.25], [0.25, 0.75, 0.75], [0.75, 0.25, 0.75], [0.75, 0.75, 0.25]];
  const atoms = [];
  const off = (latN * A) / 2;
  for (let i = 0; i < latN; i++)
    for (let j = 0; j < latN; j++)
      for (let k = 0; k < latN; k++)
        for (const b of basis) atoms.push([(i + b[0]) * A - off, (j + b[1]) * A - off - 9, (k + b[2]) * A - off]);
  const bonds = [];
  const keyOf = (p) => p.map((v) => Math.round(v * 100)).join(',');
  const atomSet = new Set(atoms.map(keyOf));
  for (const p of atoms) {
    // tetrahedral bonds from the A-sublattice only (each bond once)
    const fx = ((p[0] + off) / A) % 1;
    const isA = Math.abs(fx - 0.25) > 0.1 && Math.abs(fx - 0.75) > 0.1;
    if (!isA) continue;
    for (const d of [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]) {
      const q = [p[0] + (d[0] * A) / 4, p[1] + (d[1] * A) / 4, p[2] + (d[2] * A) / 4];
      if (atomSet.has(keyOf(q))) bonds.push(...p, ...q);
    }
  }
  const latGeo = new BufferGeometry();
  latGeo.setAttribute('position', new Float32BufferAttribute(atoms.flat(), 3));
  latGeo.setAttribute('aSeed', new Float32BufferAttribute(atoms.map(() => Math.random()), 1));
  const latMat = new ShaderMaterial({
    vertexShader: pointVert, fragmentShader: pointFrag, transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uSize: { value: 2.6 }, uTime: { value: 0 }, uPix: { value: 1 }, uColor: { value: ICE }, uOpacity: { value: 0 } },
  });
  const lattice = new Points(latGeo, latMat);
  const bondGeo = new BufferGeometry();
  bondGeo.setAttribute('position', new Float32BufferAttribute(bonds, 3));
  const bondMat = new ShaderMaterial({
    vertexShader: latticeLineVert, fragmentShader: latticeLineFrag, transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uColor: { value: new Color('#5d86b3') }, uOpacity: { value: 0 } },
  });
  const latticeGroup = new Group();
  latticeGroup.add(lattice, new LineSegments(bondGeo, bondMat));
  world.add(latticeGroup);

  // ── bond wires to the package ──
  const padCount = document.querySelectorAll('.pad').length;
  const wirePos = [], wireAlong = [], wireId = [];
  const fingerPos = [];
  const linkEnds = [];
  const n = 18;
  let w = 0;
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < n; i++) {
      const t = 0.1 + (0.8 * i) / (n - 1);
      const a = 0.045;
      const [u, v] = [[t, a], [1 - a, t], [t, 1 - a], [a, t]][side];
      const start = new Vector3(u * DIE - DIE / 2, 0.64, v * DIE - DIE / 2);
      const out = [new Vector3(0, 0, -1), new Vector3(1, 0, 0), new Vector3(0, 0, 1), new Vector3(-1, 0, 0)][side];
      const spread = start.clone().setY(0).multiplyScalar(0.28);
      const end = start.clone().add(out.clone().multiplyScalar(4.2)).add(spread).setY(-1.2);
      const mid = start.clone().lerp(end, 0.35).setY(2.1 + Math.random() * 0.4);
      const pts = new QuadraticBezierCurve3(start, mid, end).getPoints(28);
      // links get the wires on the front-left edge (the one facing the contact pads in the closing view)
      const id = side === 2 && i % 4 === 1 && (i - 1) / 4 < padCount ? (i - 1) / 4 : 100 + w++;
      for (let k = 0; k < pts.length - 1; k++) {
        wirePos.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
        wireAlong.push(k / 28, (k + 1) / 28);
        wireId.push(id, id);
      }
      const f2 = end.clone().add(out.clone().multiplyScalar(2.6)).add(spread.clone().multiplyScalar(0.6));
      fingerPos.push(end.x, end.y, end.z, f2.x, f2.y, f2.z);
      if (id < 100) linkEnds[id] = start; // the page's pad is bonded to this pad on the die
    }
  }
  const wireGeo = new BufferGeometry();
  wireGeo.setAttribute('position', new Float32BufferAttribute(wirePos, 3));
  wireGeo.setAttribute('aAlong', new Float32BufferAttribute(wireAlong, 1));
  wireGeo.setAttribute('aWire', new Float32BufferAttribute(wireId, 1));
  const wireMat = new ShaderMaterial({
    vertexShader: wireVert, fragmentShader: wireFrag, transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uHot: { value: -1 }, uColor: { value: new Color('#8fb3d6') }, uHotColor: { value: SIGNAL } },
  });
  const wires = new LineSegments(wireGeo, wireMat);
  const fingerGeo = new BufferGeometry();
  fingerGeo.setAttribute('position', new Float32BufferAttribute(fingerPos, 3));
  const fingerMat = new LineBasicMaterial({ color: ICE, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  const fingers = new LineSegments(fingerGeo, fingerMat);
  world.add(wires, fingers);


  // ── annotation pins (DOM labels on leader lines, projected each frame) ──
  const SVGNS = 'http://www.w3.org/2000/svg';
  const pinList = [];
  function addPin(text, getPos, chapter, dir = 1) {
    const g = document.createElementNS(SVGNS, 'g');
    const line = document.createElementNS(SVGNS, 'polyline');
    line.setAttribute('fill', 'none');
    const rect = document.createElementNS(SVGNS, 'rect');
    rect.setAttribute('width', 7);
    rect.setAttribute('height', 7);
    const label = document.createElementNS(SVGNS, 'text');
    label.textContent = text;
    g.append(line, rect, label);
    g.style.opacity = 0;
    pins.append(g);
    const pin = { g, line, rect, label, getPos, chapter, dir, hot: false };
    pinList.push(pin);
    return pin;
  }
  // polylines take the line style from CSS too
  pins.insertAdjacentHTML('afterbegin', '<style>polyline{stroke:var(--line-strong);stroke-width:1}.is-hot polyline{stroke:var(--signal)}</style>');

  const pass = plates[0], m7 = plates[1], m4 = plates[2], m1 = plates[3];
  const onPlate = (p, u, v) => () => new Vector3(u * DIE - DIE / 2, p.mesh.position.y, v * DIE - DIE / 2);
  addPin('top metal', onPlate(m7, 0.94, 0.1), 1, 1);
  addPin('floorplan', onPlate(m4, 0.92, 0.96), 2, 1);
  addPin('test structures', onPlate(m1, 0.3, 0.96), 3, 0);
  addPin('bond pads', onPlate(pass, 0.955, 0.75), 5, 1);
  const cellCodes = [...document.querySelectorAll('.cell__code')].map((e) => e.textContent);
  const cellPins = BLOCKS.map(([x, y], i) => addPin(cellCodes[i] || '', onPlate(m4, x + 0.012, y + 0.012), 2, 0));
  // projects: each row on the page is wired to its own test structure on M1
  const probeEls = [...document.querySelectorAll('.probe')];
  const probeRect = (i) => {
    const [u, v] = probeSpot(i, probeCount);
    return [u - PROBE_HALF, v - 0.045, u + PROBE_HALF, v + 0.045];
  };
  const probeLeaders = probeEls.map((el, i) => {
    const [u, v] = probeSpot(i, probeCount);
    const pin = addPin('', onPlate(m1, u - PROBE_HALF + 0.035, v), 3, 3);
    pin.el = el;
    pin.g.classList.add('bond');
    return pin;
  });

  // probe needles resting on each structure's pads; only the active structure is probed
  const needleSets = probeEls.map((_, i) => {
    const [u, v] = probeSpot(i, probeCount);
    const pos = [];
    for (const du of [-PROBE_HALF + 0.035, PROBE_HALF - 0.035]) {
      const x = (u + du) * DIE - DIE / 2, z = v * DIE - DIE / 2;
      const lean = du < 0 ? -1 : 1;
      pos.push(x, 0.02, z, x + 0.14 * lean, 0.32, z + 0.06, x + 0.14 * lean, 0.32, z + 0.06, x + 1.3 * lean, 3.8, z + 1.1);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    const mat = new LineBasicMaterial({ color: ICE, transparent: true, opacity: 0, depthWrite: false });
    const lines = new LineSegments(geo, mat);
    world.add(lines);
    return { lines, mat, amt: 0 };
  });
  let hoverProbe = -1, activeProbe = -1;

  // bond leaders: each contact pad on the page is wired to its bond wire on the die
  const padEls = [...document.querySelectorAll('.pad')];
  const bondPins = padEls.map((el, i) => {
    const pin = addPin('', () => linkEnds[i] || new Vector3(), 5, 2);
    pin.el = el;
    pin.g.classList.add('bond');
    return pin;
  });

  // ── scroll → keyframe mapping ──
  let anchors = [];
  function measure() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    anchors = chapters.map((c, i) => {
      if (i === 0) return 0;
      if (i === chapters.length - 1) return max;
      const r = c.getBoundingClientRect();
      return MathUtils.clamp(r.top + scrollY + r.height / 2 - innerHeight / 2, 0, max);
    });
  }

  const target = blank();
  const current = blank();
  function blank() {
    return { target: new Vector3(), az: 0, el: 0, dist: 0, shift: 0, explode: 0, show: [0, 0, 0, 0], body: 0, lat: 0, wire: 0, weights: [] };
  }
  function lerpKey(out, a, b, t) {
    out.target.set(...a.target).lerp(new Vector3(...b.target), t);
    for (const k of NUM) out[k] = MathUtils.lerp(a[k], b[k], t);
    out.show = a.show.map((v, i) => MathUtils.lerp(v, b.show[i], t));
  }
  function sample(out, y) {
    let i = 0;
    while (i < anchors.length - 2 && y >= anchors[i + 1]) i++;
    const span = anchors[i + 1] - anchors[i] || 1;
    const raw = MathUtils.clamp((y - anchors[i]) / span, 0, 1);
    const t = reduced.matches ? (raw < 0.5 ? 0 : 1) : hold(raw);
    lerpKey(out, KEYS[i], KEYS[i + 1], t);
    out.weights = KEYS.map((_, k) => (k === i ? 1 - t : k === i + 1 ? t : 0));
  }
  function copy(dst, src) {
    dst.target.copy(src.target);
    for (const k of NUM) dst[k] = src[k];
    dst.show = [...src.show];
    dst.weights = [...src.weights];
  }
  function damp(dst, src, f) {
    dst.target.lerp(src.target, f);
    for (const k of NUM) dst[k] += (src[k] - dst[k]) * f;
    dst.show = dst.show.map((v, i) => v + (src.show[i] - v) * f);
    dst.weights = src.weights.map((v, i) => (dst.weights[i] ?? v) + (v - (dst.weights[i] ?? v)) * f);
  }

  // ── input ──
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
    wake();
  }, { passive: true });

  let hotCell = -1, hotPad = -1;
  const hotAmt = { cell: 0 };

  // ── sizing ──
  let W = 0, H = 0, dpr = 1, distK = 1;
  function resize() {
    W = innerWidth;
    H = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    // narrow screens: widen the view so the whole die fits
    const ar = W / H;
    camera.fov = ar < 0.8 ? 40 : 32;
    distK = ar < 0.8 ? 1.55 : ar < 1.25 ? 1.25 : 1;
    measure();
    wake();
  }
  addEventListener('resize', resize);
  new ResizeObserver(() => measure()).observe(document.body);

  // ── frame ──
  // ?qa settles the intro instantly so headless screenshots are deterministic
  const QA = new URLSearchParams(location.search).has('qa');
  let intro = reduced.matches || QA ? 1 : 0;
  let introGo = !ready;
  ready?.then(() => (introGo = true)); // the chip assembles as the boot screen powers off
  let last = performance.now();
  let time = 0;
  let awakeUntil = 0;
  let slowFrames = 0, frames = 0, dprDropped = false;
  function wake(ms = 1500) {
    awakeUntil = Math.max(awakeUntil, performance.now() + ms);
  }
  addEventListener('scroll', () => wake(), { passive: true });
  reduced.addEventListener?.('change', () => wake());

  measure();
  sample(target, scrollY);
  copy(current, target);

  const camPos = new Vector3();
  const lookAt = new Vector3();
  const tmp = new Vector3();

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const still = reduced.matches;
    const animating = !still || now < awakeUntil || intro < 1;
    // idle with reduced motion: nothing moves, so don't redraw
    if (!animating) return;

    // adaptive resolution: if frames are consistently slow, render fewer pixels
    frames++;
    if (dt > 0.028) slowFrames++;
    if (frames === 90) {
      // drop resolution at most once: repeated reallocations read as flicker
      if (slowFrames > 45 && !dprDropped && dprCap > 1) {
        dprDropped = true;
        dprCap = 1;
        resize();
      }
      frames = slowFrames = 0;
    }

    if (!still) time += dt;
    if (intro < 1 && introGo) intro = Math.min(1, intro + dt / 2.6);
    const introE = 1 - Math.pow(1 - intro, 4);

    sample(target, scrollY);
    if (still || QA) copy(current, target);
    else damp(current, target, 1 - Math.exp(-dt * 5));
    const s = current;

    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 3));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 3));
    const px = still ? 0 : pointer.sx, py = still ? 0 : pointer.sy;

    // camera
    const az = s.az + px * 0.07 + (still ? 0 : Math.sin(time * 0.05) * 0.06);
    const el = MathUtils.clamp(s.el - py * 0.05, 0.05, 1.45);
    const dist = s.dist * distK * (1 + (1 - introE) * 0.25);
    // narrow screens centre the subject instead of framing it beside the copy
    const look = small() ? lookAt.copy(s.target).setX(s.target.x * 0.2) : s.target;
    camPos.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(dist).add(look);
    camera.position.copy(camPos);
    camera.lookAt(look);
    const shift = small() ? MOBILE_SHIFT : s.shift;
    const lift = small() ? H * 0.17 * (1 - s.weights[0]) * (1 - (s.weights[4] || 0)) : 0;
    camera.setViewOffset(W, H, -W * shift, lift, W, H);
    camera.updateProjectionMatrix();

    key.position.set(Math.sin(time * 0.2) * 12, 14, Math.cos(time * 0.2) * 12);

    // layers
    const explode = s.explode + (1 - introE) * 0.9;
    const sweep = still ? 0.1 : ((time * 0.11) % 1.6) - 0.8;
    plates.forEach((p, i) => {
      p.mesh.position.y = plateY(p, explode);
      const u = p.mat.uniforms;
      u.uOpacity.value = s.show[i] * MathUtils.clamp(introE * 1.6 - i * 0.15, 0, 1);
      u.uSweep.value = sweep + i * 0.06;
      u.uTime.value = time;
      u.uLight.value.set(0.5 + px * 0.35, 0.5 - py * 0.35);
      if (!still) u.uReveal.value = MathUtils.clamp(intro * 1.5 - i * 0.12, 0, 1.2);
      p.mesh.visible = u.uOpacity.value > 0.003;
    });
    hotAmt.cell += ((hotCell >= 0 ? 1 : 0) * s.weights[2] - hotAmt.cell) * (still ? 1 : 1 - Math.exp(-dt * 8));
    m4.mat.uniforms.uHotAmt.value = hotAmt.cell * 0.8;

    bodyMat.opacity = s.body;
    body.visible = s.body > 0.01;
    bodyEdges.material.opacity = 0.32 * s.body;

    latMat.uniforms.uOpacity.value = s.lat;
    bondMat.uniforms.uOpacity.value = s.lat * 0.8;
    latMat.uniforms.uTime.value = time;
    latMat.uniforms.uPix.value = dpr;
    latticeGroup.visible = s.lat > 0.01;

    wireMat.uniforms.uOpacity.value = s.wire * introE;
    wireMat.uniforms.uTime.value = time;
    wireMat.uniforms.uHot.value = hotPad;
    fingerMat.opacity = s.wire * 0.5;
    wires.visible = fingers.visible = s.wire > 0.01;


    // active structure: the hovered row, else the row nearest the middle of the viewport
    activeProbe = hoverProbe;
    if (activeProbe < 0 && (s.weights[3] || 0) > 0.2) {
      let best = Infinity;
      probeEls.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - H / 2);
        if (d < best) { best = d; activeProbe = i; }
      });
    }
    const w3 = (s.weights[3] || 0) * s.show[3];
    needleSets.forEach((n, i) => {
      n.amt += ((i === activeProbe ? 1 : 0) - n.amt) * (still || QA ? 1 : 1 - Math.exp(-dt * 8));
      n.lines.position.y = m1.mesh.position.y;
      n.mat.opacity = 0.75 * w3 * n.amt;
      n.lines.visible = n.mat.opacity > 0.01;
    });
    probeLeaders.forEach((p, i) => p.g.classList.toggle('is-hot', i === activeProbe));
    if (activeProbe >= 0) {
      const [x0, y0, x1, y1] = probeRect(activeProbe);
      m1.mat.uniforms.uHot.value = [x0, 1 - y1, x1, 1 - y0];
    }
    m1.mat.uniforms.uHotAmt.value = activeProbe >= 0 ? 0.85 * (s.weights[3] || 0) : 0;

    renderer.render(scene, camera);
    updatePins(s);
  }

  function updatePins(s) {
    for (const pin of pinList) {
      const o = (s.weights[pin.chapter] || 0) * (pin.chapter === 0 ? introE() : 1);
      const vis = o > 0.02 && !small();
      pin.g.style.opacity = vis ? Math.min(1, o * 1.4) : 0;
      if (!vis) continue;
      tmp.copy(pin.getPos()).project(camera);
      const x = (tmp.x * 0.5 + 0.5) * W, y = (-tmp.y * 0.5 + 0.5) * H;
      if (pin.dir >= 2) {
        // leader from the page element, routed at 0/45 degrees to its point on the die
        const r = pin.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > H) { pin.g.style.opacity = 0; continue; }
        const vx = pin.dir === 2 ? r.right - 12.8 : r.right + 14, vy = pin.dir === 2 ? r.top + 12.8 : r.top + 38;
        const dy = Math.abs(y - vy);
        const ex = Math.max(vx, x - dy * Math.sign(x - vx || 1));
        pin.line.setAttribute('points', `${vx},${vy} ${ex},${vy} ${x},${y}`);
        pin.rect.setAttribute('x', x - 3.5);
        pin.rect.setAttribute('y', y - 3.5);
        continue;
      }
      if (pin.dir === 0) {
        // cell name set inside its own block, like a layout label
        pin.line.setAttribute('points', '');
        pin.rect.setAttribute('x', x - 3.5);
        pin.rect.setAttribute('y', y - 3.5);
        const lw = pin.label.getComputedTextLength?.() || 80;
        pin.label.setAttribute('x', Math.min(x + 8, W - 16 - lw));
        pin.label.setAttribute('y', y + 18);
        continue;
      }
      const len = pin.label.getComputedTextLength?.() || 80;
      // flip a leader that would run off either edge of the viewport
      let dir = pin.dir;
      if (dir > 0 && x + 46 + len + 12 > W - 16) dir = -1;
      else if (dir < 0 && x - 46 - len - 12 < 16) dir = 1;
      const dx = 46 * dir;
      const ex = x + dx, ey = y - 34;
      const tx = dir > 0 ? ex + 6 : ex - 6 - len;
      pin.line.setAttribute('points', `${x},${y} ${ex},${ey} ${dir > 0 ? ex + len + 12 : ex - len - 12},${ey}`);
      pin.rect.setAttribute('x', x - 3.5);
      pin.rect.setAttribute('y', y - 3.5);
      pin.label.setAttribute('x', tx);
      pin.label.setAttribute('y', ey - 7);
    }
  }
  const introE = () => 1 - Math.pow(1 - intro, 4);

  resize();
  requestAnimationFrame(frame);

  return {
    setCell(i) {
      hotCell = i;
      cellPins.forEach((p, j) => p.g.classList.toggle('is-hot', j === i));
      if (i >= 0) {
        const [x, y, w2, h2] = BLOCKS[i];
        m4.mat.uniforms.uHot.value = [x, 1 - (y + h2), x + w2, 1 - y];
      }
      wake();
    },
    setProbe(i) {
      hoverProbe = i;
      wake();
    },
    setPad(i) {
      hotPad = i;
      bondPins.forEach((p, j) => p.g.classList.toggle('is-hot', j === i));
      wake();
    },
  };
}
