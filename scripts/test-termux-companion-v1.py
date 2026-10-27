#!/usr/bin/env python3
"""Local-only Termux Companion contract tests; no downloads or package installs."""
import importlib.util
import io
import json
import tempfile
import time
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch
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

    def test_discovers_existing_download_without_copy(self):
        downloads = Path(self.tmp.name) / "storage" / "downloads"
        downloads.mkdir(parents=True)
        file = downloads / module.MODELS["qwen35-4b-native"]["file"]
        file.write_bytes(b"existing model fixture")
        selected = self.app.find_existing_model("qwen35-4b-native")
        self.assertEqual(selected, file)
        state = self.app.status()
        self.assertTrue(state["models"]["qwen35-4b-native"]["present"])
        self.assertEqual(state["models"]["qwen35-4b-native"]["location"], "Android Downloads")
        self.assertFalse(state["models"]["qwen35-4b-native"]["verified"])
        with self.assertRaisesRegex(RuntimeError, "already exists|already found|present"):
            self.app._download("qwen35-4b-native")
        self.assertFalse((Path(self.tmp.name) / "models" / file.name).exists())
        with self.assertRaisesRegex(RuntimeError, "SHA-256"):
            self.app._verify("qwen35-4b-native")
        self.assertEqual(file.read_bytes(), b"existing model fixture")

    def test_existing_model_under_llama_cpp_tree(self):
        directory = Path(self.tmp.name) / "llama.cpp" / "models"
        directory.mkdir(parents=True)
        model = directory / module.MODELS["qwen35-4b-native"]["file"]
        model.write_bytes(b"old model fixture")
        self.assertEqual(self.app.find_existing_model("qwen35-4b-native"), model)
        self.assertEqual(self.app.status()["models"]["qwen35-4b-native"]["location"],
                         "Termux llama.cpp/models")

    def test_rejects_symlinked_candidate(self):
        directory = Path(self.tmp.name) / "models"
        target = Path(self.tmp.name) / "real.gguf"
        target.write_bytes(b"file")
        (directory / module.MODELS["qwen35-4b-native"]["file"]).symlink_to(target)
        self.assertIsNone(self.app.find_existing_model("qwen35-4b-native"))

    def test_long_context_choices_and_safe_limits(self):
        self.assertEqual(module.DEFAULT_CONTEXT, 32768)
        self.assertEqual(module.model_options({}), ("qwen35-4b-native", 32768))
        for size in (1024, 2048, 4096, 8192, 16384, 32768, 65536):
            self.assertEqual(module.model_options({"context": size})[1], size)
        for size in (-1, 0, 32767, 65537, 262144, 3.5, True, "32768"):
            with self.assertRaises(ValueError):
                module.model_options({"context": size})
        self.assertEqual(self.app.status()["context"], 32768)

    def test_background_generation_is_independent_and_durable(self):
        body = {"model": "qwen35-4b-native",
                "client_key": "c" * 32,
                "messages": [{"role": "user", "content": "Write a lesson."}],
                "max_tokens": 256, "temperature": 0.2}
        frames = [
            {"choices": [{"delta": {"content": "First passage. "}, "finish_reason": None}]},
            {"choices": [{"delta": {"content": "Second passage."}, "finish_reason": None}]},
            {"choices": [{"delta": {}, "finish_reason": "stop"}],
             "usage": {"completion_tokens": 7, "prompt_tokens": 15}}
        ]
        stream = b"".join(b"data: " + json.dumps(frame).encode() + b"\n\n" for frame in frames)
        stream += b"data: [DONE]\n\n"
        def model_reply(request, **kwargs):
            self.assertEqual(request.full_url, "http://127.0.0.1:8080/v1/chat/completions")
            payload = json.loads(request.data)
            self.assertEqual(payload["model"], "qwen35-4b-native")
            self.assertTrue(payload["stream"])
            return io.BytesIO(stream)
        with (patch.object(self.app, "server_responding", return_value=True),
              patch.object(module.urllib.request, "urlopen", side_effect=model_reply)):
            accepted = self.app.submit_generation(body)
            self.assertRegex(accepted["job_id"], r"^[0-9a-f]{32}$")
            for _ in range(150):
                snapshot = self.app.generation(accepted["job_id"])
                if snapshot["state"] not in ("queued", "running"):
                    break
                time.sleep(0.02)
            self.assertEqual(snapshot["state"], "completed", snapshot["error"])
            self.assertEqual(snapshot["text"], "First passage. Second passage.")
            self.assertEqual(snapshot["finish_reason"], "stop")
            self.assertEqual(snapshot["usage"]["completion_tokens"], 7)
            duplicate = self.app.submit_generation(body)
            self.assertTrue(duplicate["reused"])
            self.assertEqual(duplicate["job_id"], accepted["job_id"])
        restored = module.Controller(Path(self.tmp.name))
        self.assertEqual(restored.generation(accepted["job_id"])["text"], snapshot["text"])
        self.assertEqual(restored.generation(accepted["job_id"])["state"], "completed")
        self.assertNotIn("cancel_requested", restored.generation(accepted["job_id"]))

    def test_generation_validation_and_authentication(self):
        payload = {"model": "qwen35-4b-native", "client_key": "b" * 32,
                   "messages": [{"role": "user", "content": "Valid."}],
                   "max_tokens": 120}
        for bad in [
            {**payload, "model": "../../etc/passwd"},
            {**payload, "client_key": "invalid"},
            {**payload, "max_tokens": 20000},
            {**payload, "messages": [{"role": "tool", "content": "execute code"}]},
            {**payload, "messages": [{"role": "user", "content": "x" * 32001}]}
        ]:
            with self.assertRaises(ValueError):
                self.app.submit_generation(bad)
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.request("/v1/generations", "POST", origin=self.origin, body=payload)
        self.assertEqual(error.exception.code, 401)
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.request("/v1/generations", "POST", secret=self.app.token,
                         origin="https://attacker.invalid", body=payload)
        self.assertEqual(error.exception.code, 403)
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.request("/v1/generations/" + "f" * 32, secret=self.app.token, origin=self.origin)
        self.assertEqual(error.exception.code, 404)

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
