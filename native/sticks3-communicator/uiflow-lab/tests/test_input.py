import unittest
from firmware.input import Buttons


class ButtonTests(unittest.TestCase):
    def test_tap_does_not_start_voice(self):
        buttons = Buttons()
        self.assertEqual(buttons.update(True, False, 0), [])
        self.assertEqual(buttons.update(False, False, .1), ['a_tap'])

    def test_hold_releases_once_and_never_taps(self):
        buttons = Buttons()
        buttons.update(True, False, 0)
        self.assertEqual(buttons.update(True, False, .5), ['ptt_start'])
        self.assertEqual(buttons.update(True, False, 1), [])
        self.assertEqual(buttons.update(False, False, 1.1), ['ptt_stop'])
        self.assertEqual(buttons.update(False, False, 1.2), [])

    def test_background_cancel_ends_ptt(self):
        buttons = Buttons()
        buttons.update(True, False, 0)
        buttons.update(True, False, 1)
        self.assertEqual(buttons.cancel(), ['ptt_stop'])
        self.assertEqual(buttons.cancel(), [])

    def test_long_b_does_not_advance_menu(self):
        buttons = Buttons()
        buttons.update(False, True, 0)
        self.assertEqual(buttons.update(False, True, 1), ['b_hold'])
        self.assertEqual(buttons.update(False, False, 1.1), [])


if __name__ == '__main__':
    unittest.main()
