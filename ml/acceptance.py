"""Development regressions, separate from the frozen accuracy holdout."""
import math
from pipeline import extract_batch

# Known benign development cases; no network calls, allowlist, or fitted exceptions.
PROBES = ['https://example.com/', 'https://www.example.com/',
          'https://example.com/login', 'https://www.example.com/login',
          'https://github.com/login', 'https://www.github.com/login',
          'https://accounts.google.com/signin', 'https://www.accounts.google.com/signin']


def check_predictions(probabilities, threshold):
    if (not probabilities or len(probabilities) % 2 or not 0 < threshold <= 1
            or any(not math.isfinite(p) or not 0 <= p <= 1 or p >= threshold for p in probabilities)
            or any(abs(a-b) > 1e-12 for a, b in zip(probabilities[::2], probabilities[1::2]))):
        raise ValueError('Development regression: www sampling dependence or known benign URL flagged. Do not tune on the frozen holdout.')


def development_acceptance(manifest, model):
    features = extract_batch(PROBES, schema_version=manifest['feature_schema']['version'])
    names = manifest['feature_schema']['features']
    probabilities = model.predict_proba([[r['features'][n] for n in names] for r in features])[:, 1].tolist()
    check_predictions(probabilities, manifest['threshold'])
    return {'passed': True, 'purpose': 'Development regression only, not an accuracy estimate or a safety guarantee.',
            'cases': [{'url': url, 'probability': p} for url, p in zip(PROBES, probabilities)]}
