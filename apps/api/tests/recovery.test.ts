import { expect, it } from 'vitest';
import { reconcilePending } from '../src/recovery';

it('recovers every pending scan beyond the old 1000-record cap', async () => {
  const ids = Array.from({ length: 1205 }, (_, i) => String(i).padStart(5, '0'));
  const recovered: string[] = [];
  const count = await reconcilePending(
    async (after) =>
      ids
        .filter((id) => !after || id > after)
        .slice(0, 200)
        .map((id) => ({ id })),
    {
      getJob: async () => undefined,
      add: async (_name, data) => {
        recovered.push(data.id);
      },
    },
    async () => {
      throw new Error('No terminal jobs expected');
    },
  );
  expect(count).toBe(1205);
  expect(recovered).toEqual(ids);
});

it('preserves active jobs and records missing terminal results without duplicate submission', async () => {
  const results: string[] = [];
  await reconcilePending(
    async (after) => (after ? [] : [{ id: 'a' }, { id: 'b' }, { id: 'c' }]),
    {
      getJob: async (id) => ({
        getState: async () => ({ a: 'active', b: 'failed', c: 'completed' })[id]!,
      }),
      add: async () => {
        throw new Error('Duplicate submission');
      },
    },
    async (id, error) => {
      results.push(`${id}:${error}`);
    },
  );
  expect(results).toEqual(['b:worker_failed', 'c:queue_result_missing']);
});
