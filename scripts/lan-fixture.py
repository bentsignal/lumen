"""Disposable synthetic Hue Bridge for simulator transport/interaction validation.

Never points at a real bridge or TV. Keep generated TLS material/evidence outside git.
Run on an isolated development LAN, publish its address with mDNS, and stop when done.
"""
import argparse
import copy
import json
from pathlib import Path
import queue
import ssl
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BRIDGE_ID = '0011223344556677'
KEY = 'fixture-application-key'
RESOURCES = [
    {'id': 'fixture-light', 'type': 'light', 'owner': {'rid': 'fixture-device', 'rtype': 'device'}, 'metadata': {'name': 'Test lamp'}, 'on': {'on': True}, 'dimming': {'brightness': 60}},
    {'id': 'fixture-group', 'type': 'grouped_light', 'owner': {'rid': 'fixture-room', 'rtype': 'room'}, 'on': {'on': True}, 'dimming': {'brightness': 60}},
    {'id': 'fixture-room', 'type': 'room', 'metadata': {'name': 'Test room'}, 'children': [{'rid': 'fixture-device', 'rtype': 'device'}], 'services': [{'rid': 'fixture-group', 'rtype': 'grouped_light'}]},
    {'id': 'fixture-scene', 'type': 'scene', 'metadata': {'name': 'Test evening'}, 'group': {'rid': 'fixture-room', 'rtype': 'room'}},
]

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--directory', type=Path, required=True)
parser.add_argument('--bind', default='0.0.0.0')
parser.add_argument('--port', type=int, default=8443)
args = parser.parse_args()
folder = args.directory.expanduser().resolve()
repo = Path(__file__).resolve().parents[1]
if folder == repo or repo in folder.parents:
    parser.error('Use a private directory outside the repository')
folder.mkdir(parents=True, exist_ok=True, mode=0o700)
cert, key = folder / 'fixture-cert.pem', folder / 'fixture-key.pem'
if not cert.exists():
    subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', str(key), '-out', str(cert), '-days', '2', '-subj', '/CN=' + BRIDGE_ID], check=True, capture_output=True)
    key.chmod(0o600)
clients = []
lock = threading.RLock()


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *args):
        pass

    def send_json(self, value, code=200):
        payload = json.dumps(value).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == '/api/config':
            return self.send_json({'bridgeid': BRIDGE_ID})
        if self.headers.get('hue-application-key') != KEY:
            return self.send_json({}, 403)
        if self.path == '/eventstream/clip/v2':
            events = queue.Queue()
            with lock:
                clients.append(events)
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.end_headers()
            try:
                while True:
                    try:
                        event = events.get(timeout=5)
                        self.wfile.write(('data: ' + json.dumps([event]) + '\n\n').encode())
                    except queue.Empty:
                        self.wfile.write(b':keepalive\n\n')
                    self.wfile.flush()
            except (OSError, ssl.SSLError):
                with lock:
                    clients.remove(events)
            return
        with lock:
            self.send_json({'data': copy.deepcopy(RESOURCES), 'errors': []})

    def do_POST(self):
        self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if self.path == '/api':
            return self.send_json([{'success': {'username': KEY}}])
        self.send_json({}, 404)

    def do_PUT(self):
        if self.headers.get('hue-application-key') != KEY:
            return self.send_json({}, 403)
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
        rid = self.path.rsplit('/', 1)[-1]
        with lock:
            target = next((r for r in RESOURCES if r['id'] == rid), None)
            if not target:
                return self.send_json({'errors': [{'description': 'Resource unavailable'}], 'data': []})
            if 'recall' in body:
                body = {'on': {'on': True}, 'dimming': {'brightness': 30}}
            targets = [target] if target['type'] == 'light' else RESOURCES[:2]
            for resource in targets:
                resource.update(body)
                event = {'type': 'update', 'data': [dict(body, id=resource['id'], type=resource['type'])]}
                for client in clients:
                    client.put(event)
            self.send_json({'errors': [], 'data': [{'rid': rid, 'rtype': target['type']}]})


server = ThreadingHTTPServer((args.bind, args.port), Handler)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(cert, key)
server.socket = context.wrap_socket(server.socket, server_side=True)
print('Synthetic Hue fixture listening; Bridge ID ' + BRIDGE_ID, flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
