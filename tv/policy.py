"""Serialized desired state and HTTPS control API. Python 2.7 standard library only."""
from __future__ import print_function
import copy
import hmac
import json
import math
import os
import ssl
import socket
import threading
import time
try:
    string_types = (basestring,)
except NameError:
    string_types = (str,)
try:
    from BaseHTTPServer import HTTPServer, BaseHTTPRequestHandler
except ImportError:
    from http.server import HTTPServer, BaseHTTPRequestHandler

PRESETS = {
    'calm': {'brightness': 70, 'intensity': 75, 'softness': 300},
    'balanced': {'brightness': 100, 'intensity': 100, 'softness': 150},
    'action': {'brightness': 100, 'intensity': 100, 'softness': 100},
}


def atomic_json(path, value):
    with open(path + '.tmp', 'w') as handle:
        os.chmod(path + '.tmp', 0o600)
        json.dump(value, handle)
        handle.flush()
        os.fsync(handle.fileno())
    os.rename(path + '.tmp', path)
    directory = os.open(os.path.dirname(path), os.O_RDONLY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def merged_tuning(config, patch):
    if not isinstance(patch, dict) or not patch or set(patch) - set(['preset', 'brightness', 'intensity', 'softness']):
        raise ValueError('Unsupported tuning fields')
    values = dict(PRESETS[patch['preset']]) if patch.get('preset') in PRESETS else {}
    if 'preset' in patch and not values:
        raise ValueError('Unknown preset')
    values.update({k: v for k, v in patch.items() if k != 'preset'})
    for key, value in values.items():
        low, high = (75, 500) if key == 'softness' else ((1, 100) if key == 'brightness' else (0, 100))
        if isinstance(value, bool) or not isinstance(value, (int, float)) or math.isnan(value) or math.isinf(value) or not low <= value <= high:
            raise ValueError('Tuning value out of range')
    # Refuse unknown engines/config shapes instead of silently resetting settings.
    if config.get('device', {}).get('type') != 'philipshue' or config.get('smoothing', {}).get('type') != 'RgbInterpolator':
        raise ValueError('Unsupported engine configuration')
    adjustments = config.get('color', {}).get('channelAdjustment', [])
    if len(adjustments) != 1 or 'saturationGain' not in adjustments[0]:
        raise ValueError('Unsupported color adjustment configuration')
    result = copy.deepcopy(config)
    if 'brightness' in values:
        result['device']['brightnessFactor'] = values['brightness'] / 100.0
    if 'intensity' in values:
        result['color']['channelAdjustment'][0]['saturationGain'] = values['intensity'] / 100.0
    if 'softness' in values:
        result['smoothing']['time_ms'] = values['softness']
    return result


def tuning_values(config):
    return {
        'brightness': config['device']['brightnessFactor'] * 100,
        'intensity': config['color']['channelAdjustment'][0]['saturationGain'] * 100,
        'softness': config['smoothing']['time_ms'],
    }


def engine_request(command, password, connect=socket.create_connection):
    """HyperHDR admin authentication is connection-scoped; keep login and command together."""
    connection = connect(('127.0.0.1', 19444), 8)
    handle = connection.makefile('rb')
    try:
        for value in [dict(command='authorize', subcommand='login', password=password, tan=900), dict(command, tan=901)]:
            connection.sendall((json.dumps(value) + '\n').encode('utf8'))
            while True:
                line = handle.readline(4 * 1024 * 1024 + 1)
                if not line or len(line) > 4 * 1024 * 1024:
                    raise RuntimeError('Engine response unavailable')
                result = json.loads(line.decode('utf8'))
                if result.get('tan') == value['tan']:
                    break
            if not result.get('success'):
                raise RuntimeError('Engine rejected authenticated command')
        return result
    finally:
        handle.close()
        connection.close()


class Controller(object):
    def __init__(self, base, cfg, api, engine, snapshot, restore, boot_id):
        self.base, self.cfg = base, cfg
        self.api, self.engine = api, engine
        self.snapshot, self.restore = snapshot, restore
        self.lock = threading.RLock()
        self.powered = None
        self.restored = False
        self.path = base + '/policy.json'
        if os.path.exists(self.path):
            with open(self.path) as handle:
                self.state = json.load(handle)
            # A corrupt policy must fail closed at startup, never silently become Auto.
            if self.state.get('mode') not in ('auto', 'on', 'off') or type(self.state.get('paused')) is not bool:
                raise ValueError('Invalid saved policy')
        else:
            self.state = {'mode': 'auto', 'paused': False, 'saw_off': False, 'boot_id': boot_id}
        if self.state.get('boot_id') != boot_id:
            self.state.update({'paused': False, 'saw_off': False, 'boot_id': boot_id})
        self.restored = not self.state.get('restore_pending', False)
        self.last_snapshot = 0
        self.start_deadline = 0
        self.save()

    def save(self):
        atomic_json(self.path, self.state)

    def wants_sync(self):
        return self.powered is True and self.state['mode'] != 'off' and not self.state['paused']

    def power(self, active):
        with self.lock:
            self.powered = active
            if not active:
                self.state['saw_off'] = True
            elif self.state.get('saw_off'):
                self.state.update({'paused': False, 'saw_off': False})
            self.save()

    def streams(self):
        areas = self.api('entertainment_configuration')
        active = [area for area in areas if area.get('status') == 'active']
        other = any(area.get('active_streamer', {}).get('rid') != self.cfg['auth_id'] or area['id'] != self.cfg['area'] for area in active)
        ours = any(area['id'] == self.cfg['area'] and area.get('active_streamer', {}).get('rid') == self.cfg['auth_id'] for area in active)
        return ours, other

    def config(self):
        config = self.engine({'command': 'config', 'subcommand': 'getconfig'})['info']
        if not isinstance(config, dict) or not all(key in config for key in ('device', 'general', 'smoothing', 'color', 'leds', 'network')):
            raise ValueError('Full engine configuration unavailable')
        return config

    def write_config(self, before, after):
        if before == after:
            return
        atomic_json(self.base + '/config-rollback.json', before)
        self.engine({'command': 'config', 'subcommand': 'setconfig', 'config': after})

    def disable_startup(self):
        before = self.config()
        if not before['general'].get('disableLedsStartup'):
            after = copy.deepcopy(before)
            after['general']['disableLedsStartup'] = True
            self.write_config(before, after)

    def component(self, enabled):
        self.engine({'command': 'componentstate', 'componentstate': {'component': 'LEDDEVICE', 'state': enabled}})

    def stop_restore(self):
        ours, other = self.streams()
        if ours:
            self.state['restore_pending'] = True
            self.save()
        # Saving startup-disabled prevents the engine restarting its output before policy runs.
        self.disable_startup()
        self.component(False)
        deadline = time.time() + 8
        while True:
            ours, other = self.streams()
            if other:
                raise RuntimeError('Another app owns Entertainment; no restoration performed')
            if not ours:
                break
            self.api('entertainment_configuration/' + self.cfg['area'], 'PUT', {'action': 'stop'})
            if time.time() >= deadline:
                raise RuntimeError('Timed out waiting for Entertainment to stop')
            time.sleep(.2)
        # A completed restore must not run again after a manual scene or helper restart.
        if self.state.get('restore_pending'):
            if self.restore() is not True:
                raise RuntimeError('Ordinary lighting restoration is incomplete')
            self.state['restore_pending'] = False
            self.save()
        self.restored = True

    def policy(self, patch):
        with self.lock:
            if not isinstance(patch, dict) or not patch or set(patch) - set(['mode', 'paused']):
                raise ValueError('Unsupported policy fields')
            if 'mode' in patch and patch['mode'] not in ('auto', 'on', 'off'):
                raise ValueError('Invalid sync mode')
            if 'paused' in patch and type(patch['paused']) is not bool:
                raise ValueError('Invalid pause state')
            self.state.update(patch)
            self.save()  # Desired Off survives even a failed engine/bridge operation.
            if not self.wants_sync():
                self.stop_restore()
            else:
                self.tick()
            return self.status()

    def handoff(self):
        return self.policy({'paused': True})

    def tune(self, patch):
        with self.lock:
            before = self.config()
            after = merged_tuning(before, patch)
            # A device config update reinitializes output; protect ordinary state first.
            self.stop_restore()
            after['general']['disableLedsStartup'] = True
            self.write_config(before, after)
            self.restored = True
            # Resume is handled by the single policy loop after engine initialization.
            return self.status()

    def tick(self):
        with self.lock:
            ours, other = self.streams()
            if other:
                self.component(False)
                # Another application now owns the lights and their ordinary state.
                self.state['restore_pending'] = False
                self.save()
                self.restored = True
                return
            if ours and not self.state.get('restore_pending'):
                self.state['restore_pending'] = True
                self.save()
            if not ours and self.state.get('restore_pending'):
                if self.wants_sync() and time.time() < self.start_deadline:
                    return  # Give a newly enabled engine time to establish its stream.
                self.stop_restore()
                return
            if not self.wants_sync() or other:
                self.component(False)
                if ours or (not self.restored and not other):
                    self.stop_restore()
                return
            info = self.engine({'command': 'serverinfo'})['info']
            capture = any(p.get('priority') == 150 and p.get('active') for p in info.get('priorities', []))
            components = info.get('components', [])
            enabled = any(c.get('name') == 'LEDDEVICE' and c.get('enabled') for c in components)
            if not ours and not enabled and capture:
                self.snapshot()
                self.state['restore_pending'] = True
                self.save()
                self.restored = False
                self.start_deadline = time.time() + 15
                self.component(True)
            elif ours:
                self.start_deadline = 0
                self.restored = False
            elif not enabled and time.time() - self.last_snapshot > 5:
                self.snapshot()
                self.last_snapshot = time.time()

    def status(self):
        with self.lock:
            ours, other = self.streams()
            info = self.engine({'command': 'serverinfo'})['info']
            return {
                'version': 1, 'deviceId': self.cfg['device_id'], 'bridgeId': self.cfg['bridge_id'],
                'area': self.cfg['area'], 'mode': self.state['mode'], 'paused': self.state['paused'],
                'powered': self.powered, 'streaming': ours, 'owner': 'other' if other else ('ours' if ours else 'none'),
                'restored': self.restored and not ours and not other,
                'capture': any(p.get('priority') == 150 and p.get('active') for p in info.get('priorities', [])),
                'tuning': tuning_values(self.config()),
            }


def authorized(header, token):
    return isinstance(header, string_types) and hmac.compare_digest(header.encode('utf8'), ('Bearer ' + token).encode('utf8'))


def serve(controller, settings):
    token = settings['token']
    if not isinstance(token, string_types) or len(token) < 32:
        raise ValueError('API token must be at least 32 characters')

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # Never log credentials, paths, or request bodies.

        def respond(self, code, value):
            payload = json.dumps(value).encode('utf8')
            self.send_response(code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(payload)

        def do_GET(self):
            self.dispatch(False)

        def do_POST(self):
            self.dispatch(True)

        def dispatch(self, write):
            if not authorized(self.headers.get('Authorization'), token):
                return self.respond(401, {'error': 'Unauthorized'})
            try:
                if not write and self.path == '/v1/status':
                    return self.respond(200, controller.status())
                if not write or self.path not in ('/v1/policy', '/v1/handoff', '/v1/tuning'):
                    return self.respond(404, {'error': 'Unsupported endpoint'})
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 2048 or self.headers.get('Transfer-Encoding'):
                    return self.respond(400, {'error': 'Invalid body length'})
                body = json.loads(self.rfile.read(length).decode('utf8'))
                if self.path == '/v1/handoff':
                    if body != {}:
                        raise ValueError('Handoff takes an empty object')
                    result = controller.handoff()
                elif self.path == '/v1/policy':
                    result = controller.policy(body)
                else:
                    result = controller.tune(body)
                self.respond(200, result)
            except (ValueError, TypeError, KeyError):
                self.respond(400, {'error': 'Invalid or unsupported request'})
            except Exception:
                self.respond(503, {'error': 'Device operation incomplete; desired policy retained'})

    class LocalServer(HTTPServer):
        def get_request(self):
            connection, address = HTTPServer.get_request(self)
            connection.settimeout(12)
            return context.wrap_socket(connection, server_side=True), address

    # TLS handshakes and requests are bounded. A single API worker plus the controller
    # lock serializes all policy/config/restoration operations with the guard loop.
    context = ssl.SSLContext(ssl.PROTOCOL_TLSv1_2)
    context.load_cert_chain(settings['certificate'], settings['private_key'])
    server = LocalServer((settings['bind'], 8766), Handler)
    worker = threading.Thread(target=server.serve_forever)
    worker.daemon = True
    worker.start()
    return server
