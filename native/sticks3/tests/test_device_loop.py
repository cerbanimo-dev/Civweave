import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from sticks3_main import ButtonInput, SaveScheduler, apply_intents, run_device


class ButtonTests(unittest.TestCase):
    def test_short_press_and_long_back_have_one_owner(self):
        keys = ButtonInput()
        self.assertEqual(keys.update(True, False, 0), [])
        self.assertEqual(keys.update(False, False, 90), ['next'])
        self.assertEqual(keys.update(False, True, 100), [])
        self.assertEqual(keys.update(False, False, 200), ['select'])
        self.assertEqual(keys.update(False, True, 300), [])
        self.assertEqual(keys.update(False, True, 950), ['back'])
        self.assertEqual(keys.update(False, True, 1400), [])
        self.assertEqual(keys.update(False, False, 1500), [])

    def test_hold_is_detected_when_first_sample_is_release(self):
        keys = ButtonInput()
        keys.update(False, True, 10)
        self.assertEqual(keys.update(False, False, 900), ['back'])

    def test_tick_wrap_and_both_buttons_do_not_trigger_accidental_select(self):
        diff = lambda now, then: ((now - then + 2048) % 4096) - 2048
        keys = ButtonInput(diff_ms=diff)
        keys.update(False, True, 4000)
        self.assertEqual(keys.update(False, True, 554), ['back'])
        self.assertEqual(keys.update(False, False, 555), [])
        keys.update(True, True, 800)
        self.assertEqual(keys.update(False, True, 900), [])


class SaveTests(unittest.TestCase):
    def test_render_ticks_never_write_and_changes_are_coalesced(self):
        class Store:
            def __init__(self): self.calls = []
            def save(self, data): self.calls.append(data); return True
        store = Store()
        save = SaveScheduler(store, {'x': 0}, delay_ms=5000)
        for tick in range(0, 20000, 200): save.tick(tick)
        self.assertEqual(store.calls, [])
        save.queue({'x': 1}, 20000)
        save.queue({'x': 2}, 23000)
        save.tick(24999)
        self.assertEqual(store.calls, [])
        save.tick(25000)
        self.assertEqual(store.calls, [{'x': 2}])
        save.tick(30000)
        self.assertEqual(len(store.calls), 1)

    def test_save_failure_is_visible_and_retry_is_bounded(self):
        class Store:
            calls = 0
            def save(self, data):
                self.calls += 1
                if self.calls == 1: raise OSError('full')
                return True
        store = Store()
        save = SaveScheduler(store, {'x': 0}, delay_ms=5000, retry_ms=30000)
        save.queue({'x': 1}, 0)
        save.tick(5000)
        self.assertIn('SAVE FAILED', save.error)
        for tick in range(5001, 35000, 100): save.tick(tick)
        self.assertEqual(store.calls, 1)
        save.tick(35000)
        self.assertEqual(store.calls, 2)
        self.assertEqual(save.error, '')

    def test_return_to_saved_state_cancels_pending_write(self):
        class Store:
            def save(self, data): raise AssertionError('should not save')
        save = SaveScheduler(Store(), {'x': 0})
        save.queue({'x': 1}, 0)
        save.queue({'x': 0}, 100)
        save.tick(100000)


class IntentTests(unittest.TestCase):
    class Link:
        def __init__(self, connected): self.connected = connected
        def snapshot(self): return {'connected': self.connected}
        def query_bytes(self): return b'Q'
        def dismiss_bytes(self): return b'X'

    def test_offline_and_note_drafts_do_not_transmit(self):
        calls = []
        emit = lambda packet: calls.append(packet) or True
        self.assertIn('NO PHONE', apply_intents([{'type': 'query'}], self.Link(False), emit))
        self.assertIn('UNSENT', apply_intents([{'type': 'note_draft', 'text': 'Hi'}], self.Link(True), emit))
        self.assertEqual(calls, [])

    def test_requested_query_is_not_a_claim_of_delivery(self):
        calls = []
        self.assertEqual(apply_intents([{'type': 'query'}], self.Link(True), lambda packet: calls.append(packet) or True), 'QUERY REQUESTED')
        self.assertEqual(calls, [b'Q'])
        self.assertIn('FAILED', apply_intents([{'type': 'query'}], self.Link(True), lambda packet: False))


class DeviceLoopTests(unittest.TestCase):
    class Clock:
        def __init__(self): self.now = 0
        def ticks_ms(self): return self.now
        def ticks_diff(self, now, then): return now - then
        def sleep_ms(self, value): self.now += value

    class Display:
        def __init__(self, width=135): self.w = width; self.calls = 0; self.rotation = None
        def setRotation(self, value): self.rotation = value
        def width(self): return self.w
        def height(self): return 240
        def fillRect(self, *args): self.calls += 1

    class Key:
        def __init__(self, clock, start, end): self.clock = clock; self.start = start; self.end = end
        def isPressed(self): return self.start <= self.clock.now < self.end

    class Game:
        def __init__(self): self.actions = []
        def input(self, action): self.actions.append(action); return []
        def export(self): return {'progress': 0}
        def snapshot(self):
            return {'screen': 'home', 'selection': 0, 'options': ['Explore'],
                    'active': {'id': 'mothbit', 'name': 'Mothbit'},
                    'energy': 8, 'bond': 0, 'berries': 3, 'notice': 'Ready'}

    class Store:
        def save(self, data): raise AssertionError('pure navigation must not save')

    class Link:
        def snapshot(self): return {'connected': False}

    def make_device(self, clock, width=135):
        class M5:
            def __init__(self, test):
                self.Lcd = test.Display(width)
                self.BtnA = test.Key(clock, 20, 80)
                self.BtnB = test.Key(clock, 100, 900)
                self.begins = 0
                self.updates = 0
            def begin(self): self.begins += 1
            def update(self): self.updates += 1
        return M5(self)

    def test_offline_device_loop_initializes_once_and_bounds_animation(self):
        clock = self.Clock()
        device = self.make_device(clock)
        game = self.Game()
        result = run_device(device, game, self.Link(), self.Store(), clock, iterations=100)
        self.assertEqual(device.begins, 1)
        self.assertEqual(device.updates, 100)
        self.assertEqual(game.actions, ['next', 'back'])
        self.assertEqual(result['frames'], 10)
        self.assertEqual(device.Lcd.rotation, 0)
        self.assertGreater(device.Lcd.calls, 100)

    def test_wrong_board_shape_stops_before_running_game(self):
        clock = self.Clock()
        device = self.make_device(clock, width=240)
        with self.assertRaisesRegex(RuntimeError, '135x240'):
            run_device(device, self.Game(), self.Link(), self.Store(), clock, iterations=2)
        self.assertEqual(device.updates, 0)


if __name__ == '__main__':
    unittest.main()
