"""Research importer boundary tests; no network or target websites involved."""
import gzip
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch

from scamferret import (PUBLICATION_UPPER_BOUND, SourceError, archived_content,
                       blob_sha, download_tree, parse_whois, public_provenance,
                       read_bounded_gzip, snapshot_path, verify_blob, COMMIT)
from scam_evaluation import category_metrics, validate_research_rows


class ScamFerretTests(unittest.TestCase):
    def whois(self, raw, action='RetrieveWHOIS'):
        return [{'action': action, 'action_input': 'example.com',
                 'observation': repr({'domain': 'example.com', 'raw': raw})}]

    def test_whois_age_uses_recorded_reference_time(self):
        result = parse_whois(self.whois([
            'Creation Date: 2024-01-01T00:00:00Z',
            '>>> Last update of WHOIS database: 2024-02-01T00:00:00Z <<<']), 'example.com')
        self.assertEqual(result['ageDays'], 31)
        self.assertEqual(result['observedAt'], '2024-02-01T00:00:00Z')
        self.assertEqual(result['addresses'], [])
        self.assertEqual(result['rdapStatus'], 'unavailable')

    def test_whois_missing_reference_does_not_use_today_or_publication(self):
        self.assertIsNone(parse_whois(self.whois(['Creation Date: 2024-01-01T00:00:00Z']), 'example.com'))

    def test_no_llm_judgments_search_or_wrong_domain_used(self):
        raw = ['Creation Date: 2024-01-01T00:00:00Z',
               'Last update of WHOIS database: 2024-02-01T00:00:00Z']
        self.assertIsNone(parse_whois(self.whois(raw, 'FinalAnswer'), 'example.com'))
        self.assertIsNone(parse_whois(self.whois(raw), 'other.example'))
        self.assertIsNone(parse_whois([{'action': 'RetrieveWHOIS', 'observation': "__import__('os').system('false')"}], 'example.com'))

    def test_reversed_or_future_dates_are_unavailable(self):
        self.assertIsNone(parse_whois(self.whois([
            'Creation Date: 2024-03-01T00:00:00Z',
            'Last update of WHOIS database: 2024-02-01T00:00:00Z']), 'example.com'))
        self.assertIsNone(parse_whois(self.whois([
            'Creation Date: 2024-01-01T00:00:00Z',
            'Last update of WHOIS database: 2026-02-01T00:00:00Z']), 'example.com'))

    def test_gzip_expansion_is_bounded(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'snapshot.gz'
            path.write_bytes(gzip.compress(b'x' * 101))
            with self.assertRaises(SourceError):
                read_bounded_gzip(path, limit=100)
            self.assertEqual(read_bounded_gzip(path, limit=101), b'x' * 101)

    def test_git_blob_verification_is_not_plain_sha1(self):
        body = b'example'
        sha = hashlib.sha1(b'blob 7\0example').hexdigest()
        self.assertEqual(blob_sha(body), sha)
        verify_blob(body, {'sha': sha, 'size': len(body)})
        with self.assertRaises(SourceError):
            verify_blob(body + b'!', {'sha': sha, 'size': len(body)})

    def test_static_parser_does_not_execute_scripts_or_invent_redirects(self):
        html = b'<title>Archived</title><script>throw Error("executed")</script><p>guaranteed returns</p>'
        result = archived_content(html, 'https://example.com/')
        self.assertEqual(result['title'], 'Archived')
        self.assertNotIn('executed', result['text'])
        self.assertEqual(result['observedAt'], PUBLICATION_UPPER_BOUND)
        self.assertEqual(result['redirects'], [])

    def test_upstream_snapshot_filename_www_convention_is_not_redirect_history(self):
        prefix = 'dataset/scam_websites/online_shopping_english'
        bare = prefix + '/toppage_html/example.com.html.gz'
        exact = prefix + '/toppage_html/www.example.com.html.gz'
        self.assertEqual(snapshot_path(prefix, 'www.example.com', {bare: {}}), bare)
        self.assertEqual(snapshot_path(prefix, 'www.example.com', {bare: {}, exact: {}}), exact)
        self.assertNotEqual(snapshot_path(prefix, 'wallet.example.com', {bare: {}}), bare)

    def test_tree_download_uses_pinned_metadata_endpoint_and_rejects_truncation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'tree.json'
            response = MagicMock()
            response.__enter__.return_value = response
            response.geturl.return_value = f'https://api.github.com/repos/ScamFerret/artifact/git/trees/{COMMIT}?recursive=1'
            response.read.return_value = json.dumps({'sha': COMMIT, 'truncated': True, 'tree': []}).encode()
            with patch('scamferret.build_opener') as opener:
                opener.return_value.open.return_value = response
                with self.assertRaises(SourceError):
                    download_tree(path)
                self.assertFalse(path.exists())
                response.read.return_value = json.dumps({'sha': COMMIT, 'truncated': False, 'tree': []}).encode()
                self.assertEqual(download_tree(path), path)
                request = opener.return_value.open.call_args.args[0]
                self.assertEqual(request.full_url, response.geturl.return_value)

    def test_public_provenance_omits_target_hosts_and_raw_inventory(self):
        provenance = {'repository': 'https://github.com/ScamFerret/artifact', 'pinned_commit': COMMIT,
            'counts': {'retained_rows': 1}, 'source_files': [{'path': 'raw/private-target.example.html.gz'}],
            'download_failures': {'private-target.example': 'error'},
            'exclusions': [{'category': 'cryptocurrency', 'label': 1, 'reason': 'duplicate normalized URL'}]}
        result = public_provenance(provenance, b'full local provenance')
        self.assertNotIn('private-target.example', json.dumps(result))
        self.assertEqual(result['source_inventory']['files'], 1)
        self.assertEqual(len(result['source_inventory']['sha256']), 64)

    def test_category_report_uses_one_fixed_validation_threshold(self):
        rows = [{'category': category, 'label': label}
                for category in ('investment', 'cryptocurrency') for label in (0, 1)]
        report = category_metrics(rows, [0.6, 0.9, 0.8, 0.7], 0.75)
        self.assertEqual(report['investment']['confusion_matrix'], [[1, 0], [0, 1]])
        self.assertEqual(report['cryptocurrency']['confusion_matrix'], [[0, 1], [1, 0]])
        self.assertTrue(all(metrics['threshold'] == 0.75 for metrics in report.values()))

    def test_research_rows_cannot_claim_temporal_or_full_hybrid_evidence(self):
        row = {'url': 'https://example.com/', 'label': 0, 'category': 'investment',
               'first_seen_at': '', 'observations': {'asOf': PUBLICATION_UPPER_BOUND,
                   'content': archived_content(b'archive', 'https://example.com/'), 'providers': [],
                   'domain': {'hostname': 'example.com', 'ageDays': 31}},
               'archive_metadata': {'content_timestamp_semantics': 'artifact-publication-upper-bound'}}
        validate_research_rows([row])
        for changed in ({**row, 'first_seen_at': PUBLICATION_UPPER_BOUND},
                        {**row, 'observations': {**row['observations'], 'providers': [{'status': 'completed'}]}}):
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                validate_research_rows([changed])


if __name__ == '__main__':
    unittest.main()
