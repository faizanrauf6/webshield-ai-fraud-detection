"""Import pinned ScamFerret snapshots for offline research, never visit targets.

ScamFerret artifact: https://github.com/ScamFerret/artifact (GPL-3.0).
The upstream license and README are preserved beside the ignored local raw data.
Only static HTML and timestamped RetrieveWHOIS raw observations become features;
LLM thoughts, verdicts and search-result observations are deliberately ignored.
"""
from __future__ import annotations

import argparse
import ast
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path, PurePosixPath
import re
import time
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '8cf8dc631edafe584141e2f95f0c0f51855fb7bc'
PINNED_TREE_SHA = '6f59aa1d88fd7f66b8e0cce6cc0e115bfbf952bc'
PUBLICATION_UPPER_BOUND = '2025-09-30T08:10:39Z'
REPOSITORY = 'https://github.com/ScamFerret/artifact'
RAW_BASE = f'https://raw.githubusercontent.com/ScamFerret/artifact/{COMMIT}/'
CATEGORIES = ('cryptocurrency', 'investment', 'online_shopping_english')
CLASSES = ('legitimate_websites', 'scam_websites')
MAX_COMPRESSED = 2 * 1024 * 1024
MAX_EXPANDED = 1024 * 1024
MAX_TREE_BYTES = 20 * 1024 * 1024
TREE_ENDPOINT = f'https://api.github.com/repos/ScamFerret/artifact/git/trees/{COMMIT}?recursive=1'
SOURCE_METADATA_AUDIT = {
    'commit_sha': COMMIT, 'git_tree_sha': PINNED_TREE_SHA,
    'commit_author_date': PUBLICATION_UPPER_BOUND, 'commit_committer_date': PUBLICATION_UPPER_BOUND,
    'primary_commit_api': f'https://api.github.com/repos/ScamFerret/artifact/commits/{COMMIT}',
    'date_caveat': 'Git committer timestamp used as artifact upper bound; per-row capture time and GitHub first-publication/push time are unknown.',
    'recursive_tree_api_caveat': 'The cached recursive git/trees response identifies its requested commit ref in sha; the commit metadata separately supplies the Git tree object ID.',
}


class SourceError(ValueError):
    pass


def blob_sha(body):
    return hashlib.sha1(f'blob {len(body)}\0'.encode() + body).hexdigest()


def verify_blob(body, entry):
    if len(body) != entry['size'] or blob_sha(body) != entry['sha']:
        raise SourceError('Pinned Git blob size or SHA-1 mismatch.')


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise SourceError('Artifact download redirect rejected.')


def validate_tree(body):
    if len(body) > MAX_TREE_BYTES:
        raise SourceError('Pinned tree metadata exceeds 20 MiB.')
    tree = json.loads(body)
    if (not isinstance(tree, dict) or tree.get('truncated') is not False
            or tree.get('sha') not in (COMMIT, PINNED_TREE_SHA)
            or not isinstance(tree.get('tree'), list) or len(tree['tree']) > 100000):
        raise SourceError('Expected the complete pinned upstream tree.')
    return tree


def download_tree(path):
    """Fetch bounded recursive metadata for the fixed source commit only."""
    path = Path(path)
    if path.is_file():
        if path.stat().st_size > MAX_TREE_BYTES:
            raise SourceError('Cached tree metadata exceeds 20 MiB.')
        validate_tree(path.read_bytes())
        return path
    request = Request(TREE_ENDPOINT, headers={'User-Agent': 'WebShieldAI-offline-research/1.0',
                                              'Accept-Encoding': 'identity'})
    with build_opener(NoRedirects()).open(request, timeout=60) as response:
        if response.geturl() != TREE_ENDPOINT:
            raise SourceError('Unexpected tree metadata origin.')
        body = response.read(MAX_TREE_BYTES + 1)
    validate_tree(body)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    return path


def public_provenance(provenance, full_body):
    """Share aggregate reproducibility evidence without target URL/host lists."""
    allowed = ('repository', 'pinned_commit', 'citation', 'tree_sha256', 'license',
               'notices_preserved_locally', 'scope', 'production_eligible', 'labels',
               'labeling_audit', 'dataset_subset', 'features', 'forbidden_features',
               'date_semantics', 'missingness', 'unavailable_ablation', 'split',
               'reuse_caveat', 'counts')
    result = {key: provenance[key] for key in allowed if key in provenance}
    inventory = provenance.get('source_files', [])
    result.update(source_inventory={
        'files': len(inventory), 'sha256': hashlib.sha256(json.dumps(inventory, sort_keys=True).encode()).hexdigest(),
        'hash_encoding': 'SHA256 of UTF-8 json.dumps(source_files, sort_keys=True)',
        'raw_inventory_location': 'ignored ml/data/scamferret/provenance.json'},
        local_provenance_sha256=hashlib.sha256(full_body).hexdigest(),
        source_metadata_audit=SOURCE_METADATA_AUDIT,
        download_failure_count=len(provenance.get('download_failures', {})),
        exclusions=[{key: item[key] for key in ('category', 'label', 'reason') if key in item}
                    for item in provenance.get('exclusions', [])])
    return result


def download(path, entries, cache):
    """Fetch known, size-bounded pinned public artifact blobs; no target requests."""
    relative = PurePosixPath(path)
    if relative.is_absolute() or '..' in relative.parts or path not in entries:
        raise SourceError('Unknown or unsafe artifact path.')
    entry = entries[path]
    if entry.get('type') != 'blob' or entry.get('size', MAX_COMPRESSED + 1) > MAX_COMPRESSED:
        raise SourceError('Artifact blob exceeds compressed/raw download bound.')
    destination = cache.joinpath(*relative.parts)
    if destination.is_file():
        if destination.stat().st_size > MAX_COMPRESSED:
            raise SourceError('Cached artifact exceeds download bound.')
        body = destination.read_bytes()
        verify_blob(body, entry)
        return destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = Request(RAW_BASE + quote(path, safe='/'), headers={
        'User-Agent': 'WebShieldAI-offline-research/1.0', 'Accept-Encoding': 'identity'})
    for attempt in range(3):
        try:
            with build_opener(NoRedirects()).open(request, timeout=30) as response:
                if response.geturl() != request.full_url:
                    raise SourceError('Unexpected artifact response origin.')
                body = response.read(MAX_COMPRESSED + 1)
            verify_blob(body, entry)
            temporary = destination.with_suffix(destination.suffix + '.part')
            temporary.write_bytes(body)
            temporary.replace(destination)
            return destination
        except OSError:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def read_bounded_gzip(path, limit=MAX_EXPANDED):
    if path.stat().st_size > MAX_COMPRESSED:
        raise SourceError('Compressed HTML exceeds 2 MiB.')
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(path.read_bytes())) as stream:
            body = stream.read(limit + 1)
        if len(body) > limit:
            raise SourceError('Expanded HTML exceeds 1 MiB static scanner limit.')
        return body
    except (OSError, EOFError) as error:
        raise SourceError('Invalid archived gzip.') from error


def archived_content(body, normalized_url):
    """Only call the production static parser; never its HTTP scanner."""
    spec = importlib.util.spec_from_file_location('archived_static_scanner', ROOT / 'services/analysis-worker/scanner.py')
    scanner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(scanner)
    return {'url': normalized_url, 'finalUrl': normalized_url,
            'observedAt': PUBLICATION_UPPER_BOUND, 'redirects': [],
            **scanner.extract_html(body.decode('utf-8', errors='replace'), normalized_url)}


def iso_date(value):
    try:
        date = datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
        if date.tzinfo is None:
            return None
        return date.astimezone(timezone.utc)
    except (ValueError, TypeError, AttributeError):
        return None


def parse_whois(trace, hostname):
    """Use recorded WHOIS database reference time, never today's domain age.

    A WHOIS database update time is a reference for the returned record, not a
    measured query/capture timestamp. Both that limitation and missingness are
    included in provenance. Retrieval time itself is unknown.
    """
    if not isinstance(trace, list):
        return None
    for action in trace[:100]:
        if not isinstance(action, dict) or action.get('action') != 'RetrieveWHOIS':
            continue
        observation = action.get('observation')
        if not isinstance(observation, str) or len(observation) > MAX_EXPANDED:
            continue
        try:
            record = ast.literal_eval(observation)
        except (ValueError, SyntaxError, TypeError, RecursionError):
            continue
        if not isinstance(record, dict):
            continue
        registered_domain = str(record.get('domain', '')).lower().rstrip('.')
        if not registered_domain or not (hostname == registered_domain or hostname.endswith('.' + registered_domain)):
            continue
        raw = record.get('raw')
        if not isinstance(raw, list) or len(raw) > 10000 or any(not isinstance(line, str) for line in raw):
            continue
        text = '\n'.join(raw)
        created_match = re.search(r'(?im)^\s*Creation Date:\s*(\S+)', text)
        observed_match = re.search(r'(?i)Last update of WHOIS database:\s*(\S+)', text)
        if not created_match or not observed_match:
            continue
        created, observed = iso_date(created_match[1]), iso_date(observed_match[1])
        if not created or not observed or not created <= observed <= iso_date(PUBLICATION_UPPER_BOUND):
            continue
        return {'hostname': hostname, 'addresses': [], 'ageDays': (observed - created).days,
                'registeredAt': created.isoformat().replace('+00:00', 'Z'),
                'observedAt': observed.isoformat().replace('+00:00', 'Z'),
                'rdapStatus': 'unavailable'}
    return None


def snapshot_path(prefix, hostname, entries):
    """Upstream HTML filenames sometimes omit www; never infer redirects."""
    exact = f'{prefix}/toppage_html/{hostname}.html.gz'
    if exact in entries:
        return exact
    if hostname.startswith('www.'):
        bare = f'{prefix}/toppage_html/{hostname[4:]}.html.gz'
        if bare in entries:
            return bare
    return exact


def import_dataset(tree_path, directory, workers=4):
    import pipeline
    directory = Path(directory)
    cache = directory / 'raw'
    tree_body = Path(tree_path).read_bytes()
    tree = validate_tree(tree_body)
    entries = {entry['path']: entry for entry in tree['tree']}
    for notice in ('LICENSE', 'README.md'):
        download(notice, entries, cache)
    candidates = []
    source_files = []
    for notice in ('LICENSE', 'README.md'):
        body = (cache / notice).read_bytes()
        source_files.append({'path': notice, 'git_blob_sha1': entries[notice]['sha'],
                             'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body)})
    for website_class in CLASSES:
        for category in CATEGORIES:
            prefix = f'dataset/{website_class}/{category}'
            path = prefix + '/groundtruth_url.txt'
            urls = download(path, entries, cache).read_text().splitlines()
            body = (cache / path).read_bytes()
            source_files.append({'path': path, 'git_blob_sha1': entries[path]['sha'],
                                 'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body)})
            for url in urls:
                if url.strip():
                    candidates.append({'url': url.strip(), 'category': category,
                                       'label': int(website_class == 'scam_websites'),
                                       'prefix': prefix, 'website_class': website_class})
    normalized = pipeline.extract_batch([row['url'] for row in candidates], skip_invalid=True, schema_version='lexical-v2')
    exclusions = []
    tasks = {}
    valid = []
    seen = {}
    for row, features in zip(candidates, normalized):
        if 'error' in features:
            exclusions.append({'category': row['category'], 'label': row['label'], 'reason': 'URL rejected by production policy'})
            continue
        url = features['normalized']
        if url in seen:
            if seen[url] != row['label']:
                raise SourceError('Conflicting ground-truth labels for normalized URL.')
            exclusions.append({'category': row['category'], 'label': row['label'], 'reason': 'duplicate normalized URL'})
            continue
        seen[url] = row['label']
        original_host = urlsplit(row['url']).hostname
        host = urlsplit(url).hostname
        row.update(normalized=url, hostname=host, group=features['domain'])
        row['html_path'] = snapshot_path(row['prefix'], original_host, entries)
        row['trace_path'] = f'evaluation/gpt-4_results/{row["website_class"]}/{row["category"]}/{original_host}.json'
        valid.append(row)
        for kind in ('html', 'trace'):
            path = row[kind + '_path']
            if path in entries and entries[path].get('size', MAX_COMPRESSED + 1) <= MAX_COMPRESSED:
                tasks[path] = None
    errors = {}
    if not 1 <= workers <= 8:
        raise ValueError('Artifact download concurrency must be between one and eight.')
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(download, path, entries, cache): path for path in tasks}
        for index, future in enumerate(as_completed(futures), 1):
            path = futures[future]
            try:
                future.result()
            except (OSError, SourceError) as error:
                errors[path] = type(error).__name__
            if index % 100 == 0 or index == len(futures):
                print(json.dumps({'downloaded_or_cached': index, 'total': len(futures), 'errors': len(errors)}), flush=True)
    rows = []
    counts = Counter()
    file_manifest = list(source_files)
    for row_index, candidate in enumerate(valid, 1):
        observations = {'asOf': PUBLICATION_UPPER_BOUND, 'providers': []}
        missing = []
        for kind in ('html', 'trace'):
            path = candidate[kind + '_path']
            entry = entries.get(path)
            if not entry:
                missing.append(kind + ':missing_upstream_blob')
                continue
            if entry.get('size', MAX_COMPRESSED + 1) > MAX_COMPRESSED:
                missing.append(kind + ':size_limit')
                continue
            if path in errors:
                missing.append(kind + ':download_error:' + errors[path])
                continue
            local = cache / path
            body = local.read_bytes()
            file_manifest.append({'path': path, 'git_blob_sha1': entry['sha'],
                                  'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body)})
            try:
                if kind == 'html':
                    observations['content'] = archived_content(read_bounded_gzip(local), candidate['normalized'])
                else:
                    domain = parse_whois(json.loads(body), candidate['hostname'])
                    if domain:
                        observations['domain'] = domain
                    else:
                        missing.append('domain:no_usable_timestamped_whois_record')
            except (SourceError, UnicodeError, json.JSONDecodeError, RecursionError) as error:
                missing.append(kind + ':' + str(error))
        counts['content_available'] += int('content' in observations)
        counts['domain_age_available'] += int('domain' in observations)
        cohort_key = candidate['category'] + ':' + str(candidate['label'])
        counts['content_available:' + cohort_key] += int('content' in observations)
        counts['domain_age_available:' + cohort_key] += int('domain' in observations)
        counts[candidate['category'] + ':' + str(candidate['label'])] += 1
        for reason in missing:
            counts['missing:' + reason] += 1
        rows.append({'url': candidate['normalized'], 'label': candidate['label'],
                     'first_seen_at': '', 'source': 'ScamFerret-DIMVA2025-published-groundtruth',
                     'campaign_or_domain_group': candidate['group'], 'category': candidate['category'],
                     'observations': observations,
                     'archive_metadata': {'source_commit': COMMIT,
                         'html_source_path': candidate['html_path'],
                         'capture_time': None, 'content_timestamp_semantics': 'artifact-publication-upper-bound',
                         'whois_timestamp_semantics': 'WHOIS-database-update-reference-not-query-time',
                         'redirect_history': 'unavailable', 'final_url': 'unavailable; input URL used as static parser base',
                         'dns_history': 'unavailable', 'threat_history': 'unavailable',
                         'missing': missing}})
        if row_index % 100 == 0 or row_index == len(valid):
            print(json.dumps({'parsed_rows': row_index, 'total_rows': len(valid)}), flush=True)
    provenance = {
        'repository': REPOSITORY, 'pinned_commit': COMMIT,
        'citation': 'Hiroki Nakano, Takashi Koide, and Daiki Chiba. ScamFerret: Detecting Scam Websites Autonomously with Large Language Models. DIMVA 2025, Springer.',
        'tree_sha256': hashlib.sha256(tree_body).hexdigest(), 'license': 'GPL-3.0',
        'notices_preserved_locally': ['raw/LICENSE', 'raw/README.md'],
        'scope': 'scam-research-store-investment-cryptocurrency', 'production_eligible': False,
        'labels': 'Published groundtruth_url.txt path classes; not independently re-adjudicated.',
        'labeling_audit': {
            'primary_paper': 'https://arxiv.org/html/2502.10110v1#S4',
            'candidate_sources': ['ScamGuard', 'The Scam Directory', 'Double-and-Nothing', 'TSS_ESP23', 'NOLA Defense'],
            'legitimate_sources': ['Curlie', 'Trustpilot'],
            'reported_candidate_collection_window': '2024-04-01 through 2024-04-07; not a per-row snapshot timestamp',
            'adjudication': 'Section 4 describes Tranco top-100k exclusion, HTTP-200 accessibility, consensus inspection by three security engineers using search engines, content and screenshots, then balanced sampling.',
            'provider_circularity': 'Google Safe Browsing, OpenPhish and WHOIS age are not specified as labeling rules. Undisclosed dependencies of upstream candidate sources cannot be excluded.',
            'content_circularity': 'Content informed manual adjudication; labels are not independently observed financial outcomes. No claim of blind content-independent truth.',
        },
        'dataset_subset': 'dataset; three English categories; 200 published URLs per category/class before exclusions',
        'features': 'Production URL normalization, static scanner extract_html, and raw WHOIS records only.',
        'forbidden_features': ['LLM verdicts', 'LLM thoughts', 'search results', 'current websites', 'current WHOIS'],
        'date_semantics': {'first_seen_at': 'unknown; empty in every row',
            'content_observedAt': 'Pinned artifact commit timestamp is an upper bound, NOT capture time.',
            'domain_observedAt': 'WHOIS database update reference timestamp, NOT query/capture time.',
            'assessment_asOf': 'Artifact publication upper bound; no temporal-generalization claim.'},
        'missingness': 'Unknown DNS addresses and redirect histories are represented by empty arrays; production feature zeros conflate unknown and absent.',
        'unavailable_ablation': 'hybrid-v2: no independently timestamped threat-provider history; no full-hybrid claim.',
        'split': 'Registered-domain-connected group split (seed 42); campaign IDs unavailable, registered domain proxy.',
        'reuse_caveat': 'Repurposes the published evaluation subset into our own group train/validation/test partitions; not an original ScamFerret benchmark comparison.',
        'counts': {'published_rows': len(candidates), 'retained_rows': len(rows), **dict(counts)},
        'exclusions': exclusions, 'download_failures': errors,
        'source_files': file_manifest,
    }
    directory.mkdir(parents=True, exist_ok=True)
    (directory / 'dataset.jsonl').write_text(''.join(json.dumps(row, allow_nan=False) + '\n' for row in rows))
    pipeline.write_json(directory / 'provenance.json', provenance)
    print(json.dumps({'dataset': str(directory / 'dataset.jsonl'), 'counts': provenance['counts'],
                      'excluded_rows': len(exclusions)}, indent=2), flush=True)
    return rows, provenance


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tree', type=Path, help='Complete pinned GitHub recursive tree JSON')
    parser.add_argument('--download-tree', action='store_true', help='Fetch bounded pinned recursive tree metadata to the output directory')
    parser.add_argument('--output', type=Path, default=ROOT / 'ml/data/scamferret')
    parser.add_argument('--workers', type=int, default=4, help='Bounded artifact download concurrency, at most eight')
    args = parser.parse_args()
    if args.download_tree:
        args.tree = download_tree(args.tree or args.output / 'tree.json')
    elif args.tree is None:
        parser.error('Supply --tree or --download-tree.')
    import_dataset(args.tree, args.output, args.workers)
