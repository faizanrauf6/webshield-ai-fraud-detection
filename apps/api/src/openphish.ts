import { normalizeUrl } from '@webshield/core';
import type { ProviderFinding } from './providers';

const ENDPOINT = 'https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt';
const TTL = 12 * 3600 * 1000;

/** Academic/personal research only. Never expose or persist the raw proprietary feed. */
export class OpenPhishProvider {
  private urls = new Set<string>();
  private refreshedAt: number | null = null;
  private refreshPromise: Promise<void> | null = null;
  constructor(
    private fetcher: typeof fetch = fetch,
    private clock: () => number = Date.now,
  ) {}
  private async refresh(): Promise<void> {
    const response = await this.fetcher(ENDPOINT, {
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok || !response.body) throw new Error('Feed unavailable');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '',
      bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 2_000_000) {
          await reader.cancel();
          throw new Error('Feed exceeds size limit');
        }
        text += decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
    text += decoder.decode();
    const urls = new Set<string>();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (!lines.length || lines.length > 20000 || lines.some((line) => !/^https?:\/\//i.test(line)))
      throw new Error('Invalid feed');
    for (const line of lines) {
      try {
        urls.add(normalizeUrl(line.trim()));
      } catch {
        /* Unsupported URLs cannot match accepted submissions. */
      }
    }
    if (!urls.size) throw new Error('No usable feed entries');
    this.urls = urls;
    this.refreshedAt = this.clock();
  }
  async lookup(url: string): Promise<ProviderFinding> {
    const base: ProviderFinding = {
      status: 'unavailable',
      reportedMalicious: false,
      source: 'OpenPhish Community Feed',
      checkedAt: new Date(this.clock()).toISOString(),
      detail: 'Feed unavailable; no clean verdict can be inferred.',
    };
    try {
      if (this.refreshedAt === null || this.clock() - this.refreshedAt >= TTL) {
        this.refreshPromise ??= this.refresh();
        try {
          await this.refreshPromise;
        } finally {
          this.refreshPromise = null;
        }
      }
      const match = this.urls.has(normalizeUrl(url));
      return {
        ...base,
        status: 'completed',
        reportedMalicious: match,
        expiresAt: new Date(this.refreshedAt! + TTL).toISOString(),
        detail: match
          ? 'This exact normalized URL appears in the OpenPhish Community Feed. Reports may contain errors; this is not a business-legitimacy guarantee.'
          : 'No exact URL match in the limited community feed; this does not establish safety.',
      };
    } catch {
      return base;
    }
  }
}
