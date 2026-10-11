import unittest
from selection import grouped_split, select_threshold
from benchmark import map_label


class SelectionTests(unittest.TestCase):
    def test_uci_labels_are_inverted_without_inventing_dates(self):
        self.assertEqual(map_label('1'), 0)
        self.assertEqual(map_label('0'), 1)
        with self.assertRaises(ValueError):
            map_label('unknown')

    def test_connected_campaigns_and_domains_never_cross_group_partitions(self):
        rows = [{'domain': f'{i}.example', 'campaign_or_domain_group': f'g{i}', 'label': i % 2} for i in range(200)]
        rows[1]['domain'] = rows[0]['domain']
        rows[2]['campaign_or_domain_group'] = rows[1]['campaign_or_domain_group']
        partitions = grouped_split(rows)
        membership = {id(r): i for i, p in enumerate(partitions) for r in p}
        self.assertEqual(membership[id(rows[0])], membership[id(rows[2])])
        for key in ['domain', 'campaign_or_domain_group']:
            sets = [{r[key] for r in p} for p in partitions]
            self.assertTrue(all(not sets[i] & sets[j] for i in range(3) for j in range(i)))
        self.assertEqual(partitions, grouped_split(rows))

    def test_threshold_maximizes_validation_recall_under_false_positive_limit(self):
        result = select_threshold([0, 0, 1, 1], [0.1, 0.8, 0.7, 0.9], max_fpr=0)
        self.assertEqual(result['threshold'], 0.9)
        self.assertEqual(result['false_positive_rate'], 0)
        self.assertEqual(result['recall'], 0.5)

    def test_impossible_threshold_is_not_promoted(self):
        self.assertIsNone(select_threshold([0, 1], [1.0, 0.5], max_fpr=0))

    def test_bad_probability_and_single_class_validation_are_rejected(self):
        for labels, values in [([0, 1], [0.1, float('nan')]), ([0, 0], [0.2, 0.3])]:
            with self.assertRaises(ValueError):
                select_threshold(labels, values)
