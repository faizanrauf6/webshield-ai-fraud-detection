import json
import tempfile
import unittest
from pathlib import Path
import pipeline
from promotion import promote


class TrainingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.old = pipeline.ARTIFACTS
        pipeline.ARTIFACTS = Path(self.temp.name) / 'artifacts'
        self.addCleanup(setattr, pipeline, 'ARTIFACTS', self.old)

    def test_selection_is_frozen_before_holdout_and_synthetic_promotion_is_rejected(self):
        pipeline.train(pipeline.synthetic_rows(), '2026-02-01', '2026-03-01', synthetic=True)
        manifest = json.loads((pipeline.ARTIFACTS / 'manifest.json').read_text())
        self.assertIn('selected_model', manifest)
        self.assertEqual(manifest['selection_partition'], 'validation')
        pipeline.evaluate()
        self.assertEqual(json.loads((pipeline.ARTIFACTS / 'manifest.json').read_text())['selected_model'], manifest['selected_model'])
        with self.assertRaises(ValueError):
            promote(pipeline.ARTIFACTS, Path(self.temp.name) / 'production')

    def test_group_training_accepts_unknown_dates_without_claiming_temporal_evaluation(self):
        rows = pipeline.synthetic_rows()
        for row in rows:
            row['first_seen_at'] = ''
        pipeline.train(rows, None, None, synthetic=True, split_protocol='group')
        manifest = json.loads((pipeline.ARTIFACTS / 'manifest.json').read_text())
        self.assertEqual(manifest['evaluation_protocol'], 'group-disjoint')
        self.assertIsNone(manifest['validation_start'])
