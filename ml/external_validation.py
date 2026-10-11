"""Frozen-model comparison on the newly collected cohort; no fitting or promotion."""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

import numpy as np

from aligned_evaluation import DIRECTORY, validate_alignment, validate_frozen_candidates, normalize_snapshot_clocks
from inference import load_bundle
import pipeline
from quality_study import predict_url_candidate, summarize, cluster_bootstrap_delta, error_cohorts

ROOT = Path(__file__).resolve().parents[1]
LOCK = ROOT / 'ml/artifacts/aligned-cohort/external-plan.json'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def plan():
    quality = json.loads((ROOT / 'docs/evidence/model-quality-study.json').read_text())
    candidate = quality['experiments']['phreshphish']['candidate_artifact']
    return {
        'version': 1, 'production_eligible': False,
        'candidate': candidate,
        'production_manifest_sha256': sha(ROOT / 'ml/production/manifest.json'),
        'historical_source_sha256': sha(ROOT / 'ml/data/phreshphish.csv'),
        'selection': 'Use both previously frozen models and their validation-selected thresholds unchanged; no fitting or recalibration.',
        'cohorts': ['all candidates', 'registrable domains absent from entire historical PhreshPhish metadata sample'],
        'limits': ['Famous HTTPS root-page references versus arbitrary positive paths create source/URL convention confounding.',
            'PhishTank community labels and official-domain identity are not independent current page adjudication.',
            'This new source pilot does not fix the already measured legitimate HTTP false-positive problem.',
            'No broad store/investment claim or automatic production promotion.'],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--freeze-plan', action='store_true')
    args = parser.parse_args()
    expected = plan()
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    if LOCK.exists() and json.loads(LOCK.read_text()) != expected:
        raise ValueError('Frozen external validation models or historical source changed.')
    if not LOCK.exists():
        pipeline.write_json(LOCK, expected)
    if args.freeze_plan:
        print(json.dumps({'frozen': True, 'plan_sha256': sha(LOCK)}))
        return
    raw = [json.loads(line) for line in (DIRECTORY / 'dataset.jsonl').read_text().splitlines() if line.strip()]
    validate_frozen_candidates(raw, json.loads((DIRECTORY / 'candidates.json').read_text()))
    derived, clock_normalization = normalize_snapshot_clocks(raw)
    validate_alignment(derived)
    rows = pipeline.prepare_rows(derived, schema_version='hybrid-v2')
    historical = set()
    with (ROOT / 'ml/data/phreshphish.csv').open(newline='') as handle:
        for row in csv.DictReader(handle):
            historical.add(row['campaign_or_domain_group'])
    manifest, production = load_bundle(ROOT / 'ml/production')
    names = manifest['feature_schema']['features']
    baseline = production.predict_proba(np.asarray([[r['features'][name] for name in names] for r in rows]))[:, 1]
    artifact = expected['candidate']
    candidate = predict_url_candidate(ROOT / artifact['path'], [r['normalized'] for r in rows], artifact['sha256'])
    scores = np.asarray([r['score'] for r in candidate['rows']])
    report = {'scope': 'new-source phishing/reference descriptive validation', 'production_eligible': False,
        'implementation_sha256': sha(Path(__file__)),
        'shared_alignment_implementation_sha256': sha(ROOT / 'ml/aligned_evaluation.py'),
        'recorded_at': datetime.now(timezone.utc).isoformat(), 'frozen_plan': expected,
        'plan_sha256': sha(LOCK), 'dataset_sha256': sha(DIRECTORY / 'dataset.jsonl'), 'clock_normalization': clock_normalization,
        'production_model_version': manifest['model_version'], 'selected_candidate': candidate['selected_candidate'],
        'historical_domain_overlap_rows': sum(r['domain'] in historical for r in rows), 'cohorts': {}}
    for label, indices in (
        ('all candidates', list(range(len(rows)))),
        ('unseen historical domains', [i for i,r in enumerate(rows) if r['domain'] not in historical]),
    ):
        subset = [rows[i] for i in indices]
        if not subset:
            report['cohorts'][label] = {'rows': 0}
            continue
        y = [r['label'] for r in subset]
        a, b = scores[indices], baseline[indices]
        report['cohorts'][label] = {
            'rows': len(subset), 'positive': sum(y),
            'production': summarize(y, b, manifest['threshold']),
            'candidate': summarize(y, a, candidate['threshold']),
            'production_error_cohorts': error_cohorts(subset, b, manifest['threshold']),
            'candidate_error_cohorts': error_cohorts(subset, a, candidate['threshold']),
            'paired_candidate_vs_production': cluster_bootstrap_delta(subset, y, a, candidate['threshold'], b, manifest['threshold']),
        }
    pipeline.write_json(ROOT / 'docs/evidence/external-model-validation.json', report)
    print(json.dumps({'rows': len(rows), 'overlap_rows': report['historical_domain_overlap_rows'], 'cohorts': {k:{m:v.get(m) for m in ('rows', 'positive', 'production', 'candidate')} for k,v in report['cohorts'].items()}}))


if __name__ == '__main__':
    main()
