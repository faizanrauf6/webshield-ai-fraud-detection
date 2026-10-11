import unittest
from acceptance import check_predictions


class AcceptanceTests(unittest.TestCase):
    def test_sampling_shortcut_and_known_false_positive_prevent_promotion(self):
        with self.assertRaises(ValueError):
            check_predictions([0.1, 0.2, 0.1, 0.1], 0.5)
        with self.assertRaises(ValueError):
            check_predictions([0.6, 0.6, 0.1, 0.1], 0.5)

    def test_checks_are_regressions_not_an_accuracy_claim(self):
        check_predictions([0.4, 0.4, 0.3, 0.3], 0.5)
