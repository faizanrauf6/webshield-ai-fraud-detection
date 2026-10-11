"""Measured classification and calibration statistics, including small cohorts."""
import numpy as np
from sklearn.calibration import calibration_curve
from sklearn.metrics import average_precision_score, brier_score_loss, confusion_matrix, precision_recall_fscore_support, roc_auc_score


def measure(labels, probabilities, threshold, latency=None):
    labels, probabilities = np.asarray(labels), np.asarray(probabilities)
    matrix = confusion_matrix(labels, probabilities >= threshold, labels=[0, 1])
    tn, fp, fn, tp = matrix.ravel()
    precision, recall, f1, support = precision_recall_fscore_support(labels, probabilities >= threshold, labels=[0, 1], zero_division=0)
    observed, predicted = calibration_curve(labels, probabilities, n_bins=10)
    return {'threshold': threshold, 'confusion_matrix_labels': [0, 1], 'confusion_matrix': matrix.tolist(),
        'per_class': {str(i): {'precision': float(precision[i]), 'recall': float(recall[i]), 'f1': float(f1[i]), 'support': int(support[i])} for i in (0, 1)},
        'false_positive_rate': float(fp / (fp + tn)) if fp+tn else None,
        'pr_auc_average_precision': float(average_precision_score(labels, probabilities)) if len(set(labels)) == 2 else None,
        'roc_auc': float(roc_auc_score(labels, probabilities)) if len(set(labels)) == 2 else None,
        'brier_score': float(brier_score_loss(labels, probabilities)),
        'calibration_curve': {'predicted': predicted.tolist(), 'observed': observed.tolist()},
        'batch_inference_ms_per_row': latency}
