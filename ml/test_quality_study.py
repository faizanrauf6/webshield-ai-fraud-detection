"""Guard research partition isolation and uncertainty reporting."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import numpy as np

import quality_study as study


class QualityStudyTests(unittest.TestCase):
    def test_wilson_interval_and_empty_denominator(self):
        low, high = study.wilson_interval(0, 110)
        self.assertEqual(low, 0)
        self.assertGreater(high, .03)
        self.assertIsNone(study.wilson_interval(0, 0))

    def test_archived_unknown_content_and_age_are_missing_not_zero(self):
        names = ['https', 'domain_age_days', 'dns_address_count', 'redirect_count',
                 'cross_domain_redirects', 'content_available', 'domain_age_known', 'crypto_present']
        row = {'features': dict(zip(names, [1, 0, 0, 0, 0, 0, 0, 0]))}
        before = copy.deepcopy(row)
        matrix, retained = study.archived_matrix([row], names)
        self.assertNotIn('dns_address_count', retained)
        self.assertNotIn('redirect_count', retained)
        self.assertTrue(np.isnan(matrix[0, retained.index('domain_age_days')]))
        self.assertTrue(np.isnan(matrix[0, retained.index('crypto_present')]))
        self.assertEqual(row, before)

    def test_validation_selection_has_no_holdout_argument(self):
        candidates = {'a': np.array([.1, .2, .3, .8]), 'b': np.array([.4, .1, .8, .9])}
        labels = np.array([0, 0, 1, 1])
        selected, locked = study.select_candidates(labels, candidates)
        self.assertEqual(selected, 'b')
        self.assertEqual(locked['b']['threshold'], .8)
        self.assertEqual(locked['b']['false_positive_rate'], 0)
        self.assertEqual(locked['b']['recall'], 1)

    def test_sensitivity_uses_validation_thresholds_on_holdout(self):
        result = study.threshold_sensitivity([0, 0, 1, 1], [.1, .2, .15, .9],
                                             [0, 1], [.8, .7])
        # With zero validation false positives, threshold .9, not .7 from holdout.
        self.assertEqual(result['0.02']['threshold'], .9)
        self.assertEqual(result['0.02']['holdout']['recall'], 0)
        self.assertEqual(result['0.02']['holdout']['false_positive_rate'], 0)

    def test_group_bootstrap_preserves_shared_domain_clusters(self):
        rows = [{'domain': 'shared.test'}, {'domain': 'shared.test'}, {'domain': 'other.test'}]
        result = study.cluster_bootstrap_delta(rows, [1, 1, 0], [.8, .8, .1], .5,
                                              [.8, .8, .1], .5, repetitions=30)
        self.assertEqual(result['recall_delta_95_interval'], [0, 0])
        self.assertEqual(result['false_positive_rate_delta_95_interval'], [0, 0])
        self.assertEqual(result['group_count'], 2)

    def test_partition_guard_rejects_shared_domain(self):
        with self.assertRaisesRegex(ValueError, 'overlap'):
            study.assert_disjoint([[{'domain': 'a', 'campaign_or_domain_group': 'x'}],
                                   [{'domain': 'a', 'campaign_or_domain_group': 'y'}], []])

    def test_validation_values_do_not_fit_imputer_scaler_or_estimator(self):
        names = ['https', 'domain_age_days', 'domain_age_known', 'content_available', 'crypto_present']
        training = [{'label': i % 2, 'features': dict(zip(names, [1, 100+i, 1, 1, i % 2]))}
                    for i in range(30)]
        validation_a = copy.deepcopy(training[:4])
        validation_b = copy.deepcopy(validation_a)
        for row in validation_b:
            row['label'] = 1-row['label']
            row['features']['domain_age_days'] = 1000000
            row['features']['crypto_present'] = 0
        a = study.fit_candidates(training, validation_a, names, archived=True)[0]['missingness_logistic_c01']
        b = study.fit_candidates(training, validation_b, names, archived=True)[0]['missingness_logistic_c01']
        np.testing.assert_array_equal(a[0].statistics_, b[0].statistics_)
        np.testing.assert_array_equal(a[1].mean_, b[1].mean_)
        np.testing.assert_array_equal(a[2].coef_, b[2].coef_)

    def test_all_thresholds_are_persisted_before_any_holdout_prediction(self):
        partitions = [[{'domain': f'{part}-{label}', 'label': label, 'features': {'https': 1}}
                       for label in (0, 1)] for part in range(3)]
        manifest = {'selected_model': 'baseline', 'threshold': .9,
                    'feature_schema': {'features': ['https']}, 'dataset_sha256': 'fixture',
                    'counts': {'train': 2, 'validation': 2, 'test': 2, 'purged': 0},
                    'holdout_sha256': 'fixture', 'evaluation_protocol': 'group-disjoint',
                    'provenance': {'source': 'fixture'}}
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            (directory / 'manifest.json').write_text(json.dumps(manifest))
            (directory / 'dataset.csv').write_text('fixture')

            def verify_lock():
                locked = json.loads((directory / 'scamferret-validation-lock.json').read_text())
                self.assertEqual(locked['selected_candidate'], 'candidate')
                self.assertEqual(set(locked['baseline_sensitivity_thresholds']), {'0.005', '0.01', '0.02', '0.05'})
                self.assertEqual(set(locked['candidate_sensitivity_thresholds']['candidate']), {'0.005', '0.01', '0.02', '0.05'})

            def baseline_scores(parts, *_):
                if parts[0] is partitions[2]:
                    verify_lock()
                return [np.array([.1, .9]) for _ in parts]

            class Model:
                def predict_proba(self, matrix):
                    verify_lock()
                    return np.array([[.9, .1], [.1, .9]])

            fit = ({'candidate': Model()}, lambda rows: rows,
                   {'candidate': np.array([.1, .9])}, {'candidate': np.array([.1, .9])}, {})
            with patch.object(study, 'reconstruct', return_value=(partitions, manifest)), \
                 patch.object(study, 'fit_candidates', return_value=fit), \
                 patch.object(study, 'save_candidate', return_value={'path': 'fixture', 'sha256': 'fixture'}), \
                 patch.object(study, 'baseline_scores', side_effect=baseline_scores):
                result = study.run_experiment('scamferret', directory / 'dataset.csv', directory, directory)
            self.assertEqual(result['selected_candidate'], 'candidate')

    def test_saved_prediction_rejects_tampered_bundle_before_loading(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'tampered.joblib'
            artifact.write_text('not a trusted pickle')
            with self.assertRaisesRegex(ValueError, 'hash mismatch'):
                study.predict_url_candidate(artifact, ['https://example.com/'], 'wrong')


if __name__ == '__main__':
    unittest.main()
