import type { Analysis } from '@webshield/core';

/** Refresh authority at read time without overwriting the historical stored observations. */
export function refreshProviderEvidence(original: Analysis, now = Date.now()): Analysis {
  const a: Analysis = { ...original };
  const current = (value: string | undefined) =>
    Boolean(value && Number.isFinite(Date.parse(value)) && Date.parse(value) > now);
  if (a.providers?.length) {
    a.providers = a.providers.map((p) => ({
      ...p,
      status:
        p.status === 'completed' &&
        ((p.expiresAt && !current(p.expiresAt)) || (p.reportedMalicious && !p.expiresAt))
          ? 'expired'
          : p.status,
    }));
    const positives = a.providers.filter(
      (p) => p.status === 'completed' && p.reportedMalicious && current(p.expiresAt),
    );
    const strongest = [...positives].sort(
      (x, y) => Date.parse(y.expiresAt!) - Date.parse(x.expiresAt!),
    )[0];
    a.checks = a.checks.map((c) => {
      const provider = a.providers!.find((p) => c.name === `Provider: ${p.source}`);
      if (provider?.status === 'expired')
        return {
          ...c,
          status: 'unavailable',
          detail: `Historical finding expired at ${provider.expiresAt || 'an unknown time'}. Rescan for current evidence. ${provider.detail}`,
        };
      if (c.name === 'Threat intelligence' && a.providers!.some((p) => p.status !== 'completed'))
        return {
          ...c,
          status: 'unavailable',
          detail:
            'One or more provider observations are unavailable or expired. Inspect each source and expiry.',
        };
      return c;
    });
    a.signals = a.signals.filter(
      (s) => s.code !== 'reported_malicious_url' || positives.some((p) => p.source === s.source),
    );
    if (strongest) {
      a.category = 'confirmed_malicious';
      a.providerSource = strongest.source;
      a.providerExpiresAt = strongest.expiresAt;
      a.summary = `${strongest.source} reports this exact URL as a potential threat. Reports may contain errors; review the observation and expiry.`;
    } else if (a.category === 'confirmed_malicious') {
      a.category = a.screeningCategory || 'inconclusive';
      a.summary =
        'The historical provider match has expired. ' +
        (a.screeningSummary || 'Rescan for current evidence.');
      a.providerSource = undefined;
      a.providerExpiresAt = undefined;
    }
  } else if (a.category === 'confirmed_malicious' && !current(a.providerExpiresAt)) {
    a.category = a.screeningCategory || 'inconclusive';
    a.summary =
      'The historical provider match has expired. ' +
      (a.screeningSummary || 'No current provider verdict is available.');
    a.providerSource = undefined;
    a.signals = a.signals.filter((s) => s.code !== 'reported_malicious_url');
    a.checks = a.checks.map((c) =>
      c.name === 'Threat intelligence' || c.name.startsWith('Provider:')
        ? {
            ...c,
            status: 'unavailable',
            detail: 'The historical provider response has expired. Rescan for a current lookup.',
          }
        : c,
    );
  }
  return a;
}
