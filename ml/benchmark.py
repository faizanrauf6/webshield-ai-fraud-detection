"""Import public PhiUSIIL labels without visiting any listed website."""
import argparse
import csv
import hashlib
import io
import json
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from pipeline import extract_batch, write_json

SOURCE = 'https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset'
DOWNLOAD = 'https://archive.ics.uci.edu/static/public/967/phiusiil%2Bphishing%2Burl%2Bdataset.zip'


def map_label(value):
    if str(value) not in ('0', '1'):
        raise ValueError('Invalid PhiUSIIL label.')
    return 1 - int(value)


def import_benchmark(archive, destination):
    archive, destination = Path(archive), Path(destination)
    with zipfile.ZipFile(archive) as z:
        with z.open('PhiUSIIL_Phishing_URL_Dataset.csv') as f:
            raw = list(csv.DictReader(io.TextIOWrapper(f, encoding='utf-8-sig')))
    urls = [r['URL'].strip() for r in raw]
    extracted = extract_batch(urls, skip_invalid=True)
    exclusions = Counter()
    seen, conflicts = {}, set()
    for row, feature in zip(raw, extracted):
        if 'error' in feature:
            exclusions['unsupported_url'] += 1
            continue
        url, label = feature['normalized'], map_label(row['label'])
        if url in seen:
            exclusions['canonical_duplicate'] += 1
            if seen[url]['label'] != label:
                conflicts.add(url)
            continue
        seen[url] = {'url': url, 'label': label, 'first_seen_at': '', 'source': 'UCI-PhiUSIIL',
                     'campaign_or_domain_group': feature['domain']}
    for url in conflicts:
        del seen[url]
    exclusions['conflicting_canonical_urls'] = len(conflicts)
    rows = sorted(seen.values(), key=lambda r: r['url'])
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['url', 'label', 'first_seen_at', 'source', 'campaign_or_domain_group'])
        writer.writeheader()
        writer.writerows(rows)
    provenance = {'name': 'PhiUSIIL', 'authors': ['Arvind Prasad', 'Shalini Chandra'],
        'source': SOURCE, 'download_url': DOWNLOAD, 'license': 'CC BY 4.0',
        'citation': 'Prasad and Chandra (2024), doi:10.1016/j.cose.2023.103545',
        'imported_at': datetime.now(timezone.utc).isoformat(), 'raw_sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
        'prepared_sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
        'raw_rows': len(raw), 'retained_rows': len(rows), 'class_counts': dict(Counter(r['label'] for r in rows)),
        'exclusions': dict(exclusions), 'label_mapping': 'UCI 1=legitimate -> 0; UCI 0=phishing -> 1',
        'label_basis': 'Published benchmark labels; not independently re-reviewed by this project.',
        'observation_dates': 'Unavailable; no collection dates invented. Evaluate by domain/campaign groups, not time.',
        'scope': 'phishing', 'limitations': ['Historical benchmark; not a guarantee for current websites.',
            'No campaign IDs beyond registrable domains are provided.', 'No labeled investment/store-fraud cohorts.',
            'Precomputed content and similarity features are not used by the production lexical model.']}
    write_json(destination.with_suffix('.provenance.json'), provenance)
    print(json.dumps(provenance, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path, default=Path('ml/data/phiusiil.zip'))
    parser.add_argument('--output', type=Path, default=Path('ml/data/phiusiil.csv'))
    args = parser.parse_args()
    import_benchmark(args.archive, args.output)
