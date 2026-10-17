// Build-time renderers: turn src/content.js into static HTML fragments.
import { site, interests, projects, principles, quote, links } from './content.js';
import { svg as wordmarkSvg } from './wordmark.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const visible = (list) => list.filter((x) => site.showPlaceholders || !x.placeholder);

const STATUS = {
  published: { label: 'Published', mark: '<rect x="1" y="1" width="10" height="10"/>' },
  'in-progress': { label: 'In progress', mark: '<rect x="1.5" y="1.5" width="9" height="9" fill="none"/><path d="M6 0v12M0 6h12" fill="none"/>' },
  experimental: { label: 'Experimental', mark: '<rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke-dasharray="2 2"/>' },
};

export function statusMark(status) {
  const s = STATUS[status] || STATUS.experimental;
  return `<span class="status status--${esc(status)}"><svg viewBox="0 0 12 12" aria-hidden="true">${s.mark}</svg>${s.label}</span>`;
}

const arrow =
  '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M6 4h6v6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';

export function renderInterests() {
  return interests
    .map(
      (it, i) => `
      <li class="cell" data-cell="${i}">
        <button class="cell__head" type="button" aria-expanded="false" aria-controls="cell-${i}">
          <span class="cell__code">${esc(it.cell)}</span>
          <span class="cell__title">${esc(it.title)}</span>
        </button>
        <p class="cell__body" id="cell-${i}">${esc(it.body)}</p>
      </li>`,
    )
    .join('');
}

export function renderProjects() {
  return visible(projects)
    .map((p) => {
      const actions = [];
      if (p.repo) actions.push(`<a href="${esc(p.repo)}" rel="noopener">Source on GitHub<span class="sr"> for ${esc(p.name)}</span>${arrow}</a>`);
      if (p.writeup) actions.push(`<a href="${esc(p.writeup)}" rel="noopener">Read<span class="sr"> ${esc(p.name)}</span>${arrow}</a>`);
      const img = p.image
        ? `<img class="probe__img" src="${esc(p.image.src)}" alt="${esc(p.image.alt || '')}" loading="lazy" decoding="async">`
        : '';
      return `
      <li class="probe${p.placeholder ? ' probe--placeholder' : ''}">
        <div class="probe__id">
          <h3 class="probe__name">${esc(p.name)}${p.alias ? ` <span class="probe__alias">${esc(p.alias)}</span>` : ''}</h3>
          ${p.placeholder ? '<span class="probe__flag">Placeholder</span>' : statusMark(p.status)}
        </div>
        <p class="probe__summary">${esc(p.summary)}</p>
        <dl class="probe__meta"><div><dt>Domain</dt><dd>${esc(p.domain)}</dd></div><div><dt>Stack</dt><dd>${esc(p.stack)}</dd></div></dl>
        ${img}
        ${actions.length ? `<p class="probe__links">${actions.join('')}</p>` : ''}
      </li>`;
    })
    .join('');
}

export function renderPrinciples() {
  return principles.map((t) => `<li><p>${esc(t)}</p></li>`).join('');
}

export function renderQuote() {
  if (!quote?.text) return '';
  return `<figure class="quote"><blockquote><p>${esc(quote.text)}</p></blockquote><figcaption><svg class="quote__trace" viewBox="0 0 34 12" aria-hidden="true"><path d="M0 2.5h13l6 6h7"/><rect x="26.5" y="5" width="7" height="7"/></svg>${esc(quote.source)}</figcaption></figure>`;
}

export function renderLinks() {
  return visible(links)
    .map((l, i) =>
      l.href
        ? `<li class="pad" data-pad="${i}"><a href="${esc(l.href)}" rel="noopener me"><span class="pad__label">${esc(l.label)}</span><span class="pad__handle">${esc(l.handle)}</span>${arrow}</a></li>`
        : `<li class="pad pad--open" data-pad="${i}"><span class="pad__label">${esc(l.label)}</span><span class="pad__handle">Placeholder: ${esc(l.handle)}</span></li>`,
    )
    .join('');
}

export function renderAll(html) {
  return html
    .replaceAll('<!--@WORDMARK-->', wordmarkSvg({ className: 'wordmark' }))
    .replace('<!--@INTERESTS-->', renderInterests())
    .replace('<!--@PROJECTS-->', renderProjects())
    .replace('<!--@PRINCIPLES-->', renderPrinciples())
    .replace('<!--@QUOTE-->', renderQuote())
    .replace('<!--@LINKS-->', renderLinks())
    .replaceAll('@SITE_URL', esc(site.url))
    .replaceAll('@SITE_TITLE', esc(site.title))
    .replaceAll('@SITE_DESCRIPTION', esc(site.description));
}
