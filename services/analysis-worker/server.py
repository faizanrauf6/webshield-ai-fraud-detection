"""Authenticated bounded request service. The child process has a hard wall-clock limit."""
import hmac
import json
import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

TOKEN = os.environ.get('CONTENT_WORKER_TOKEN', '')
if len(TOKEN) < 32 or os.environ.get('WEBSHIELD_ISOLATED') != '1':
    raise RuntimeError('Use the isolated Docker entrypoint and a token of at least 32 characters.')


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass  # Submitted URLs and tokens must never appear in server logs.

    def reply(self, code, value):
        body = json.dumps(value).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/health':
            return self.reply(200, {'status': 'ok', 'isolation': 'egress-filtered', 'version': 1})
        self.reply(404, {'status': 'unavailable'})

    def do_POST(self):
        if not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + TOKEN):
            return self.reply(401, {'status': 'unavailable'})
        if self.path not in ('/content', '/domain'):
            return self.reply(404, {'status': 'unavailable'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > 8192:
                raise ValueError('Invalid size')
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict) or not set(body).issubset({'url', 'registeredDomain'}) or not isinstance(body.get('url'), str):
                raise ValueError('Invalid request')
            result = subprocess.run([sys.executable, str(Path(__file__).with_name('scanner.py'))], input=json.dumps({'url': body['url'], 'kind': self.path[1:], 'registeredDomain': body.get('registeredDomain')}), text=True, capture_output=True, timeout=18, check=True)
            self.reply(200, json.loads(result.stdout))
        except (ValueError, subprocess.SubprocessError):
            self.reply(200, {'status': 'unavailable', 'message': 'Scan unavailable or execution deadline exceeded.'})


class Server(ThreadingHTTPServer):
    daemon_threads = True
    capacity = threading.BoundedSemaphore(2)

    def get_request(self):
        sock, address = super().get_request()
        sock.settimeout(3)
        return sock, address

    def process_request(self, request, address):
        if not self.capacity.acquire(blocking=False):
            self.shutdown_request(request)
            return
        super().process_request(request, address)

    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.capacity.release()


Server(('0.0.0.0', 4100), Handler).serve_forever()
