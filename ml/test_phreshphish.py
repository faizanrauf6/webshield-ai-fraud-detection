import unittest
from phreshphish import prepare_metadata


class PhreshPhishTests(unittest.TestCase):
    def row(self, url='https://example.com/', label='benign', date='2025-08-03'):
        return {'url': url, 'label': label, 'date': date}

    def test_dates_labels_and_www_are_preserved_without_visiting_urls(self):
        rows, exclusions = prepare_metadata([self.row(), self.row('https://www.example.com/login', 'phish')])
        self.assertEqual([r['label'] for r in rows], [0, 1])
        self.assertEqual(rows[0]['first_seen_at'], '2025-08-03')
        self.assertEqual(rows[1]['url'], 'https://www.example.com/login')
        self.assertEqual(exclusions['unsupported_url'], 0)

    def test_conflicts_are_removed_and_earliest_real_date_is_retained(self):
        rows, exclusions = prepare_metadata([self.row(), self.row(date='2025-08-01'),
            self.row('https://other.com/', 'benign'), self.row('https://other.com/#copy', 'phish')])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['first_seen_at'], '2025-08-01')
        self.assertEqual(exclusions['conflicting_canonical_urls'], 1)

    def test_invalid_dates_labels_and_unsafe_urls_are_excluded(self):
        rows, exclusions = prepare_metadata([self.row('http://127.0.0.1/'),
            self.row(label='uncertain'), self.row(date='unknown')])
        self.assertEqual(rows, [])
        self.assertEqual(sum(exclusions.values()), 3)
