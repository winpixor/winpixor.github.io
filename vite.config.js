import { defineConfig } from 'vite';

// Renders src/content.js into index.html at build time (and on every request in dev),
// so the full content ships as static HTML.
function contentPlugin() {
  return {
    name: 'winpixor-content',
    async transformIndexHtml(html, ctx) {
      const mod = ctx.server ? await ctx.server.ssrLoadModule('/src/render.js') : await import('./src/render.js');
      return mod.renderAll(html);
    },
    handleHotUpdate({ file, server }) {
      if (/src\/(content|render|wordmark)\.js$/.test(file)) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig({
  // Relative asset paths: works at a user site root (winpixor.github.io) and under a project sub-path.
  base: './',
  plugins: [contentPlugin()],
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 700 },
});
