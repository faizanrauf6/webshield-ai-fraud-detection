import { getDomain } from 'tldts';
import { extractCryptoAddresses } from './analysis';
import type { Analysis, ContentObservation, Signal } from './types';

function domain(value: string): string {
  const host = new URL(value).hostname;
  return getDomain(host, { allowPrivateDomains: true }) || host;
}

/** Rule-based screening of observations, never a trained-model or verified fraud verdict. */
export function applyContentObservation(a: Analysis, observation: ContentObservation): Analysis {
  const source = 'Isolated static HTML scan';
  const add = (code: string, label: string, severity: Signal['severity'], evidence: string) => {
    a.signals.push({
      code,
      label,
      severity,
      evidence,
      source,
      confidence: 'heuristic',
      observedAt: observation.observedAt,
    });
  };
  const claims = ['guaranteed returns', 'double your deposit'].filter((phrase) =>
    observation.text.toLowerCase().includes(phrase),
  );
  const addresses = extractCryptoAddresses(observation.text);
  const detected = /\b(?:crypto|bitcoin|ethereum|wallet|token)\b/i.test(observation.text);
  a.crypto = { detected, addresses, claims };
  for (const phrase of claims)
    add(
      phrase === 'guaranteed returns' ? 'guaranteed_returns' : 'deposit_multiplier',
      'Unrealistic investment claim',
      'medium',
      `Page text contains “${phrase}”. This is a textual warning, not an independently verified fraud report.`,
    );
  const mismatches = observation.forms.filter((form) => {
    try {
      return form.hasPassword && domain(form.action) !== domain(observation.finalUrl);
    } catch {
      return false;
    }
  });
  if (mismatches.length)
    add(
      'credential_destination_mismatch',
      'Credential form points to another domain',
      'high',
      `Password form action: ${mismatches[0].action}. Legitimate identity providers can also use external forms.`,
    );
  if (observation.forms.some((form) => form.hasPassword && form.action.startsWith('http:')))
    add(
      'unencrypted_credential_form',
      'Password form uses an unencrypted destination',
      'medium',
      'An observed password form submits to an HTTP URL. No form was submitted.',
    );
  const redirectDomains = new Set(observation.redirects.map((r) => domain(r)));
  redirectDomains.delete(domain(observation.url));
  if (redirectDomains.size >= 2)
    add(
      'cross_domain_redirect_chain',
      'Redirect chain crosses multiple domains',
      'medium',
      `${redirectDomains.size} other registrable domains in the redirect chain. Advertising and sign-in flows may also redirect legitimately.`,
    );
  else if (redirectDomains.size)
    add(
      'cross_domain_redirect',
      'Page redirects to another domain',
      'low',
      'The final navigation includes another registrable domain. A redirect alone does not establish deception.',
    );
  const shopping = /\b(?:shop|store|checkout|sale|buy|order)\b/i.test(observation.text);
  const discount = /\b(?:[89]\d|100)\s*%\s*off\b/i.test(observation.text);
  const irreversibleOnly =
    /(?:pay|payment|payments)\s+(?:only\s+(?:in\s+)?(?:crypto|bitcoin)|(?:in\s+)?(?:crypto|bitcoin)\s+only)/i.test(
      observation.text,
    );
  if (shopping && discount && irreversibleOnly)
    add(
      'storefront_payment_pressure',
      'Storefront combines extreme discounts with crypto-only payment',
      'medium',
      'Observed shopping language, an 80–100% discount claim and crypto-only payment wording. These combined textual indicators require review; they do not prove storefront fraud.',
    );
  if (addresses.length)
    a.signals.push({
      code: 'crypto_addresses',
      label: 'Candidate cryptocurrency addresses',
      severity: 'info',
      evidence: `${addresses.length} format/checksum-validated candidates; presence does not imply abuse.`,
      source,
      confidence: 'observation',
      observedAt: observation.observedAt,
    });
  Object.assign(
    a.checks.find((c) => c.name === 'Page content')!,
    {
      status: 'completed',
      source,
      observedAt: observation.observedAt,
      detail: `Bounded HTML inspected. Title: ${observation.title || '(none)'}. ${observation.forms.length} forms, ${observation.iframeCount} iframes, ${observation.redirects.length} redirects. JavaScript was not executed.`,
    },
  );
  Object.assign(
    a.checks.find((c) => c.name === 'Cryptocurrency indicators')!,
    {
      status: 'completed',
      source,
      observedAt: observation.observedAt,
      detail:
        'Page text and candidate addresses checked. No wallet operations or blockchain activity checks were performed.',
    },
  );
  if (a.category !== 'confirmed_malicious') {
    const warnings = a.signals.filter((s) => ['medium', 'high'].includes(s.severity));
    if (warnings.length) {
      a.category = 'suspicious';
      a.summary = `Static page content and URL evidence include warning signs: ${warnings
        .slice(0, 3)
        .map((s) => s.label)
        .join('; ')}. This screening result is not a verified fraud report.`;
    } else {
      a.summary =
        'Static page content and URL structure were inspected. Available evidence is insufficient to establish website or business legitimacy.';
    }
  }
  a.content = {
    url: observation.url,
    finalUrl: observation.finalUrl,
    observedAt: observation.observedAt,
    title: observation.title,
    forms: observation.forms,
    linkDomains: observation.linkDomains,
    iframeCount: observation.iframeCount,
    redirects: observation.redirects,
  };
  a.limitations = a.limitations.filter((l) => !l.startsWith('Only the submitted URL structure'));
  a.limitations.push(
    'Only bounded static HTML was inspected. JavaScript-rendered behavior, hidden pages, wallet interactions and form submissions were not examined.',
  );
  return a;
}
