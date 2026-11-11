"""Loopback-only desktop lab using the exact MicroPython game and renderer.

Run: python simulator.py --open
No dependencies, network discovery, radio, microphone, or real message sending.
"""
import argparse
import json
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from pocket_game import Game
from pocket_link import LinkState
from pocket_save import SaveStore
from pocket_view import FONT, render


class PocketLab:
    def __init__(self, data_dir):
        directory = Path(data_dir)
        directory.mkdir(parents=True, exist_ok=True)
        self.store = SaveStore(str(directory / 'companion'))
        self.game = Game(self.store.load())
        self.link = LinkState(lambda: int(time.monotonic() * 1000))
        self.events = []
        self.revision = 0
        self.save_warning = ''
        self.lock = threading.RLock()

    def snapshot(self):
        with self.lock:
            game, link = self.game.snapshot(), self.link.snapshot()
            link['simulated'] = True
            return {'kind': 'simulator', 'revision': self.revision,
                    'game': game, 'link': link, 'save_warning': self.save_warning,
                    'events': self.events[-8:],
                    'commands': render(game, link, int(time.monotonic() * 5))}

    def input(self, action):
        if action not in ('next', 'select', 'back'):
            raise ValueError('Unknown input')
        with self.lock:
            intents = self.game.input(action)
            for intent in intents:
                kind = intent.get('type')
                if kind == 'query':
                    text = 'Demo query Q recorded; no phone contacted.'
                elif kind == 'dismiss':
                    text = 'Demo dismiss X recorded; no phone contacted.'
                elif kind == 'note_draft':
                    text = 'LOCAL UNSENT DRAFT: ' + str(intent.get('text', ''))[:80]
                else:
                    continue
                self.events.append(text)
                self.events = self.events[-8:]
            try:
                if not self.store.save(self.game.export()):
                    raise OSError('save rejected')
                self.save_warning = ''
            except OSError:
                self.save_warning = 'Save failed. Progress is in memory only.'
            self.revision += 1
            return self.snapshot()

    def demo_link(self, mode):
        if mode not in ('off', 'connected', 'idle', 'generating', 'completed', 'needs_human'):
            raise ValueError('Unknown demo mode')
        with self.lock:
            self.link.disconnect()
            if mode != 'off':
                self.link.connect()
            if mode not in ('off', 'connected'):
                raw = json.dumps({'schema': 'civweave.pocket.state.v1', 'source': 'server',
                    'fresh': True, 'mode': mode, 'agent': 'moss',
                    'task': 'SIMULATED learning task'}, separators=(',', ':')).encode()
                checksum, length = sum(raw) & 65535, len(raw)
                self.link.consume(bytes([1, ord('S'), length >> 8, length & 255, checksum >> 8, checksum & 255]))
                for i in range(0, length, 19):
                    self.link.consume(b'\x02' + raw[i:i+19])
                if self.link.consume(b'\x03') != [b'K1']:
                    raise RuntimeError('Demo frame failed the real parser')
            self.revision += 1
            return self.snapshot()


def make_server(lab, port=8768):
    page = (Path(__file__).parent / 'simulator.html').read_bytes()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def reply(self, code, data, mime='application/json; charset=utf-8'):
            if not isinstance(data, bytes):
                data = json.dumps(data, separators=(',', ':')).encode()
            self.send_response(code)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(data)

        def local_request(self):
            port_number = self.server.server_address[1]
            hosts = ('127.0.0.1:' + str(port_number), 'localhost:' + str(port_number))
            if self.headers.get('Host', '') not in hosts:
                self.reply(403, {'error': 'Loopback host required'})
                return False
            origin = self.headers.get('Origin')
            if origin is not None and origin not in tuple('http://' + h for h in hosts):
                self.reply(403, {'error': 'Same-origin request required'})
                return False
            return True

        def do_GET(self):
            if not self.local_request():
                return
            path = urlsplit(self.path).path
            if path in ('/', '/simulator.html'):
                self.reply(200, page, 'text/html; charset=utf-8')
            elif path == '/api/state':
                self.reply(200, lab.snapshot())
            elif path == '/api/font':
                self.reply(200, FONT)
            elif path == '/favicon.ico':
                self.reply(204, b'')
            else:
                self.reply(404, {'error': 'Not found'})

        def do_POST(self):
            if not self.local_request():
                return
            if self.headers.get_content_type() != 'application/json':
                self.reply(415, {'error': 'JSON required'})
                return
            try:
                length = int(self.headers.get('Content-Length', '-1'))
            except ValueError:
                length = -1
            if not 0 < length <= 2048:
                self.reply(413, {'error': 'Body must be between 1 and 2048 bytes'})
                return
            try:
                value = json.loads(self.rfile.read(length))
                if not isinstance(value, dict):
                    raise ValueError('Object required')
                path = urlsplit(self.path).path
                if path == '/api/input':
                    result = lab.input(value.get('action'))
                elif path == '/api/demo-link':
                    result = lab.demo_link(value.get('mode'))
                else:
                    self.reply(404, {'error': 'Not found'})
                    return
            except (ValueError, TypeError, UnicodeError):
                self.reply(400, {'error': 'Invalid request'})
                return
            self.reply(200, result)

    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    server.daemon_threads = True
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8768)
    parser.add_argument('--data-dir', default=str(Path(__file__).parent / '.pocket-state'))
    parser.add_argument('--open', action='store_true', help='Open the local simulator in your browser')
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('port must be 0..65535')
    server = make_server(PocketLab(args.data_dir), args.port)
    url = 'http://127.0.0.1:' + str(server.server_address[1])
    print('Civweave Pocket Lab: ' + url, flush=True)
    print('Local simulator only. No radio, microphone, or real message sending.', flush=True)
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
