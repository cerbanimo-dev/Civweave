#!/usr/bin/env python3
"""Hermetic tests for paired Starling Termux worker. No llama.cpp or phone needed."""
import importlib.util
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from http.server import ThreadingHTTPServer

SOURCE = Path(__file__).resolve().parents[1] / "public/termux/civweave_starling_host.py"
spec = importlib.util.spec_from_file_location("civweave_starling_host", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

GUILD = "community-garden"
JOB = {"schema": module.SCHEMA, "jobId": "a"*32, "guildId": GUILD,
       "personaId": "kami", "model": "qwen35-4b-native",
       "intention": "Build an accessible community garden with neighbors.",
       "brief": "Draft a research plan.", "maxTokens": 440, "action": "draft-only"}


class HostTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / ".civweave-companion"
        self.root.mkdir()
        (self.root / "pairing-token").write_text("b"*64)
        self.calls = []
        self.clock = [1000000.0]
        self.generation = "f"*32

        def companion(method, path, body=None):
            self.calls.append((method,path,body))
            if path == "/v1/generations":
                return {"job_id": self.generation}
            if path == "/v1/generations/" + self.generation:
                return {"state": "completed", "text": "Propose a small garden accessibility survey."}
            if path.endswith("/cancel"):
                return {"cancel_requested": True}
            raise AssertionError("Unexpected Companion call")
        self.companion = companion
        self.host = module.StarlingHost(self.tmp.name, companion_request=companion, clock=lambda:self.clock[0])

    def tearDown(self):
        self.tmp.cleanup()

    def test_validation_is_strict(self):
        for bad in [{**JOB,"model":"cloud"},{**JOB,"personaId":"stranger"},{**JOB,"jobId":"../../secrets"},
                    {**JOB,"maxTokens":True},{**JOB,"intention":"hi"},{**JOB,"action":"shell"}]:
            with self.assertRaises(ValueError):
                module.checked_job(bad)
        schedule={"schema": module.SCHEDULE_SCHEMA, "guildId":GUILD,"enabled":True,
                  "intention":JOB["intention"],"model":JOB["model"],"action":"draft-only"}
        self.assertEqual(module.checked_schedule(schedule)["intervalMinutes"],60)
        with self.assertRaises(ValueError):
            module.checked_schedule({**schedule,"intervalMinutes":2})
        with self.assertRaises(ValueError):
            module.checked_schedule({**schedule,"dailyLimit":False})

    def test_durable_job_deduplicates_and_recovers(self):
        first=self.host.submit(JOB)
        self.assertEqual(first["state"],"queued")
        self.assertEqual(self.host.submit(JOB)["jobId"],JOB["jobId"])
        with self.assertRaises(RuntimeError):
            self.host.submit({**JOB,"brief":"Different task"})
        self.host.tick()
        status=self.host.get_job(JOB["jobId"])
        self.assertEqual(status["state"],"completed")
        self.assertIn("garden accessibility",status["text"])
        self.assertTrue(status["reviewRequired"])
        self.assertFalse(status["claimVerified"])
        self.assertEqual(self.calls[0][1], "/v1/generations")
        payload=self.calls[0][2]
        self.assertEqual(payload["client_key"],JOB["jobId"])
        self.assertEqual(payload["max_tokens"],440)
        self.assertNotIn("tools", payload)
        restarted=module.StarlingHost(self.tmp.name, companion_request=self.companion,clock=lambda:self.clock[0])
        self.assertEqual(restarted.get_job(JOB["jobId"])["state"],"completed")

    def test_abandoned_job_never_reexecutes_after_restart(self):
        self.host.submit(JOB)
        self.host.jobs[JOB["jobId"]]["state"]="running"
        self.host._save()
        restarted=module.StarlingHost(self.tmp.name,companion_request=self.companion,clock=lambda:self.clock[0])
        self.assertEqual(restarted.get_job(JOB["jobId"])["state"],"interrupted")
        restarted.tick()
        self.assertEqual(self.calls,[])

    def test_autopilot_is_explicit_capped_and_persistent(self):
        schedule={"schema":module.SCHEDULE_SCHEMA,"guildId":GUILD,"enabled":True,
                  "intention":JOB["intention"],"model":JOB["model"],
                  "intervalMinutes":15,"dailyLimit":2,"action":"draft-only"}
        self.host.configure(schedule)
        self.host.tick()
        self.assertEqual(len(self.host.jobs),1)
        self.host.tick()
        self.assertEqual(len(self.host.jobs),1)
        self.clock[0]+=16*60
        self.host.tick()
        self.assertEqual(len(self.host.jobs),2)
        self.clock[0]+=16*60
        self.host.tick()
        self.assertEqual(len(self.host.jobs),2)
        self.assertEqual(self.host.configure({"schema":module.SCHEDULE_SCHEMA,"guildId":GUILD,"enabled":False})["enabled"],False)
        self.assertEqual(self.host.status()["schedules"],[])

    def test_pairing_cors_and_no_arbitrary_actions(self):
        server=ThreadingHTTPServer(("127.0.0.1",0),module.make_handler(self.host))
        t=threading.Thread(target=server.serve_forever,daemon=True)
        t.start()
        def request(path,body=None,token=None,origin="https://civweave-staging.pages.dev",method=None):
            headers={"Host":"127.0.0.1:8767","Origin":origin}
            if token is not None: headers["X-Civweave-Token"]=token
            if body is not None: headers["Content-Type"]="application/json"
            req=urllib.request.Request(f"http://127.0.0.1:{server.server_port}"+path,
                  data=json.dumps(body).encode() if body is not None else None,
                  headers=headers,method=method or ("POST" if body is not None else "GET"))
            return urllib.request.urlopen(req, timeout=3)
        try:
            with self.assertRaises(urllib.error.HTTPError) as error: request("/v1/starling/status")
            self.assertEqual(error.exception.code,401)
            with self.assertRaises(urllib.error.HTTPError) as error:
                request("/v1/starling/status",token="b"*64,origin="https://attacker.invalid")
            self.assertEqual(error.exception.code,403)
            with request("/v1/starling/status",token="b"*64) as result:
                self.assertEqual(result.status,200)
                self.assertEqual(result.headers["Access-Control-Allow-Origin"],"https://civweave-staging.pages.dev")
                self.assertFalse(json.load(result)["taskClaims"])
            with self.assertRaises(urllib.error.HTTPError) as error:
                request("/v1/starling/shell",{"command":"echo hi"},token="b"*64)
            self.assertEqual(error.exception.code,404)
            with request("/v1/starling/jobs",JOB,token="b"*64) as result:
                self.assertEqual(result.status,202)
                self.assertEqual(json.load(result)["state"],"queued")
        finally:
            server.shutdown()
            server.server_close()
            t.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
