"""Offline scam research ablations on published ScamFerret snapshots.

Research artifacts are isolated from production. Publication upper-bound dates
must never become invented first-seen/capture dates or temporal split claims.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import pipeline
from scamferret import (CATEGORIES, COMMIT, PUBLICATION_UPPER_BOUND,
                       SOURCE_METADATA_AUDIT, public_provenance)

SCHEMAS = ('lexical-v2', 'url-domain-v2', 'url-content-v2')
SCOPE = 'scam-research-store-investment-cryptocurrency'
PURPOSE = 'Offline archived scam research only; NOT production eligible or a phishing benchmark.'


def validate_research_rows(rows):
    if not rows:
        raise ValueError('Research dataset is empty.')
    for row in rows:
        if row.get('category') not in CATEGORIES or row.get('first_seen_at'):
            raise ValueError('ScamFerret capture/first-seen dates are unknown; only grouped research split is supported.')
        observation = row.get('observations', {})
        if observation.get('providers') or observation.get('asOf') != PUBLICATION_UPPER_BOUND:
            raise ValueError('No historical provider evidence exists; assessment is the pinned publication upper bound.')
        if row.get('archive_metadata', {}).get('content_timestamp_semantics') != 'artifact-publication-upper-bound':
            raise ValueError('Missing explicit upper-bound date semantics.')
        if observation.get('content') and observation['content'].get('observedAt') != PUBLICATION_UPPER_BOUND:
            raise ValueError('Content date must retain publication-upper-bound semantics.')
    if not any(row['observations'].get('domain') for row in rows):
        raise ValueError('No usable recorded WHOIS ages; domain ablation is unavailable.')
    if not any(row['observations'].get('content') for row in rows):
        raise ValueError('No usable static HTML; content ablation is unavailable.')


def category_metrics(rows, probabilities, threshold):
    import numpy as np
    from metrics import measure
    probabilities = np.asarray(probabilities)
    if len(rows) != len(probabilities):
        raise ValueError('Every holdout row requires its model probability.')
    results = {}
    for category in sorted({row['category'] for row in rows}):
        indices = [index for index, row in enumerate(rows) if row['category'] == category]
        labels = np.array([rows[index]['label'] for index in indices])
        results[category] = measure(labels, probabilities[indices], threshold)
        results[category]['rows'] = len(indices)
        results[category]['threshold_source'] = 'same global validation threshold; no category retuning'
    return results


def split_diagnostics(rows):
    from selection import grouped_split
    prepared = pipeline.prepare_rows(rows, allow_unknown_dates=True, schema_version='url-content-v2')
    partitions = grouped_split(prepared)
    domains = [{row['domain'] for row in part} for part in partitions]
    if any(domains[a] & domains[b] for a, b in ((0, 1), (0, 2), (1, 2))):
        raise ValueError('Registered domains overlap across research partitions.')
    diagnostics = {'seed': 42, 'registered_domain_overlap': 0, 'campaign_ids': 'unavailable; registered-domain proxy'}
    for name, partition in zip(('train', 'validation', 'test'), partitions):
        counts = {}
        for category in CATEGORIES:
            cohort = [row for row in partition if row['category'] == category]
            counts[category] = {'rows': len(cohort),
                                'legitimate': sum(row['label'] == 0 for row in cohort),
                                'scam': sum(row['label'] == 1 for row in cohort),
                                'content_available': sum(bool(row['observations'].get('content')) for row in cohort),
                                'domain_age_available': sum(bool(row['observations'].get('domain')) for row in cohort)}
        diagnostics[name] = counts
    return diagnostics


def run_research(dataset, provenance_path, output, evidence, max_fpr=0.02):
    import joblib
    import numpy as np
    rows = [json.loads(line) for line in Path(dataset).read_text().splitlines() if line.strip()]
    provenance = json.loads(Path(provenance_path).read_text())
    if provenance.get('pinned_commit') != COMMIT or provenance.get('scope') != SCOPE:
        raise ValueError('Expected pinned ScamFerret research provenance.')
    validate_research_rows(rows)
    diagnostics = split_diagnostics(rows)
    output = Path(output)
    summary = {'scope': SCOPE, 'purpose': PURPOSE, 'synthetic': False, 'production_eligible': False,
               'source_repository': provenance['repository'], 'pinned_commit': COMMIT,
               'source_metadata_audit': SOURCE_METADATA_AUDIT,
               'license': provenance['license'],
               'labeling_audit': provenance.get('labeling_audit'),
               'dataset_sha256': hashlib.sha256(Path(dataset).read_bytes()).hexdigest(),
               'provenance_sha256': hashlib.sha256(Path(provenance_path).read_bytes()).hexdigest(),
               'implementation_sha256': {str(path.relative_to(pipeline.ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
                   for path in [pipeline.ROOT / name for name in (
                       'ml/scamferret.py', 'ml/scam_evaluation.py', 'ml/pipeline.py', 'ml/selection.py', 'ml/metrics.py',
                       'scripts/features.ts', 'packages/core/src/features.ts', 'packages/core/src/observations.ts',
                       'services/analysis-worker/scanner.py')]},
               'source_counts': provenance['counts'], 'excluded_rows': len(provenance['exclusions']),
               'evaluation_protocol': 'group-disjoint; unknown collection dates; no temporal claim',
               'split_diagnostics': diagnostics, 'max_validation_fpr': max_fpr,
               'threshold_protocol': 'Model selection, sigmoid calibration and thresholds use validation only; all category thresholds fixed before test scoring.',
               'limitations': [
                   'Single published dataset; no independently adjudicated labels or external scam holdout.',
                   'Upstream manual adjudication uses content and search engines. Provider-label independence is not fully auditable; no current intelligence replay is presented as historical ground truth.',
                   'Original evaluation subset repurposed into group train/validation/test; results are not directly comparable to upstream reported performance.',
                   'Content observedAt is an artifact-publication upper bound, not capture time; first_seen_at unknown.',
                   'WHOIS age is referenced to recorded database update time; query/capture time unknown. Unsupported dates remain missing.',
                   'Archived HTML filenames sometimes omit www; that filename convention does not establish final URL or redirect history.',
                   'WHOIS coverage depends on upstream LLM tool choices and record parsing; acquisition missingness can reflect those choices.',
                   'No timestamped provider history: full hybrid-v2 and threat-feed ablation unavailable.',
                   'DNS, final URL and redirects unavailable. Empty arrays/input parser base preserve shape but unknown is conflated with absence in those feature values.',
                   'Campaign memberships unavailable: registered-domain groups do not isolate cross-domain campaigns or shared templates.',
                   'Calibration, model selection and threshold selection share the validation partition.',
                   'Small category holdouts and low-FPR estimates have sampling uncertainty; no production accuracy claim.',
               ], 'unavailable_ablations': {'hybrid-v2': 'no usable independent timestamped threat-provider history'},
               'ablations': {}}
    original = pipeline.ARTIFACTS
    holdout_signature = None
    try:
        for schema in SCHEMAS:
            pipeline.ARTIFACTS = output / schema
            pipeline.train(rows, None, None, split_protocol='group', provenance=provenance,
                           synthetic=False, schema_version=schema, max_fpr=max_fpr)
            manifest_path = pipeline.ARTIFACTS / 'manifest.json'
            manifest = json.loads(manifest_path.read_text())
            manifest.update(scope=SCOPE, purpose=PURPOSE, production_eligible=False,
                            date_semantics=provenance['date_semantics'])
            pipeline.write_json(manifest_path, manifest)
            report = pipeline.evaluate()
            report.update(scope=SCOPE, purpose=PURPOSE, production_eligible=False)
            holdout = json.loads((pipeline.ARTIFACTS / 'holdout.json').read_text())
            signature = hashlib.sha256(json.dumps([
                [row['normalized'], row['label'], row['category']] for row in holdout], sort_keys=True).encode()).hexdigest()
            if holdout_signature is not None and signature != holdout_signature:
                raise ValueError('Ablations must use exactly the same held-out observations.')
            holdout_signature = signature
            x_test = np.array([[row['features'][name] for name in manifest['feature_schema']['features']] for row in holdout])
            for name, artifact in manifest['artifacts'].items():
                path = pipeline.ARTIFACTS / artifact['file']
                if hashlib.sha256(path.read_bytes()).hexdigest() != artifact['sha256']:
                    raise ValueError('Local research model hash mismatch.')
                model = joblib.load(path)
                probabilities = model.predict_proba(x_test)[:, 1]
                threshold = manifest['validation_selection'].get(name, {}).get('threshold', 1.0)
                report['models'][name]['categories'] = category_metrics(holdout, probabilities, threshold)
            pipeline.write_json(pipeline.ARTIFACTS / 'evaluation.json', report)
            manifest = json.loads(manifest_path.read_text())
            manifest['evaluation_sha256'] = hashlib.sha256((pipeline.ARTIFACTS / 'evaluation.json').read_bytes()).hexdigest()
            pipeline.write_json(manifest_path, manifest)
            selected = manifest['selected_model']
            summary['ablations'][schema] = {
                'selected_model': selected, 'threshold': manifest['threshold'],
                'feature_schema': manifest['feature_schema'],
                'counts': manifest['counts'], 'holdout_identity_sha256': signature,
                'manifest_sha256': hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
                'validation_selection': manifest['validation_selection'],
                'selected_holdout': report['models'][selected], 'all_models': report['models']}
    finally:
        pipeline.ARTIFACTS = original
    pipeline.write_json(output / 'scamferret-ablation-summary.json', summary)
    pipeline.write_json(Path(evidence), summary)
    pipeline.write_json(Path(evidence).with_name('scamferret-provenance.json'),
                        public_provenance(provenance, Path(provenance_path).read_bytes()))
    print(json.dumps({'evidence': str(evidence), 'scope': SCOPE,
                      'ablations': {schema: {'selected_model': result['selected_model'],
                          'false_positive_rate': result['selected_holdout']['false_positive_rate'],
                          'scam_recall': result['selected_holdout']['per_class']['1']['recall']}
                                    for schema, result in summary['ablations'].items()}}, indent=2))
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset', type=Path, default=pipeline.ROOT / 'ml/data/scamferret/dataset.jsonl')
    parser.add_argument('--provenance', type=Path, default=pipeline.ROOT / 'ml/data/scamferret/provenance.json')
    parser.add_argument('--output', type=Path, default=pipeline.ROOT / 'ml/artifacts/scamferret')
    parser.add_argument('--evidence', type=Path, default=pipeline.ROOT / 'docs/evidence/scamferret-ablations.json')
    parser.add_argument('--max-fpr', type=float, default=0.02)
    args = parser.parse_args()
    run_research(args.dataset, args.provenance, args.output, args.evidence, args.max_fpr)
