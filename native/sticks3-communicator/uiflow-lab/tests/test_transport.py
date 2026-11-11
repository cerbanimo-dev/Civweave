import json
import os
import tempfile
import unittest

from transport.ble_frames import Assembler, split_frame
from transport.storage import StateStore


class FragmentTests(unittest.TestCase):
    def test_boundary_and_round_trip(self):
        frame = bytes(range(161))
        chunks = split_frame(frame, 7)
        self.assertEqual(len(chunks), 11)
        self.assertTrue(all(len(c) <= 20 for c in chunks))
        receiver = Assembler()
        complete = [receiver.feed(c, i / 100) for i, c in enumerate(chunks)]
        self.assertEqual(complete[-1], frame)
        self.assertTrue(all(c is None for c in complete[:-1]))

    def test_duplicate_fragment_is_not_appended_twice(self):
        frame = b'a' * 41
        chunks = split_frame(frame, 4)
        receiver = Assembler()
        receiver.feed(chunks[0], 0)
        receiver.feed(chunks[1], 0.1)
        receiver.feed(chunks[1], 0.2)
        self.assertEqual(receiver.feed(chunks[2], 0.3), frame)

    def test_out_of_order_and_timeout_cannot_yield_partial_message(self):
        chunks = split_frame(b'x' * 45, 3)
        receiver = Assembler()
        self.assertIsNone(receiver.feed(chunks[0], 0))
        self.assertIsNone(receiver.feed(chunks[2], 0.1))
        self.assertIsNone(receiver.feed(chunks[1], 0.2))
        receiver.feed(chunks[0], 1)
        self.assertIsNone(receiver.feed(chunks[1], 5))
        self.assertIsNone(receiver.feed(chunks[2], 5.1))

    def test_disconnect_resets_partial_transfer(self):
        chunks = split_frame(b'x' * 23, 1)
        receiver = Assembler()
        receiver.feed(chunks[0], 0)
        receiver.reset()
        self.assertIsNone(receiver.feed(chunks[1], 1))

    def test_rejects_bad_lengths_and_unbounded_input(self):
        receiver = Assembler()
        for invalid in (b'', bytes([193, 0, 0, 1, 1]), bytes([193, 1, 0, 12, 1]),
                        bytes([193, 1, 0, 2, 1]), b'x' * 21):
            self.assertIsNone(receiver.feed(invalid, 0))
        for frame in (b'', b'x' * 162):
            with self.assertRaises(ValueError):
                split_frame(frame, 1)


class StorageTests(unittest.TestCase):
    def test_torn_latest_slot_preserves_previous_valid_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            store = StateStore(os.path.join(folder, 'state'))
            store.save({'game': 'first'})
            store.save({'game': 'second'})
            self.assertEqual(store.load(), {'game': 'second'})
            with open(store.slot_path(2 % 2), 'w') as output:
                output.write('{broken')
            self.assertEqual(StateStore(os.path.join(folder, 'state')).load(), {'game': 'first'})

    def test_checksum_rejects_silent_data_damage(self):
        with tempfile.TemporaryDirectory() as folder:
            store = StateStore(os.path.join(folder, 'state'))
            store.save({'bond': 1})
            path = store.slot_path(1)
            with open(path) as input_file:
                envelope = json.load(input_file)
            envelope['payload'] = '{"bond":99}'
            with open(path, 'w') as output:
                json.dump(envelope, output)
            self.assertIsNone(StateStore(os.path.join(folder, 'state')).load())

    def test_large_or_non_object_snapshot_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            store = StateStore(os.path.join(folder, 'state'))
            for invalid in ([], {'data': 'x' * 40000}):
                with self.assertRaises(ValueError):
                    store.save(invalid)


if __name__ == '__main__':
    unittest.main()
