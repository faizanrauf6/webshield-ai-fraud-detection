"""Group-disjoint partitions and validation-only operational threshold selection."""
import numpy as np


def component_groups(rows):
    parent = list(range(len(rows)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    seen = {}
    for i, row in enumerate(rows):
        for key in [('domain', row['domain']), ('campaign', row['campaign_or_domain_group'])]:
            if key in seen:
                parent[find(i)] = find(seen[key])
            else:
                seen[key] = i
    return [find(i) for i in range(len(rows))]


def grouped_split(rows, seed=42):
    from sklearn.model_selection import GroupShuffleSplit
    groups = component_groups(rows)
    indices = np.arange(len(rows))
    rest, test = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=seed).split(indices, groups=groups))
    train_local, validation_local = next(GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=seed).split(rest, groups=np.array(groups)[rest]))
    return [[rows[int(i)] for i in selection] for selection in (rest[train_local], rest[validation_local], test)]


def select_threshold(labels, probabilities, max_fpr=0.02):
    labels, probabilities = np.asarray(labels), np.asarray(probabilities, dtype=float)
    if (labels.ndim != 1 or labels.shape != probabilities.shape or set(labels) != {0, 1}
            or not np.isfinite(probabilities).all() or (probabilities < 0).any()
            or (probabilities > 1).any() or not 0 <= max_fpr < 1):
        raise ValueError('Threshold selection requires both classes and finite probabilities in [0,1].')
    order = np.argsort(-probabilities, kind='stable')
    scores, y = probabilities[order], labels[order]
    ends = np.flatnonzero(np.r_[scores[1:] != scores[:-1], True])
    tp, fp = np.cumsum(y)[ends], np.cumsum(1-y)[ends]
    positives, negatives = sum(labels == 1), sum(labels == 0)
    choices = []
    if scores[0] < 1:
        choices.append({'threshold': 1.0, 'recall': 0.0, 'precision': 0.0, 'f1': 0.0, 'false_positive_rate': 0.0})
    for i, true_positive, false_positive in zip(ends, tp, fp):
        threshold, fpr = float(scores[i]), float(false_positive / negatives)
        if threshold <= 0 or fpr > max_fpr:
            continue
        recall = float(true_positive / positives)
        precision = float(true_positive / max(1, true_positive + false_positive))
        choices.append({'threshold': threshold, 'recall': recall, 'precision': precision,
                        'f1': 2 * precision * recall / max(1e-15, precision + recall), 'false_positive_rate': fpr})
    return max(choices, key=lambda c: (c['recall'], c['precision'], c['threshold'])) if choices else None
