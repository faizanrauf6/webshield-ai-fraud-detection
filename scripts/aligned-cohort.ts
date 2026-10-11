import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { getDomain } from 'tldts';
import { normalizeUrl } from '../packages/core/src';
import { requestObservation } from '../apps/api/src/observations';
import { lookupSafeBrowsing } from '../apps/api/src/providers';
import { OpenPhishProvider } from '../apps/api/src/openphish';

const directory = 'ml/data/aligned-cohort';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
type Candidate = {
  url: string;
  label: number;
  source: string;
  category: string;
  campaign_or_domain_group: string;
  label_snapshot_at: string;
  label_verified_at?: string;
};

async function main() {
  if (!process.env.SAFE_BROWSING_API_KEY || !process.env.CONTENT_WORKER_TOKEN)
    throw new Error('Private Google and isolated-worker configuration required.');
  await mkdir(directory, { recursive: true });
  const metadata = JSON.parse(await readFile(`${directory}/source-retrieval.json`, 'utf8'));
  const source = metadata.find((item: { name: string }) => item.name === 'phishtank.json.bz2');
  if (!source?.sha256 || source.status !== 200)
    throw new Error('Verified public label snapshot required.');
  const compressed = await readFile(`${directory}/phishtank.json.bz2`);
  if (createHash('sha256').update(compressed).digest('hex') !== source.sha256)
    throw new Error('Frozen public label snapshot changed.');
  const snapshot = Date.parse(source.retrieved_at);
  const rows = JSON.parse(await readFile(`${directory}/phishtank.json`, 'utf8'));
  const seen = new Set<string>();
  const positives: Candidate[] = [];
  const sorted = rows
    .filter(
      (row: { verified: string; online: string; verification_time: string }) =>
        row.verified === 'yes' &&
        row.online === 'yes' &&
        Date.parse(row.verification_time) <= snapshot &&
        Date.parse(row.verification_time) >= snapshot - 7 * 86400000,
    )
    .sort((a: { url: string }, b: { url: string }) =>
      hash(`webshield-aligned-v1:${a.url}`).localeCompare(hash(`webshield-aligned-v1:${b.url}`)),
    );
  for (const row of sorted) {
    try {
      const url = normalizeUrl(row.url);
      const host = new URL(url).hostname;
      const domain = getDomain(host, { allowPrivateDomains: true }) || host;
      if (seen.has(domain)) continue;
      seen.add(domain);
      positives.push({
        url,
        label: 1,
        source: 'PhishTank community verified',
        category: 'phishing',
        campaign_or_domain_group: domain,
        label_snapshot_at: source.retrieved_at,
        label_verified_at: row.verification_time,
      });
      if (positives.length === 100) break;
    } catch {
      /* Apply the production public-URL policy before collection. */
    }
  }
  if (positives.length !== 100) throw new Error('Insufficient independent recent domains.');
  const referenceBytes = await readFile('ml/reference-sites.json', 'utf8');
  const references = JSON.parse(referenceBytes);
  const candidatePath = `${directory}/candidates.json`;
  let referenceAt = new Date().toISOString();
  try {
    const frozen: Candidate[] = JSON.parse(await readFile(candidatePath, 'utf8'));
    referenceAt = frozen.find((row) => row.label === 0)?.label_snapshot_at || referenceAt;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const negatives: Candidate[] = [];
  for (const [category, hosts] of Object.entries(references.categories) as [string, string[]][]) {
    for (const host of hosts) {
      const url = normalizeUrl(`https://${host}/`);
      const domain = getDomain(new URL(url).hostname, { allowPrivateDomains: true }) || host;
      if (seen.has(domain))
        throw new Error('Reference overlaps the positive source or another reference.');
      seen.add(domain);
      negatives.push({
        url,
        label: 0,
        source: 'curated-official-reference',
        category,
        campaign_or_domain_group: domain,
        label_snapshot_at: referenceAt,
      });
    }
  }
  const candidates = [...positives, ...negatives].sort((a, b) =>
    hash(`collection-order-v1:${a.url}`).localeCompare(hash(`collection-order-v1:${b.url}`)),
  );
  const candidateBytes = JSON.stringify(candidates, null, 2) + '\n';
  try {
    if ((await readFile(candidatePath, 'utf8')) !== candidateBytes)
      throw new Error('Frozen candidates differ; use a new cohort directory.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      await writeFile(candidatePath, candidateBytes);
    else throw error;
  }
  const dataset = `${directory}/dataset.jsonl`;
  let existing: { url: string }[] = [];
  try {
    existing = (await readFile(dataset, 'utf8'))
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const done = new Set(existing.map((row) => row.url));
  const openphish = new OpenPhishProvider();
  let completed = done.size;
  await writeFile(
    `${directory}/provenance.json`,
    JSON.stringify(
      {
        purpose:
          'Aligned current phishing/reference pilot; research-only, no production promotion.',
        scope: 'aligned-phishing-reference-pilot',
        production_eligible: false,
        label_source: source,
        reference_sha256: hash(referenceBytes),
        candidate_sha256: hash(candidateBytes),
        selection:
          '100 recent community-verified online source URLs; one public registrable domain each; label-independent URL hash. All 100 prespecified official reference URLs retained.',
        observation_protocol:
          'Static isolated HTML and authoritative DNS/RDAP, plus current Google/OpenPhish; actual per-request dates and assessment time preserved. No historical replay.',
        labels: {
          positive:
            'Published community verified and online feed status; not independently re-adjudicated by this project.',
          negative: references.purpose,
        },
        collection_order:
          'Label-independent deterministic SHA256 order; one URL at a time, at most two isolated worker requests.',
        limits: [
          'Small convenience cohort; reference identity is not an independent compromise/security audit.',
          'Public feeds may share reports; source independence does not establish statistical independence.',
          'Registered domains control overlap but unknown cross-domain campaigns can overlap.',
          'Short one-session collection cannot establish long-term temporal robustness.',
          'Do not discard samples because content, DNS, RDAP or provider checks fail.',
        ],
      },
      null,
      2,
    ) + '\n',
  );
  for (const candidate of candidates) {
    if (done.has(candidate.url)) continue;
    const started = new Date().toISOString();
    const [domain, content, google, feed] = await Promise.all([
      requestObservation('domain', candidate.url),
      requestObservation('content', candidate.url),
      lookupSafeBrowsing(candidate.url, process.env.SAFE_BROWSING_API_KEY),
      openphish.lookup(candidate.url),
    ]);
    const at = new Date().toISOString();
    const providers = [google, feed].map((provider) =>
      provider.expiresAt && Date.parse(provider.expiresAt) <= Date.parse(at)
        ? { ...provider, status: 'expired' }
        : provider,
    );
    const row = {
      ...candidate,
      first_seen_at: at,
      collection_started_at: started,
      timestamp_semantics:
        'first_seen_at is this pilot acquisition completion, not first attack appearance',
      observations: {
        asOf: at,
        ...(domain ? { domain } : {}),
        ...(content ? { content } : {}),
        providers,
      },
    };
    await appendFile(dataset, JSON.stringify(row) + '\n');
    completed++;
    console.log(
      JSON.stringify({
        completed,
        total: candidates.length,
        content: Boolean(content),
        domain: Boolean(domain),
        providers_completed: providers.filter((p) => p.status === 'completed').length,
      }),
    );
  }
}
main().catch(() => {
  console.error('Aligned cohort collection failed; no credentials or target URLs were logged.');
  process.exitCode = 1;
});
