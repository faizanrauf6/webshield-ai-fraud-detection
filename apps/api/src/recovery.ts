/** Keyset pagination stays stable while recovered rows change status. */
export async function reconcilePending(
  load: (after?: string) => Promise<{ id: string }[]>,
  queue: {
    getJob: (id: string) => Promise<{ getState(): Promise<string> } | undefined>;
    add: (name: string, data: { id: string }, options: { jobId: string }) => Promise<unknown>;
  },
  markTerminal: (id: string, error: string) => Promise<unknown>,
): Promise<number> {
  let after: string | undefined;
  let count = 0;
  while (true) {
    const rows = await load(after);
    if (!rows.length) return count;
    for (const { id } of rows) {
      const job = await queue.getJob(id);
      const state = job ? await job.getState() : null;
      if (state === 'failed' || state === 'completed') {
        await markTerminal(id, state === 'failed' ? 'worker_failed' : 'queue_result_missing');
      } else if (!job) {
        await queue.add('scan', { id }, { jobId: id });
      }
      count++;
    }
    const next = rows.at(-1)!.id;
    if (after && next <= after) throw new Error('Recovery cursor did not advance.');
    after = next;
  }
}
