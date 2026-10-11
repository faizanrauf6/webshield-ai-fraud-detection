"""Trusted-local model inference. JSON input only; never accepts a model from a URL."""
import argparse
import hashlib
import io
import json
import math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_bundle(directory):
    root = Path(directory).resolve()
    manifest = json.loads((root / 'manifest.json').read_text())
    from schemas import feature_schema
    schema = feature_schema(manifest.get('feature_schema', {}).get('version'))
    if (manifest.get('bundle_version') != 1 or manifest.get('synthetic') is not False
            or manifest.get('scope') != 'phishing' or manifest.get('feature_schema') != schema
            or not isinstance(manifest.get('model_version'), str) or not manifest['model_version']
            or not isinstance(manifest.get('threshold'), (int, float))
            or not 0 < manifest['threshold'] <= 1):
        raise ValueError('Invalid, synthetic, or incompatible production bundle.')
    artifact = manifest['artifacts'][manifest['selected_model']]
    path = (root / artifact['file']).resolve()
    if path.parent != root:
        raise ValueError('Artifact must be inside the trusted bundle.')
    data = path.read_bytes()
    if len(data) > 100_000_000 or hashlib.sha256(data).hexdigest() != artifact['sha256']:
        raise ValueError('Altered or oversized model artifact.')
    # Hashes detect alteration, not hostile replacement of manifest and file together.
    # Only deserialize locally trained artifacts in an owner-controlled directory.
    import joblib
    return manifest, joblib.load(io.BytesIO(data))


def predict(directory, features):
    manifest, model = load_bundle(directory)
    names = manifest['feature_schema']['features']
    if (not isinstance(features, dict) or set(features) != set(names)
            or any(isinstance(features[n], bool) or not isinstance(features[n], (int, float))
                   or not math.isfinite(features[n]) for n in names)):
        raise ValueError('Features must exactly match the installed schema and be finite.')
    if list(model.classes_) != [0, 1]:
        raise ValueError('Unexpected model classes.')
    probability = float(model.predict_proba([[features[n] for n in names]])[0, 1])
    if not math.isfinite(probability) or not 0 <= probability <= 1:
        raise ValueError('Invalid model estimate.')
    return {'probability': probability, 'threshold': manifest['threshold'],
            'modelVersion': manifest['model_version'], 'featureVersion': manifest['feature_schema']['version'],
            'scope': manifest['scope'], 'observedAt': datetime.now(timezone.utc).isoformat()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bundle', type=Path, required=True)
    args = parser.parse_args()
    import sys
    try:
        request = sys.stdin.read(32769)
        if len(request) > 32768:
            raise ValueError('Oversized inference input.')
        print(json.dumps(predict(args.bundle, json.loads(request)), allow_nan=False))
    except Exception:
        # A missing runtime, artifact or feature is unavailable, never a clean result.
        print(json.dumps({'unavailable': True}))
        sys.exit(1)


if __name__ == '__main__':
    main()
