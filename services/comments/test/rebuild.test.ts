import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { buildExport, exportFingerprint } from '../src/export.ts';
import { Rebuilder, parisNow } from '../src/rebuild.ts';
import { parseSites } from '../src/sites.ts';
import { setReaction, setReply, setStatus } from '../src/store.ts';
import { ADMIN, BASE, SITES_YAML, post, setup } from './helpers.ts';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const REBUILD_YAML = `${SITES_YAML.replace('    bake_after_days: 7\n', '    bake_after_days: 7\n    rebuild: { coolify_app: altwebprod0001 }\n')}`;

function withRebuilder(opts: { fail?: boolean } = {}) {
  const s = setup({ devMode: true });
  const sites = parseSites(REBUILD_YAML, { allowDevOrigins: false });
  const deployed: string[] = [];
  let fail = opts.fail ?? false;
  const rebuilder = new Rebuilder({
    db: s.db,
    sites,
    now: s.now,
    at: '03:30',
    deploy: async (uuid) => {
      if (fail) throw new Error('Coolify answered 500');
      deployed.push(uuid);
    },
  });
  return { ...s, sites, rebuilder, deployed, setFail: (v: boolean) => (fail = v) };
}

describe('export fingerprint', () => {
  it('ignores the cutoff and generation dates, and sees every baked change', async () => {
    const s = setup();
    const site = s.sites.get('alt-web')!;
    const fp = () => exportFingerprint(buildExport(s.db, site, s.now()));
    const { token, user } = s.reader('ana@example.org');
    const id = await post(s, token, 'old one', '/a/');
    setStatus(s.db, id, 'published', s.now());

    const empty = fp();
    s.advance(DAY);
    expect(fp()).toBe(empty); // only the cutoff moved

    s.advance(7 * DAY);
    const baked = fp();
    expect(baked).not.toBe(empty); // the comment crossed the delay

    setReply(s.db, id, 'Thanks', s.now());
    const replied = fp();
    expect(replied).not.toBe(baked);

    setReaction(s.db, { siteId: 'alt-web', path: '/a/', userId: user.id, kind: 'useful', on: true }, s.now());
    const reacted = fp();
    expect(reacted).not.toBe(replied);

    setStatus(s.db, id, 'refused', s.now());
    expect(fp()).not.toBe(reacted); // removal

    // a young comment does not change it
    const before = fp();
    setStatus(s.db, await post(s, token, 'young', '/a/'), 'published', s.now());
    expect(fp()).toBe(before);
  });
});

describe('rebuilder', () => {
  it('requests a rebuild only for configured sites whose export changed', async () => {
    const r = withRebuilder();
    expect(r.rebuilder.configuredSites().map((s) => s.id)).toEqual(['alt-web']); // simplygoodfood has no app
    expect(await r.rebuilder.runAll()).toMatchObject({ 'alt-web': { result: 'requested' } }); // first run
    expect(r.deployed).toEqual(['altwebprod0001']);
    expect(await r.rebuilder.runAll()).toMatchObject({ 'alt-web': { result: 'unchanged' } });
    expect(r.deployed).toHaveLength(1);

    const { token } = r.reader('ana@example.org');
    setStatus(r.db, await post(r, token), 'published', r.now());
    r.advance(8 * DAY);
    expect(await r.rebuilder.runAll()).toMatchObject({ 'alt-web': { result: 'requested' } });
    expect(r.deployed).toHaveLength(2);
  });

  it('retries after a failed request', async () => {
    const r = withRebuilder({ fail: true });
    expect(await r.rebuilder.runAll()).toMatchObject({ 'alt-web': { result: 'failed', error: 'Coolify answered 500' } });
    expect(r.rebuilder.status('alt-web')).toMatchObject({ result: 'failed' });
    r.setFail(false);
    expect(await r.rebuilder.runAll()).toMatchObject({ 'alt-web': { result: 'requested' } });
  });

  it('runs once a night, after 03:30 in Paris, even across restarts', async () => {
    const r = withRebuilder();
    // setup's clock starts at 2026-11-01 10:00 UTC (11:00 in Paris): move to 02:00 UTC next day = 03:00 Paris
    r.advance(16 * HOUR);
    expect(parisNow(r.now())).toEqual({ day: '2026-11-02', time: '03:00' });
    expect(await r.rebuilder.tick()).toBe(false);
    r.advance(40 * 60 * 1000); // 03:40
    expect(await r.rebuilder.tick()).toBe(true);
    expect(r.deployed).toHaveLength(1);
    r.advance(HOUR);
    expect(await r.rebuilder.tick()).toBe(false);

    // a restarted service (new Rebuilder, same database) does not run again the same day
    const again = new Rebuilder({ db: r.db, sites: r.sites, now: r.now, at: '03:30', deploy: async () => {} });
    expect(await again.tick()).toBe(false);

    r.advance(DAY);
    expect(await r.rebuilder.tick()).toBe(true); // next night: checked, nothing changed
    expect(r.rebuilder.status('alt-web')).toMatchObject({ result: 'unchanged' });
    expect(r.deployed).toHaveLength(1);
  });
});

describe('admin rebuild box', () => {
  it('shows the status and runs the check on demand', async () => {
    const r = withRebuilder();
    const app = createApp({ config: r.config, sites: r.sites, db: r.db, mailer: r.mailer, now: r.now, rebuilder: r.rebuilder });
    const login = await app.request('/admin/login');
    const flow = (await login.text()).match(/name="flow" value="([^"]+)"/)![1]!;
    const res = await app.request('/auth/dev', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: BASE },
      body: new URLSearchParams({ flow, email: ADMIN }).toString(),
    });
    const cookie = res.headers.get('set-cookie')!.split(';')[0]!;

    const page = await (await app.request('/admin', { headers: { cookie } })).text();
    expect(page).toContain('Site rebuilds');
    expect(page).toContain('Alt Web: never checked');

    const run = await app.request('/admin/rebuild', { method: 'POST', headers: { cookie, origin: BASE } });
    expect(run.status).toBe(302);
    expect(r.deployed).toEqual(['altwebprod0001']);
    expect(await (await app.request('/admin', { headers: { cookie } })).text()).toContain('rebuild requested');
  });

  it('says when the rebuild is off', async () => {
    const s = setup({ devMode: true });
    const login = await s.app.request('/admin/login');
    const flow = (await login.text()).match(/name="flow" value="([^"]+)"/)![1]!;
    const res = await s.form('/auth/dev', { flow, email: ADMIN });
    const cookie = res.headers.get('set-cookie')!.split(';')[0]!;
    expect(await (await s.app.request('/admin', { headers: { cookie } })).text()).toContain('Site rebuilds</strong>: off');
  });
});

describe('rebuild configuration', () => {
  it('validates REBUILD_AT and the app uuid', () => {
    expect(loadConfig({}).rebuildAt).toBe('03:30');
    expect(loadConfig({ COOLIFY_API_URL: 'https://c.example.org/', COOLIFY_DEPLOY_TOKEN: 't' })).toMatchObject({
      coolifyApiUrl: 'https://c.example.org',
      coolifyDeployToken: 't',
    });
    expect(() => loadConfig({ REBUILD_AT: '3:30' })).toThrow(/REBUILD_AT/);
    expect(() => parseSites('sites:\n  a: { name: A, domains: [x.org], rebuild: { coolify_app: "bad uuid!" } }\n', { allowDevOrigins: false })).toThrow();
  });
});
