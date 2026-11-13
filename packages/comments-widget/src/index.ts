/**
 * BabelCoach comments widget.
 *
 *   <div data-bc-comments data-site="alt-web"></div>
 *   <script src="https://comments.babelcoach.com/widget.js" defer></script>
 *
 * Optional attributes on the mount: data-api (service URL, default: where this script
 * comes from), data-cutoff (ISO date: comments published up to then are already in the
 * page's HTML), data-heading="false" (the page renders the heading itself).
 */
import { h, linkify } from './dom.ts';
import { type Lang, pageLang, translator } from './i18n.ts';
import { STYLE } from './style.ts';

interface Comment {
  id: number;
  author: string | null;
  body: string;
  status: 'pending' | 'published' | 'refused';
  created_at: string;
  published_at: string | null;
  mine: boolean;
  reply: { body: string; created_at: string } | null;
}
interface Reaction {
  id: string;
  icon: string;
  label: string;
  count: number;
  mine: boolean;
}
interface PageData {
  site: { id: string; name: string };
  comments: Comment[];
  reactions: Reaction[];
  me: { display_name: string | null } | null;
}

const MAX = 500;
const TIMEOUT = 5000;
const scriptSrc = (document.currentScript as HTMLScriptElement | null)?.src;

class Widget {
  private readonly api: string;
  private readonly site: string;
  private readonly cutoff: string | null;
  private readonly heading: boolean;
  private readonly lang: Lang;
  private readonly t: ReturnType<typeof translator>;
  private readonly root: ShadowRoot;
  private readonly mount: HTMLElement;
  private readonly path = location.pathname;
  private data: PageData | null = null;
  private notice: { text: string; error?: boolean; link?: string } | null = null;
  private signingIn = false;
  private confirmingDelete = false;
  private draft = '';

  constructor(mount: HTMLElement) {
    this.mount = mount;
    this.site = mount.dataset.site ?? '';
    this.api = (mount.dataset.api ?? (scriptSrc ? new URL(scriptSrc).origin : '')).replace(/\/+$/, '');
    this.cutoff = mount.dataset.cutoff || null;
    this.heading = mount.dataset.heading !== 'false';
    this.lang = pageLang(document);
    this.t = translator(this.lang);
    this.root = mount.attachShadow({ mode: 'open' });
  }

  // ---- storage and requests ----------------------------------------------

  private get tokenKey() {
    return `bc-comments:${this.site}`;
  }
  private get token(): string | null {
    try {
      return localStorage.getItem(this.tokenKey);
    } catch {
      return null;
    }
  }
  private set token(v: string | null) {
    try {
      if (v) localStorage.setItem(this.tokenKey, v);
      else localStorage.removeItem(this.tokenKey);
    } catch {
      /* storage blocked: the session lasts until reload */
    }
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = {};
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    return fetch(`${this.api}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT),
      credentials: 'omit',
    });
  }

  private sitePath(p: string) {
    return `/api/v1/sites/${encodeURIComponent(this.site)}${p}`;
  }

  async load() {
    const q = new URLSearchParams({ path: this.path, lang: this.lang });
    if (this.cutoff) q.set('after', this.cutoff);
    try {
      const res = await this.request('GET', this.sitePath(`/page?${q}`));
      if (res.status === 403 || res.status === 404) {
        // Not an allowed domain for this site: show nothing at all.
        this.mount.hidden = true;
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      this.data = (await res.json()) as PageData;
      if (this.token && !this.data.me) this.token = null;
      this.hideStaticReactions();
    } catch {
      this.notice = { text: this.t('unavailable'), error: true };
    }
    this.render();
  }

  /** Inside the Astro section, live reactions replace the baked counts. */
  private hideStaticReactions() {
    const section = this.mount.closest('[data-bc-section]');
    section?.querySelectorAll<HTMLElement>('[data-bc-static-reactions]').forEach((el) => (el.hidden = true));
  }

  private bakedCount(): number {
    return this.mount.closest('[data-bc-section]')?.querySelectorAll('[data-bc-baked] article').length ?? 0;
  }

  private async errorFrom(res: Response) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    const map: Record<string, string> = {
      invalid_length: this.t('tooLong', { max: MAX }),
      too_many: this.t('tooMany'),
      not_allowed: this.t('notAllowed'),
      invalid_display_name: this.t('nameInvalid'),
    };
    return map[body.error ?? ''] ?? this.t('error');
  }

  // ---- actions --------------------------------------------------------------

  private async signIn() {
    if (this.signingIn) return;
    // Open the window synchronously, inside the click, so pop-up blockers allow it.
    const popup = window.open('', 'bc-signin', 'width=480,height=680');
    this.signingIn = true;
    this.notice = { text: this.t('waiting') };
    this.render();
    try {
      const res = await this.request('POST', '/auth/flows', { site: this.site, lang: this.lang });
      if (!res.ok) throw new Error(String(res.status));
      const { flow, url } = (await res.json()) as { flow: string; url: string };
      if (popup && !popup.closed) popup.location.href = url;
      else this.notice = { text: this.t('popupBlocked'), link: url };
      this.render();
      const deadline = Date.now() + 20 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1500));
        const poll = await this.request('GET', `/auth/flows/${encodeURIComponent(flow)}`).catch(() => null);
        if (!poll?.ok) continue;
        const s = (await poll.json()) as { status: string; token?: string };
        if (s.status === 'done' && s.token) {
          this.token = s.token;
          break;
        }
        if (s.status === 'expired') break;
      }
    } catch {
      popup?.close();
      this.notice = { text: this.t('error'), error: true };
      this.signingIn = false;
      this.render();
      return;
    }
    this.signingIn = false;
    this.notice = null;
    await this.load();
  }

  private async signOut() {
    await this.request('POST', this.sitePath('/logout')).catch(() => null);
    this.token = null;
    await this.load();
  }

  private async deleteAccount(keep: boolean) {
    const res = await this.request('DELETE', this.sitePath(`/me?comments=${keep ? 'keep' : 'delete'}`)).catch(() => null);
    if (!res?.ok) return this.fail(res);
    this.token = null;
    this.confirmingDelete = false;
    await this.load();
  }

  private async saveName(name: string) {
    const res = await this.request('PUT', this.sitePath('/me'), { display_name: name }).catch(() => null);
    if (!res?.ok) return this.fail(res);
    this.notice = null;
    await this.load();
  }

  private async post(body: string) {
    const res = await this.request('POST', this.sitePath('/comments'), { path: this.path, body, lang: this.lang }).catch(() => null);
    if (!res?.ok) return this.fail(res);
    const { comment } = (await res.json()) as { comment: Comment };
    this.data?.comments.unshift(comment);
    this.draft = '';
    this.notice = { text: this.t('posted') };
    this.render();
  }

  private async remove(id: number) {
    if (!confirm(this.t('deleteConfirm'))) return;
    const res = await this.request('DELETE', this.sitePath(`/comments/${id}`)).catch(() => null);
    if (!res?.ok) return this.fail(res);
    if (this.data) this.data.comments = this.data.comments.filter((c) => c.id !== id);
    this.render();
  }

  private async react(r: Reaction) {
    if (!this.data?.me) return this.signIn();
    const res = await this.request('PUT', this.sitePath('/reactions'), { path: this.path, kind: r.id, on: !r.mine, lang: this.lang }).catch(
      () => null,
    );
    if (!res?.ok) return this.fail(res);
    this.data.reactions = ((await res.json()) as { reactions: Reaction[] }).reactions;
    this.render();
  }

  private async fail(res: Response | null) {
    this.notice = { text: res ? await this.errorFrom(res) : this.t('unavailable'), error: true };
    this.render();
  }

  // ---- rendering --------------------------------------------------------------

  private date(iso: string | null) {
    if (!iso) return null;
    const d = new Date(iso);
    return h('time', { datetime: iso }, new Intl.DateTimeFormat(this.lang, { dateStyle: 'medium' }).format(d));
  }

  private renderComment(c: Comment) {
    const t = this.t;
    return h(
      'article',
      { class: `comment ${c.status}` },
      h(
        'header',
        {},
        h('strong', {}, c.author ?? t('formerReader')),
        ' ',
        this.date(c.published_at ?? c.created_at),
        c.status !== 'published' ? h('span', { class: 'badge' }, t(c.status === 'pending' ? 'pending' : 'refused')) : null,
      ),
      h('p', { class: 'body' }, linkify(c.body)),
      c.reply
        ? h('div', { class: 'reply' }, h('strong', {}, t('replyFrom', { site: this.data?.site.name ?? '' })), h('p', { class: 'body' }, linkify(c.reply.body)))
        : null,
      c.mine ? h('button', { type: 'button', class: 'link', onclick: () => this.remove(c.id) }, t('delete')) : null,
    );
  }

  private renderReactions(d: PageData) {
    if (!d.reactions.length) return null;
    return h(
      'div',
      { class: 'reactions', role: 'group', 'aria-label': this.t('reactions') },
      d.reactions.map((r) =>
        h(
          'button',
          {
            type: 'button',
            class: 'reaction',
            'aria-pressed': r.mine ? 'true' : 'false',
            title: d.me ? r.label : this.t('reactSignIn'),
            onclick: () => this.react(r),
          },
          h('span', { 'aria-hidden': 'true' }, r.icon),
          ` ${r.label} `,
          h('span', { class: 'count' }, String(r.count)),
        ),
      ),
    );
  }

  private renderFooter(d: PageData) {
    const t = this.t;
    if (!d.me) {
      return h('div', { class: 'footer' }, h('button', { type: 'button', class: 'btn', onclick: () => this.signIn(), disabled: this.signingIn }, t('signIn')));
    }
    if (!d.me.display_name) {
      const input = h('input', { type: 'text', id: 'bc-name', minlength: '2', maxlength: '40', required: true, autocomplete: 'nickname' });
      return h(
        'form',
        {
          class: 'footer',
          onsubmit: (e: Event) => {
            e.preventDefault();
            void this.saveName(input.value);
          },
        },
        h('label', { for: 'bc-name' }, t('namePrompt')),
        h('div', { class: 'row' }, input, h('button', { class: 'btn', type: 'submit' }, t('nameSave'))),
      );
    }
    if (this.confirmingDelete) {
      return h(
        'div',
        { class: 'footer confirm' },
        h('p', {}, t('deleteAccountText')),
        h(
          'div',
          { class: 'row' },
          h('button', { type: 'button', class: 'btn danger', onclick: () => this.deleteAccount(false) }, t('deleteAll')),
          h('button', { type: 'button', class: 'btn secondary', onclick: () => this.deleteAccount(true) }, t('keepComments')),
          h('button', { type: 'button', class: 'link', onclick: () => ((this.confirmingDelete = false), this.render()) }, t('cancel')),
        ),
      );
    }
    const counter = h('span', { class: 'muted' }, `${this.draft.length}/${MAX}`);
    const textarea = h('textarea', { id: 'bc-body', rows: '4', maxlength: String(MAX), required: true });
    textarea.value = this.draft;
    textarea.addEventListener('input', () => {
      this.draft = textarea.value;
      counter.textContent = `${this.draft.length}/${MAX}`;
    });
    return h(
      'div',
      { class: 'footer' },
      h(
        'form',
        {
          onsubmit: (e: Event) => {
            e.preventDefault();
            const body = textarea.value.trim();
            if (body) void this.post(body);
          },
        },
        h('label', { for: 'bc-body' }, t('formLabel')),
        textarea,
        h('div', { class: 'row spread' }, counter, h('button', { class: 'btn', type: 'submit' }, t('post'))),
      ),
      h(
        'p',
        { class: 'muted account' },
        t('signedInAs', { name: d.me.display_name }),
        ' · ',
        h('button', { type: 'button', class: 'link', onclick: () => this.signOut() }, t('signOut')),
        ' · ',
        h('button', { type: 'button', class: 'link', onclick: () => ((this.confirmingDelete = true), this.render()) }, t('deleteAccount')),
      ),
    );
  }

  render() {
    const t = this.t;
    const d = this.data;
    const notice = this.notice
      ? h(
          'p',
          { class: `notice${this.notice.error ? ' error' : ''}`, role: 'status' },
          this.notice.text,
          this.notice.link ? [' ', h('a', { href: this.notice.link, target: '_blank', rel: 'noopener' }, this.notice.link)] : null,
        )
      : null;
    const content = d
      ? [
          // Most recent first: form on top, then the newest comments. Inside the Astro
          // section, the older (baked) comments follow below the widget.
          this.renderReactions(d),
          h('p', { class: 'muted small' }, t('intro')),
          notice,
          this.renderFooter(d),
          d.comments.length ? h('div', { class: 'comments' }, d.comments.map((c) => this.renderComment(c))) : null,
          !d.comments.length && !this.bakedCount() ? h('p', { class: 'muted' }, t('empty')) : null,
        ]
      : [notice];
    this.root.replaceChildren(
      h('style', {}, STYLE),
      h('div', { class: 'bc' }, this.heading ? h('h2', {}, t('heading')) : null, content),
    );
  }
}

function init() {
  document.querySelectorAll<HTMLElement>('[data-bc-comments]').forEach((el) => {
    if (el.shadowRoot || !el.dataset.site) return;
    void new Widget(el).load();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
