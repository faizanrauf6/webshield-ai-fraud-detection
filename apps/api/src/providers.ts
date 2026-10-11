export interface ProviderFinding {
  status: 'completed' | 'unavailable';
  reportedMalicious: boolean;
  source: string;
  checkedAt: string;
  expiresAt?: string;
  detail: string;
}
export async function lookupSafeBrowsing(
  url: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<ProviderFinding> {
  const base: ProviderFinding = {
    status: 'unavailable',
    reportedMalicious: false,
    source: 'Google Safe Browsing',
    checkedAt: new Date().toISOString(),
    detail: 'Provider unavailable; this is not a negative finding.',
  };
  try {
    const response = await fetcher(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'webshield-fyp', clientVersion: '0.1.0' },
          threatInfo: {
            threatTypes: [
              'MALWARE',
              'SOCIAL_ENGINEERING',
              'UNWANTED_SOFTWARE',
              'POTENTIALLY_HARMFUL_APPLICATION',
            ],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
      },
    );
    if (!response.ok) return base;
    const reader = response.body?.getReader();
    if (!reader) return base;
    let text = '',
      size = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 262144) {
          await reader.cancel();
          return base;
        }
        text += decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
    text += decoder.decode();
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return base;
    const matches = (data as { matches?: unknown }).matches;
    if (matches === undefined && Object.keys(data).length === 0)
      return {
        ...base,
        status: 'completed',
        detail: 'No match returned by this provider at lookup time; this does not prove safety.',
      };
    if (!Array.isArray(matches)) return base;
    if (matches.length === 0)
      return {
        ...base,
        status: 'completed',
        detail: 'No current match returned; this does not prove safety.',
      };
    if (
      matches.some(
        (m) =>
          !m ||
          m.threat?.url !== url ||
          ![
            'MALWARE',
            'SOCIAL_ENGINEERING',
            'UNWANTED_SOFTWARE',
            'POTENTIALLY_HARMFUL_APPLICATION',
          ].includes(m.threatType) ||
          typeof m.cacheDuration !== 'string' ||
          !/^[0-9]+(?:\.[0-9]+)?s$/.test(m.cacheDuration),
      )
    )
      return base;
    const lifetime = Math.min(...matches.map((m) => Number(m.cacheDuration.slice(0, -1))));
    if (!Number.isFinite(lifetime) || lifetime <= 0 || lifetime > 604800) return base;
    return {
      ...base,
      status: 'completed',
      reportedMalicious: true,
      expiresAt: new Date(Date.parse(base.checkedAt) + lifetime * 1000).toISOString(),
      detail: `Exact URL listed for: ${[...new Set(matches.map((m) => m.threatType))].join(', ')}.`,
    };
  } catch {
    return base;
  }
}
