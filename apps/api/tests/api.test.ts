import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/module';
import { ScanService } from '../src/service';
import { configureApp } from '../src/bootstrap';
import { createDatabase } from '../src/database';
import { Queue } from 'bullmq';
import { lookupSafeBrowsing } from '../src/providers';

describe('Safe Browsing parsing', () => {
  it('preserves unavailable evidence on malformed provider response', async () => {
    const finding = await lookupSafeBrowsing(
      'https://example.com/',
      'test-key',
      async () => new Response('{"matches":"invalid"}', { status: 200 }),
    );
    expect(finding.status).toBe('unavailable');
  });
  it('does not confirm a malicious verdict for a different URL', async () => {
    const finding = await lookupSafeBrowsing('https://example.com/', 'test-key', async () =>
      Response.json({
        matches: [
          {
            threat: { url: 'https://other.example/' },
            threatType: 'SOCIAL_ENGINEERING',
            cacheDuration: '300s',
          },
        ],
      }),
    );
    expect(finding.status).toBe('unavailable');
    expect(finding.reportedMalicious).toBe(false);
  });
  it('records only exact reported URL and source', async () => {
    const finding = await lookupSafeBrowsing('https://example.com/', 'test-key', async () =>
      Response.json({
        matches: [
          {
            threat: { url: 'https://example.com/' },
            threatType: 'SOCIAL_ENGINEERING',
            cacheDuration: '300s',
          },
        ],
      }),
    );
    expect(finding.reportedMalicious).toBe(true);
    expect(finding.source).toBe('Google Safe Browsing');
    expect(Date.parse(finding.expiresAt!)).toBeGreaterThan(Date.now());
  });
  it('rejects a reported match without a valid cache lifetime', async () => {
    const finding = await lookupSafeBrowsing('https://example.com/', 'test-key', async () =>
      Response.json({
        matches: [
          {
            threat: { url: 'https://example.com/' },
            threatType: 'SOCIAL_ENGINEERING',
            cacheDuration: 'invalid',
          },
        ],
      }),
    );
    expect(finding.status).toBe('unavailable');
    expect(finding.reportedMalicious).toBe(false);
  });
  it('handles provider timeouts without a negative finding', async () => {
    const finding = await lookupSafeBrowsing('https://example.com/', 'test-key', async () => {
      throw new Error('timeout');
    });
    expect(finding.status).toBe('unavailable');
    expect(finding.reportedMalicious).toBe(false);
  });
});

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://webshield:webshield_local@127.0.0.1:55432/webshield_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:56379/1';
const integration = process.env.RUN_INTEGRATION === 'true' ? describe : describe.skip;
integration('NestJS + PostgreSQL + BullMQ integration', () => {
  let app: INestApplication;
  let scanId: string;
  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('persists an asynchronous scan and exposes evidence, history and export', async () => {
    const post = await request(app.getHttpServer())
      .post('/api/v1/scans')
      .send({ url: 'https://example.com/' })
      .expect(202);
    scanId = post.body.scan_id;
    expect(post.body.status).toBe('queued');
    let body: any;
    for (let n = 0; n < 100; n++) {
      const result = await request(app.getHttpServer()).get(`/api/v1/scans/${scanId}`).expect(200);
      body = result.body;
      if (['completed', 'partial', 'failed'].includes(body.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(body.status).toBe('partial');
    expect(body.assessment.category).toBe('inconclusive');
    expect(body.assessment.numeric_score).toBeNull();
    expect(body.checks.length).toBeGreaterThan(2);
    const exported = await request(app.getHttpServer())
      .get(`/api/v1/scans/${scanId}/export`)
      .expect(200);
    expect(exported.body.scan_id).toBe(scanId);
    const history = await request(app.getHttpServer()).get('/api/v1/scans?limit=1').expect(200);
    expect(history.body.items).toHaveLength(1);
    if (history.body.next_cursor)
      await request(app.getHttpServer())
        .get(`/api/v1/scans?cursor=${history.body.next_cursor}`)
        .expect(200);
  });
  it('returns controlled errors for unsafe input, unknown IDs and bad cursors', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/scans')
      .send({ url: 'http://127.0.0.1' })
      .expect(400);
    await request(app.getHttpServer()).post('/api/v1/scans').send({ url: 123 }).expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/scans')
      .send({ url: 'https://example.com', extra: true })
      .expect(400);
    await request(app.getHttpServer()).get('/api/v1/scans/not-a-uuid').expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/scans/00000000-0000-4000-8000-000000000000')
      .expect(404);
    await request(app.getHttpServer()).get('/api/v1/scans?cursor=invalid').expect(400);
    const invalidUuidCursor = Buffer.from(
      JSON.stringify({ date: '2026-01-01', id: '------------------------------------' }),
    ).toString('base64url');
    await request(app.getHttpServer()).get(`/api/v1/scans?cursor=${invalidUuidCursor}`).expect(400);
    for (const date of ['0', '2026-02-30T00:00:00.000Z']) {
      const cursor = Buffer.from(
        JSON.stringify({ date, id: '00000000-0000-4000-8000-000000000000' }),
      ).toString('base64url');
      await request(app.getHttpServer()).get(`/api/v1/scans?cursor=${cursor}`).expect(400);
    }
    await request(app.getHttpServer()).get('/api/v1/scans?limit=-1').expect(400);
  });
  it('ties explicit demo evidence to the correct fixture URL', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/scans')
      .send({ url: 'https://example.com/', fixture: 'investment' })
      .expect(400);
    const response = await request(app.getHttpServer())
      .post('/api/v1/scans')
      .send({ url: 'https://investment-demo.example/', fixture: 'investment' })
      .expect(202);
    expect(response.body.scan_id).toBeTruthy();
  });
  it('checks database and queue health', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });
  it('keeps completed jobs idempotent', async () => {
    const service = app.get(ScanService);
    const before = await service.get(scanId);
    await service.process(scanId);
    const after = await service.get(scanId);
    expect(after.completed_at).toEqual(before.completed_at);
  });
  it('preserves a completed scan when enqueue acknowledgement fails', async () => {
    const service = app.get(ScanService);
    const queue = (service as unknown as { queue: Queue }).queue;
    const spy = vi.spyOn(queue, 'add').mockImplementationOnce(async (_name, data) => {
      await service.process(data.id);
      throw new Error('Acknowledgement lost after acceptance');
    });
    try {
      const response = await request(app.getHttpServer())
        .post('/api/v1/scans')
        .send({ url: 'https://accepted-job.example/' })
        .expect(202);
      expect((await service.get(response.body.scan_id)).status).toBe('partial');
    } finally {
      spy.mockRestore();
    }
  });
  it('records terminal queue failures below retry limit and preserves completed reports', async () => {
    const service = app.get(ScanService);
    const job = { data: { id: scanId }, getState: async () => 'failed' };
    await service.recordFailure(job);
    expect((await service.get(scanId)).status).toBe('partial');
    const db = await createDatabase().initialize();
    try {
      await db.query("UPDATE scans SET status='running' WHERE id=$1", [scanId]);
    } finally {
      await db.destroy();
    }
    await service.recordFailure(job);
    expect((await service.get(scanId)).status).toBe('failed');
  });
  it('records queue submission failures instead of leaving scans queued', async () => {
    const service = app.get(ScanService);
    await (service as unknown as { queue: { close: () => Promise<void> } }).queue.close();
    const response = await request(app.getHttpServer())
      .post('/api/v1/scans')
      .send({ url: 'https://queue-failure.example/' })
      .expect(503);
    const saved = await service.get(response.body.scan_id);
    expect(saved.status).toBe('failed');
    expect(saved.error).toBe('queue_unavailable');
  });
});
