"""Aligned prospective phishing/reference pilot; never promotes production models.

The source labels are frozen before collection. All feature stages use exactly
the same observations and partitions, including failed observations. All model
and operating-point choices are persisted before the first holdout prediction.
"""
from __future__ import annotations

import argparse
import copy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import time

import numpy as np

import pipeline
from metrics import measure
from quality_study import summarize, cluster_bootstrap_delta, error_cohorts
from schemas import feature_schema
from selection import grouped_split, select_threshold

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'ml/data/aligned-cohort'
ARTIFACTS = ROOT / 'ml/artifacts/aligned-cohort'
STAGES = ['lexical-v2', 'url-domain-v2', 'url-content-v2', 'hybrid-v2']
PLAN = {
    'version': 1, 'seed': 42, 'max_validation_fpr': .02,
    'stages': STAGES,
    'models': {
        'logistic_regression': {'C': 1, 'class_weight': 'balanced', 'max_iter': 2000},
        'random_forest': {'n_estimators': 100, 'max_depth': 12, 'class_weight': 'balanced'},
        'hist_gradient_boosting': {'max_iter': 100, 'early_stopping': False},
    },
    'protocols': ['group-disjoint-60-20-20', 'single-session-chronological-60-20-20'],
    'threshold_selection': 'validation only, max recall at <=2% empirical FPR; F1 then Brier tie breaks',
    'calibration': 'sigmoid fitted on validation; threshold and model selection reuse that partition',
    'holdout_policy': 'All stages and model selections locked before any holdout scoring.',
    'missing_data': 'Retain every candidate, represent missing observations with availability flags.',
    'production_eligible': False,
    'limitations': [
        'Small prospective convenience pilot, not independent population-level ground truth.',
        'Official reference identity does not prove absence of compromise or financial misconduct.',
        'Public threat feeds may share reports despite different direct label and feature sources.',
        'A single collection session cannot establish long-term temporal or campaign robustness.',
        'At this sample size, 2% empirical validation FPR is not a statistical safety guarantee.',
        'Calibration, threshold and model selection reuse validation; estimates can be optimistic.',
        'Phishing/reference scope does not establish deceptive-store or investment detection accuracy.',
    ],
}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def date(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Timezone-aware acquisition timestamps required.')
    return parsed


def normalize_snapshot_clocks(rows):
    """Derive a bounded source-clock watermark; never rewrite raw acquisition.

    Protocol amendment after collection integrity checks and before scoring.
    Reject the entire run, rather than selecting/dropping rows, above the bound.
    """
    derived = copy.deepcopy(rows)
    affected = 0
    skew = {key: {'ahead_of_host_rows': 0, 'max_ahead_ms': 0.0} for key in ('domain', 'content', 'provider')}
    for row in derived:
        start = date(row['collection_started_at'])
        host = date(row.get('collection_completed_at', row['first_seen_at']))
        if host != date(row['first_seen_at']) or host < start:
            raise ValueError('Invalid original host acquisition completion.')
        observations = row['observations']
        # Raw collector assessments use the host completion. Derived copies can
        # only advance the assessment to an actually reported source timestamp.
        if date(observations['asOf']) != host:
            raise ValueError('Expected unmodified raw host assessment time.')
        timestamps = [host]
        for key in ('domain', 'content'):
            observation = observations.get(key)
            if not observation:
                continue
            timestamp = date(observation['observedAt'])
            if (start-timestamp).total_seconds() > 1 or (timestamp-host).total_seconds() > 1:
                raise ValueError('Source clock outside one-second acquisition bound; reject the whole cohort.')
            timestamps.append(timestamp)
            milliseconds = max(0.0, (timestamp-host).total_seconds()*1000)
            skew[key]['ahead_of_host_rows'] += milliseconds > 0
            skew[key]['max_ahead_ms'] = max(skew[key]['max_ahead_ms'], milliseconds)
        for provider in observations.get('providers', []):
            timestamp = date(provider['checkedAt'])
            if (timestamp-host).total_seconds() > 1:
                raise ValueError('Provider clock outside one-second bound.')
            timestamps.append(timestamp)
            milliseconds = max(0.0, (timestamp-host).total_seconds()*1000)
            skew['provider']['ahead_of_host_rows'] += milliseconds > 0
            skew['provider']['max_ahead_ms'] = max(skew['provider']['max_ahead_ms'], milliseconds)
        watermark = max(timestamps)
        row['collection_completed_at'] = host.isoformat()
        row['raw_assessment_at'] = observations['asOf']
        observations['asOf'] = watermark.isoformat()
        affected += watermark > host
        for provider in observations.get('providers', []):
            if provider['status'] == 'completed' and provider.get('expiresAt') and date(provider['expiresAt']) <= watermark:
                provider['status'] = 'expired'
    return derived, {'algorithm': 'bounded-source-clock-watermark-v1', 'max_clock_skew_seconds': 1,
        'amendment': 'After acquisition integrity checks and before model scoring; model/threshold/split policy unchanged.',
        'raw_rows_immutable': True, 'affected_rows': affected, 'source_skew': skew,
        'semantics': 'first_seen_at retains actual host completion; only derived assessment asOf advances to a reported source clock. No capture or attack dates are reconstructed.',
        'derived_rows_sha256': digest(derived)}


def validate_alignment(rows):
    seen = set()
    for row in rows:
        if row['label'] not in (0, 1) or row['source'] not in (
                'curated-official-reference', 'PhishTank community verified'):
            raise ValueError('Labels must come from the frozen reference/PhishTank sources, not feature providers.')
        if (row['label'] == 0) != (row['source'] == 'curated-official-reference'):
            raise ValueError('Source and label disagree.')
        if row['url'] in seen:
            raise ValueError('Duplicate candidate.')
        seen.add(row['url'])
        start, at = date(row['collection_started_at']), date(row['observations']['asOf'])
        host = date(row.get('collection_completed_at', row['first_seen_at']))
        if (date(row['label_snapshot_at']) > start or start > host or host > at
                or date(row['first_seen_at']) != host or (at-host).total_seconds() > 1):
            raise ValueError('Labels must be frozen before actual acquisition; assessment time must match.')
        for key in ('domain', 'content'):
            observation = row['observations'].get(key)
            if observation and (date(observation['observedAt']) > at or (start-date(observation['observedAt'])).total_seconds() > 1):
                raise ValueError('Observation is outside this acquisition window.')
        for provider in row['observations'].get('providers', []):
            if date(provider['checkedAt']) > at:
                raise ValueError('Future provider evidence.')
            if provider['status'] == 'completed' and provider.get('expiresAt') and date(provider['expiresAt']) <= at:
                raise ValueError('Expired provider evidence must be marked expired, not completed.')


def frozen_partitions(rows):
    return grouped_split(sorted(rows, key=lambda row: row.get('normalized', row['url'])), seed=PLAN['seed'])


def validate_frozen_candidates(rows, candidates):
    frozen = {r['url']: r for r in candidates}
    if len(frozen) != len(candidates) or len(rows) != len(candidates) or len({r['url'] for r in rows}) != len(rows):
        raise ValueError('Every frozen candidate must appear exactly once.')
    if {r['url'] for r in rows} != set(frozen):
        raise ValueError('Frozen candidate membership changed.')
    for row in rows:
        expected = frozen[row['url']]
        if any(row.get(key) != value for key, value in expected.items()):
            raise ValueError('Frozen labels, sources, categories, groups and label times cannot change after collection.')


def matrix(rows, names):
    return np.asarray([[row['features'][name] for name in names] for row in rows]), np.asarray([row['label'] for row in rows])


def coverage(rows):
    return {'rows': len(rows), **{key: sum(bool(r['observations'].get(key)) for r in rows) for key in ('domain', 'content')}}


def fit_stage(partitions, stage, directory):
    import joblib
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
    from sklearn.frozen import FrozenEstimator
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    names = feature_schema(stage)['features']
    train, validation, _ = partitions
    xt, yt = matrix(train, names)
    xv, yv = matrix(validation, names)
    models = {
        'logistic_regression': make_pipeline(StandardScaler(), LogisticRegression(random_state=42, **PLAN['models']['logistic_regression'])),
        'random_forest': RandomForestClassifier(random_state=42, n_jobs=1, **PLAN['models']['random_forest']),
        'hist_gradient_boosting': HistGradientBoostingClassifier(random_state=42, **PLAN['models']['hist_gradient_boosting']),
    }
    selections, artifacts = {}, {}
    for name, model in models.items():
        model.fit(xt, yt)
        calibrated = CalibratedClassifierCV(FrozenEstimator(model), method='sigmoid').fit(xv, yv)
        probabilities = calibrated.predict_proba(xv)[:, 1]
        selection = select_threshold(yv, probabilities, PLAN['max_validation_fpr'])
        selections[name] = {**selection, 'metrics': measure(yv, probabilities, selection['threshold'])} if selection else None
        path = directory / f'{stage}-{name}.joblib'
        joblib.dump(calibrated, path)
        artifacts[name] = {'path': str(path.relative_to(ROOT)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    eligible = [name for name, selection in selections.items() if selection and selection['recall'] > 0]
    selected = max(eligible, key=lambda name: (selections[name]['recall'], selections[name]['f1'], -selections[name]['metrics']['brier_score'])) if eligible else None
    return {'feature_schema': feature_schema(stage), 'selected_model': selected, 'validation_selection': selections, 'artifacts': artifacts}


def score_stage(partitions, lock):
    import joblib
    test = partitions[2]
    x, y = matrix(test, lock['feature_schema']['features'])
    results, scores = {}, {}
    for name, artifact in lock['artifacts'].items():
        path = ROOT / artifact['path']
        if hashlib.sha256(path.read_bytes()).hexdigest() != artifact['sha256']:
            raise ValueError('Candidate artifact changed after locking.')
        model = joblib.load(path)
        started = time.perf_counter()
        probabilities = model.predict_proba(x)[:, 1]
        latency = (time.perf_counter()-started)*1000/len(test)
        selection = lock['validation_selection'][name]
        threshold = selection['threshold'] if selection else 1.0
        results[name] = {**summarize(y, probabilities, threshold), 'metrics': measure(y, probabilities, threshold, latency),
                         'eligible_on_validation': bool(selection and selection['recall'] > 0),
                         'cohorts': error_cohorts(test, probabilities, threshold)}
        scores[name] = probabilities
    return results, scores


def provider_comparison(rows):
    y = np.asarray([row['label'] for row in rows])
    result = {}
    for source in ('Google Safe Browsing', 'OpenPhish Community Feed', 'either'):
        available, positive = [], []
        for row in rows:
            providers = [p for p in row['observations'].get('providers', []) if source == 'either' or p['source'] == source]
            completed = [p for p in providers if p['status'] == 'completed']
            available.append(bool(completed))
            positive.append(any(p['reportedMalicious'] for p in completed))
        coverage = np.asarray(available)
        result[source] = {'coverage_rows': int(coverage.sum()), 'total_rows': len(rows),
            'covered_only': summarize(y[coverage], np.asarray(positive, dtype=float)[coverage], .5) if coverage.any() else None,
            'all_rows_missing_as_abstention_no_alert': summarize(y, np.asarray(positive, dtype=float), .5),
            'interpretation': 'Unavailable checks are abstentions; no alert is not evidence of safety.'}
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--freeze-plan', action='store_true')
    parser.add_argument('--dataset', type=Path, default=DIRECTORY / 'dataset.jsonl')
    args = parser.parse_args()
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    plan_path = ARTIFACTS / 'plan.json'
    if plan_path.exists() and json.loads(plan_path.read_text()) != PLAN:
        raise ValueError('The prespecified plan changed; use a new experiment directory.')
    if not plan_path.exists():
        pipeline.write_json(plan_path, PLAN)
    if args.freeze_plan:
        print(json.dumps({'plan_sha256': digest(PLAN), 'frozen': True}))
        return
    raw = [json.loads(line) for line in args.dataset.read_text().splitlines() if line.strip()]
    candidates = json.loads((DIRECTORY / 'candidates.json').read_text())
    validate_frozen_candidates(raw, candidates)
    derived, clock_normalization = normalize_snapshot_clocks(raw)
    validate_alignment(derived)
    rows = pipeline.prepare_rows(derived, schema_version='hybrid-v2')
    ordered = sorted(rows, key=lambda row: row['first_seen_at'])
    n = len(rows)
    protocols = {
        PLAN['protocols'][0]: frozen_partitions(rows),
        PLAN['protocols'][1]: [ordered[:int(n*.6)], ordered[int(n*.6):int(n*.8)], ordered[int(n*.8):]],
    }
    locks = {}
    for protocol, parts in protocols.items():
        for part in parts:
            if len(part) < 10 or {r['label'] for r in part} != {0, 1}:
                raise ValueError('Both classes required in every prespecified partition; no outcome-dependent resplitting.')
        for field in ('domain', 'campaign_or_domain_group'):
            sets = [{r[field] for r in part} for part in parts]
            if sets[0]&sets[1] or sets[0]&sets[2] or sets[1]&sets[2]:
                raise ValueError('Group overlap in frozen partition.')
        directory = ARTIFACTS / protocol
        directory.mkdir(exist_ok=True)
        locks[protocol] = {'partition_sha256': digest([[r['normalized'] for r in part] for part in parts]),
            'counts': {key: {'rows': len(part), 'positive': sum(r['label'] for r in part)} for key, part in zip(('train', 'validation', 'test'), parts)},
            'coverage': {key: coverage(part) for key, part in zip(('train', 'validation', 'test'), parts)},
            'stages': {stage: fit_stage(parts, stage, directory) for stage in STAGES}}
    # This durable lock covers every model, threshold, stage and protocol before
    # ANY holdout predictions, including the chronological sensitivity analysis.
    lock = {'plan_sha256': digest(PLAN), 'dataset_sha256': hashlib.sha256(args.dataset.read_bytes()).hexdigest(),
            'clock_normalization': clock_normalization, 'protocols': locks}
    lock_path = ARTIFACTS / 'selection-lock.json'
    pipeline.write_json(lock_path, lock)
    report = {'scope': 'aligned-phishing-reference-pilot', 'production_eligible': False,
        'evaluated_at': datetime.now(timezone.utc).isoformat(), 'plan': PLAN,
        'implementation_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'plan_sha256': digest(PLAN), 'selection_lock_sha256': hashlib.sha256(lock_path.read_bytes()).hexdigest(),
        'dataset_sha256': lock['dataset_sha256'], 'clock_normalization': clock_normalization, 'rows': n,
        'observation_window': {'start': min(r['collection_started_at'] for r in rows), 'end': max(r['first_seen_at'] for r in rows)},
        'coverage': {key: sum(bool(r['observations'].get(key)) for r in rows) for key in ('domain', 'content')},
        'coverage_by_label': {str(label): coverage([r for r in rows if r['label'] == label]) for label in (0, 1)},
        'collection_diagnostics': 'Host public-DNS failures were observed near collection completion; worker-specific failure causes were not retained, so not every missing observation can be attributed to DNS. Every failed observation remains missing, not a negative safety finding.',
        'provider_comparison_all_rows': provider_comparison(rows), 'protocols': {},
        'source_provenance': json.loads((DIRECTORY / 'provenance.json').read_text()),
        'sampling_bias': 'Negatives are famous HTTPS homepages; positives retain arbitrary feed paths. URL/path/length, institution age, popularity and acquisition-source shortcuts may dominate. No matched benign-path or independently adjudicated current business cohort is claimed.'}
    for protocol, parts in protocols.items():
        results, predictions = {}, {}
        for stage, stage_lock in locks[protocol]['stages'].items():
            models, scores = score_stage(parts, stage_lock)
            results[stage] = {**stage_lock, 'models': models}
            selected = stage_lock['selected_model']
            if selected:
                predictions[stage] = (scores[selected], stage_lock['validation_selection'][selected]['threshold'])
        comparisons = {}
        if 'lexical-v2' in predictions:
            baseline, baseline_threshold = predictions['lexical-v2']
            for stage, (scores, threshold) in predictions.items():
                if stage != 'lexical-v2':
                    comparisons[stage] = cluster_bootstrap_delta(parts[2], [r['label'] for r in parts[2]], scores, threshold, baseline, baseline_threshold)
        report['protocols'][protocol] = {**{k:v for k,v in locks[protocol].items() if k != 'stages'},
            'stages': results, 'paired_vs_lexical': comparisons, 'provider_comparison_holdout': provider_comparison(parts[2])}
    # Do not publish raw URLs, target content or per-target error examples.
    pipeline.write_json(ROOT / 'docs/evidence/aligned-evaluation.json', report)
    print(json.dumps({'rows': n, 'coverage': report['coverage'], 'evidence': 'docs/evidence/aligned-evaluation.json'}))


if __name__ == '__main__':
    main()
