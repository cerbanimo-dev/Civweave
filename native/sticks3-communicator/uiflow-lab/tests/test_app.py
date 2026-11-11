"""Host regressions for application recovery and control/delivery boundaries."""
import contextlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import firmware.main as firmware
from core import protocol
from core.game import Game
from core.messenger import Messenger
from tools.ble_bridge import Bridge
from transport.storage import StateStore


class FakeFonts:
    Montserrat14 = "test-font"


class FakeLCD:
    FONTS = FakeFonts()

    def __init__(self):
        self.rendered = []
        self.brightness = None

    def setFont(self, value):
        pass

    def setRotation(self, value):
        pass

    def width(self):
        return 135

    def height(self):
        return 240

    def setBrightness(self, value):
        self.brightness = value

    def clear(self, color):
        self.rendered = []

    def setTextColor(self, foreground, background):
        pass

    def drawString(self, value, x, y):
        self.rendered.append(str(value))

    def fillRect(self, x, y, width, height, color):
        pass


class FakeM5:
    def __init__(self):
        self.Lcd = FakeLCD()


class FakeRadio:
    def __init__(self):
        self.ready = True
        self.client = object()
        self.ble = object()
        self.notice = "BLE LAB plaintext"
        self.controls = []
        self.sent = []
        self.incoming = []

    def poll(self, now):
        frames, self.incoming = self.incoming, []
        return frames

    def control(self, down):
        self.controls.append(down)

    def send(self, frame):
        self.sent.append(frame)
        return True

    def stop(self):
        self.ready = False
        self.client = self.ble = None


class AppTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        base = patch.object(firmware, "BASE", self.folder.name)
        base.start()
        self.addCleanup(base.stop)
        self.output = contextlib.redirect_stdout(io.StringIO())
        self.output.__enter__()
        self.addCleanup(self.output.__exit__, None, None, None)

    def make_app(self):
        def no_radio(**kwargs):
            raise AssertionError("Test must not initialize physical Bluetooth")
        return firmware.App(FakeM5(), no_radio,
                            {"node_id": "cami", "peer": "desk", "companion": "Mossling"})

    def test_semantic_fallback_preserves_good_slot_on_next_write(self):
        prefix = str(Path(self.folder.name) / "state-cami")
        store = StateStore(prefix)
        game = Game()
        game.act("care")
        good = {"schema": "civweave.pocket.save.v1", "game": game.export_state(),
                "messages": Messenger("cami").export_state()}
        store.save(good)
        retained_path = Path(store.slot_path(1))
        original_bytes = retained_path.read_bytes()
        newer_bad = dict(good)
        newer_bad["game"] = {"v": 999}
        store.save(newer_bad)

        app = self.make_app()
        self.assertEqual(app.game.export_state(), good["game"])
        self.assertEqual(app.store.generation, 1)
        app.game.act("explore")
        self.assertTrue(app.save(1))
        self.assertEqual(app.store.generation, 2)
        self.assertEqual(retained_path.read_bytes(), original_bytes)

        # A torn replacement of the rejected slot must still recover the old
        # complete application state, not just a checksum-valid JSON envelope.
        Path(app.store.slot_path(0)).write_text('{"partial":')
        recovered = self.make_app()
        self.assertEqual(recovered.game.export_state(), good["game"])

    def test_async_disconnect_cancels_ptt_until_button_is_released(self):
        app = self.make_app()
        radio = FakeRadio()
        app.radio = radio
        app.tick(0, False, False)
        app.tick(0.1, True, False)
        app.tick(0.6, True, False)
        self.assertTrue(app.ptt)
        self.assertTrue(app.buttons.ptt)
        self.assertEqual(radio.controls, [True])

        # This models a callback between loop ticks, before poll() can report
        # a transition. A still-held button must not restart the old session.
        radio.ready, radio.client = False, None
        app.tick(0.7, True, False)
        self.assertFalse(app.ptt)
        self.assertFalse(app.buttons.ptt)
        self.assertEqual(radio.controls, [True, False])
        app.tick(1.5, True, False)
        self.assertFalse(app.ptt)
        self.assertEqual(radio.controls, [True, False])
        app.tick(2, False, False)
        self.assertFalse(app.ignore_a_until_up)
        self.assertEqual(app.game.xp, 0)  # Releasing cannot synthesize a tap.

        radio.ready, radio.client = True, object()
        app.tick(2.1, True, False)
        app.tick(2.6, True, False)
        self.assertTrue(app.ptt)
        self.assertEqual(radio.controls, [True, False, True])

    def test_failed_home_save_does_not_claim_saved(self):
        app = self.make_app()
        app.dirty = True
        app.page = firmware.PAGES.index("Train")
        with patch.object(app.store, "save", side_effect=OSError("storage unavailable")):
            app.handle("b_hold", 1)
        self.assertEqual(app.page, 0)
        self.assertTrue(app.dirty)
        self.assertEqual(app.notice, "Save failed")
        app.draw(1)
        self.assertIn("Save failed", app.m5.Lcd.rendered)
        self.assertFalse(any("saved" in text.lower() for text in app.m5.Lcd.rendered))

    def test_inbox_receipt_waits_for_successful_save(self):
        app = self.make_app()
        radio = FakeRadio()
        app.radio = radio
        frame = protocol.encode(protocol.TEXT, "0123456789abcdef", "desk", "cami", "Hello")
        radio.incoming = [frame]
        with patch.object(app.store, "save", side_effect=OSError("storage unavailable")):
            app.tick(1, False, False)
        self.assertEqual(len(app.messenger.inbox), 1)
        self.assertEqual(radio.sent, [])

        # A duplicate triggers another save attempt and then a receipt; it must
        # neither acknowledge the failed write nor create another inbox entry.
        radio.incoming = [frame]
        app.tick(2, False, False)
        self.assertEqual(len(app.messenger.inbox), 1)
        self.assertEqual(len(radio.sent), 1)
        receipt = protocol.decode(radio.sent[0])
        self.assertEqual((receipt["kind"], receipt["id"], receipt["to"]),
                         (protocol.ACK, "0123456789abcdef", "desk"))


class DesktopPresentationTests(unittest.TestCase):
    def test_received_body_is_visible_and_terminal_escaped(self):
        bridge = Bridge.__new__(Bridge)
        bridge.desktop = Messenger("desk")
        logs = []
        bridge.log = logs.append
        body = "Hello\ncrew's pocket"
        frame = protocol.encode(protocol.TEXT, "0123456789abcdef", "cami", "desk", body)
        bridge.desktop.receive(frame, 0)
        bridge.desktop_events()
        displayed = [line for line in logs if line.startswith("desk message from ")]
        self.assertEqual(displayed, ["desk message from cami: " + repr(body)])
        self.assertNotIn("\n", displayed[0])


if __name__ == "__main__":
    unittest.main()
