import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { t } from './i18n.ts';
import type { Lang } from './sites.ts';

type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

const STYLE = `
  :root { color-scheme: light dark; --fg: #1d2520; --muted: #5b675f; --bg: #fbfaf6; --card: #fff; --line: #d9ddd5; --accent: #2f6b4f; --danger: #a33a2b; }
  @media (prefers-color-scheme: dark) { :root { --fg: #e8ece6; --muted: #a9b3ab; --bg: #161a17; --card: #1f2420; --line: #343b35; --accent: #7cc49e; --danger: #f08a7a; } }
  * { box-sizing: border-box; }
  body { margin: 0; font: 16px/1.5 system-ui, sans-serif; color: var(--fg); background: var(--bg); }
  main { max-width: 34rem; margin: 0 auto; padding: 1.5rem 1rem; }
  main.wide { max-width: 64rem; }
  h1 { font-size: 1.3rem; margin: 0 0 .75rem; }
  p { margin: 0 0 1rem; }
  .muted { color: var(--muted); font-size: .9rem; }
  .btn { display: inline-block; padding: .6rem 1rem; border: 1px solid var(--accent); border-radius: .5rem; background: var(--accent); color: var(--bg); font: inherit; text-decoration: none; cursor: pointer; }
  .btn.secondary { background: transparent; color: var(--accent); }
  .btn.danger { border-color: var(--danger); background: transparent; color: var(--danger); }
  .btn.small { padding: .25rem .6rem; font-size: .85rem; }
  input[type=email], input[type=text], textarea, select { width: 100%; padding: .55rem .7rem; border: 1px solid var(--line); border-radius: .5rem; background: var(--card); color: var(--fg); font: inherit; }
  label { display: block; margin-bottom: .3rem; font-weight: 600; }
  form { margin: 0 0 1rem; }
  .stack > * + * { margin-top: .75rem; }
  .or { text-align: center; color: var(--muted); margin: 1rem 0; }
  .notice { padding: .75rem 1rem; border: 1px solid var(--line); border-radius: .5rem; background: var(--card); }
  .error { border-color: var(--danger); }
  .card { border: 1px solid var(--line); border-radius: .6rem; background: var(--card); padding: .9rem 1rem; margin-bottom: .9rem; }
  .card .body { white-space: pre-wrap; overflow-wrap: anywhere; margin: .5rem 0; }
  .row { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
  .filters { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1rem; }
  .filters select, .filters input { width: auto; }
  nav a { margin-right: 1rem; color: var(--accent); }
  .badge { font-size: .75rem; padding: .1rem .45rem; border-radius: 1rem; border: 1px solid var(--line); }
`;

export function layout(p: { title: string; lang?: string; wide?: boolean; script?: string; body: Html }): Html {
  return html`<!doctype html>
<html lang="${p.lang ?? 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${p.title}</title>
<style>${raw(STYLE)}</style>
${p.script ? html`<script src="${p.script}" defer></script>` : ''}
</head>
<body><main class="${p.wide ? 'wide' : ''}">${p.body}</main></body>
</html>`;
}

export function messagePage(lang: Lang, title: string, message: string, opts: { error?: boolean; close?: boolean } = {}): Html {
  return layout({
    title,
    lang,
    script: opts.close ? '/popup.js' : undefined,
    body: html`${title === message ? '' : html`<h1>${title}</h1>`}<p class="notice ${opts.error ? 'error' : ''}" ${opts.close ? raw('data-close="1"') : ''}>${message}</p>`,
  });
}

export function signInPage(p: {
  lang: Lang;
  siteName: string;
  flow: string;
  google: boolean;
  dev: boolean;
  error?: string;
  sent?: string;
}): Html {
  const { lang } = p;
  const title = t(lang, 'signInTitle', { site: p.siteName });
  if (p.sent) {
    return layout({
      title,
      lang,
      script: '/popup.js',
      body: html`<h1>${title}</h1>
        <p class="notice" data-flow="${p.flow}">${t(lang, 'checkInbox', { email: p.sent })}</p>`,
    });
  }
  return layout({
    title,
    lang,
    script: '/popup.js',
    body: html`<h1>${title}</h1>
      <p>${t(lang, 'signInIntro')}</p>
      ${p.error ? html`<p class="notice error">${p.error}</p>` : ''}
      <div data-flow="${p.flow}"></div>
      ${p.google ? html`<p><a class="btn" href="/auth/google?flow=${p.flow}">${t(lang, 'google')}</a></p><p class="or">${t(lang, 'or')}</p>` : ''}
      <form method="post" action="/auth/email" class="stack">
        <input type="hidden" name="flow" value="${p.flow}">
        <div><label for="email">${t(lang, 'emailLabel')}</label>
        <input id="email" name="email" type="email" autocomplete="email" required maxlength="320"></div>
        <button class="btn secondary" type="submit">${t(lang, 'emailButton')}</button>
      </form>
      ${
        p.dev
          ? html`<form method="post" action="/auth/dev" class="stack">
              <input type="hidden" name="flow" value="${p.flow}">
              <input name="email" type="email" required placeholder="dev@example.org" aria-label="Dev email">
              <button class="btn danger" type="submit">${t(lang, 'devButton')}</button>
            </form>`
          : ''
      }
      <p class="muted">${t(lang, 'privacy')}</p>`,
  });
}

export function confirmLinkPage(p: { lang: Lang; siteName: string; email: string; token: string }): Html {
  const title = t(p.lang, 'confirmTitle');
  return layout({
    title,
    lang: p.lang,
    body: html`<h1>${title}</h1>
      <p>${t(p.lang, 'confirmText', { site: p.siteName, email: p.email })}</p>
      <form method="post" action="/auth/email/verify">
        <input type="hidden" name="token" value="${p.token}">
        <button class="btn" type="submit">${t(p.lang, 'confirmButton')}</button>
      </form>`,
  });
}
