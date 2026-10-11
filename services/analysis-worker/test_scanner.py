import http.server
import socket
import threading
import unittest
from unittest.mock import patch

from scanner import PolicyError, checked_url, public_addresses, request_once, fetch_document, extract_html


class ScannerTests(unittest.TestCase):
    def test_empty_form_action_submits_to_document_despite_base_href(self):
        for action in ('', ' action=""'):
            html = '<base href="http://other.com/"><form' + action + '><input type="password"></form>'
            result = extract_html(html, 'https://example.com/login')
            self.assertEqual(result['forms'], [{'action': 'https://example.com/login', 'hasPassword': True}])

    def test_base_href_and_external_form_association_are_respected(self):
        html = '<base href="https://collector.example/"><form id="login" action="send"></form><input form="login" type="password">'
        result = extract_html(html, 'https://example.com/')
        self.assertEqual(result['forms'], [{'action': 'https://collector.example/send', 'hasPassword': True}])

    def test_unsafe_urls_rejected(self):
        for url in ['file:///etc/passwd', 'http://u:p@site.com/', 'http://127.0.0.1/', 'http://[::1]/', 'http://2130706433/', 'http://0x7f000001/', 'http://127.00.0.1/', 'http://site.com:8080/', 'http://x.local/', 'http://%31%32%37.0.0.1/', 'http://site.com/\r\nx']:
            with self.subTest(url=url), self.assertRaises(PolicyError):
                checked_url(url)

    def test_all_dns_answers_must_be_public(self):
        answers = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('8.8.8.8', 443)), (socket.AF_INET6, socket.SOCK_STREAM, 6, '', ('::1', 443, 0, 0))]
        with patch('scanner.socket.getaddrinfo', return_value=answers), self.assertRaises(PolicyError):
            public_addresses('mixed.example', 443)

    def test_rebinding_or_internal_alias_never_opens_local_socket(self):
        server = http.server.HTTPServer(('127.0.0.1', 0), http.server.BaseHTTPRequestHandler)
        self.addCleanup(server.server_close)
        answers = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 80))]
        with patch('scanner.socket.getaddrinfo', return_value=answers), self.assertRaises(PolicyError):
            request_once('http://alias.example/')

    def test_actual_peer_must_match_validated_ip(self):
        sock = unittest.mock.Mock()
        sock.getpeername.return_value = ('127.0.0.1', 80)
        with patch('scanner.public_addresses', return_value=['8.8.8.8']), patch('scanner.socket.create_connection', return_value=sock), self.assertRaises(PolicyError):
            request_once('http://example.com/')
        self.assertTrue(sock.close.called)

    def test_redirect_to_internal_target_is_rejected(self):
        with patch('scanner.request_once', return_value=(302, {'location': 'http://127.0.0.1/'}, b'')), self.assertRaises(PolicyError):
            fetch_document('https://example.com/')

    def test_oversized_document_is_rejected(self):
        class Large(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.send_header('Content-Type', 'text/html')
                self.send_header('Content-Length', '99999999')
                self.end_headers()
            def log_message(self, *_args):
                pass
        server = http.server.HTTPServer(('127.0.0.1', 0), Large)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        real_connect = socket.create_connection
        # Socket boundary fixture maps the public address onto a local test server.
        # Peer verification still remains active in the production scanner.
        sock = real_connect(('127.0.0.1', server.server_port))
        proxy = unittest.mock.Mock(wraps=sock)
        proxy.getpeername.return_value = ('8.8.8.8', 80)
        with patch('scanner.public_addresses', return_value=['8.8.8.8']), patch('scanner.socket.create_connection', return_value=proxy), self.assertRaises(PolicyError):
            request_once('http://example.com/')

    def test_extracts_text_and_forms_without_scripts_or_form_submission(self):
        result = extract_html('<title>Login</title><script>double your deposit</script><form action="https://other.example/send"><input type="password"></form><p>Guaranteed returns</p><iframe src="x"></iframe>', 'https://example.com/')
        self.assertEqual(result['title'], 'Login')
        self.assertNotIn('double your deposit', result['text'])
        self.assertIn('Guaranteed returns', result['text'])
        self.assertEqual(result['forms'], [{'action': 'https://other.example/send', 'hasPassword': True}])
        self.assertEqual(result['iframeCount'], 1)


if __name__ == '__main__':
    unittest.main()
