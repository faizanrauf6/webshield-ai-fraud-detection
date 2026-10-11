"""Reproducible offline lexical baselines. No submitted website is fetched.

A synthetic smoke run proves tooling, never real-world detection performance.
Production features and registered domains are extracted by the TypeScript library.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'ml' / 'artifacts'
SCHEMA = json.loads((ROOT / 'ml' / 'feature_schema.json').read_text())
NAMES = SCHEMA['features']


def extract_batch(urls: list, skip_invalid=False, schema_version=SCHEMA['version']) -> list[dict]:
    output = []
    for start in range(0, len(urls), 20000):
        result = subprocess.run(
            ['node', '--import', 'tsx', str(ROOT / 'scripts' / 'features.ts'), f'--schema={schema_version}', *(['--skip-invalid'] if skip_invalid else [])],
            input=json.dumps(urls[start:start+20000]), text=True, cwd=ROOT, capture_output=True, timeout=120,
        )
        if result.returncode:
            raise ValueError('Dataset contains an invalid or unsupported public HTTP(S) URL.')
        output.extend(json.loads(result.stdout))
    return output


def extract_features(url: str) -> dict[str, float]:
    return extract_batch([url])[0]['features']


def parse_date(value: str) -> str:
    try:
        date = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if date.tzinfo is None:
            date = date.replace(tzinfo=timezone.utc)
        return date.astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError, AttributeError) as error:
        raise ValueError('first_seen_at and split boundaries must be ISO dates.') from error


def prepare_rows(rows: list[dict], allow_unknown_dates=False, schema_version=SCHEMA['version']) -> list[dict]:
    if not rows:
        raise ValueError('Dataset is empty.')
    for row in rows:
        required = ['url', 'label', 'source', 'campaign_or_domain_group'] + ([] if allow_unknown_dates else ['first_seen_at'])
        if any(key not in row or str(row[key]).strip() == '' for key in required):
            raise ValueError('Required dataset columns are missing or empty.')
        if str(row['label']) not in ('0', '1'):
            raise ValueError('Labels must be 0 (reviewed legitimate) or 1 (fraudulent).')
    extracted = extract_batch([{'url': row['url'], 'observations': row.get('observations', {})} for row in rows], schema_version=schema_version)
    seen = {}
    output = []
    for raw, features in zip(rows, extracted):
        item = {**raw, **features, 'label': int(raw['label']), 'first_seen_at': parse_date(raw['first_seen_at']) if raw.get('first_seen_at') else None}
        normalized = item['normalized']
        if normalized in seen:
            if seen[normalized]['label'] != item['label']:
                raise ValueError('Conflicting labels for a canonical URL.')
            existing = seen[normalized]
            if existing['campaign_or_domain_group'] != item['campaign_or_domain_group']:
                raise ValueError('Conflicting campaign groups for a canonical URL; resolve memberships before training.')
            dates = [d for d in [existing['first_seen_at'], item['first_seen_at']] if d]
            existing['first_seen_at'] = min(dates) if dates else None
            continue
        seen[normalized] = item
        output.append(item)
    return sorted(output, key=lambda row: (row['first_seen_at'] or '', row['normalized']))


def temporal_split(rows: list[dict], validation_start: str, test_start: str):
    validation_start, test_start = parse_date(validation_start), parse_date(test_start)
    if validation_start >= test_start:
        raise ValueError('Validation must start before test.')
    # Connected domain/campaign components capture transitive overlap too.
    parent = list(range(len(rows)))

    def find(index):
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    groups = {}
    for index, row in enumerate(rows):
        for key in [('domain', row['domain']), ('campaign', row['campaign_or_domain_group'])]:
            if key in groups:
                parent[find(index)] = find(groups[key])
            else:
                groups[key] = index
    windows = [2 if row['first_seen_at'] >= test_start else 1 if row['first_seen_at'] >= validation_start else 0 for row in rows]
    latest = {}
    for index, window in enumerate(windows):
        component = find(index)
        latest[component] = max(window, latest.get(component, 0))
    partitions = [[], [], []]
    purged = 0
    for index, row in enumerate(rows):
        if windows[index] < latest[find(index)]:
            purged += 1
        else:
            partitions[windows[index]].append(row)
    return *partitions, purged


def load_csv(path: Path) -> list[dict]:
    with path.open(newline='') as handle:
        return list(csv.DictReader(handle))


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')


def synthetic_rows():
    rows = []
    # Every domain/campaign is unique. Labels and wording are deliberately artificial.
    for period, date in enumerate(['2026-01-10', '2026-02-10', '2026-03-10']):
        for index in range(80):
            positive = index % 2
            prefix = f'account-verify-secure-{index}' if positive else f'bookshop{index}'
            url = f'{"http" if positive and index % 3 else "https"}://{prefix}-{period}.example/'
            url += 'login/verify?account=123456789' if positive else 'books'
            rows.append({'url': url, 'label': positive, 'first_seen_at': date, 'source': 'synthetic-smoke-only', 'campaign_or_domain_group': f'{period}-{index}'})
    return rows


def train(rows, validation_start, test_start, synthetic=False, split_protocol='temporal', max_fpr=0.02, provenance=None, schema_version=SCHEMA['version']):
    import joblib
    import numpy as np
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
    from sklearn.frozen import FrozenEstimator
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    from selection import grouped_split, select_threshold
    from metrics import measure
    from schemas import feature_schema
    schema = feature_schema(schema_version)
    names = schema['features']

    prepared = prepare_rows(rows, allow_unknown_dates=split_protocol == 'group', schema_version=schema_version)
    if split_protocol == 'group':
        training, validation, test = grouped_split(prepared)
        purged = 0
    else:
        training, validation, test, purged = temporal_split(prepared, validation_start, test_start)
    for name, partition in [('training', training), ('validation', validation), ('test', test)]:
        if len(partition) < 10 or {row['label'] for row in partition} != {0, 1}:
            raise ValueError(f'{name} requires at least 10 rows and both classes after purging overlap.')

    def matrix(partition):
        return np.array([[row['features'][name] for name in names] for row in partition]), np.array([row['label'] for row in partition])

    x_train, y_train = matrix(training)
    x_validation, y_validation = matrix(validation)
    models = {
        'logistic_regression': make_pipeline(StandardScaler(), LogisticRegression(class_weight='balanced', random_state=42, max_iter=2000)),
        'random_forest': RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42, n_jobs=1, max_depth=12),
        'hist_gradient_boosting': HistGradientBoostingClassifier(random_state=42, max_iter=100, early_stopping=False),
    }
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    artifacts = {}
    selections = {}
    # The test partition is saved untouched; no model or threshold selection uses it.
    for name, model in models.items():
        model.fit(x_train, y_train)
        calibrated = CalibratedClassifierCV(FrozenEstimator(model), method='sigmoid')
        calibrated.fit(x_validation, y_validation)
        probabilities = calibrated.predict_proba(x_validation)[:, 1]
        selection = select_threshold(y_validation, probabilities, max_fpr=max_fpr)
        if selection:
            selections[name] = {**selection, 'metrics': measure(y_validation, probabilities, selection['threshold'])}
        path = ARTIFACTS / f'{name}.joblib'
        joblib.dump(calibrated, path)
        artifacts[name] = {'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    if not selections or max(s['recall'] for s in selections.values()) <= 0:
        raise ValueError('No model has useful validation recall under the requested false-positive limit.')
    selected = max(selections, key=lambda n: (selections[n]['recall'], selections[n]['f1'], -selections[n]['false_positive_rate'], -selections[n]['metrics']['brier_score']))
    dataset_hash = hashlib.sha256(json.dumps(prepared, sort_keys=True).encode()).hexdigest()
    holdout_path = ARTIFACTS / 'holdout.json'
    write_json(holdout_path, test)
    manifest = {
        'bundle_version': 1, 'scope': 'phishing', 'selected_model': selected,
        'model_version': f'{schema["version"]}-{selected}-{dataset_hash[:12]}',
        'evaluation_protocol': 'group-disjoint' if split_protocol == 'group' else 'temporal-group-purged',
        'selection_partition': 'validation', 'calibration_partition': 'validation',
        'validation_selection': selections, 'max_validation_fpr': max_fpr,
        'holdout_sha256': hashlib.sha256(holdout_path.read_bytes()).hexdigest(), 'provenance': provenance,
        'feature_schema': schema, 'dataset_sha256': hashlib.sha256(json.dumps(prepared, sort_keys=True).encode()).hexdigest(),
        'synthetic': synthetic, 'purpose': 'Synthetic pipeline validation only; NOT real-world accuracy.' if synthetic else 'User-supplied dataset; review labeling and permissions before claims.',
        'validation_start': parse_date(validation_start) if split_protocol == 'temporal' else None,
        'test_start': parse_date(test_start) if split_protocol == 'temporal' else None,
        'counts': {'train': len(training), 'validation': len(validation), 'test': len(test), 'purged': purged},
        'sources': sorted({row['source'] for row in prepared}), 'threshold': selections[selected]['threshold'], 'artifacts': artifacts,
    }
    write_json(ARTIFACTS / 'manifest.json', manifest)
    print(json.dumps({'trained_models': list(models), 'selected_model': selected, 'threshold': manifest['threshold'], 'counts': manifest['counts'], 'synthetic': synthetic}), flush=True)


def evaluate():
    import joblib
    import numpy as np
    from sklearn.calibration import calibration_curve
    from sklearn.metrics import average_precision_score, brier_score_loss, confusion_matrix, precision_recall_fscore_support, roc_auc_score
    from metrics import measure
    from schemas import feature_schema
    manifest = json.loads((ARTIFACTS / 'manifest.json').read_text())
    if manifest['feature_schema'] != feature_schema(manifest['feature_schema']['version']):
        raise ValueError('Artifact feature schema does not match production.')
    holdout = (ARTIFACTS / 'holdout.json').read_bytes()
    if hashlib.sha256(holdout).hexdigest() != manifest['holdout_sha256']:
        raise ValueError('The frozen holdout has changed.')
    test = json.loads(holdout)
    x_test = np.array([[row['features'][name] for name in manifest['feature_schema']['features']] for row in test])
    y_test = np.array([row['label'] for row in test])
    results = {}
    for name, artifact in manifest['artifacts'].items():
        path = (ARTIFACTS / artifact['file']).resolve()
        if path.parent != ARTIFACTS.resolve() or hashlib.sha256(path.read_bytes()).hexdigest() != artifact['sha256']:
            raise ValueError('Untrusted or altered local model artifact.')
        # Hash validation detects accidental alteration, not hostile replacement of both
        # manifest and artifact. Only load files you generated in a trusted checkout.
        model = joblib.load(path)
        start = time.perf_counter()
        probabilities = model.predict_proba(x_test)[:, 1]
        latency = (time.perf_counter() - start) * 1000 / len(test)
        threshold = manifest['validation_selection'].get(name, {}).get('threshold', 1.0)
        results[name] = measure(y_test, probabilities, threshold, latency)
        results[name]['eligible_on_validation'] = name in manifest['validation_selection']
        cohorts = {}
        for feature in ['https', 'punycode', 'ip_literal']:
            for value in (0, 1):
                indices = [i for i, r in enumerate(test) if r['features'][feature] == value]
                if indices:
                    cohorts[f'{feature}={value}'] = measure(y_test[indices], probabilities[indices], threshold)
        results[name]['cohorts'] = cohorts
        errors = [{'url': r['normalized'], 'label': r['label'], 'probability': float(p)} for r, p in zip(test, probabilities) if int(p >= threshold) != r['label']]
        write_json(ARTIFACTS / f'{name}-errors.json', errors)
    report = {'synthetic': manifest['synthetic'], 'purpose': manifest['purpose'], 'dataset_sha256': manifest['dataset_sha256'], 'counts': manifest['counts'],
              'selected_model': manifest['selected_model'], 'evaluation_protocol': manifest['evaluation_protocol'], 'models': results}
    write_json(ARTIFACTS / 'evaluation.json', report)
    manifest['evaluation_sha256'] = hashlib.sha256((ARTIFACTS / 'evaluation.json').read_bytes()).hexdigest()
    manifest['evaluated_at'] = datetime.now(timezone.utc).isoformat()
    write_json(ARTIFACTS / 'manifest.json', manifest)
    print(json.dumps({'evaluation': str(ARTIFACTS / 'evaluation.json'), 'selected_model': manifest['selected_model'],
                      'models': {n: {k: r[k] for k in ['per_class', 'false_positive_rate', 'brier_score']} for n, r in results.items()}}, indent=2), flush=True)
    return report


def main():
    global ARTIFACTS
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['train', 'evaluate', 'smoke'])
    parser.add_argument('--dataset', type=Path)
    parser.add_argument('--validation-start', default='2026-02-01')
    parser.add_argument('--test-start', default='2026-03-01')
    parser.add_argument('--split', choices=['temporal', 'group'], default='temporal')
    parser.add_argument('--max-fpr', type=float, default=0.02)
    parser.add_argument('--artifacts', type=Path, default=ARTIFACTS)
    parser.add_argument('--schema', default=SCHEMA['version'])
    args = parser.parse_args()
    ARTIFACTS = args.artifacts
    if args.command == 'evaluate':
        evaluate()
    elif args.command == 'smoke':
        train(synthetic_rows(), '2026-02-01', '2026-03-01', synthetic=True)
        evaluate()
    else:
        if not args.dataset:
            parser.error('train requires --dataset; use smoke for synthetic pipeline validation.')
        provenance_path = args.dataset.with_suffix('.provenance.json')
        provenance = json.loads(provenance_path.read_text()) if provenance_path.exists() else None
        train(load_csv(args.dataset), args.validation_start, args.test_start, split_protocol=args.split,
              max_fpr=args.max_fpr, provenance=provenance, schema_version=args.schema)


if __name__ == '__main__':
    main()
