import http.client
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from simulator import PocketLab, make_server


class SimulatorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.lab = PocketLab(self.temp.name)
        self.server = make_server(self.lab, port=0)
        self.port = self.server.server_address[1]
        self.worker = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.worker.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.worker.join()
        self.temp.cleanup()

    def request(self, method, path, data=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=2)
        h = {'Content-Type': 'application/json'}
        h.update(headers or {})
        connection.request(method, path, json.dumps(data).encode() if data is not None else None, h)
        response = connection.getresponse()
        code, body = response.status, response.read()
        connection.close()
        return code, body

    def test_real_core_renders_and_input_changes_selection(self):
        code, body = self.request('GET', '/api/state')
        view = json.loads(body)
        self.assertEqual(code, 200)
        self.assertEqual(view['kind'], 'simulator')
        self.assertEqual(view['game']['active']['id'], 'mothbit')
        self.assertTrue(view['commands'])
        self.assertFalse(view['link']['fresh'])
        code, body = self.request('POST', '/api/input', {'action': 'next'})
        self.assertEqual(code, 200)
        self.assertEqual(json.loads(body)['game']['selection'], 1)

    def test_demo_frames_are_labeled_and_never_change_game_progress(self):
        before = self.lab.game.export()
        code, body = self.request('POST', '/api/demo-link', {'mode': 'generating'})
        value = json.loads(body)
        self.assertEqual(code, 200)
        self.assertTrue(value['link']['simulated'])
        self.assertTrue(value['link']['fresh'])
        self.assertEqual(value['link']['mode'], 'generating')
        self.assertEqual(self.lab.game.export(), before)
        self.request('POST', '/api/demo-link', {'mode': 'off'})
        self.assertFalse(self.lab.link.snapshot()['connected'])

    def test_http_rejects_cross_origin_invalid_actions_and_traversal(self):
        for method, path, data, headers, status in [
            ('POST', '/api/input', {'action': 'next'}, {'Origin': 'https://outside.example'}, 403),
            ('POST', '/api/input', {'action': 'next'}, {'Host': 'outside.example'}, 403),
            ('POST', '/api/input', {'action': 'execute'}, {}, 400),
            ('POST', '/api/input', {'action': 'next'}, {'Content-Type': 'text/plain'}, 415),
            ('GET', '/../pocket_game.py', None, {}, 404),
            ('GET', '/api/state', None, {'Host': 'outside.example'}, 403),
        ]:
            with self.subTest(path=path, headers=headers):
                self.assertEqual(self.request(method, path, data, headers)[0], status)
        self.assertEqual(self.request('POST', '/api/input', {'padding': 'x' * 3000})[0], 413)

    def test_core_progress_survives_simulator_restart(self):
        for action in ('select', 'select'):
            self.request('POST', '/api/input', {'action': action})
        reloaded = PocketLab(self.temp.name)
        self.assertEqual(reloaded.game.export(), self.lab.game.export())


if __name__ == '__main__': unittest.main()
