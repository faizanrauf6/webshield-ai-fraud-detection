import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  featureSchema,
  FEATURE_VERSION,
  type Analysis,
  type ModelPrediction,
} from '@webshield/core';

const root = path.resolve(__dirname, '../../..');
export function modelDirectory() {
  return path.resolve(process.env.MODEL_ARTIFACT_DIR || path.join(root, 'ml/production'));
}
export function getModelInfo() {
  const missing = {
    available: false,
    feature_version: FEATURE_VERSION,
    model_version: null,
    scope: 'phishing',
    threshold: null,
    metrics: null,
    evaluation: null,
    message:
      'No independently evaluated production model is installed or enabled. Synthetic experiments are not real-world accuracy.',
  };
  if (process.env.ENABLE_ML !== 'true') return missing;
  try {
    const directory = modelDirectory();
    const manifest = JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    const artifact = manifest.artifacts?.[manifest.selected_model];
    if (
      manifest.bundle_version !== 1 ||
      manifest.synthetic !== false ||
      manifest.scope !== 'phishing' ||
      JSON.stringify(manifest.feature_schema) !==
        JSON.stringify(featureSchema(manifest.feature_schema?.version)) ||
      typeof manifest.model_version !== 'string' ||
      !manifest.model_version ||
      !Number.isFinite(manifest.threshold) ||
      manifest.threshold <= 0 ||
      manifest.threshold > 1 ||
      !artifact ||
      typeof artifact.file !== 'string' ||
      path.basename(artifact.file) !== artifact.file
    )
      return missing;
    const bytes = readFileSync(path.join(directory, artifact.file));
    if (
      bytes.length > 100_000_000 ||
      createHash('sha256').update(bytes).digest('hex') !== artifact.sha256
    )
      return missing;
    return {
      available: true,
      feature_version: manifest.feature_schema.version,
      model_version: manifest.model_version,
      scope: manifest.scope,
      threshold: manifest.threshold,
      metrics: manifest.metrics || null,
      evaluation: {
        protocol: manifest.evaluation_protocol,
        counts: manifest.counts,
        dataset_sha256: manifest.dataset_sha256,
        evaluated_at: manifest.evaluated_at,
        selected_model: manifest.selected_model,
        provenance: manifest.provenance || null,
      },
      message:
        'A calibrated phishing benchmark model is installed. Estimates do not verify business legitimacy or broader investment/store fraud.',
    };
  } catch {
    return missing;
  }
}

export async function predictRisk(
  features: Record<string, number>,
): Promise<ModelPrediction | null> {
  const info = getModelInfo();
  if (!info.available) return null;
  return new Promise((resolve) => {
    const child = execFile(
      process.env.ML_PYTHON || path.join(root, '.venv/bin/python'),
      [path.join(root, 'ml/inference.py'), '--bundle', modelDirectory()],
      {
        timeout: 10000,
        maxBuffer: 65536,
        env: {
          ...process.env,
          OMP_NUM_THREADS: '1',
          OPENBLAS_NUM_THREADS: '1',
          PYTHONDONTWRITEBYTECODE: '1',
        },
      },
      (error, stdout) => {
        if (error) return resolve(null);
        try {
          const p: ModelPrediction = JSON.parse(stdout);
          if (
            !Number.isFinite(p.probability) ||
            p.probability < 0 ||
            p.probability > 1 ||
            p.threshold !== info.threshold ||
            p.modelVersion !== info.model_version ||
            p.featureVersion !== info.feature_version ||
            p.scope !== 'phishing' ||
            !Number.isFinite(Date.parse(p.observedAt)) ||
            Math.abs(Date.now() - Date.parse(p.observedAt)) > 60000
          )
            return resolve(null);
          resolve(p);
        } catch {
          resolve(null);
        }
      },
    );
    child.stdin?.on('error', () => {});
    child.stdin?.end(JSON.stringify(features));
  });
}

export function applyModelPrediction(analysis: Analysis, prediction: ModelPrediction) {
  analysis.model = prediction;
  analysis.numericScore = Math.round(prediction.probability * 10000) / 100;
  const check = analysis.checks.find((c) => c.name === 'Machine learning')!;
  Object.assign(check, {
    status: 'completed',
    source: prediction.modelVersion,
    observedAt: prediction.observedAt,
    detail: `Calibrated phishing estimate ${(prediction.probability * 100).toFixed(1)}%; validation threshold ${(prediction.threshold * 100).toFixed(1)}%. This model does not assess every type of fraud.`,
  });
  if (prediction.probability >= prediction.threshold) {
    analysis.category = 'high_risk';
    analysis.summary =
      'The installed phishing model estimates elevated risk. Review its limited benchmark scope and the observed evidence; this is not a verified fraud report.';
  } else if (
    analysis.category === 'inconclusive' &&
    !analysis.signals.some((s) => ['medium', 'high'].includes(s.severity))
  ) {
    analysis.category = 'low_observed_risk';
    analysis.summary =
      'The phishing estimate is below the selected warning threshold. This does not establish website or business legitimacy; review missing checks and other evidence.';
  }
  analysis.limitations = analysis.limitations.filter(
    (l) => !l.includes('No validated numeric risk score'),
  );
  analysis.limitations.push(
    'The model estimate is scoped to its phishing benchmark. Novel scams, deceptive stores and investment fraud may fall outside its training distribution.',
  );
}
