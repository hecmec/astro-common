import { type Clock, systemClock } from './util.ts';

/** Sliding-window counter kept in memory. Keys (IPs, emails) are never stored on disk. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: Clock;

  constructor(limit: number, windowMs: number, now: Clock = systemClock) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  /** Records a hit; returns false when the key is over its limit. */
  hit(key: string): boolean {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(now);
    return true;
  }

  private prune(now: number) {
    for (const [key, times] of this.hits) {
      if (!times.some((t) => t > now - this.windowMs)) this.hits.delete(key);
    }
  }
}
