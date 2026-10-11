"""Promote only evaluated real-data bundles; publish the manifest last."""
import argparse
import hashlib
import json
import os
import shutil
from pathlib import Path
from inference import load_bundle


def promote(artifacts, destination):
    artifacts, destination = Path(artifacts), Path(destination)
    manifest, model = load_bundle(artifacts)
    report_path = artifacts / 'evaluation.json'
    if hashlib.sha256(report_path.read_bytes()).hexdigest() != manifest.get('evaluation_sha256'):
        raise ValueError('A matching frozen holdout evaluation is required before promotion.')
    report = json.loads(report_path.read_text())
    if (report.get('synthetic') is not False or report.get('dataset_sha256') != manifest['dataset_sha256']
            or not manifest.get('provenance') or not manifest.get('evaluated_at')
            or manifest.get('selection_partition') != 'validation'
            or manifest['validation_selection'][manifest['selected_model']]['recall'] <= 0):
        raise ValueError('Only a real, documented, validated experiment may be promoted.')
    from acceptance import development_acceptance
    manifest['development_acceptance'] = development_acceptance(manifest, model)
    selected = manifest['artifacts'][manifest['selected_model']]
    destination.mkdir(parents=True, exist_ok=True)
    filename = selected['sha256'][:16] + '.joblib'
    shutil.copyfile(artifacts / selected['file'], destination / filename)
    manifest['artifacts'] = {manifest['selected_model']: {**selected, 'file': filename}}
    manifest['metrics'] = report['models']
    pending = destination / 'manifest.pending'
    pending.write_text(json.dumps(manifest, indent=2, allow_nan=False) + '\n')
    os.replace(pending, destination / 'manifest.json')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--artifacts', type=Path, default=Path('ml/artifacts'))
    parser.add_argument('--destination', type=Path, default=Path('ml/production'))
    args = parser.parse_args()
    result = promote(args.artifacts, args.destination)
    print(json.dumps({'model_version': result['model_version'], 'selected_model': result['selected_model'], 'threshold': result['threshold']}))
