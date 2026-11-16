export const TIMEZONE = 'Europe/Paris';
const DAY = 24 * 60 * 60 * 1000;

function parts(ms: number, timeZone = TIMEZONE): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
}

/** Calendar day (YYYY-MM-DD) of an instant in Europe/Paris. */
export function parisDay(ms: number): string {
  const p = parts(ms);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Offset of Europe/Paris from UTC at an instant, in ms. */
function offset(ms: number): number {
  const p = parts(ms);
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - Math.floor(ms / 1000) * 1000;
}

/** The instant of midnight starting a Paris calendar day. */
export function parisMidnight(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const utc = Date.UTC(y, m - 1, d);
  let ms = utc - offset(utc);
  ms = utc - offset(ms); // second pass across a DST change
  return ms;
}

/** The `count` Paris calendar days ending with the day of `now`, oldest first. */
export function lastDays(now: number, count: number): string[] {
  const today = parisDay(now);
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) days.push(new Date(Date.UTC(y, m - 1, d) - i * DAY).toISOString().slice(0, 10));
  return days;
}

const shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "12 Nov" for a YYYY-MM-DD day. */
export function shortDay(day: string): string {
  return shortFmt.format(new Date(`${day}T00:00:00Z`));
}

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** "12 Nov 2026, 14:02" in Paris time, for an ISO instant. */
export function parisDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? '' : dateTimeFmt.format(new Date(ms));
}
