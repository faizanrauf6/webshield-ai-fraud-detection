"""Metadata-only import of PhreshPhish. Never fetch any URL in the dataset."""
import argparse
import csv
import hashlib
import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.request import urlopen
from pipeline import extract_batch, write_json

REVISION = 'eabec4b7a66324b79cc8a0ad856d1731dc26fe1a'
SOURCE = 'https://huggingface.co/datasets/phreshphish/phreshphish'


def prepare_metadata(raw):
    candidates, exclusions = [], Counter()
    for row in raw:
        try:
            if row['label'] not in ('benign', 'phish'):
                raise ValueError('Unknown published label')
            observed = date.fromisoformat(row['date']).isoformat()
            candidates.append({**row, 'date': observed})
        except (KeyError, ValueError, TypeError):
            exclusions['invalid_label_or_date'] += 1
    extracted = extract_batch([r['url'] for r in candidates], skip_invalid=True)
    seen, conflicts = {}, set()
    for row, feature in zip(candidates, extracted):
        if 'error' in feature:
            exclusions['unsupported_url'] += 1
            continue
        url, label = feature['normalized'], int(row['label'] == 'phish')
        if url in seen:
            exclusions['canonical_duplicate'] += 1
            if seen[url]['label'] != label:
                conflicts.add(url)
            seen[url]['first_seen_at'] = min(seen[url]['first_seen_at'], row['date'])
            continue
        seen[url] = {'url': url, 'label': label, 'first_seen_at': row['date'],
                     'source': 'PhreshPhish', 'campaign_or_domain_group': feature['domain']}
    for url in conflicts:
        del seen[url]
    exclusions['conflicting_canonical_urls'] = len(conflicts)
    return sorted(seen.values(), key=lambda r: r['url']), exclusions


def download_metadata(directory):
    # Optional research dependencies. HTML columns are deliberately never read.
    import fsspec
    import pyarrow.parquet as pq
    directory.mkdir(parents=True, exist_ok=True)
    with urlopen(f'https://huggingface.co/api/datasets/phreshphish/phreshphish/tree/{REVISION}/data', timeout=30) as response:
        entries = json.load(response)
    files = [r for r in entries if r['path'].startswith(('data/train-', 'data/test-')) and r['path'].endswith('.parquet')]
    if len(files) != 77:
        raise ValueError('Pinned source file inventory is incomplete.')

    def fetch(entry):
        destination = directory / (entry['path'].split('/')[-1] + '.jsonl')
        # Always refresh from the pinned source rather than trusting unverified cache.
        with fsspec.open(f'{SOURCE}/resolve/{REVISION}/{entry["path"]}', 'rb', block_size=262144) as handle:
            rows = pq.ParquetFile(handle).read(columns=['url', 'label', 'date', 'sha256']).to_pylist()
        with destination.open('w') as output:
            for row in rows:
                row['date'] = row['date'].isoformat()
                output.write(json.dumps(row) + '\n')
        return {**entry, 'metadata_sha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'rows': len(rows)}

    with ThreadPoolExecutor(max_workers=4) as pool:
        inventory = list(pool.map(fetch, files))
    write_json(directory / 'sources.json', {'revision': REVISION, 'files': inventory})


def import_metadata(directory, output, limit=150000):
    inventory = json.loads((directory / 'sources.json').read_text())
    if inventory['revision'] != REVISION:
        raise ValueError('Unexpected dataset revision.')
    raw, hashes = [], {}
    for entry in inventory['files']:
        path = directory / (entry['path'].split('/')[-1] + '.jsonl')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if entry.get('metadata_sha256') and entry['metadata_sha256'] != digest:
            raise ValueError('Cached source metadata changed.')
        hashes[path.name] = digest
        raw.extend(json.loads(line) for line in path.read_text().splitlines())
    # Label-independent reproducible URL hash sample across all published shards.
    # Custom chronological evaluation below, not a claim of reproducing paper splits.
    sampled = sorted(raw, key=lambda r: hashlib.sha256(('webshield-v2:' + r['url']).encode()).digest())[:limit]
    rows, exclusions = prepare_metadata(sampled)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=['url', 'label', 'first_seen_at', 'source', 'campaign_or_domain_group'])
        writer.writeheader()
        writer.writerows(rows)
    provenance = {'name': 'PhreshPhish metadata sample', 'source': SOURCE, 'revision': REVISION,
        'paper': 'https://arxiv.org/abs/2507.10854', 'license': 'CC BY 4.0 (anti-phishing research use)',
        'imported_at': datetime.now(timezone.utc).isoformat(), 'source_metadata_sha256': hashes,
        'prepared_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'raw_rows': len(raw), 'sampled_rows': len(sampled), 'retained_rows': len(rows),
        'class_counts': dict(Counter(r['label'] for r in rows)), 'exclusions': dict(exclusions),
        'sampling': 'Lowest SHA-256(webshield-v2: + original URL), independent of label, across all 77 published shards.',
        'observation_dates': 'Published day precision; UTC midnight used only to order days, not as a known capture time.',
        'evaluation': 'Custom temporal split, validation >=2025-07-01, test >=2025-09-09; purge connected domain/campaign overlaps. Original published split assignments are not reproduced.',
        'scope': 'phishing', 'limitations': ['Published labels not independently re-reviewed.',
            'URL metadata only; no historical content/domain/provider enrichment.',
            'No store/investment scam labels; see separate ScamFerret research.',
            'Historical sample and source drift limit live-site generalization.']}
    write_json(output.with_suffix('.provenance.json'), provenance)
    print(json.dumps({k: provenance[k] for k in ('raw_rows', 'sampled_rows', 'retained_rows', 'class_counts', 'exclusions')}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--metadata', type=Path, default=Path('ml/data/phreshphish-metadata'))
    parser.add_argument('--output', type=Path, default=Path('ml/data/phreshphish.csv'))
    parser.add_argument('--limit', type=int, default=150000)
    parser.add_argument('--download', action='store_true')
    args = parser.parse_args()
    if args.limit < 100:
        parser.error('Use at least 100 sampled rows.')
    if args.download:
        download_metadata(args.metadata)
    import_metadata(args.metadata, args.output, args.limit)
