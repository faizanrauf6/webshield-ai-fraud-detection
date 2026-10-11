import { expect, it } from 'vitest';
import { OpenPhishProvider } from '../src/openphish';

it('checks exact URLs using a fixed public feed without visiting submitted sites', async () => {
  const provider = new OpenPhishProvider(async (input) => {
    expect(String(input)).toBe(
      'https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt',
    );
    return new Response('https://phish.example/login\nhttps://other.example/\n');
  });
  expect((await provider.lookup('https://phish.example/login')).reportedMalicious).toBe(true);
  expect((await provider.lookup('https://phish.example/other')).reportedMalicious).toBe(false);
});
it('does not silently use expired reports after a refresh failure', async () => {
  let clock = 0;
  const provider = new OpenPhishProvider(
    async () => {
      if (clock) throw new Error('Offline');
      return new Response('https://phish.example/\n');
    },
    () => clock,
  );
  expect((await provider.lookup('https://phish.example/')).status).toBe('completed');
  clock = 13 * 3600 * 1000;
  const result = await provider.lookup('https://phish.example/');
  expect(result.status).toBe('unavailable');
  expect(result.reportedMalicious).toBe(false);
});
it('invalid or oversized feed data remains unavailable rather than a clean verdict', async () => {
  for (const body of ['<html>blocked</html>', 'https://a.example/' + 'x'.repeat(2100000)]) {
    const result = await new OpenPhishProvider(async () => new Response(body)).lookup(
      'https://example.com/',
    );
    expect(result.status).toBe('unavailable');
  }
});
