import { expect, it } from 'vitest';
import { requestObservation } from '../src/observations';

it('treats worker timeouts and malformed responses as unavailable', async () => {
  for (const fetcher of [
    async () => {
      throw new Error('Timeout');
    },
    async () => Response.json({ status: 'completed', observation: {} }),
  ]) {
    const result = await requestObservation(
      'content',
      'https://example.com/',
      { endpoint: 'http://127.0.0.1:4100', token: 'x'.repeat(32) },
      fetcher,
    );
    expect(result).toBeNull();
  }
});
it('rejects a worker response for a different URL', async () => {
  const result = await requestObservation(
    'content',
    'https://example.com/',
    { endpoint: 'http://127.0.0.1:4100', token: 'x'.repeat(32) },
    async () =>
      Response.json({ status: 'completed', observation: { url: 'https://different.example/' } }),
  );
  expect(result).toBeNull();
});
it('does not allow the worker service URL to become an arbitrary outbound proxy', async () => {
  await expect(
    requestObservation('content', 'https://example.com/', {
      endpoint: 'https://attacker.example',
      token: 'x'.repeat(32),
    }),
  ).rejects.toThrow('worker endpoint');
});
