import { parse } from 'yaml';
import { z } from 'zod';

const host = z.string().regex(/^([a-z0-9-]+\.)+[a-z]{2,63}$/, 'must be a host name');
const hex = z.string().regex(/^#[0-9a-f]{6}$/i, 'must be a #rrggbb colour');

const siteSchema = z.object({
  name: z.string().min(1).max(60),
  short: z.string().min(1).max(4),
  domain: host,
  staging: host,
  color: z.object({ light: hex, dark: hex }),
  umami: z.uuid(),
  search_console: z.string().regex(/^(sc-domain:[a-z0-9.-]+|https:\/\/.+\/)$/).optional(),
});

const fileSchema = z.object({ sites: z.record(z.string().regex(/^[a-z0-9-]{1,40}$/), siteSchema) });

export interface Site {
  id: string;
  name: string;
  /** Abbreviation for tight places (chart end labels). */
  short: string;
  /** Production host. */
  domain: string;
  /** Staging host. */
  staging: string;
  color: { light: string; dark: string };
  umamiId: string;
  searchConsole?: string;
}

/** The sites in file order (the colour order). */
export type Sites = Site[];

export function parseSites(text: string): Sites {
  const result = fileSchema.safeParse(parse(text));
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid console sites file:\n- ${issues.join('\n- ')}`);
  }
  return Object.entries(result.data.sites).map(([id, s]) => ({
    id,
    name: s.name,
    short: s.short,
    domain: s.domain,
    staging: s.staging,
    color: s.color,
    umamiId: s.umami,
    searchConsole: s.search_console,
  }));
}

export function siteById(sites: Sites, id: string | null | undefined): Site | undefined {
  return id ? sites.find((s) => s.id === id) : undefined;
}
