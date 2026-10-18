"""Prepare private HTTPS material on the Mac. Does not install or restart anything."""
import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import secrets
import ssl
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True, help='Private directory outside any checkout')
parser.add_argument('--bind', required=True, help='TV Ethernet address')
args = parser.parse_args()
folder = args.output.expanduser().resolve()
repository = Path(__file__).resolve().parents[1]
if folder == repository or repository in folder.parents:
    parser.error('Private material must be outside the repository')
os.umask(0o077)
folder.mkdir(parents=True, mode=0o700)
if any(folder.iterdir()):
    parser.error('Choose an empty output directory; existing material is never overwritten')
password = getpass.getpass('HyperHDR admin password: ')
subprocess.run([
    'openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes',
    '-keyout', str(folder / 'control-key.pem'), '-out', str(folder / 'control-cert.pem'),
    '-days', '3650', '-subj', '/CN=lumen-tv',
], check=True, capture_output=True)
token = secrets.token_hex(32)
settings = {
    'bind': args.bind, 'token': token, 'engine_password': password,
    'certificate': '/var/lib/webosbrew/hue-sync/control-cert.pem',
    'private_key': '/var/lib/webosbrew/hue-sync/control-key.pem',
}
(folder / 'control.json').write_text(json.dumps(settings, indent=2) + '\n')
certificate = ssl.PEM_cert_to_DER_cert((folder / 'control-cert.pem').read_text())
fingerprint = hashlib.sha256(certificate).hexdigest()
(folder / 'phone-connection.txt').write_text('TV address: ' + args.bind + '\nCertificate SHA-256: ' + fingerprint + '\nAccess token: ' + token + '\n')
print('Private material prepared. Nothing was deployed. Read phone-connection.txt locally; never publish it.')
