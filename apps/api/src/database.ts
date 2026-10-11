import { config } from 'dotenv';
import path from 'node:path';
config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
import { DataSource, EntitySchema } from 'typeorm';
import type { Analysis, Fixture } from '@webshield/core';
export interface ScanRow {
  id: string;
  urlInput: string;
  urlNormalized: string;
  hostname: string;
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed';
  fixture: Fixture | null;
  analysis: Analysis | null;
  errorCode: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}
export const ScanEntity = new EntitySchema<ScanRow>({
  name: 'Scan',
  tableName: 'scans',
  columns: {
    id: { type: 'uuid', primary: true },
    urlInput: { name: 'url_input', type: 'text' },
    urlNormalized: { name: 'url_normalized', type: 'text' },
    hostname: { type: 'text' },
    status: { type: 'text' },
    fixture: { type: 'text', nullable: true },
    analysis: { type: 'jsonb', nullable: true },
    errorCode: { name: 'error_code', type: 'text', nullable: true },
    createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
    startedAt: { name: 'started_at', type: 'timestamptz', nullable: true },
    finishedAt: { name: 'finished_at', type: 'timestamptz', nullable: true },
  },
});
export function createDatabase() {
  return new DataSource({
    type: 'postgres',
    url:
      process.env.DATABASE_URL ||
      'postgresql://webshield:webshield_local@127.0.0.1:55432/webshield',
    entities: [ScanEntity],
    synchronize: false,
    logging: false,
    extra: { connectionTimeoutMillis: 5000 },
  });
}
