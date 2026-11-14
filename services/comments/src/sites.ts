import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';

export const LANGS = ['en', 'fr', 'de'] as const;
export type Lang = (typeof LANGS)[number];

const hostname = z
  .string()
  .regex(/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, 'must be a lowercase host name like www.example.org');
const devOrigin = z.string().regex(/^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/, 'must be http://localhost:<port>');
const label = z.object({ en: z.string().min(1).max(40), fr: z.string().min(1).max(40), de: z.string().min(1).max(40) });

const siteSchema = z.object({
  name: z.string().min(1).max(60),
  domains: z.array(hostname).min(1),
  dev_origins: z.array(devOrigin).default([]),
  languages: z.array(z.enum(LANGS)).min(1).default([...LANGS]),
  bake_after_days: z.number().int().min(0).max(365).default(7),
  reactions: z
    .array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,30}$/), icon: z.string().min(1).max(8), label }))
    .max(8)
    .default([]),
  /** Production app on Coolify, rebuilt at night when the export changed. */
  rebuild: z.object({ coolify_app: z.string().regex(/^[a-z0-9]{10,40}$/) }).optional(),
});

const fileSchema = z.object({
  sites: z.record(z.string().regex(/^[a-z0-9-]{1,40}$/), siteSchema),
});

export interface Reaction {
  id: string;
  icon: string;
  label: Record<Lang, string>;
}

export interface Site {
  id: string;
  name: string;
  domains: string[];
  /** Origins allowed to embed the service for this site. */
  origins: Set<string>;
  languages: Lang[];
  bakeAfterDays: number;
  reactions: Reaction[];
  /** Coolify uuid of the production app to rebuild, if any. */
  rebuildApp?: string;
}

export type Sites = Map<string, Site>;

export function parseSites(text: string, opts: { allowDevOrigins: boolean }): Sites {
  const result = fileSchema.safeParse(parse(text));
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid sites file:\n- ${issues.join('\n- ')}`);
  }
  const sites: Sites = new Map();
  const owner = new Map<string, string>();
  for (const [id, s] of Object.entries(result.data.sites)) {
    for (const domain of s.domains) {
      const other = owner.get(domain);
      if (other) throw new Error(`Invalid sites file: domain ${domain} is listed for both ${other} and ${id}`);
      owner.set(domain, id);
    }
    const kinds = new Set<string>();
    for (const r of s.reactions) {
      if (kinds.has(r.id)) throw new Error(`Invalid sites file: reaction ${r.id} is listed twice for ${id}`);
      kinds.add(r.id);
    }
    const origins = new Set(s.domains.map((d) => `https://${d}`));
    if (opts.allowDevOrigins) for (const o of s.dev_origins) origins.add(o);
    sites.set(id, {
      id,
      name: s.name,
      domains: s.domains,
      origins,
      languages: s.languages,
      bakeAfterDays: s.bake_after_days,
      reactions: s.reactions,
      rebuildApp: s.rebuild?.coolify_app,
    });
  }
  return sites;
}

export function loadSites(file: string, opts: { allowDevOrigins: boolean }): Sites {
  return parseSites(readFileSync(file, 'utf8'), opts);
}

/** True when `origin` may embed the service for any site (used for CORS preflights). */
export function isAllowedOrigin(sites: Sites, origin: string): boolean {
  for (const site of sites.values()) if (site.origins.has(origin)) return true;
  return false;
}

export function pickLang(value: unknown, site?: Site): Lang {
  const lang = LANGS.find((l) => l === value);
  if (lang && (!site || site.languages.includes(lang))) return lang;
  return site?.languages[0] ?? 'en';
}
