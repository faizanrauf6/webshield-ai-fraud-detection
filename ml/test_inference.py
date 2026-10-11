import hashlib
import json
import tempfile
import unittest
from pathlib import Path
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from inference import load_bundle, predict
from pipeline import SCHEMA


class InferenceTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        x = np.array([[0] * len(SCHEMA['features']), [1] * len(SCHEMA['features'])] * 10)
        self.estimator = LogisticRegression().fit(x, [0, 1] * 10)
        path = self.root / 'selected.joblib'
        joblib.dump(self.estimator, path)
        self.manifest = {'bundle_version': 1, 'synthetic': False, 'scope': 'phishing',
            'feature_schema': json.loads(json.dumps(SCHEMA)), 'selected_model': 'test_fixture', 'model_version': 'fixture-v1',
            'threshold': 0.6, 'metrics': {}, 'dataset_sha256': 'a' * 64,
            'artifacts': {'test_fixture': {'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}}}
        self.save()

    def save(self):
        (self.root / 'manifest.json').write_text(json.dumps(self.manifest))

    def test_prediction_matches_estimator_and_preserves_threshold(self):
        features = dict.fromkeys(SCHEMA['features'], 1.0)
        result = predict(self.root, features)
        self.assertAlmostEqual(result['probability'], self.estimator.predict_proba([[1] * len(features)])[0, 1])
        self.assertEqual(result['threshold'], 0.6)

    def test_synthetic_bundle_is_rejected_for_production(self):
        self.manifest['synthetic'] = True
        self.save()
        with self.assertRaises(ValueError):
            load_bundle(self.root)

    def test_altered_artifact_is_rejected_before_deserialization(self):
        (self.root / 'selected.joblib').write_bytes(b'changed')
        with self.assertRaises(ValueError):
            load_bundle(self.root)

    def test_wrong_schema_and_nonfinite_features_are_rejected(self):
        with self.assertRaises(ValueError):
            predict(self.root, dict.fromkeys(SCHEMA['features'], float('nan')))
        self.manifest['feature_schema']['version'] = 'wrong'
        self.save()
        with self.assertRaises(ValueError):
            load_bundle(self.root)

    def test_artifact_path_cannot_escape_bundle(self):
        self.manifest['artifacts']['test_fixture']['file'] = '../outside.joblib'
        self.save()
        with self.assertRaises(ValueError):
            load_bundle(self.root)
