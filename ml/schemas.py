import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def feature_schema(version):
    lexical = json.loads((ROOT / 'ml/feature_schema.json').read_text())
    groups = json.loads((ROOT / 'packages/core/src/observation-groups.json').read_text())
    stages = {'lexical-v1': [], 'url-domain-v1': ['domain'], 'url-content-v1': ['domain', 'content'],
              'hybrid-v1': ['domain', 'content', 'threat'],
              'lexical-v2': [], 'url-domain-v2': ['domain'], 'url-content-v2': ['domain', 'content'],
              'hybrid-v2': ['domain', 'content', 'threat']}
    if version not in stages:
        raise ValueError('Unknown feature schema.')
    return {'version': version, 'features': lexical['features'] + [n for group in stages[version] for n in groups[group]]}
