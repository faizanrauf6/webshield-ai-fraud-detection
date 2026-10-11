"""Controlled offline model-quality experiments; never promotes or fetches URLs.

Candidate definitions are fixed in PLAN. Selection and sensitivity thresholds use
validation only. Reused historical holdouts provide descriptive comparisons, not
new independent confirmation. Local data/models are required and hash checked.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import time

import numpy as np

import pipeline
from metrics import measure
from selection import component_groups, grouped_split, select_threshold

PLAN = {
    'version': 1, 'seed': 42, 'max_validation_fpr': .02,
    'phreshphish': {
        'char_lexical_c01': {'C': .1},
        'char_lexical_c1': {'C': 1.0},
    },
    'url_representation': {
        'analyzer': 'char', 'ngram_range': [3, 5], 'min_df': 3,
        'max_features': 100000, 'sublinear_tf': True,
        'lowercase': True, 'dtype': 'float32', 'norm': 'l2',
        'numeric_features': 'existing lexical-v2; train-fitted standard scaler',
        'max_url_characters': 2048,
    },
    'scamferret': {
        'missingness_logistic_c01': {'C': .1, 'class_weight': 'balanced'},
        'missingness_shallow_forest': {'n_estimators': 200, 'max_depth': 4,
            'min_samples_leaf': 12, 'max_features': .5, 'class_weight': 'balanced'},
    },
    'archived_representation': {
        'drop_unknown_constants': ['dns_address_count', 'redirect_count', 'cross_domain_redirects'],
        'unavailable_content_features': 'NaN when content_available=0',
        'unavailable_age': 'NaN when domain_age_known=0',
        'imputation': 'train median + missingness indicators; keep empty features',
    },
    'calibration': 'none for candidates; probabilities are uncalibrated logistic/forest scores',
    'selection': 'maximum validation recall at FPR <=2%; precision then candidate name break ties',
    'sensitivity_validation_fpr_budgets': [.005, .01, .02, .05],
    'holdout_policy': 'Previously examined historical holdouts are reused descriptively only. No tuning on holdout.',
    'production_eligible': False,
}
CONTENT_FEATURES = ('password_forms', 'external_password_forms', 'http_password_forms',
                    'iframe_count', 'link_domain_count', 'crypto_present',
                    'investment_claims', 'crypto_addresses')


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def object_digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def wilson_interval(successes, total, z=1.959963984540054):
    """Binomial descriptive interval; repeated-domain dependence is not modeled."""
    if not total:
        return None
    p = successes / total
    denominator = 1 + z*z/total
    centre = (p + z*z/(2*total)) / denominator
    half = z * math.sqrt(p*(1-p)/total + z*z/(4*total*total)) / denominator
    return [max(0., centre-half), min(1., centre+half)]


def summarize(labels, probabilities, threshold):
    result = measure(labels, probabilities, threshold)
    tn, fp, fn, tp = np.asarray(result['confusion_matrix']).ravel().tolist()
    return {'rows': len(labels), 'threshold': float(threshold),
            'confusion_matrix': result['confusion_matrix'],
            'precision': result['per_class']['1']['precision'],
            'recall': result['per_class']['1']['recall'],
            'false_positive_rate': result['false_positive_rate'],
            'average_precision': result['pr_auc_average_precision'],
            'brier_score': result['brier_score'],
            'wilson_95_descriptive': {'precision': wilson_interval(tp, tp+fp),
                                    'recall': wilson_interval(tp, tp+fn),
                                    'false_positive_rate': wilson_interval(fp, fp+tn)}}


def archived_matrix(rows, names):
    retained = [n for n in names if n not in PLAN['archived_representation']['drop_unknown_constants']]
    matrix = np.asarray([[r['features'][n] for n in retained] for r in rows], dtype=float)
    for index, row in enumerate(rows):
        features = row['features']
        if not features.get('domain_age_known') and 'domain_age_days' in retained:
            matrix[index, retained.index('domain_age_days')] = np.nan
        if not features.get('content_available'):
            for name in CONTENT_FEATURES:
                if name in retained:
                    matrix[index, retained.index(name)] = np.nan
    return matrix, retained


def assert_disjoint(partitions):
    for field in ('domain', 'campaign_or_domain_group'):
        sets = [{row[field] for row in part} for part in partitions]
        if any(sets[a] & sets[b] for a, b in ((0, 1), (0, 2), (1, 2))):
            raise ValueError(f'{field} overlap across partitions.')


def select_candidates(labels, probabilities):
    selections = {name: select_threshold(labels, scores, PLAN['max_validation_fpr'])
                  for name, scores in probabilities.items()}
    eligible = {name: selection for name, selection in selections.items()
                if selection and selection['recall'] > 0}
    selected = max(eligible, key=lambda name: (eligible[name]['recall'], eligible[name]['precision'], name)) if eligible else None
    return selected, selections


def threshold_sensitivity(validation_labels, validation_probabilities, labels, probabilities):
    return score_sensitivity(validation_sensitivity(validation_labels, validation_probabilities), labels, probabilities)


def validation_sensitivity(labels, probabilities):
    return {str(budget): select_threshold(labels, probabilities, budget)
            for budget in PLAN['sensitivity_validation_fpr_budgets']}


def score_sensitivity(selections, labels, probabilities):
    results = {}
    for budget, selection in selections.items():
        results[budget] = {'validation_selection': selection,
            'threshold': selection['threshold'],
            'holdout': summarize(labels, probabilities, selection['threshold'])} if selection else None
    return results


def cluster_bootstrap_delta(rows, labels, candidate, candidate_threshold,
                            baseline, baseline_threshold, repetitions=500):
    """Paired connected-domain/campaign bootstrap, conditional on locked models."""
    group_rows = [{**r, 'campaign_or_domain_group': r.get('campaign_or_domain_group', r['domain'])} for r in rows]
    _, inverse = np.unique(component_groups(group_rows), return_inverse=True)
    labels = np.asarray(labels)
    a, b = np.asarray(candidate) >= candidate_threshold, np.asarray(baseline) >= baseline_threshold
    groups = int(inverse.max()+1)
    totals = np.column_stack([np.bincount(inverse, weights=x, minlength=groups) for x in
        (labels == 1, labels == 0, a & (labels == 1), b & (labels == 1),
         a & (labels == 0), b & (labels == 0))])
    rng = np.random.default_rng(PLAN['seed'])
    deltas = []
    for _ in range(repetitions):
        counts = totals[rng.integers(0, groups, size=groups)].sum(axis=0)
        if counts[0] and counts[1]:
            deltas.append([(counts[2]-counts[3])/counts[0], (counts[4]-counts[5])/counts[1]])
    intervals = np.quantile(deltas, [.025, .975], axis=0).T.tolist() if deltas else [None, None]
    return {'group_count': groups, 'repetitions': repetitions, 'valid_repetitions': len(deltas),
            'recall_delta_95_interval': intervals[0],
            'false_positive_rate_delta_95_interval': intervals[1],
            'interpretation': 'Paired percentile connected-domain/campaign bootstrap; conditional on fitted models and validation thresholds; excludes selection and dataset-source uncertainty.'}


def error_cohorts(rows, probabilities, threshold):
    cohorts = {}
    for field in ('https', 'punycode', 'ip_literal', 'content_available', 'domain_age_known'):
        for value in (0, 1):
            indices = [i for i, row in enumerate(rows) if row['features'].get(field) == value]
            if indices:
                cohorts[f'{field}={value}'] = summarize([rows[i]['label'] for i in indices], np.asarray(probabilities)[indices], threshold)
    for category in sorted({r['category'] for r in rows if 'category' in r}):
        indices = [i for i, row in enumerate(rows) if row.get('category') == category]
        cohorts[f'category={category}'] = summarize([rows[i]['label'] for i in indices], np.asarray(probabilities)[indices], threshold)
    return cohorts


def reconstruct(dataset, artifact_directory, archived=False):
    directory = Path(artifact_directory)
    manifest = json.loads((directory / 'manifest.json').read_text())
    if digest(directory / 'holdout.json') != manifest['holdout_sha256']:
        raise ValueError('Frozen holdout hash mismatch.')
    if archived:
        from scam_evaluation import validate_research_rows
        raw = [json.loads(line) for line in Path(dataset).read_text().splitlines() if line.strip()]
        validate_research_rows(raw)
    else:
        raw = pipeline.load_csv(Path(dataset))
        if digest(dataset) != manifest['provenance']['prepared_sha256']:
            raise ValueError('Prepared source dataset hash mismatch.')
    prepared = pipeline.prepare_rows(raw, allow_unknown_dates=archived, schema_version=manifest['feature_schema']['version'])
    if object_digest(prepared) != manifest['dataset_sha256']:
        raise ValueError('Reconstructed prepared dataset differs from frozen baseline.')
    if archived:
        training, validation, holdout = grouped_split(prepared)
        purged = 0
    else:
        training, validation, holdout, purged = pipeline.temporal_split(prepared, manifest['validation_start'], manifest['test_start'])
    counts = dict(zip(('train', 'validation', 'test', 'purged'), (len(training), len(validation), len(holdout), purged)))
    if counts != manifest['counts'] or holdout != json.loads((directory / 'holdout.json').read_text()):
        raise ValueError('Reconstructed partitions differ from frozen baseline.')
    assert_disjoint([training, validation, holdout])
    return [training, validation, holdout], manifest


def baseline_scores(partitions, directory, manifest):
    import joblib
    name = manifest['selected_model']
    artifact = manifest['artifacts'][name]
    path = Path(directory) / artifact['file']
    if path.resolve().parent != Path(directory).resolve() or digest(path) != artifact['sha256']:
        raise ValueError('Baseline artifact hash mismatch.')
    model = joblib.load(path)
    names = manifest['feature_schema']['features']
    return [model.predict_proba(np.asarray([[r['features'][n] for n in names] for r in part]))[:, 1]
            for part in partitions]


def fit_candidates(training, validation, names, archived):
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    from scipy.sparse import csr_matrix, hstack

    models = {}
    if archived:
        x_train, retained = archived_matrix(training, names)
        x_validation, _ = archived_matrix(validation, names)
        def transform(part):
            return archived_matrix(part, names)[0]
        transform.artifact_components = {'kind': 'archived-missingness', 'feature_names': names}
        for name, parameters in PLAN['scamferret'].items():
            model = (make_pipeline(SimpleImputer(strategy='median', add_indicator=True, keep_empty_features=True),
                                   StandardScaler(), LogisticRegression(**parameters, random_state=42, max_iter=2000))
                     if 'logistic' in name else
                     make_pipeline(SimpleImputer(strategy='median', add_indicator=True, keep_empty_features=True),
                                   RandomForestClassifier(**parameters, random_state=42, n_jobs=1)))
            model.fit(x_train, [r['label'] for r in training])
            models[name] = model
        representation = {'retained_features': retained}
    else:
        vectorizer = TfidfVectorizer(analyzer='char', ngram_range=(3, 5), min_df=3,
            max_features=100000, sublinear_tf=True, dtype=np.float32)
        urls = lambda part: [r['normalized'][:2048] for r in part]
        scaler = StandardScaler()
        numeric = lambda part: np.asarray([[r['features'][n] for n in names] for r in part], dtype=np.float32)
        x_train = hstack([vectorizer.fit_transform(urls(training)), csr_matrix(scaler.fit_transform(numeric(training)))], format='csr')
        def transform(part):
            return hstack([vectorizer.transform(urls(part)), csr_matrix(scaler.transform(numeric(part)))], format='csr')
        transform.artifact_components = {'kind': 'char-lexical', 'feature_names': names,
                                         'vectorizer': vectorizer, 'scaler': scaler}
        x_validation = transform(validation)
        for name, parameters in PLAN['phreshphish'].items():
            model = LogisticRegression(**parameters, solver='liblinear', class_weight='balanced', random_state=42, max_iter=500)
            model.fit(x_train, [r['label'] for r in training])
            if (model.n_iter_ >= model.max_iter).any():
                raise ValueError('Candidate failed to converge; do not silently report a fixed-budget result.')
            models[name] = model
        representation = {'vocabulary_size': len(vectorizer.vocabulary_), 'matrix_shape': list(x_train.shape),
                          'sparse_training_nonzero': int(x_train.nnz)}
    train_scores = {name: model.predict_proba(x_train)[:, 1] for name, model in models.items()}
    validation_scores = {name: model.predict_proba(x_validation)[:, 1] for name, model in models.items()}
    return models, transform, train_scores, validation_scores, representation


def save_candidate(model, transform, selected, threshold, output):
    """Persist an isolated research bundle, never a production artifact."""
    import joblib
    path = output / f'{selected}.joblib'
    bundle = {**transform.artifact_components, 'model': model, 'threshold': threshold,
              'selected_candidate': selected, 'plan_sha256': object_digest(PLAN),
              'production_eligible': False, 'max_url_characters': 2048}
    joblib.dump(bundle, path)
    return {'path': str(path.relative_to(pipeline.ROOT)) if path.is_relative_to(pipeline.ROOT) else str(path),
            'sha256': digest(path), 'production_eligible': False}


def predict_url_candidate(artifact, urls, expected_sha256):
    """Score raw URL strings at the saved threshold, without fetching or fitting.

    Only load a locally generated trusted bundle with its recorded hash. Returned
    scores are uncalibrated research scores, not user-facing safety probabilities.
    """
    import joblib
    from scipy.sparse import csr_matrix, hstack
    if digest(artifact) != expected_sha256:
        raise ValueError('Research candidate artifact hash mismatch.')
    bundle = joblib.load(artifact)
    if bundle.get('kind') != 'char-lexical' or bundle.get('production_eligible') is not False:
        raise ValueError('Expected an isolated character/lexical research candidate.')
    prepared = pipeline.extract_batch(urls, schema_version='lexical-v2')
    text = [r['normalized'][:bundle['max_url_characters']] for r in prepared]
    numeric = np.asarray([[r['features'][n] for n in bundle['feature_names']] for r in prepared], dtype=np.float32)
    matrix = hstack([bundle['vectorizer'].transform(text),
                     csr_matrix(bundle['scaler'].transform(numeric))], format='csr')
    scores = bundle['model'].predict_proba(matrix)[:, 1]
    return {'threshold': bundle['threshold'], 'selected_candidate': bundle['selected_candidate'],
            'production_eligible': False, 'rows': [{'url': r['normalized'], 'score': float(score),
                'predicted_positive': bool(score >= bundle['threshold'])} for r, score in zip(prepared, scores)]}


def run_experiment(name, dataset, baseline_directory, output):
    archived = name == 'scamferret'
    partitions, manifest = reconstruct(dataset, baseline_directory, archived)
    training, validation, holdout = partitions
    labels = [np.asarray([r['label'] for r in part]) for part in partitions]
    models, transform, train_scores, validation_scores, representation = fit_candidates(training, validation, manifest['feature_schema']['features'], archived)
    selected, selections = select_candidates(labels[1], validation_scores)
    baseline = baseline_scores(partitions[:2], baseline_directory, manifest)
    sensitivity = {candidate_name: validation_sensitivity(labels[1], scores)
                   for candidate_name, scores in validation_scores.items()}
    baseline_sensitivity = validation_sensitivity(labels[1], baseline[1])
    locked = {'plan_sha256': object_digest(PLAN), 'dataset_sha256': manifest['dataset_sha256'],
              'selected_candidate': selected, 'thresholds': selections,
              'candidate_sensitivity_thresholds': sensitivity,
              'baseline_sensitivity_thresholds': baseline_sensitivity,
              'partition_identity_sha256': [object_digest(part) for part in partitions]}
    # This durable lock exists BEFORE baseline or candidate holdout prediction.
    lock_path = output / f'{name}-validation-lock.json'
    pipeline.write_json(lock_path, locked)
    lock_hash = digest(lock_path)
    artifact = save_candidate(models[selected], transform, selected, selections[selected]['threshold'], output) if selected else None
    baseline.extend(baseline_scores([holdout], baseline_directory, manifest))
    baseline_threshold = manifest['threshold']
    baseline_report = {'name': manifest['selected_model'], 'threshold': baseline_threshold,
        'training': summarize(labels[0], baseline[0], baseline_threshold),
        'validation': summarize(labels[1], baseline[1], baseline_threshold),
        'holdout': summarize(labels[2], baseline[2], baseline_threshold),
        'holdout_error_cohorts': error_cohorts(holdout, baseline[2], baseline_threshold),
        'threshold_sensitivity': score_sensitivity(baseline_sensitivity, labels[2], baseline[2])}
    x_holdout = transform(holdout)
    results = {}
    for candidate_name, model in models.items():
        scores = model.predict_proba(x_holdout)[:, 1]
        threshold = selections[candidate_name]['threshold'] if selections[candidate_name] else 1.
        results[candidate_name] = {
            'selected_on_validation': candidate_name == selected,
            'training': summarize(labels[0], train_scores[candidate_name], threshold),
            'validation': summarize(labels[1], validation_scores[candidate_name], threshold),
            'holdout': summarize(labels[2], scores, threshold),
            'holdout_error_cohorts': error_cohorts(holdout, scores, threshold),
            'threshold_sensitivity': score_sensitivity(sensitivity[candidate_name], labels[2], scores),
            'paired_holdout_delta_vs_baseline': cluster_bootstrap_delta(holdout, labels[2], scores, threshold, baseline[2], baseline_threshold),
        }
    if digest(lock_path) != lock_hash:
        raise ValueError('Validation lock changed during holdout scoring.')
    return {'source_dataset_sha256': digest(dataset), 'baseline_manifest_sha256': digest(Path(baseline_directory) / 'manifest.json'),
        'baseline_holdout_sha256': manifest['holdout_sha256'], 'prepared_dataset_sha256': manifest['dataset_sha256'],
        'counts': manifest['counts'], 'evaluation_protocol': manifest['evaluation_protocol'],
        'source': manifest['provenance'].get('source', manifest['provenance'].get('repository')),
        'validation_lock_sha256': lock_hash, 'selected_candidate': selected,
        'candidate_artifact': artifact,
        'representation': representation, 'baseline': baseline_report, 'candidates': results}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=pipeline.ROOT / 'ml/artifacts/quality-study')
    parser.add_argument('--evidence', type=Path, default=pipeline.ROOT / 'docs/evidence/model-quality-study.json')
    args = parser.parse_args()
    start = time.perf_counter()
    import sklearn
    args.output.mkdir(parents=True, exist_ok=True)
    pipeline.write_json(args.output / 'prespecified-plan.json', PLAN)
    report = {'scope': 'offline research comparison only', 'production_eligible': False,
        'recorded_at': datetime.now(timezone.utc).isoformat(),
        'plan': PLAN, 'plan_sha256': object_digest(PLAN), 'implementation_sha256': digest(__file__),
        'environment': {'numpy': np.__version__, 'scikit_learn': sklearn.__version__, 'seed': 42},
        'limitations': [
            'Both historical holdouts have previously been inspected. This is descriptive reuse, not independent confirmation or a production promotion claim.',
            'No new external dataset or independently adjudicated live outcomes were collected; the study never fetches targets.',
            'PhreshPhish scope is phishing only; archived ScamFerret remains isolated store/investment/crypto research.',
            'Thresholds and candidate selection share validation; validation estimates are optimistic. Candidates use uncalibrated scores, while baseline used validation sigmoid calibration; Brier scores are not a fair calibration improvement comparison.',
            'Wilson intervals treat rows as independent and are descriptive. Paired bootstrap clusters connected domains/campaigns but does not capture cross-domain unknown campaigns, source drift or tuning uncertainty.',
            'Archived missingness can reflect upstream acquisition choices; imputation does not establish historical capture times or remove source/label bias.',
            'Sensitivity thresholds are all fixed from validation, and their holdout results cannot be used to choose a production threshold.',
            'Richer URL representation requires a new deployment format and independent confirmation; existing production bundle/schema/promotion eligibility are unchanged.',
        ], 'experiments': {}}
    for name, dataset, baseline in (
        ('phreshphish', 'ml/data/phreshphish.csv', 'ml/artifacts/phreshphish-v2'),
        ('scamferret', 'ml/data/scamferret/dataset.jsonl', 'ml/artifacts/scamferret/url-content-v2'),
    ):
        print(json.dumps({'experiment': name, 'stage': 'reconstruct_and_fit'}), flush=True)
        report['experiments'][name] = run_experiment(name, pipeline.ROOT / dataset, pipeline.ROOT / baseline, args.output)
        result = report['experiments'][name]
        print(json.dumps({'experiment': name, 'selected_candidate': result['selected_candidate'],
                          'holdout': result['candidates'][result['selected_candidate']]['holdout'] if result['selected_candidate'] else None}), flush=True)
    report['elapsed_seconds'] = round(time.perf_counter()-start, 3)
    report['conclusions'] = {
        'phreshphish': 'The validation-selected character-plus-lexical candidate improves descriptive recall and precision on the identical historical holdout. Its train/validation gap remains large, its global FPR interval includes 2%, and HTTP legitimate false positives remain severe. This supports richer URL representation as a research direction, not production eligibility or confirmed live-site improvement.',
        'scamferret': 'Missingness-aware capacity restriction reduces descriptive false positives but loses recall, fails the 2% holdout FPR budget, and retains cryptocurrency false positives. It does not establish an overall model improvement. Archived acquisition/label biases and unknown capture times remain unresolved.',
        'next_confirmation_required': 'Freeze candidate, representation, global threshold and HTTP/crypto acceptance cohorts before collecting a new independently adjudicated domain-disjoint, later-period confirmation set; preserve source and label independence. Do not select among sensitivity thresholds using these holdout results.',
        'production_decision': 'Retain existing production bundle and research-only archived scam scope. No deployment-format, schema, allowlist or promotion changes are made.'}
    pipeline.write_json(args.evidence, report)


if __name__ == '__main__':
    main()
