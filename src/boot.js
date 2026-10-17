// Retro boot sequence shown on every load: a BIOS POST, a Windows NT 4.0 style
// blue boot screen that "loads" kernel modules and the projects, then a CRT
// collapse that reveals the site. ~3.5s; any key, click or tap skips it.
// The real page is fully rendered underneath the whole time.
import '@fontsource/vt323';

const BIOS = [
  'WPX Modular BIOS v4.00PG, An Energy Star Ally',
  'Copyright (C) 1996, nobody in particular',
  '',
  'Main Processor : Silicon Die-Mark 66MHz',
  'Memory Testing : @MEM',
  '',
  'Detecting die layers ... PASS M7 M4 M1 SUB PAD',
  'Booting from die 0 ...',
];

const MODULES = [
  '\\SystemRoot\\System32\\ntoskrnl.exe',
  '\\SystemRoot\\System32\\hal.dll',
  '\\SystemRoot\\System32\\ntdll.dll',
  '\\SystemRoot\\System32\\drivers\\ndis.sys',
  '\\SystemRoot\\System32\\win32k.sys',
  '\\Research\\fuzzy-find',
  '\\Research\\spirex',
  '\\Research\\writeups',
  '\\Floorplan\\curiosity.sys',
];

export function runBoot({ reduced }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'boot';
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <span class="sr">Loading WINPIXOR</span>
      <pre class="boot__bios" aria-hidden="true"></pre>
      <div class="boot__nt" aria-hidden="true">
        <p>WINPIXOR NT (TM) Version 4.0 (Build 1381: Service Pack 6).</p>
        <p>1 System Processor [65,536 KB Memory]</p>
        <p class="boot__dots"></p>
        <p class="boot__load"></p>
      </div>
      <p class="boot__skip" aria-hidden="true">Press any key to skip</p>`;
    document.body.append(el);
    document.documentElement.classList.add('booting');

    const bios = el.querySelector('.boot__bios');
    const dots = el.querySelector('.boot__dots');
    const load = el.querySelector('.boot__load');
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    let done = false;

    function finish(fast) {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      removeEventListener('keydown', skip);
      removeEventListener('pointerdown', skip);
      el.classList.add(fast || reduced ? 'is-fading' : 'is-off');
      document.documentElement.classList.remove('booting'); // the page shows behind the collapsing picture
      setTimeout(() => el.remove(), fast || reduced ? 350 : 650);
      // reveal a beat before the overlay is gone so the hero intro meets the collapse
      setTimeout(resolve, fast || reduced ? 120 : 380);
    }
    const skip = (e) => {
      if (e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey)) return;
      finish(true);
    };
    addEventListener('keydown', skip);
    addEventListener('pointerdown', skip);

    if (reduced) {
      // no typing, no flicker: a still boot screen, briefly
      el.classList.add('is-nt');
      dots.textContent = '. '.repeat(18);
      load.textContent = 'Starting WINPIXOR ...';
      at(1200, () => finish(false));
      return;
    }

    // 1 — BIOS POST, typed line by line, with a counting memory test
    let t = 80;
    BIOS.forEach((line) => {
      at(t, () => {
        if (line.includes('@MEM')) {
          const row = document.createElement('span');
          bios.append(row, '\n');
          let k = 0;
          const tick = setInterval(() => {
            k = Math.min(65536, k + 8192);
            row.textContent = line.replace('@MEM', `${k}K${k === 65536 ? ' OK' : ''}`);
            if (k === 65536) clearInterval(tick);
          }, 32);
          timers.push(tick);
        } else bios.append(line + '\n');
      });
      t += line ? 95 : 40;
    });

    // 2 — the blue NT boot screen: progress dots and module loads
    at(1150, () => el.classList.add('is-nt'));
    let d = 0;
    for (let ms = 1300; ms < 2950; ms += 90) at(ms, () => (dots.textContent = '. '.repeat(++d)));
    MODULES.forEach((m, i) => at(1350 + i * 165, () => (load.textContent = 'Loading ' + m)));
    at(2950, () => (load.textContent = 'Starting WINPIXOR ...'));

    // 3 — CRT power-off reveals the page
    at(3350, () => finish(false));
  });
}
