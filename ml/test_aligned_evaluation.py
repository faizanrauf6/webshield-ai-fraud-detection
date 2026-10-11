import unittest
from aligned_evaluation import validate_alignment, frozen_partitions, provider_comparison, validate_frozen_candidates
import copy
import json
from pathlib import Path
import tempfile
from unittest.mock import patch
import aligned_evaluation as evaluation


class AlignedEvaluationTests(unittest.TestCase):
    def row(self, index=0, label=0):
        return {'url': f'https://site{index}.example/', 'normalized': f'https://site{index}.example/',
                'domain': f'site{index}.example', 'label': label,
                'campaign_or_domain_group': f'site{index}.example',
                'source': 'curated-official-reference' if label == 0 else 'PhishTank community verified',
                'first_seen_at': '2026-10-12T00:02:00Z',
                'label_snapshot_at': '2026-10-12T00:00:00Z',
                'collection_started_at': '2026-10-12T00:01:00Z',
                'observations': {'asOf': '2026-10-12T00:02:00Z', 'providers': [
                    {'status': 'completed', 'source': 'Google Safe Browsing',
                     'checkedAt': '2026-10-12T00:01:30Z', 'reportedMalicious': False}]}}

    def test_provider_result_cannot_be_used_as_label_source(self):
        row = self.row()
        row['source'] = 'Google Safe Browsing'
        with self.assertRaises(ValueError):
            validate_alignment([row])

    def test_future_or_expired_provider_evidence_is_rejected(self):
        for field, value in [('checkedAt', '2026-10-12T00:03:00Z'),
                             ('expiresAt', '2026-10-12T00:01:45Z')]:
            row = self.row()
            row['observations']['providers'][0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                validate_alignment([row])

    def test_label_snapshot_cannot_postdate_collection(self):
        row = self.row()
        row['label_snapshot_at'] = '2026-10-12T00:03:00Z'
        with self.assertRaises(ValueError):
            validate_alignment([row])

    def test_provider_comparison_uses_runtime_source_names_and_abstains_on_failure(self):
        rows = [self.row(0, 0), self.row(1, 1)]
        for row in rows:
            row['observations']['providers'].append({
                'source': 'OpenPhish Community Feed', 'status': 'completed',
                'reportedMalicious': row['label'] == 1})
        result = provider_comparison(rows)['OpenPhish Community Feed']
        self.assertEqual(result['coverage_rows'], 2)
        self.assertEqual(result['covered_only']['recall'], 1)
        rows[1]['observations']['providers'][1]['status'] = 'unavailable'
        result = provider_comparison(rows)['OpenPhish Community Feed']
        self.assertEqual(result['coverage_rows'], 1)
        self.assertEqual(result['all_rows_missing_as_abstention_no_alert']['recall'], 0)

    def test_clock_watermark_preserves_raw_dates_and_provider_expiry(self):
        row = self.row()
        row['observations']['content'] = {'observedAt': '2026-10-12T00:02:00.027576Z'}
        provider = row['observations']['providers'][0]
        provider['expiresAt'] = '2026-10-12T00:02:00.010Z'
        original = copy.deepcopy(row)
        rows, report = evaluation.normalize_snapshot_clocks([row])
        self.assertEqual(row, original)
        self.assertEqual(rows[0]['first_seen_at'], original['first_seen_at'])
        self.assertEqual(rows[0]['observations']['content'], original['observations']['content'])
        self.assertEqual(rows[0]['observations']['providers'][0]['status'], 'expired')
        self.assertEqual(report['affected_rows'], 1)
        self.assertAlmostEqual(report['source_skew']['content']['max_ahead_ms'], 27.576)
        validate_alignment(rows)

    def test_large_clock_skew_rejects_entire_cohort_without_dropping_rows(self):
        rows = [self.row(0), self.row(1)]
        rows[1]['observations']['content'] = {'observedAt': '2026-10-12T00:02:02Z'}
        with self.assertRaisesRegex(ValueError, 'reject the whole cohort'):
            evaluation.normalize_snapshot_clocks(rows)

    def test_missing_observations_are_retained_and_split_is_identical_for_all_stages(self):
        rows = [self.row(i, i % 2) for i in range(100)]
        validate_alignment(rows)
        a, b = frozen_partitions(rows), frozen_partitions(list(reversed(rows)))
        self.assertEqual(a, b)
        domains = [{r['domain'] for r in part} for part in a]
        self.assertFalse(domains[0] & domains[1] or domains[0] & domains[2] or domains[1] & domains[2])

    def test_frozen_label_source_and_group_cannot_be_rewritten_together(self):
        candidates = [{key: self.row()[key] for key in ('url', 'label', 'source', 'campaign_or_domain_group', 'label_snapshot_at')}]
        valid = [self.row()]
        validate_frozen_candidates(valid, candidates)
        for updates in ({'label': 1, 'source': 'PhishTank community verified'},
                        {'campaign_or_domain_group': 'changed.example'},
                        {'label_snapshot_at': '2026-10-11T23:00:00Z'}):
            tampered = copy.deepcopy(valid)
            tampered[0].update(updates)
            with self.subTest(updates=updates), self.assertRaises(ValueError):
                validate_frozen_candidates(tampered, candidates)

    def test_repeated_candidate_is_rejected_even_when_membership_matches(self):
        with self.assertRaises(ValueError):
            validate_frozen_candidates([self.row(), self.row()], [self.row()])

    def test_every_stage_and_protocol_is_locked_before_first_holdout_score(self):
        rows = [self.row(i, i % 2) for i in range(100)]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dataset = root / 'dataset.jsonl'
            dataset.write_text('\n'.join(json.dumps(r) for r in rows)+'\n')
            (root / 'candidates.json').write_text(json.dumps([
                {key:r[key] for key in ('url', 'label', 'source', 'campaign_or_domain_group', 'label_snapshot_at')} for r in rows]))
            (root / 'provenance.json').write_text(json.dumps({'purpose': 'unit test only'}))
            artifacts = root / 'artifacts'

            def verify_lock(*_):
                lock = json.loads((artifacts / 'selection-lock.json').read_text())
                self.assertEqual(set(lock['protocols']), set(evaluation.PLAN['protocols']))
                for protocol in lock['protocols'].values():
                    self.assertEqual(set(protocol['stages']), set(evaluation.STAGES))
                    for stage in protocol['stages'].values():
                        self.assertEqual(stage['validation_selection']['fixture']['threshold'], .8)
                return {}, {}

            fixture = {'selected_model': None, 'feature_schema': {}, 'artifacts': {},
                       'validation_selection': {'fixture': {'threshold': .8}}}
            with patch.object(evaluation, 'ROOT', root), patch.object(evaluation, 'DIRECTORY', root), \
                 patch.object(evaluation, 'ARTIFACTS', artifacts), \
                 patch.object(evaluation.pipeline, 'prepare_rows', return_value=rows), \
                 patch.object(evaluation, 'fit_stage', return_value=fixture) as fit, \
                 patch.object(evaluation, 'score_stage', side_effect=verify_lock) as score, \
                 patch('sys.argv', ['aligned_evaluation.py', '--dataset', str(dataset)]):
                evaluation.main()
                self.assertEqual(fit.call_count, 8)
                self.assertEqual(score.call_count, 8)


if __name__ == '__main__':
    unittest.main()
