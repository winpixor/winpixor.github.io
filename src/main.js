import '@fontsource-variable/schibsted-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './styles.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { runBoot } from './boot.js';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const QA = new URLSearchParams(location.search).has('qa'); // settles intro motion for screenshots
const reducedNow = matchMedia('(prefers-reduced-motion: reduce)').matches;
const booted = QA ? Promise.resolve() : runBoot({ reduced: reducedNow });
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const chapters = [...document.querySelectorAll('.chapter')];
const navLinks = [...document.querySelectorAll('.layers a')];

// ── section-aware navigation: the chapter crossing the viewport centre is current ─
let navFrame = 0;
function updateNav() {
  navFrame = 0;
  const mid = innerHeight / 2;
  let current = chapters[0];
  for (const c of chapters) if (c.getBoundingClientRect().top <= mid) current = c;
  for (const a of navLinks) {
    if (a.hash === '#' + current.id) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  }
}
addEventListener('scroll', () => (navFrame ||= requestAnimationFrame(updateNav)), { passive: true });
addEventListener('resize', updateNav);
updateNav();

// ── floorplan cells: one open at a time, mirrored onto the 3D floorplan ─────
const cells = [...document.querySelectorAll('.cell')];
const listeners = { cell: [], pad: [], probe: [] };
const emit = (type, i) => listeners[type].forEach((fn) => fn(i));

function openCell(i) {
  cells.forEach((c, j) => {
    c.classList.toggle('is-open', i === j);
    c.querySelector('.cell__head').setAttribute('aria-expanded', String(i === j));
  });
  emit('cell', i);
}
cells.forEach((c, i) => {
  const head = c.querySelector('.cell__head');
  head.addEventListener('click', () => openCell(i));
  head.addEventListener('pointerenter', () => emit('cell', i));
  head.addEventListener('focus', () => emit('cell', i));
});
document.querySelector('.cells')?.addEventListener('pointerleave', () => {
  emit('cell', cells.findIndex((c) => c.classList.contains('is-open')));
});
if (cells.length) openCell(0);

document.querySelectorAll('.probe').forEach((p, i) => {
  p.addEventListener('pointerenter', () => emit('probe', i));
  p.addEventListener('focusin', () => emit('probe', i));
  p.addEventListener('pointerleave', () => emit('probe', -1));
  p.addEventListener('focusout', () => emit('probe', -1));
});

document.querySelectorAll('.pad').forEach((p) => {
  const i = +p.dataset.pad;
  p.addEventListener('pointerenter', () => emit('pad', i));
  p.addEventListener('focusin', () => emit('pad', i));
  p.addEventListener('pointerleave', () => emit('pad', -1));
  p.addEventListener('focusout', () => emit('pad', -1));
});

// ── scroll choreography for the DOM layer (always tied to scroll position) ──
const mm = gsap.matchMedia();
mm.add('(prefers-reduced-motion: no-preference)', () => {
  root.classList.add('motion');

  // opening: the lines arrive once, on load (inner elements only, so the
  // scroll-driven exit below never fights the intro for the same property)
  const intro = gsap.timeline({ paused: true, delay: 0.1 })
    .from('.surface__mark .wordmark', { opacity: 0, duration: 2.2, ease: 'power2.out' }, 0)
    .from('.surface__copy [data-reveal], .descend svg, .descend span', { y: 18, opacity: 0, duration: 1.4, ease: 'expo.out', stagger: 0.12 }, 0.3);
  if (QA) intro.progress(1);
  else booted.then(() => intro.play());

  // leaving the surface: copy and wordmark sink back as the camera descends
  gsap.fromTo('.surface__copy, .descend', { y: 0, opacity: 1 }, {
    y: -60, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '#surface', start: 'top top', end: '60% top', scrub: true },
  });
  gsap.fromTo('.surface__mark', { yPercent: 0, opacity: 1 }, {
    yPercent: 30, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '#surface', start: '10% top', end: 'bottom top', scrub: true },
  });

  // chapters: content rises out of depth, and recedes as the next layer comes
  document.querySelectorAll('.chapter:not(.chapter--surface) [data-reveal]').forEach((el) => {
    gsap.fromTo(el, { y: 48, opacity: 0 }, {
      y: 0, opacity: 1, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 96%', end: 'top 62%', scrub: true },
    });
    gsap.fromTo(el, { y: 0, opacity: 1 }, {
      y: -36, opacity: 0, ease: 'power1.in', immediateRender: false,
      scrollTrigger: { trigger: el, start: 'bottom 22%', end: 'bottom -4%', scrub: true },
    });
  });

  // substrate: each statement comes into focus only as it crosses the centre
  document.querySelectorAll('.principles p, .quote').forEach((el) => {
    gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 90%', end: 'bottom 10%', scrub: true } })
      .fromTo(el, { opacity: 0.08, y: 40, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', ease: 'power2.out', duration: 0.4 })
      .to(el, { opacity: 1, duration: 0.2 })
      .to(el, { opacity: 0.08, y: -30, filter: 'blur(4px)', ease: 'power2.in', duration: 0.4 });
  });

  return () => root.classList.remove('motion');
});

// ── the 3D die (lazy: the page is complete before it arrives) ───────────────
function webglOK() {
  if (new URLSearchParams(location.search).has('nogl')) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

if (webglOK()) {
  const start = () =>
    import('./scene/scene.js')
      .then(({ createScene }) => {
        const scene = createScene({
          canvas: document.getElementById('stage'),
          pins: document.getElementById('pins'),
          chapters,
          reduced,
          ready: booted,
        });
        listeners.cell.push(scene.setCell);
        listeners.pad.push(scene.setPad);
        listeners.probe.push(scene.setProbe);
        scene.setCell(0);
        root.classList.add('gl');
      })
      .catch((err) => {
        console.warn('3D scene unavailable, using static fallback.', err);
        root.classList.add('no-gl');
      });
  'requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 600 }) : setTimeout(start, 60);
} else {
  root.classList.add('no-gl');
}

addEventListener('load', () => ScrollTrigger.refresh());

if (QA) {
  // headless perf probe: paint + long-task timings, readable via --dump-dom
  const perf = { long: 0 };
  new PerformanceObserver((l) => l.getEntries().forEach((e) => (perf[e.name || e.entryType] = Math.round(e.startTime)))).observe({ type: 'paint', buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => (perf.lcp = Math.round(e.startTime)))).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => (perf.long += Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => (perf.cls = (perf.cls || 0) + e.value))).observe({ type: 'layout-shift', buffered: true });
  setInterval(() => (root.dataset.perf = JSON.stringify(perf)), 500);
  // headless screenshots: jump scrubbed tweens straight to the current scroll position
  window.__qaSettle = () => {
    ScrollTrigger.refresh();
    ScrollTrigger.getAll().forEach((st) => st.animation?.progress(st.progress));
  };
}
