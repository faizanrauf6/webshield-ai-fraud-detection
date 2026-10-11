"""Bounded static HTTP scanner. Run behind entrypoint.py's independent egress policy."""
import http.client
import ipaddress
import json
import re
import socket
import ssl
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit

MAX_BYTES = 1024 * 1024
MAX_REDIRECTS = 4


class PolicyError(ValueError):
    pass


def now():
    return datetime.now(timezone.utc).isoformat()


def public_ip(value):
    address = ipaddress.ip_address(value)
    return address.is_global and not address.is_multicast and not address.is_reserved and not getattr(address, 'ipv4_mapped', None) and not (address.version == 6 and (address.sixtofour or address.teredo))


def checked_url(value):
    if not isinstance(value, str) or len(value) > 4096 or re.search(r'[\x00-\x20\x7f\\]', value) or re.search(r'%(?:00|0a|0d)', value, re.I):
        raise PolicyError('Invalid or overlong URL.')
    try:
        url = urlsplit(value)
        if url.scheme not in ('http', 'https') or not url.hostname or url.username is not None or url.password is not None or '%' in url.netloc:
            raise PolicyError('Only credential-free HTTP(S) URLs are allowed.')
        if url.port not in (None, 443 if url.scheme == 'https' else 80):
            raise PolicyError('Only default HTTP(S) ports are allowed.')
        host = url.hostname.rstrip('.').encode('idna').decode('ascii').lower()
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            if '.' not in host or re.search(r'(?:^|\.)(localhost|local|internal|lan|home|onion|test|invalid)$', host):
                raise PolicyError('Internal hostname rejected.')
            if len(host) > 253 or any(not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label) for label in host.split('.')):
                raise PolicyError('Malformed hostname.')
            # libc accepts legacy integer/octal/hex addresses: disallow them before DNS.
            if re.fullmatch(r'(?:0x[0-9a-f]+|[0-9]+)(?:\.(?:0x[0-9a-f]+|[0-9]+))*', host):
                raise PolicyError('Ambiguous IP encoding.')
        else:
            if not public_ip(str(address)) or (address.version == 4 and str(address) != host):
                raise PolicyError('Nonpublic address rejected.')
        authority = f'[{host}]' if ':' in host else host
        return urlunsplit((url.scheme, authority, url.path or '/', url.query, ''))
    except (ValueError, UnicodeError) as error:
        raise PolicyError('URL policy rejected the input.') from error


def public_addresses(host, port):
    answers = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    addresses = list(dict.fromkeys(answer[4][0] for answer in answers))
    if not addresses or len(addresses) > 32 or any(not public_ip(ip) for ip in addresses):
        raise PolicyError('DNS returned nonpublic or unsupported addresses.')
    return addresses


def request_once(value, accept='text/html', max_bytes=MAX_BYTES):
    url = urlsplit(checked_url(value))
    port = 443 if url.scheme == 'https' else 80
    ip = public_addresses(url.hostname, port)[0]
    # Connect to the validated literal, never resolve the hostname a second time.
    sock = socket.create_connection((ip, port), timeout=3)
    connection = None
    try:
        peer = sock.getpeername()[0]
        if not public_ip(peer) or ipaddress.ip_address(peer) != ipaddress.ip_address(ip):
            raise PolicyError('Connected peer did not match the validated address.')
        if url.scheme == 'https':
            sock = ssl.create_default_context().wrap_socket(sock, server_hostname=url.hostname)
        connection = http.client.HTTPConnection(url.hostname, port, timeout=3)
        connection.sock = sock
        path = url.path or '/'
        if url.query:
            path += '?' + url.query
        connection.request('GET', path, headers={'Host': url.netloc, 'User-Agent': 'WebShieldAI-AcademicScanner/0.2', 'Accept': accept, 'Accept-Encoding': 'identity', 'Connection': 'close'})
        response = connection.getresponse()
        headers = {key.lower(): val for key, val in response.getheaders()}
        if response.status in (301, 302, 303, 307, 308):
            return response.status, headers, b''
        if int(headers.get('content-length', '0')) > max_bytes:
            raise PolicyError('Response exceeds the content-size limit.')
        if headers.get('content-encoding', 'identity').lower() != 'identity':
            raise PolicyError('Compressed responses are not accepted.')
        result = bytearray()
        deadline = time.monotonic() + 6
        while True:
            if time.monotonic() > deadline:
                raise PolicyError('Response deadline exceeded.')
            chunk = response.read1(min(16384, max_bytes + 1 - len(result)))
            if not chunk:
                break
            result.extend(chunk)
            if len(result) > max_bytes:
                raise PolicyError('Response exceeds the content-size limit.')
        return response.status, headers, bytes(result)
    finally:
        if connection:
            connection.close()
        sock.close()


def fetch_document(value, accept='text/html', max_bytes=MAX_BYTES):
    current = checked_url(value)
    hops = []
    for _ in range(MAX_REDIRECTS + 1):
        status, headers, body = request_once(current, accept, max_bytes)
        if status in (301, 302, 303, 307, 308):
            location = headers.get('location')
            if not location:
                raise PolicyError('Redirect has no destination.')
            destination = checked_url(urljoin(current, location))
            if urlsplit(current).scheme == 'https' and urlsplit(destination).scheme != 'https':
                raise PolicyError('HTTPS downgrade rejected.')
            hops.append(destination)
            current = destination
            continue
        if status != 200:
            raise PolicyError(f'Target returned HTTP {status}.')
        return current, headers, body, hops
    raise PolicyError('Too many redirects.')


class PageParser(HTMLParser):
    def __init__(self, base):
        super().__init__(convert_charrefs=True)
        self.base = base
        self.document_url = base
        self.parts = []
        self.text_length = 0
        self.title_parts = []
        self.in_title = False
        self.ignored = 0
        self.forms = []
        self.form = None
        self.links = set()
        self.iframes = 0
        self.base_seen = False
        self.form_ids = {}
        self.external_passwords = set()

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag in ('script', 'style', 'noscript', 'template'):
            self.ignored += 1
        if self.ignored:
            return
        if tag == 'base' and not self.base_seen and data.get('href'):
            self.base = urljoin(self.base, data['href'])
            self.base_seen = True
        if tag == 'title':
            self.in_title = True
        if tag == 'form' and len(self.forms) < 32:
            self.form = {'action': data.get('action') or self.document_url, 'hasPassword': False}
            self.forms.append(self.form)
            if data.get('id'):
                self.form_ids.setdefault(data['id'], self.form)
        if tag == 'input' and (data.get('type') or '').lower() == 'password':
            if data.get('form') and len(self.external_passwords) < 256:
                self.external_passwords.add(data['form'])
            elif self.form is not None:
                self.form['hasPassword'] = True
        if tag == 'a' and data.get('href') and len(self.links) < 100:
            host = urlsplit(urljoin(self.base, data['href'])).hostname
            if host:
                self.links.add(host[:253])
        if tag == 'iframe':
            self.iframes += 1

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript', 'template'):
            self.ignored = max(0, self.ignored - 1)
        if tag == 'title':
            self.in_title = False
        if tag == 'form':
            self.form = None

    def handle_data(self, text):
        if self.ignored or self.text_length >= 50000:
            return
        text = ' '.join(text.split())[:50000-self.text_length]
        if text:
            self.parts.append(text)
            self.text_length += len(text) + 1
            if self.in_title:
                self.title_parts.append(text)


def extract_html(html, base):
    parser = PageParser(base)
    parser.feed(html)
    for name in parser.external_passwords:
        if name in parser.form_ids:
            parser.form_ids[name]['hasPassword'] = True
    for form in parser.forms:
        form['action'] = urljoin(parser.base, form['action'])[:4096]
    return {'title': ' '.join(parser.title_parts)[:300], 'text': ' '.join(parser.parts)[:50000], 'forms': parser.forms, 'linkDomains': sorted(parser.links), 'iframeCount': parser.iframes}


def content_scan(value):
    final, headers, body, redirects = fetch_document(value)
    if not any(kind in headers.get('content-type', '').lower() for kind in ('text/html', 'application/xhtml+xml')) or 'attachment' in headers.get('content-disposition', '').lower():
        raise PolicyError('Only inline HTML documents can be analyzed.')
    charset = re.search(r'charset=([a-zA-Z0-9_-]+)', headers.get('content-type', ''))
    try:
        text = body.decode(charset.group(1) if charset else 'utf-8', errors='replace')
    except LookupError:
        text = body.decode('utf-8', errors='replace')
    return {'url': checked_url(value), 'finalUrl': final, 'redirects': redirects, 'observedAt': now(), **extract_html(text, final)}


def domain_scan(value, registered_domain=None):
    host = urlsplit(checked_url(value)).hostname
    ips = public_addresses(host, 443)
    result = {'hostname': host, 'addresses': ips, 'observedAt': now(), 'rdapStatus': 'unavailable', 'registeredAt': None, 'ageDays': None}
    try:
        if ipaddress.ip_address(host):
            return result
    except ValueError:
        pass
    try:
        rdap_host = urlsplit(checked_url('https://' + registered_domain + '/')).hostname if registered_domain else host
        if host != rdap_host and not host.endswith('.' + rdap_host):
            raise PolicyError('RDAP name does not match the submitted hostname.')
        # Use the authoritative IANA RDAP bootstrap, not a user-selected server.
        _, _, bootstrap, _ = fetch_document('https://data.iana.org/rdap/dns.json', 'application/json', 262144)
        services = json.loads(bootstrap)['services']
        tld = rdap_host.rsplit('.', 1)[-1]
        endpoint = next(urls[0] for tlds, urls in services if tld in tlds)
        if not endpoint.startswith('https://'):
            return result
        _, _, body, _ = fetch_document(endpoint.rstrip('/') + '/domain/' + rdap_host, 'application/rdap+json, application/json', 262144)
        data = json.loads(body)
        if data.get('objectClassName') != 'domain' or str(data.get('ldhName', '')).lower() != rdap_host.lower():
            return result
        registration = next(event['eventDate'] for event in data.get('events', []) if event.get('eventAction') == 'registration')
        date = datetime.fromisoformat(registration.replace('Z', '+00:00'))
        if date.tzinfo is None:
            return result
        age = (datetime.now(timezone.utc) - date).days
        if age >= 0:
            result.update(rdapStatus='completed', registeredAt=date.isoformat(), ageDays=age)
    except (ValueError, KeyError, StopIteration, OSError, http.client.HTTPException):
        pass
    return result


if __name__ == '__main__':
    import sys
    request = json.loads(sys.stdin.read(8193))
    try:
        result = content_scan(request['url']) if request['kind'] == 'content' else domain_scan(request['url'], request.get('registeredDomain'))
        print(json.dumps({'status': 'completed', 'observation': result}))
    except (ValueError, KeyError, OSError, http.client.HTTPException):
        print(json.dumps({'status': 'unavailable', 'message': 'Target unavailable or blocked by scan policy.'}))
