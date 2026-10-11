"""Compare cumulative feature groups on supplied historical snapshots only."""
import argparse
import json
from pathlib import Path
import pipeline


def require_observations(rows):
    if not rows or any(not isinstance(r.get('observations'), dict) for r in rows):
        raise ValueError('Hybrid experiments require historical observations for every row; current websites must not reconstruct benchmark history.')
    for row in rows:
        if any(row['observations'].get(n) for n in ('domain', 'content', 'providers')) and not row['observations'].get('asOf'):
            raise ValueError('Historical snapshots require their assessment time.')
        assessment = row['observations'].get('asOf')
        if assessment and row.get('first_seen_at') and pipeline.parse_date(assessment) > pipeline.parse_date(row['first_seen_at']):
            raise ValueError('Historical assessment cannot postdate the labeled observation.')
    for name in ('domain', 'content', 'providers'):
        if not any(r['observations'].get(name) for r in rows):
            raise ValueError(f'No historical {name} observations supplied; this ablation is unavailable.')
    extracted = pipeline.extract_batch([{'url': r['url'], 'observations': r['observations']} for r in rows], schema_version='hybrid-v1')
    for group in ('domain', 'content', 'threat'):
        if not any(r['features'][group + '_available'] for r in extracted):
            raise ValueError(f'No usable historical {group} observations supplied.')


def run_ablations(rows, directory, split='temporal', validation_start=None, test_start=None, provenance=None, synthetic=False):
    require_observations(rows)
    original = pipeline.ARTIFACTS
    results = {}
    try:
        for version in ('lexical-v1', 'url-domain-v1', 'url-content-v1', 'hybrid-v1'):
            pipeline.ARTIFACTS = Path(directory) / version
            pipeline.train(rows, validation_start, test_start, split_protocol=split,
                           provenance=provenance, synthetic=synthetic, schema_version=version)
            results[version] = pipeline.evaluate()
        pipeline.write_json(Path(directory) / 'ablations.json', results)
    finally:
        pipeline.ARTIFACTS = original
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', type=Path, required=True, help='JSONL rows with reviewed labels and historical observations')
    parser.add_argument('--output', type=Path, default=Path('ml/artifacts/ablations'))
    parser.add_argument('--split', choices=['group', 'temporal'], default='temporal')
    parser.add_argument('--validation-start')
    parser.add_argument('--test-start')
    parser.add_argument('--provenance', type=Path, required=True)
    args = parser.parse_args()
    rows = [json.loads(line) for line in args.dataset.read_text().splitlines() if line.strip()]
    run_ablations(rows, args.output, args.split, args.validation_start, args.test_start,
                  json.loads(args.provenance.read_text()))
