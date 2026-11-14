import { type DB, getMeta, setMeta } from './db.ts';
import { buildExport, exportFingerprint } from './export.ts';
import type { Site, Sites } from './sites.ts';
import type { Clock } from './util.ts';

export const REBUILD_TIMEZONE = 'Europe/Paris';

export interface RebuildStatus {
  checked_at: string;
  result: 'requested' | 'unchanged' | 'failed';
  error?: string;
}

/** Asks Coolify to deploy an app; resolves when the deploy is queued, rejects otherwise. */
export type Deployer = (appUuid: string) => Promise<void>;

export function coolifyDeployer(apiUrl: string, token: string): Deployer {
  return async (appUuid) => {
    const res = await fetch(`${apiUrl}/api/v1/deploy`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ uuid: appUuid, force: false }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Coolify answered ${res.status}: ${text.slice(0, 200)}`);
    if (!text.includes('queued')) throw new Error(`Unexpected Coolify answer: ${text.slice(0, 200)}`);
  };
}

/** Local date (YYYY-MM-DD) and time (HH:MM) in Europe/Paris. */
export function parisNow(ms: number): { day: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: REBUILD_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/**
 * Rebuilds the sites' production apps when what they would bake changed: the export's
 * fingerprint is compared with the one stored after the last accepted rebuild.
 */
export class Rebuilder {
  private readonly db: DB;
  private readonly sites: Sites;
  private readonly deploy: Deployer;
  private readonly now: Clock;
  private readonly at: string;
  private running = false;

  constructor(p: { db: DB; sites: Sites; deploy: Deployer; now: Clock; at: string }) {
    this.db = p.db;
    this.sites = p.sites;
    this.deploy = p.deploy;
    this.now = p.now;
    this.at = p.at;
  }

  configuredSites(): Site[] {
    return [...this.sites.values()].filter((s) => s.rebuildApp);
  }

  /** Called every few minutes: runs the check once a day, after the configured local time. */
  async tick(): Promise<boolean> {
    const { day, time } = parisNow(this.now());
    if (time < this.at || getMeta(this.db, 'rebuild:last_day') === day) return false;
    setMeta(this.db, 'rebuild:last_day', day);
    await this.runAll();
    return true;
  }

  /** Checks every configured site now and requests the rebuilds needed. */
  async runAll(): Promise<Record<string, RebuildStatus>> {
    const results: Record<string, RebuildStatus> = {};
    if (this.running) return results;
    this.running = true;
    try {
      for (const site of this.configuredSites()) results[site.id] = await this.runSite(site);
    } finally {
      this.running = false;
    }
    return results;
  }

  private async runSite(site: Site): Promise<RebuildStatus> {
    const fingerprint = exportFingerprint(buildExport(this.db, site, this.now()));
    const key = `rebuild:${site.id}:fingerprint`;
    let status: RebuildStatus;
    if (getMeta(this.db, key) === fingerprint) {
      status = { checked_at: new Date(this.now()).toISOString(), result: 'unchanged' };
    } else {
      try {
        await this.deploy(site.rebuildApp!);
        setMeta(this.db, key, fingerprint); // only once Coolify accepted: a failure is retried
        status = { checked_at: new Date(this.now()).toISOString(), result: 'requested' };
        console.log(`Rebuild requested for ${site.id}`);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        status = { checked_at: new Date(this.now()).toISOString(), result: 'failed', error };
        console.error(`Rebuild of ${site.id} failed: ${error}`);
      }
    }
    setMeta(this.db, `rebuild:${site.id}:status`, JSON.stringify(status));
    return status;
  }

  status(siteId: string): RebuildStatus | undefined {
    const raw = getMeta(this.db, `rebuild:${siteId}:status`);
    return raw ? (JSON.parse(raw) as RebuildStatus) : undefined;
  }
}
