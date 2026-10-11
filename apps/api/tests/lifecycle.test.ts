import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ScanService } from '../src/service';
import type { ScanRow } from '../src/database';
import { decodeCursor } from '../src/cursor';

// In-memory persistence boundary: these tests never open database or Redis sockets.
function harness(initial?: ScanRow) {
  let row = initial;
  const repository = {
    save: vi.fn(async (value: ScanRow) => {
      row = value;
      return row;
    }),
    findOneBy: vi.fn(async () => row),
    update: vi.fn(async (criteria: string | Partial<ScanRow>, patch: Partial<ScanRow>) => {
      if (!row) return { affected: 0 };
      const matches =
        typeof criteria === 'string'
          ? row.id === criteria
          : Object.entries(criteria).every(([key, value]) => row![key as keyof ScanRow] === value);
      if (!matches) return { affected: 0 };
      Object.assign(row, patch);
      return { affected: 1 };
    }),
    createQueryBuilder: vi.fn(),
  };
  const service = new ScanService();
  vi.spyOn(
    service as unknown as { repository: typeof repository },
    'repository',
    'get',
  ).mockReturnValue(repository);
  return {
    service,
    repository,
    get row() {
      return row;
    },
    setQueue(add: (name: string, data: { id: string }) => Promise<unknown>) {
      Object.assign(service, { queue: { add } });
    },
  };
}
describe('cursor contract', () => {
  it.each(['0', '2026-02-30T00:00:00.000Z', 'not-a-date'])(
    'rejects noncanonical database date %s',
    (date) => {
      const cursor = Buffer.from(
        JSON.stringify({ date, id: '00000000-0000-4000-8000-000000000000' }),
      ).toString('base64url');
      expect(() => decodeCursor(cursor)).toThrow();
    },
  );
  it('round-trips the exact canonical cursor contract', () => {
    const input = { date: '2026-10-11T15:00:00.123Z', id: '00000000-0000-4000-8000-000000000000' };
    expect(decodeCursor(Buffer.from(JSON.stringify(input)).toString('base64url'))).toEqual(input);
  });
});
describe('scan lifecycle at persistence/queue boundaries', () => {
  it('does not overwrite a completed result after an ambiguous enqueue failure', async () => {
    const h = harness();
    h.setQueue(async (_name, data) => {
      await h.service.process(data.id);
      throw new Error('Acknowledgement lost');
    });
    const result = await h.service.create('https://example.com/');
    expect(result.scan_id).toBe(h.row?.id);
    expect(h.row?.status).toBe('partial');
    expect(h.row?.analysis?.category).toBe('inconclusive');
  });
  it('persists a genuine queued submission failure', async () => {
    const h = harness();
    h.setQueue(async () => {
      throw new Error('Unavailable');
    });
    await expect(h.service.create('https://example.com/')).rejects.toThrow(
      'Scan queue unavailable',
    );
    expect(h.row?.status).toBe('failed');
    expect(h.row?.errorCode).toBe('queue_unavailable');
  });
  it('records terminal failures regardless of retry count without overwriting completed reports', async () => {
    const h = harness();
    h.setQueue(async () => ({}));
    const result = await h.service.create('https://example.com/');
    await h.service.recordFailure({ data: { id: result.scan_id }, getState: async () => 'failed' });
    expect(h.row?.status).toBe('failed');
    await h.service.process(result.scan_id);
    expect(h.row?.status).toBe('partial');
    await h.service.recordFailure({ data: { id: result.scan_id }, getState: async () => 'failed' });
    expect(h.row?.status).toBe('partial');
  });
});
