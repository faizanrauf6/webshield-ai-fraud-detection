import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Queue, Worker } from 'bullmq';
import {
  normalizeUrl,
  FIXTURES,
  type Fixture,
  type HistoryResponse,
  type ScanReport,
} from '@webshield/core';
import { createDatabase, ScanEntity, type ScanRow } from './database';
import { decodeCursor } from './cursor';
import { reconcilePending } from './recovery';
import { analyzeSubmittedUrl } from './orchestration';
import { validateWorkerConfig } from './observations';
import { getModelInfo } from './model';
import { refreshProviderEvidence } from './evidence';

@Injectable()
export class ScanService {
  private readonly db = createDatabase();
  private queue!: Queue;
  private worker!: Worker;
  private get repository() {
    return this.db.getRepository(ScanEntity);
  }
  async onModuleInit() {
    if (
      process.env.ENABLE_CONTENT_SCANNING === 'true' ||
      process.env.ENABLE_DOMAIN_INTELLIGENCE === 'true'
    )
      validateWorkerConfig();
    await this.db.initialize();
    const redis = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:56379');
    const connection = {
      db: Number(redis.pathname.slice(1) || 0),
      host: redis.hostname,
      port: Number(redis.port || 6379),
      username: redis.username || undefined,
      password: redis.password || undefined,
      maxRetriesPerRequest: null,
      ...(redis.protocol === 'rediss:' ? { tls: {} } : {}),
    };
    this.queue = new Queue('webshield-scans', {
      connection: {
        ...connection,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 5000,
        commandTimeout: 5000,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });
    this.queue.on('error', () => {});
    this.worker = new Worker('webshield-scans', (job) => this.process(job.data.id), {
      connection,
      concurrency: 2,
    });
    this.worker.on('error', () => {});
    this.worker.on('failed', (job) => {
      void this.recordFailure(job).catch(() => {});
    });
    await this.queue.waitUntilReady();
    // Recover persisted submissions if the API stopped between the database write and enqueue.
    await reconcilePending(
      async (after) => {
        const query = this.repository
          .createQueryBuilder('scan')
          .where('scan.status IN (:...states)', { states: ['queued', 'running'] })
          .orderBy('scan.id', 'ASC')
          .take(200);
        if (after) query.andWhere('scan.id > :after', { after });
        return query.getMany();
      },
      this.queue,
      (id, code) => this.markNonterminalFailed(id, code),
    );
  }
  private async markNonterminalFailed(id: string, errorCode: string) {
    const patch = { status: 'failed' as const, errorCode, finishedAt: new Date() };
    await this.repository.update({ id, status: 'queued' }, patch);
    await this.repository.update({ id, status: 'running' }, patch);
  }
  async recordFailure(job: { data: { id: string }; getState: () => Promise<string> } | undefined) {
    if (job && (await job.getState()) === 'failed')
      await this.markNonterminalFailed(job.data.id, 'worker_failed');
  }
  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    if (this.db.isInitialized) await this.db.destroy();
  }
  async create(input: string, fixture?: Fixture) {
    let normalized: string;
    try {
      normalized = normalizeUrl(input);
      if (fixture && normalized !== FIXTURES[fixture]?.url)
        throw new Error('Demo scenarios must use their matching .example URL.');
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid URL.');
    }
    const row = await this.repository.save({
      id: randomUUID(),
      urlInput: input.trim(),
      urlNormalized: normalized,
      hostname: new URL(normalized).hostname,
      status: 'queued' as const,
      fixture: fixture || null,
      createdAt: new Date(),
      analysis: null,
      errorCode: null,
      startedAt: null,
      finishedAt: null,
    });
    try {
      await this.queue.add('scan', { id: row.id }, { jobId: row.id });
    } catch {
      const failed = await this.repository.update(
        { id: row.id, status: 'queued' },
        {
          status: 'failed',
          errorCode: 'queue_unavailable',
          finishedAt: new Date(),
        },
      );
      if (!failed.affected) {
        const accepted = await this.repository.findOneBy({ id: row.id });
        if (accepted && ['running', 'partial', 'completed'].includes(accepted.status))
          return { scan_id: row.id, status: 'queued', submitted_url: row.urlInput };
      }
      throw new ServiceUnavailableException({
        message: 'Scan queue unavailable. The failed submission has been recorded.',
        scan_id: row.id,
      });
    }
    return { scan_id: row.id, status: 'queued', submitted_url: row.urlInput };
  }
  async process(id: string) {
    const row = await this.repository.findOneBy({ id });
    if (!row || ['completed', 'partial'].includes(row.status)) return;
    await this.repository.update(id, {
      status: 'running',
      startedAt: row.startedAt || new Date(),
      errorCode: null,
    });
    const analysis = await analyzeSubmittedUrl(row.urlNormalized, row.fixture || undefined);
    await this.repository.update(id, {
      analysis,
      status: analysis.checks.some((c) => c.status === 'unavailable' || c.status === 'failed')
        ? 'partial'
        : 'completed',
      finishedAt: new Date(),
    });
  }
  async get(id: string): Promise<ScanReport> {
    const row = await this.repository.findOneBy({ id });
    if (!row) throw new NotFoundException('Scan not found.');
    return this.serialize(row);
  }
  async list(limitInput?: string, cursor?: string): Promise<HistoryResponse> {
    const limit = limitInput === undefined ? 20 : Number(limitInput);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException('limit must be an integer between 1 and 100.');
    const query = this.repository
      .createQueryBuilder('scan')
      .orderBy('scan.createdAt', 'DESC')
      .addOrderBy('scan.id', 'DESC')
      .take(limit + 1);
    if (cursor) {
      try {
        const value = decodeCursor(cursor);
        query.andWhere('(scan.createdAt < :date OR (scan.createdAt = :date AND scan.id < :id))', {
          date: value.date,
          id: value.id,
        });
      } catch {
        throw new BadRequestException('Invalid history cursor.');
      }
    }
    const rows = await query.getMany();
    const hasNext = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => this.serialize(row)),
      total: await this.repository.count(),
      next_cursor:
        hasNext && last
          ? Buffer.from(
              JSON.stringify({ date: last.createdAt.toISOString(), id: last.id }),
            ).toString('base64url')
          : null,
    };
  }
  async health() {
    await this.db.query('SELECT 1');
    await this.queue.getJobCounts('waiting');
    return {
      status: 'ok',
      database: 'connected',
      queue: 'connected',
      content_scanning: process.env.ENABLE_CONTENT_SCANNING === 'true',
    };
  }
  modelInfo() {
    return getModelInfo();
  }
  providerStatus() {
    return {
      content_scanning: process.env.ENABLE_CONTENT_SCANNING === 'true',
      providers: [
        {
          name: 'OpenPhish Community Feed',
          configured: true,
          enabled: process.env.ENABLE_OPENPHISH === 'true',
          purpose:
            'Exact URL phishing reports; limited feed, refreshed every 12 hours; academic/personal research only',
        },
        {
          name: 'Google Safe Browsing',
          configured: Boolean(process.env.SAFE_BROWSING_API_KEY),
          enabled:
            process.env.ENABLE_EXTERNAL_PROVIDERS === 'true' &&
            Boolean(process.env.SAFE_BROWSING_API_KEY),
          purpose: 'Known malicious URL lookup',
        },
        {
          name: 'DNS / RDAP',
          configured: Boolean(process.env.CONTENT_WORKER_TOKEN),
          enabled: process.env.ENABLE_DOMAIN_INTELLIGENCE === 'true',
          purpose: 'Public DNS and authoritative registration metadata via isolated worker',
        },
        {
          name: 'Crypto reports',
          configured: false,
          enabled: false,
          purpose: 'Reported wallet / URL abuse (not configured)',
        },
      ],
      privacy:
        'Submitted URLs and reports are stored in this local deployment. Remove secrets from URL query strings. When enabled, the external provider receives the full normalized URL.',
    };
  }
  private serialize(row: ScanRow): ScanReport {
    const a = row.analysis ? refreshProviderEvidence(row.analysis) : null;
    return {
      scan_id: row.id,
      status: row.status,
      submitted_url: row.urlInput,
      normalized_url: row.urlNormalized,
      hostname: row.hostname,
      created_at: row.createdAt.toISOString(),
      started_at: row.startedAt?.toISOString() || null,
      completed_at: row.finishedAt?.toISOString() || null,
      error: row.errorCode,
      fixture: row.fixture,
      demo: Boolean(row.fixture),
      ...(a?.content ? { content: a.content } : {}),
      ...(a?.domain ? { domain: a.domain } : {}),
      ...(a?.providerSource ? { provider_source: a.providerSource } : {}),
      providers: a?.providers || [],
      assessment: {
        category: a?.category || 'inconclusive',
        numeric_score: a?.numericScore ?? null,
        score_kind: a?.model ? 'model_probability' : 'unavailable',
        model_version: a?.model?.modelVersion || null,
        ...(a?.model
          ? {
              model_probability: a.model.probability,
              model_threshold: a.model.threshold,
              model_scope: a.model.scope,
            }
          : {}),
        summary:
          a?.summary ||
          (row.status === 'failed'
            ? 'Scan failed; no assessment is available.'
            : 'Analysis is pending.'),
        is_verified_malicious: a?.category === 'confirmed_malicious',
      },
      checks: a?.checks || [],
      signals: a?.signals || [],
      features: a?.features || {},
      limitations: a?.limitations || ['Pending analysis cannot establish website legitimacy.'],
      crypto: a?.crypto || { detected: false, addresses: [], claims: [] },
    };
  }
}
