"""Dataset safety and parity tests; fixtures are not accuracy benchmarks."""
import json
import subprocess
import unittest
from pathlib import Path

from pipeline import extract_features, prepare_rows, temporal_split

ROOT = Path(__file__).resolve().parents[1]


def row(url, label, date, group):
    return {'url': url, 'label': label, 'first_seen_at': date, 'source': 'synthetic', 'campaign_or_domain_group': group}


class PipelineTests(unittest.TestCase):
    def test_features_match_production_typescript(self):
        urls = ['https://example.com/', 'http://shop.example/books/page?q=1', 'https://xn--bcher-kva.de/a%20b', 'https://8.8.8.8/']
        command = ['node', '--import', 'tsx', '-e', "const {extractFeatures}=require('./packages/core/src/index.ts');console.log(JSON.stringify(JSON.parse(process.argv[1]).map(url=>extractFeatures(url))))", json.dumps(urls)]
        results = json.loads(subprocess.check_output(command, cwd=ROOT, text=True))
        for url, expected in zip(urls, results):
            self.assertEqual(set(extract_features(url)), set(expected))
            for name, value in expected.items():
                self.assertAlmostEqual(extract_features(url)[name], value, places=10)

    def test_bad_labels_are_rejected(self):
        with self.assertRaises(ValueError):
            prepare_rows([row('https://example.com/', 'safe-ish', '2026-01-01', 'a')])

    def test_conflicting_canonical_url_labels_are_rejected(self):
        with self.assertRaises(ValueError):
            prepare_rows([row('https://example.com/', 0, '2026-01-01', 'a'), row('https://example.com/#x', 1, '2026-01-02', 'b')])

    def test_unsafe_urls_are_not_accepted_as_training_examples(self):
        with self.assertRaises(ValueError):
            prepare_rows([row('http://127.0.0.1/', 1, '2026-01-01', 'a')])

    def test_temporal_split_purges_domain_and_campaign_overlap(self):
        rows = prepare_rows([
            row('https://a.com/x', 0, '2026-01-01', 'old-a'),
            row('https://b.com/', 1, '2026-01-02', 'campaign'),
            row('https://c.com/', 0, '2026-02-01', 'validation'),
            row('https://d.com/', 1, '2026-02-02', 'validation-d'),
            row('https://a.com/new', 1, '2026-03-01', 'new-a'),
            row('https://f.com/', 0, '2026-03-02', 'campaign'),
        ])
        train, validation, test, purged = temporal_split(rows, '2026-02-01', '2026-03-01')
        self.assertEqual(len(train), 0)
        self.assertEqual(len(validation), 2)
        self.assertEqual(len(test), 2)
        self.assertEqual(purged, 2)
        self.assertTrue(all(r['first_seen_at'] < '2026-03-01' for r in validation))

    def test_subdomains_cannot_leak_across_partitions(self):
        rows = prepare_rows([
            row('https://a.example.co.uk/', 0, '2026-01-01', 'a'),
            row('https://b.example.co.uk/', 1, '2026-03-01', 'b'),
        ])
        train, _, test, purged = temporal_split(rows, '2026-02-01', '2026-03-01')
        self.assertEqual(len(train), 0)
        self.assertEqual(len(test), 1)
        self.assertEqual(purged, 1)

    def test_duplicate_urls_cannot_discard_campaign_links(self):
        with self.assertRaises(ValueError):
            prepare_rows([
                row('https://alpha.com/', 0, '2026-01-01', 'A'),
                row('https://alpha.com/#copy', 0, '2026-01-02', 'B'),
                row('https://beta.com/', 1, '2026-03-01', 'B'),
            ])

    def test_duplicate_dates_keep_earliest_first_seen(self):
        rows = prepare_rows([
            row('https://alpha.com/', 0, '2026-03-01', 'A'),
            row('https://alpha.com/#copy', 0, '2026-01-01', 'A'),
        ])
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]['first_seen_at'].startswith('2026-01-01'))

    def test_split_dates_must_be_ordered(self):
        with self.assertRaises(ValueError):
            temporal_split([], '2026-03-01', '2026-02-01')


if __name__ == '__main__':
    unittest.main()
