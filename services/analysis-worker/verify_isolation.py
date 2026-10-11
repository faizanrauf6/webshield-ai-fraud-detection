"""Prove actual sockets cannot reach an otherwise-reachable internal HTTP service."""
import json
import subprocess
import uuid


def run(*args, **kwargs):
    return subprocess.run(args, text=True, capture_output=True, check=True, **kwargs).stdout.strip()


worker = run('docker', 'compose', '--profile', 'analysis', 'ps', '-q', 'analysis-worker')
info = json.loads(run('docker', 'inspect', worker))[0]
network = next(iter(info['NetworkSettings']['Networks']))
image = info['Config']['Image']
target = 'webshield-isolation-' + uuid.uuid4().hex[:12]
try:
    run('docker', 'run', '-d', '--name', target, '--network', network, '--entrypoint', 'python', image, '-m', 'http.server', '80')
    address = json.loads(run('docker', 'inspect', target))[0]['NetworkSettings']['Networks'][network]['IPAddress']
    control = f"import socket,time; time.sleep(.3); s=socket.create_connection(('{address}',80),timeout=3); s.close(); print('reachable')"
    assert run('docker', 'run', '--rm', '--network', network, '--entrypoint', 'python', image, '-c', control) == 'reachable'
    probe = '''
import os,socket,subprocess
targets = [(ADDRESS,80), ('127.0.0.1',80), ('169.254.169.254',80), ('10.0.0.1',443), ('::1',80)]
for host,port in targets:
    try:
        sock=socket.create_connection((host,port),timeout=2)
    except OSError:
        continue
    sock.close()
    raise AssertionError('Internal socket was reachable')
assert os.getuid() == 65532
assert subprocess.run(['iptables','-F'],capture_output=True).returncode != 0
print('5 internal socket attempts blocked; worker cannot change firewall rules')
'''.replace('ADDRESS', repr(address))
    print(run('docker', 'compose', '--profile', 'analysis', 'exec', '-T', '--user', '65532:65532', 'analysis-worker', 'python', '-c', probe))
finally:
    subprocess.run(['docker', 'rm', '-f', target], capture_output=True, check=False)
