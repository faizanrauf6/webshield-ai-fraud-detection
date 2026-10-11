import {
  normalizeUrl,
  FEATURE_VERSION,
  buildObservationFeatures,
  type ObservationSnapshot,
} from '../packages/core/src';
import { getDomain } from 'tldts';
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  try {
    const urls: unknown = JSON.parse(input);
    if (!Array.isArray(urls) || urls.length > 100000)
      throw new Error('Expected a bounded array of URLs.');
    const result = urls.map((value) => {
      try {
        const entry =
          typeof value === 'string'
            ? { url: value }
            : (value as { url: string; observations?: ObservationSnapshot });
        if (!entry || typeof entry.url !== 'string') throw new Error('Invalid URL type.');
        const normalized = normalizeUrl(entry.url);
        const hostname = new URL(normalized).hostname;
        return {
          normalized,
          domain: getDomain(hostname, { allowPrivateDomains: true }) || hostname,
          features: buildObservationFeatures(
            normalized,
            entry.observations || {},
            process.argv.find((a) => a.startsWith('--schema='))?.slice(9) || FEATURE_VERSION,
          ),
        };
      } catch (error) {
        if (process.argv.includes('--skip-invalid')) return { error: 'unsupported_url' };
        throw error;
      }
    });
    process.stdout.write(JSON.stringify(result));
  } catch {
    process.stderr.write('Feature extraction failed: invalid or unsupported URL input.\n');
    process.exitCode = 1;
  }
});
