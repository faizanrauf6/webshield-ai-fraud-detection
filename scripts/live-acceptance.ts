import 'dotenv/config';
import assert from 'node:assert/strict';
import { lookupSafeBrowsing } from '../apps/api/src/providers';
import { requestObservation } from '../apps/api/src/observations';

async function main() {
  assert(process.env.SAFE_BROWSING_API_KEY, 'Configure SAFE_BROWSING_API_KEY in .env.');
  assert(process.env.CONTENT_WORKER_TOKEN, 'Configure the isolated worker token in .env.');
  const benign = await lookupSafeBrowsing(
    'https://example.com/',
    process.env.SAFE_BROWSING_API_KEY,
  );
  const phishing = await lookupSafeBrowsing(
    'https://testsafebrowsing.appspot.com/s/phishing.html',
    process.env.SAFE_BROWSING_API_KEY,
  );
  assert.equal(benign.status, 'completed');
  assert.equal(benign.reportedMalicious, false);
  assert.equal(phishing.status, 'completed');
  assert.equal(phishing.reportedMalicious, true);
  assert(phishing.expiresAt && Date.parse(phishing.expiresAt) > Date.now());
  const content = await requestObservation('content', 'https://example.com/');
  const domain = await requestObservation('domain', 'https://example.com/');
  const blocked = await requestObservation('content', 'http://127.0.0.1/');
  assert(content?.title.includes('Example Domain'), 'Live static HTML extraction failed.');
  assert(domain?.addresses.length, 'Live public DNS observation failed.');
  assert.equal(domain.rdapStatus, 'completed', 'Live authoritative RDAP observation failed.');
  assert.equal(blocked, null, 'Internal target must be blocked.');
  console.log(
    JSON.stringify(
      {
        checked_at: new Date().toISOString(),
        google: { benign_negative: true, test_phishing_positive: true, expiry_present: true },
        worker: {
          static_html: true,
          public_dns: true,
          authoritative_rdap: true,
          internal_target_blocked: true,
        },
      },
      null,
      2,
    ),
  );
}
main().catch(() => {
  // Never print fetch errors: an upstream URL could contain a credential.
  console.error(
    'Live acceptance failed. Check local configuration and service availability; secrets were not logged.',
  );
  process.exitCode = 1;
});
