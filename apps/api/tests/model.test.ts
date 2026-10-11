import { afterEach, expect, it, vi } from 'vitest';
import { analyzeSubmittedUrl } from '../src/orchestration';
import { getModelInfo } from '../src/model';
import type { ModelPrediction } from '@webshield/core';

afterEach(() => vi.unstubAllEnvs());
const prediction: ModelPrediction = {
  probability: 0.9,
  threshold: 0.7,
  modelVersion: 'fixture-v1',
  featureVersion: 'lexical-v1',
  scope: 'phishing',
  observedAt: new Date().toISOString(),
};
it('uses an available model estimate without calling it verified fraud', async () => {
  vi.stubEnv('ENABLE_ML', 'true');
  const a = await analyzeSubmittedUrl(
    'https://example.com/',
    undefined,
    fetch,
    async () => prediction,
  );
  expect(a.model).toEqual(prediction);
  expect(a.category).toBe('high_risk');
  expect(a.numericScore).toBe(90);
  expect(a.checks.find((c) => c.name === 'Machine learning')?.status).toBe('completed');
  expect(a.signals.every((s) => s.confidence !== 'verified')).toBe(true);
});
it('preserves observed warnings when a model estimate is low', async () => {
  vi.stubEnv('ENABLE_ML', 'true');
  const a = await analyzeSubmittedUrl(
    'http://account-verify.example/',
    undefined,
    fetch,
    async () => ({ ...prediction, probability: 0.01 }),
  );
  expect(a.signals.some((s) => s.code === 'unencrypted_transport')).toBe(true);
  expect(a.category).not.toBe('low_observed_risk');
});
it('treats unavailable inference as missing evidence and keeps demos offline', async () => {
  vi.stubEnv('ENABLE_ML', 'true');
  const a = await analyzeSubmittedUrl('https://example.com/', undefined, fetch, async () => null);
  expect(a.numericScore).toBeNull();
  expect(a.category).toBe('inconclusive');
  const demo = await analyzeSubmittedUrl(
    'https://investment-demo.example/',
    'investment',
    fetch,
    async () => {
      throw new Error('Demo must not invoke a model');
    },
  );
  expect(demo.model).toBeUndefined();
});
it('reports missing model files as unavailable', () => {
  vi.stubEnv('ENABLE_ML', 'true');
  vi.stubEnv('MODEL_ARTIFACT_DIR', '/tmp/webshield-no-such-model');
  expect(getModelInfo().available).toBe(false);
});
