import { sha256 } from '@noble/hashes/sha256';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { extractFeatures } from './features';
import { normalizeUrl } from './policy';
import { FIXTURES, type Analysis, type CryptoAddress, type Fixture, type Signal } from './types';

function validEvm(address: string): boolean {
  const body = address.slice(2);
  if (body === body.toLowerCase() || body === body.toUpperCase()) return true;
  const hash = bytesToHex(keccak_256(utf8ToBytes(body.toLowerCase())));
  return [...body].every(
    (c, i) =>
      !/[a-fA-F]/.test(c) ||
      (parseInt(hash[i], 16) >= 8 ? c === c.toUpperCase() : c === c.toLowerCase()),
  );
}
function validBitcoin(address: string): boolean {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let number = 0n;
  for (const char of address) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) return false;
    number = number * 58n + BigInt(digit);
  }
  const hex = number.toString(16).padStart(2, '0');
  const body = Uint8Array.from(
    (hex.length % 2 ? '0' + hex : hex).match(/../g)!.map((x) => parseInt(x, 16)),
  );
  const zeros = address.match(/^1*/)?.[0].length || 0;
  const decoded = new Uint8Array(zeros + body.length);
  decoded.set(body, zeros);
  if (decoded.length !== 25 || ![0, 5].includes(decoded[0])) return false;
  const checksum = sha256(sha256(decoded.slice(0, 21))).slice(0, 4);
  return checksum.every((byte, i) => byte === decoded[21 + i]);
}
export function extractCryptoAddresses(text: string): CryptoAddress[] {
  const result: CryptoAddress[] = [];
  for (const address of new Set(text.match(/\b0x[a-fA-F0-9]{40}\b/g) || [])) {
    if (validEvm(address))
      result.push({
        address,
        chain: 'EVM-compatible (chain unknown)',
        validation:
          /[a-f]/.test(address.slice(2)) && /[A-F]/.test(address.slice(2))
            ? 'EIP-55 checksum'
            : 'Format only; no mixed-case checksum',
      });
  }
  for (const address of new Set(text.match(/\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g) || [])) {
    if (validBitcoin(address))
      result.push({
        address,
        chain: 'Bitcoin-compatible (network not proven)',
        validation: 'Base58Check checksum',
      });
  }
  return result;
}
export function analyzeUrl(input: string, fixture?: Fixture): Analysis {
  const normalized = normalizeUrl(input);
  const url = new URL(normalized);
  if (fixture && (!FIXTURES[fixture] || normalized !== FIXTURES[fixture].url))
    throw new Error('Demo scenarios must use their matching .example URL.');
  const observedAt = new Date().toISOString();
  const features = extractFeatures(normalized);
  const signals: Signal[] = [];
  const add = (
    code: string,
    label: string,
    severity: Signal['severity'],
    evidence: string,
    source = 'URL syntax',
    confidence: Signal['confidence'] = 'heuristic',
  ) => signals.push({ code, label, severity, evidence, source, confidence, observedAt });
  if (features.punycode)
    add(
      'internationalized_domain',
      'Internationalized hostname',
      'low',
      url.hostname + ' — IDNA encoding can be legitimate.',
    );
  if (features.ip_literal)
    add(
      'ip_literal',
      'IP address used as hostname',
      'low',
      url.hostname + ' — address use alone is not evidence of fraud.',
    );
  if (url.protocol === 'http:')
    add(
      'unencrypted_transport',
      'Unencrypted URL',
      'medium',
      'The submitted URL uses HTTP. No connection or TLS handshake was performed.',
      'URL syntax',
      'observation',
    );
  if (features.hostname_length > 45 || features.hyphen_count > 3)
    add(
      'complex_hostname',
      'Unusual hostname structure',
      'low',
      `${features.hostname_length} characters; ${features.hyphen_count} hyphens. This can occur on legitimate services.`,
    );
  if (/(?:^|[-.])(login|verify|secure|account)(?:[-.]|$)/i.test(url.hostname))
    add(
      'account_wording',
      'Account-related hostname wording',
      'low',
      url.hostname + ' — wording alone cannot establish impersonation.',
    );
  const text = fixture ? FIXTURES[fixture].text : '';
  const source = 'Synthetic local fixture';
  const claims: string[] = [];
  for (const phrase of ['guaranteed returns', 'double your deposit']) {
    if (text.toLowerCase().includes(phrase)) {
      claims.push(phrase);
      add(
        phrase === 'guaranteed returns' ? 'guaranteed_returns' : 'deposit_multiplier',
        'Unrealistic investment claim',
        'medium',
        `Fixture excerpt: “${phrase}”. A textual heuristic, not verified fraud.`,
        source,
      );
    }
  }
  if (
    fixture &&
    FIXTURES[fixture].formDestination &&
    new URL(FIXTURES[fixture].formDestination!).hostname !== url.hostname
  )
    add(
      'credential_destination_mismatch',
      'Credential form points to another domain',
      'high',
      `Local fixture form destination: ${FIXTURES[fixture].formDestination}. Some legitimate identity providers also use external forms.`,
      source,
    );
  const addresses = extractCryptoAddresses(text);
  const cryptoDetected = /crypto|bitcoin|ethereum|wallet|token/i.test(text);
  if (addresses.length)
    add(
      'crypto_addresses',
      'Candidate cryptocurrency addresses',
      'info',
      `${addresses.length} checksum/format-validated candidates; presence does not imply abuse.`,
      source,
      'observation',
    );
  return {
    category: 'inconclusive',
    numericScore: null,
    demo: Boolean(fixture),
    features,
    signals,
    summary: signals.some((s) => s.severity === 'high' || s.severity === 'medium')
      ? 'Potential warning signs were observed. Available evidence is insufficient to determine whether this website is fraudulent.'
      : 'URL analysis is complete. Available evidence is insufficient to determine whether this website is legitimate.',
    checks: [
      {
        name: 'URL analysis',
        status: 'completed',
        source: 'Local lexical engine',
        observedAt,
        detail: 'URL structure analyzed without visiting the website.',
      },
      {
        name: 'Domain intelligence',
        status: 'unavailable',
        source: 'DNS / RDAP',
        observedAt: null,
        detail: 'Live domain metadata is not configured. Domain age and ownership are unknown.',
      },
      {
        name: 'Threat intelligence',
        status: 'unavailable',
        source: 'External providers',
        observedAt: null,
        detail: 'External providers are disabled or not configured.',
      },
      {
        name: 'Page content',
        status: fixture ? 'completed' : 'skipped',
        source: fixture ? source : 'Disabled',
        observedAt: fixture ? observedAt : null,
        detail: fixture
          ? 'Analyzed repository-owned synthetic content. The target website was not visited.'
          : 'Live page scanning is disabled pending verified network isolation.',
      },
      {
        name: 'Cryptocurrency indicators',
        status: fixture ? 'completed' : 'skipped',
        source: fixture ? source : 'No content available',
        observedAt: fixture ? observedAt : null,
        detail: fixture
          ? 'Local text and address candidates checked; no wallet was connected.'
          : 'Cannot inspect addresses or investment claims without page content.',
      },
      {
        name: 'Machine learning',
        status: 'unavailable',
        source: 'Model registry',
        observedAt: null,
        detail: 'No independently evaluated production model is installed.',
      },
    ],
    limitations: [
      'A clean or inconclusive scan is not proof of legitimacy. Newly created scams may have no reports.',
      'Only the submitted URL structure was observed; no DNS resolution, TLS handshake, redirects or target-page requests were performed.',
      'Heuristics describe warning signs and may occur on legitimate websites. No validated numeric risk score is available.',
      ...(fixture
        ? [
            'This report includes synthetic demo evidence; it is not an assessment of a real website.',
          ]
        : []),
      'Crypto address presence does not prove abuse. EVM addresses do not identify a chain; on-chain activity and withdrawals were not verified.',
    ],
    crypto: { detected: cryptoDetected, addresses, claims },
  };
}
