// @ts-check
/** @typedef {import('./index.d.ts').ExportData} ExportData */
/** @typedef {import('./index.d.ts').ExportComment} ExportComment */
/** @typedef {'en' | 'fr' | 'de'} Lang */

export const labels = {
  en: { heading: 'Your reactions, your comments', formerReader: 'Former reader', replyFrom: 'Reply from {site}' },
  fr: { heading: 'Vos réactions, vos commentaires', formerReader: 'Ancien lecteur', replyFrom: 'Réponse de {site}' },
  de: { heading: 'Ihre Reaktionen, Ihre Kommentare', formerReader: 'Ehemalige Person', replyFrom: 'Antwort von {site}' },
};

/** @param {unknown} value @returns {Lang} */
function toLang(value) {
  const l = String(value ?? 'en').slice(0, 2).toLowerCase();
  return l === 'fr' || l === 'de' ? l : 'en';
}

/** @param {string} s */
function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]»]/g;

/** Comment text as HTML: escaped, URLs as nofollow ugc links, line breaks kept. @param {string} text */
function textToHtml(text) {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const i = m.index ?? 0;
    out += esc(text.slice(last, i));
    out += `<a href="${esc(m[0])}" rel="nofollow ugc noopener" target="_blank">${esc(m[0])}</a>`;
    last = i + m[0].length;
  }
  out += esc(text.slice(last));
  return out.replace(/\r?\n/g, '<br>');
}

/** Same page identity as the service: no index.html, trailing slash, single slashes. @param {string} path */
export function normalizePath(path) {
  let p = path.split(/[?#]/, 1)[0] ?? '/';
  try {
    p = encodeURI(decodeURI(p));
  } catch {
    /* keep as is */
  }
  p = p.replace(/\/{2,}/g, '/').replace(/\/index\.html?$/i, '/');
  if (!p.endsWith('/') && !/\.[a-z0-9]{1,5}$/i.test(p)) p += '/';
  return p;
}

/**
 * HTML of the comments section of one page: heading, baked reaction counts and comments,
 * then the widget mount and script.
 *
 * @param {{ site: string, api: string, path: string, lang?: string, data: ExportData | null }} p
 * @returns {string}
 */
export function renderSection({ site, api, path, lang, data }) {
  const l = toLang(lang);
  const t = labels[l];
  const base = api.replace(/\/+$/, '');
  const page = data?.pages[normalizePath(path)];
  const fmt = new Intl.DateTimeFormat(l, { dateStyle: 'medium', timeZone: 'UTC' });
  /** @param {string | null} iso */
  const time = (iso) => (iso ? `<time datetime="${esc(iso)}">${esc(fmt.format(new Date(iso)))}</time>` : '');

  const kinds = data?.reactions ?? [];
  const counts = page?.reactions ?? {};
  const reactions = kinds.filter((k) => counts[k.id]);
  const reactionsHtml = reactions.length
    ? `<ul class="bc-static-reactions" data-bc-static-reactions>${reactions
        .map((k) => `<li><span aria-hidden="true">${esc(k.icon)}</span> ${esc(k.label[l])} <strong>${counts[k.id]}</strong></li>`)
        .join('')}</ul>`
    : '';

  const comments = page?.comments ?? [];
  const commentsHtml = comments
    .map(
      (c) => `<article class="bc-comment" id="comment-${c.id}">` +
        `<header><strong>${esc(c.author ?? t.formerReader)}</strong> ${time(c.published_at)}</header>` +
        `<p>${textToHtml(c.body)}</p>` +
        (c.reply
          ? `<div class="bc-reply"><strong>${esc(t.replyFrom.replace('{site}', data?.name ?? ''))}</strong><p>${textToHtml(c.reply.body)}</p></div>`
          : '') +
        `</article>`,
    )
    .join('');

  const cutoff = data ? ` data-cutoff="${esc(data.cutoff)}"` : '';
  return (
    `<section class="bc-comments" data-bc-section aria-labelledby="bc-comments-heading">` +
    `<h2 id="bc-comments-heading">${esc(t.heading)}</h2>` +
    reactionsHtml +
    // Most recent first: the widget (form, then comments newer than the cutoff) comes
    // before the baked comments, which the export sends newest first.
    `<div data-bc-comments data-site="${esc(site)}" data-api="${esc(base)}"${cutoff} data-heading="false"></div>` +
    `<script src="${esc(base)}/widget.js" defer></script>` +
    `<div class="bc-baked" data-bc-baked>${commentsHtml}</div>` +
    `</section>`
  );
}
