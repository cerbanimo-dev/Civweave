#!/usr/bin/env python3
"""Local-only Termux Companion contract tests; no downloads or package installs."""
import importlib.util
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

FILE = Path(__file__).resolve().parents[1] / "public/termux/civweave_companion.py"
spec = importlib.util.spec_from_file_location("civweave_companion", FILE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CompanionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.app = module.Controller(Path(self.tmp.name))
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), module.make_handler(self.app))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"
        self.origin = "https://civweave-staging.pages.dev"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.tmp.cleanup()

    def request(self, path, method="GET", secret=None, origin=None, body=None):
        headers = {}
        if origin is not None:
            headers["Origin"] = origin
        if secret is not None:
            headers["X-Civweave-Token"] = secret
        if body is not None:
            headers["Content-Type"] = "application/json"
        payload = json.dumps(body).encode() if body is not None else None
        return urllib.request.urlopen(urllib.request.Request(
            self.url + path, data=payload, method=method, headers=headers
        ), timeout=3)

    def test_status_is_authenticated_and_cors_is_allowlisted(self):
        with self.assertRaises(urllib.error.HTTPError) as err:
            self.request("/v1/status", origin=self.origin)
        self.assertEqual(err.exception.code, 401)
        with self.request("/v1/status", secret=self.app.token, origin=self.origin) as r:
            self.assertEqual(r.status, 200)
            self.assertEqual(r.headers["Access-Control-Allow-Origin"], self.origin)
            body = json.load(r)
            self.assertEqual(body["schema"], "civweave.termux-companion.v1")
            self.assertIn("qwen35-4b-native", body["models"])
            self.assertNotIn("token", body)
        with self.assertRaises(urllib.error.HTTPError) as err:
            self.request("/v1/status", secret=self.app.token, origin="https://attacker.invalid")
        self.assertEqual(err.exception.code, 403)

    def test_preflight_and_unknown_action_fail_closed(self):
        with self.request("/v1/actions/start", method="OPTIONS", origin=self.origin) as r:
            self.assertEqual(r.status, 204)
            self.assertIn("X-Civweave-Token", r.headers["Access-Control-Allow-Headers"])
        with self.assertRaises(urllib.error.HTTPError) as err:
            self.request("/v1/actions/start", method="OPTIONS", origin="https://attacker.invalid")
        self.assertEqual(err.exception.code, 403)
        with self.assertRaises(urllib.error.HTTPError) as err:
            self.request("/v1/actions/execute", method="POST", secret=self.app.token,
                         origin=self.origin, body={"command": "rm -rf /"})
        self.assertEqual(err.exception.code, 404)

    def test_no_shell_commands_can_be_injected(self):
        with self.assertRaises(ValueError):
            self.app.run_action("start", {"model": "../../etc/passwd"})
        with self.assertRaises(ValueError):
            self.app.run_action("start", {"context": "; rm -rf /"})
        with self.assertRaises(ValueError):
            self.app.run_action("download", {"model": "custom-url"})
        self.assertFalse(self.app.server_running())


if __name__ == "__main__":
    unittest.main()
