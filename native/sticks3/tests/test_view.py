import copy
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from pocket_view import FONT, HEIGHT, WIDTH, draw_on, render


def sample(screen='home', creature='mothbit'):
    return {
        'screen': screen, 'selection': 0, 'title': 'Pocket companions',
        'options': ['Explore', 'Care', 'Collection', 'Link'],
        'notice': 'A new adventure awaits',
        'active': {'id': creature, 'name': creature.title()},
        'energy': 8, 'berries': 3, 'bond': 15,
        'collection': ['mothbit', 'glowfin', 'pebblehop', 'breezelet'],
        'encounter': None, 'steps': 0,
    }


class RendererTests(unittest.TestCase):
    def test_every_screen_stays_inside_portrait_display(self):
        for screen in ('home', 'trail', 'encounter', 'care', 'collection', 'link'):
            state = sample(screen)
            state['selection'] = 4
            state['options'] = ['Mothbit', 'Glowfin', 'Pebblehop', 'Breezelet', 'Home']
            state['encounter'] = 'pebblehop' if screen == 'encounter' else None
            commands = render(state, {'connected': False}, frame=999999)
            self.assertLess(len(commands), 600)
            self.assertEqual(commands[0], ['rect', 0, 0, WIDTH, HEIGHT, 0x101629])
            for command in commands:
                kind = command[0]
                if kind == 'rect':
                    _, x, y, w, h, color = command
                    self.assertGreaterEqual(x, 0)
                    self.assertGreaterEqual(y, 0)
                    self.assertGreater(w, 0)
                    self.assertGreater(h, 0)
                    self.assertLessEqual(x + w, WIDTH)
                    self.assertLessEqual(y + h, HEIGHT)
                elif kind == 'text':
                    _, text, x, y, color = command
                    self.assertGreaterEqual(x, 0)
                    self.assertGreaterEqual(y, 0)
                    self.assertLessEqual(x + len(text) * 6, WIDTH)
                    self.assertLessEqual(y + 8, HEIGHT)
                    self.assertTrue(all(char in FONT for char in text))
                else:
                    self.fail('Unrecognized display primitive: ' + kind)
                self.assertTrue(0 <= color <= 0xFFFFFF)

    def test_status_does_not_invent_a_live_radio_or_server(self):
        state = sample('link')
        text = lambda link: '\n'.join(c[1] for c in render(state, link) if c[0] == 'text')
        offline = text({'connected': False, 'fresh': True, 'mode': 'generating'})
        self.assertIn('OFFLINE', offline)
        self.assertNotIn('GENERATING', offline)
        stale = text({'connected': True, 'fresh': False, 'mode': 'generating', 'agent': 'Moss'})
        self.assertIn('STATUS STALE', stale)
        self.assertNotIn('GENERATING', stale)
        linked = text({'connected': True, 'fresh': True, 'mode': 'generating', 'agent': 'Moss', 'task': 'Working'})
        self.assertIn('PHONE REPORTED', linked)
        self.assertIn('GENERATING', linked)
        self.assertIn('LORA: NOT ATTACHED', linked)
        self.assertNotIn('VERIFIED', linked)

    def test_render_is_read_only_and_handles_long_untrusted_text(self):
        state = sample('link')
        link = {'connected': True, 'fresh': True, 'agent': 'A' * 200,
                'task': '<script>\n\t' + '\u2603' * 100, 'mode': 'idle'}
        original = copy.deepcopy((state, link))
        render(state, link)
        self.assertEqual((state, link), original)

    def test_original_creatures_have_distinct_visible_sprites(self):
        pictures = [render(sample(creature=name), {}) for name in ('mothbit', 'glowfin', 'pebblehop', 'breezelet')]
        art = [tuple(tuple(c) for c in commands if c[0] == 'rect' and 30 <= c[2] < 110) for commands in pictures]
        self.assertEqual(len(set(art)), 4)

    def test_bitmap_painter_needs_only_fill_rect(self):
        class Display:
            def __init__(self): self.calls = []
            def fillRect(self, *args): self.calls.append(args)
        display = Display()
        draw_on(display, [['rect', 0, 0, WIDTH, HEIGHT, 0], ['text', 'HELLO 5!', 3, 5, 0xFFFFFF]])
        self.assertGreater(len(display.calls), 10)
        for x, y, w, h, _ in display.calls:
            self.assertTrue(0 <= x < WIDTH and 0 <= y < HEIGHT)
            self.assertLessEqual(x + w, WIDTH)
            self.assertLessEqual(y + h, HEIGHT)


if __name__ == '__main__':
    unittest.main()
