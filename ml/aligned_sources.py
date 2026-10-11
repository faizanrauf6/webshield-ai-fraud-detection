"""Download one bounded public PhishTank label snapshot, never target pages.

PhishTank limits unauthenticated downloads; reuse the frozen local snapshot
instead of repeatedly running this command. Collection is a separate explicitly
configured command using the isolated worker and owner-configured providers.
"""
import argparse
import bz2
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import urllib.request

SOURCE = 'https://data.phishtank.com/data/online-valid.json.bz2'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, default=Path('ml/data/aligned-cohort'))
    args = parser.parse_args()
    args.directory.mkdir(parents=True, exist_ok=True)
    destination = args.directory / 'phishtank.json.bz2'
    if destination.exists():
        raise ValueError('Snapshot already exists. Reuse it or choose a new experiment directory.')
    request = urllib.request.Request(SOURCE, headers={'User-Agent': 'WebShield-AI-FYP/1.0 (public labeled research dataset)'})
    with urllib.request.urlopen(request, timeout=45) as response:
        payload = response.read(30_000_001)
        status = response.status
    if len(payload) > 30_000_000:
        raise ValueError('Public source exceeds download bound.')
    decoder = bz2.BZ2Decompressor()
    expanded = decoder.decompress(payload, max_length=80_000_000)
    if not decoder.eof or decoder.unused_data or len(expanded) >= 80_000_000:
        raise ValueError('Invalid or oversized expanded public snapshot.')
    rows = json.loads(expanded)
    if not isinstance(rows, list) or not rows:
        raise ValueError('Expected nonempty public records.')
    metadata = {'name': destination.name, 'source_url': SOURCE,
        'retrieved_at': datetime.now(timezone.utc).isoformat(), 'status': status,
        'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest(),
        'expanded_sha256': hashlib.sha256(expanded).hexdigest(), 'records': len(rows)}
    destination.write_bytes(payload)
    (args.directory / 'phishtank.json').write_bytes(expanded)
    (args.directory / 'source-retrieval.json').write_text(json.dumps([metadata], indent=2)+'\n')
    print(json.dumps(metadata))


if __name__ == '__main__':
    main()
