// ─────────────────────────────────────────────────────────────────────────────
//  WINPIXOR — site content.  This is the only file you need to edit to change
//  what the site says. It is rendered into index.html at build time, so the
//  content is readable even without JavaScript or WebGL.
//
//  Anything marked `placeholder: true` is shown as an empty, clearly labelled
//  slot. Set `showPlaceholders: false` to hide every placeholder at once.
// ─────────────────────────────────────────────────────────────────────────────

export const site = {
  // Public URL of the deployed site (used for canonical + social meta tags).
  url: 'https://winpixor.github.io/',
  title: 'WINPIXOR',
  description:
    'WINPIXOR: a pseudonymous researcher exploring Windows internals, Linux, web security, reverse engineering and exploit development.',
  showPlaceholders: true,
};

// Areas of interest. These are framed as ongoing exploration, not expertise.
// `cell` is the block name drawn on the chip floorplan.
export const interests = [
  {
    cell: 'nt_internals',
    title: 'Windows internals',
    body: 'Tokens, handles, the object manager and the line between user mode and the kernel. How NT decides what a process is allowed to touch.',
  },
  {
    cell: 'linux_sys',
    title: 'Linux and the system layer',
    body: 'Syscalls, namespaces, capabilities and /proc. Reading what the kernel actually answers instead of what the man page promises.',
  },
  {
    cell: 'web_appsec',
    title: 'Web application security',
    body: 'Auth flows, parsers and caches, and the gap between what a server validates and what it ends up using.',
  },
  {
    cell: 'vuln_research',
    title: 'Bug bounty and vulnerability research',
    body: 'Slow reading of real, in-scope targets: find the assumption a feature was built on, then check whether it holds.',
  },
  {
    cell: 'reverse_eng',
    title: 'Binary analysis and reverse engineering',
    body: 'Disassemblers, decompilers and debuggers, used to recover what a program does when there is no source to ask.',
  },
  {
    cell: 'exploit_dev',
    title: 'Exploit development',
    body: 'Memory corruption and mitigations from the other side: stack, heap, ROP, and why each defence was invented.',
  },
  {
    cell: 'tooling',
    title: 'Security tooling and automation',
    body: 'Small, sharp tools that take the repetition out of research. A few of them are listed below.',
  },
];

// Projects, tools, experiments and write-ups.
// status: 'published' | 'in-progress' | 'experimental'
// Optional fields: repo, writeup, image ({ src, alt } — put files in /public).
export const projects = [
  {
    name: 'fuzzy-find',
    alias: 'ff',
    summary: 'A tiny fuzzy file finder for the shell, glued together from fd, fzf and bat.',
    domain: 'Tooling',
    stack: 'Shell',
    status: 'published',
    repo: 'https://github.com/winpixor/fuzzy-find',
  },
  {
    name: 'spirex',
    summary: 'A fast, multithreaded web crawler in pure Java with zero dependencies.',
    domain: 'Web / recon',
    stack: 'Java',
    status: 'published',
    repo: 'https://github.com/winpixor/spirex',
  },
  {
    name: 'writeups',
    summary: 'Technical write-ups and research notes.',
    domain: 'Research notes',
    stack: 'Blog',
    status: 'published',
    writeup: 'https://winpixor.github.io/writeups/',
  },
];

// How it thinks. Kept short on purpose.
export const principles = [
  'Use a system long enough and it starts to look simple. Take it apart and it never does.',
  'Most bugs are not clever. They are an assumption nobody wrote down.',
  'Being wrong is fine. Not checking is the problem.',
  'Break things responsibly, and report what you find.',
];

// A quotation set at the bottom of the substrate, after the principles.
export const quote = {
  text: "Above all, don't lie to yourself. The man who lies to himself and listens to his own lie comes to a point that he cannot distinguish the truth within him, or around him, and so loses all respect for himself and for others. And having no respect he ceases to love.",
  source: 'Fyodor Dostoevsky, The Brothers Karamazov',
};

// Contact channels. `href: null` + placeholder: true renders an unbonded pad.
// Do not add accounts here that reveal a legal name.
export const links = [
  { label: 'GitHub', handle: 'winpixor', href: 'https://github.com/winpixor' },
  { label: 'X', handle: '@winpixor', href: 'https://x.com/winpixor' },
  { label: 'Discord', handle: 'user profile', href: 'https://discordid.netlify.app/?id=1548683398745292815' },
  { label: 'Write-ups', handle: '/writeups', href: 'https://winpixor.github.io/writeups/' },
];
