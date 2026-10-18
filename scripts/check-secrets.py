"""Reject obvious private setup artifacts in git's publishable file set."""
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
result = subprocess.run(
    ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    cwd=root, check=True, capture_output=True,
)
patterns = [
    re.compile(rb'-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----'),
    re.compile(rb'"clientkey"\s*:\s*"[0-9a-fA-F]{32}"'),
    re.compile(rb'\bgh[pousr]_[A-Za-z0-9]{30,}\b'),
]
forbidden = {'hue-pairing.json', 'bridge.json', 'normal-state.json', 'root-key', 'prisoner-key', 'known_hosts'}
failures = []
for relative in set(result.stdout.decode().split('\0')) - {''}:
    path = root / relative
    if not path.is_file():
        continue
    if path.name in forbidden or path.suffix in {'.db', '.p8', '.p12', '.pem', '.mov', '.mp4', '.tgz'} or (path.name.startswith('.env') and path.name != '.env.example'):
        failures.append(relative)
        continue
    content = path.read_bytes()
    if any(pattern.search(content) for pattern in patterns):
        failures.append(relative)
if failures:
    print('Private material found; values are intentionally hidden:', file=sys.stderr)
    print('\n'.join(sorted(set(failures))), file=sys.stderr)
    sys.exit(1)
print('Publishable files contain no prohibited setup artifacts or recognized credential patterns.')
