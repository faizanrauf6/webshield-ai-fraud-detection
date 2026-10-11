import unittest
from ablations import require_observations
from schemas import feature_schema
from pipeline import extract_batch


class AblationTests(unittest.TestCase):
    def historical_row(self):
        time = '2020-01-01T00:00:00Z'
        return {'url': 'https://example.com/', 'first_seen_at': time, 'observations': {
            'asOf': time,
            'domain': {'hostname': 'example.com', 'observedAt': time, 'addresses': ['8.8.8.8'],
                       'ageDays': None, 'registeredAt': None, 'rdapStatus': 'unavailable'},
            'content': {'url': 'https://example.com/', 'finalUrl': 'https://example.com/',
                        'observedAt': time, 'text': '', 'title': '', 'forms': [],
                        'redirects': [], 'linkDomains': [], 'iframeCount': 0},
            'providers': [{'source': 'fixture', 'checkedAt': time, 'expiresAt': '2022-01-01T00:00:00Z',
                           'status': 'completed', 'reportedMalicious': False, 'detail': 'fixture'}]}}

    def test_historical_assessment_cannot_postdate_labeled_observation(self):
        row = self.historical_row()
        row['observations']['asOf'] = '2021-01-01T00:00:00Z'
        with self.assertRaises(ValueError):
            require_observations([row])

    def test_usable_groups_allow_other_rows_to_preserve_missingness(self):
        require_observations([self.historical_row(), {'url': 'https://other.example/', 'observations': {}}])

    def test_empty_historical_groups_do_not_enable_ablation_claims(self):
        for observations in ({'domain': None, 'content': None, 'providers': []},
                             {'domain': {}, 'content': {}, 'providers': []}):
            with self.subTest(observations=observations), self.assertRaises(ValueError):
                require_observations([{'url': 'https://example.com/', 'observations': observations}])

    def test_missing_historical_snapshots_cannot_be_presented_as_hybrid_evaluation(self):
        with self.assertRaises(ValueError):
            require_observations([{'url': 'https://example.com/', 'label': 0}])

    def test_hybrid_schema_and_features_match_typescript(self):
        result = extract_batch([{'url': 'https://example.com/', 'observations': {}}], schema_version='hybrid-v1')[0]
        self.assertEqual(list(result['features']), feature_schema('hybrid-v1')['features'])
        self.assertEqual(result['features']['domain_available'], 0)
        self.assertEqual(result['features']['threat_available'], 0)
