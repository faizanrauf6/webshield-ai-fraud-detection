"""Install namespace-local kernel rules, then permanently run the scanner unprivileged."""
import ctypes
import os
import subprocess
import sys


def rule(binary, *args):
    subprocess.run([binary, '-w', *args], check=True)


for binary in ('iptables', 'ip6tables'):
    rule(binary, '-P', 'OUTPUT', 'DROP')
    rule(binary, '-A', 'OUTPUT', '-m', 'conntrack', '--ctstate', 'ESTABLISHED,RELATED', '-j', 'ACCEPT')

# Docker's embedded resolver DNATs port 53 onto a namespace-local random port.
for protocol in ('udp', 'tcp'):
    rule('iptables', '-A', 'OUTPUT', '-d', '127.0.0.11', '-p', protocol, '-j', 'ACCEPT')
# Only the worker's own health endpoint is reachable on loopback.
rule('iptables', '-A', 'OUTPUT', '-d', '127.0.0.1', '-p', 'tcp', '--dport', '4100', '-j', 'ACCEPT')
for network in ('0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24', '192.88.99.0/24', '192.168.0.0/16', '198.18.0.0/15', '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4'):
    rule('iptables', '-A', 'OUTPUT', '-d', network, '-j', 'REJECT')
for network in ('2001::/23', '2001:db8::/32', '2002::/16', '3fff::/20'):
    rule('ip6tables', '-A', 'OUTPUT', '-d', network, '-j', 'REJECT')
for port in ('80', '443'):
    rule('iptables', '-A', 'OUTPUT', '-p', 'tcp', '--dport', port, '-j', 'ACCEPT')
    rule('ip6tables', '-A', 'OUTPUT', '-d', '2000::/3', '-p', 'tcp', '--dport', port, '-j', 'ACCEPT')

if ctypes.CDLL(None, use_errno=True).prctl(38, 1, 0, 0, 0) != 0:  # PR_SET_NO_NEW_PRIVS
    raise OSError(ctypes.get_errno(), 'Could not disable privilege escalation')
os.setgroups([])
os.setgid(65532)
os.setuid(65532)
os.environ['WEBSHIELD_ISOLATED'] = '1'
os.execv(sys.executable, [sys.executable, '/app/server.py'])
