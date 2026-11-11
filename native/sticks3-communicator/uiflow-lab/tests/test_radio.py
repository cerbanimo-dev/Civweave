import unittest
from firmware.radio import Radio
from transport.ble_frames import split_frame


class Client:
    def __init__(self):
        self.data = bytearray()
        self.sent = []
        self.closed = False

    def any(self, uuid):
        return len(self.data)

    def read(self, uuid, size=None):
        size = len(self.data) if size is None else size
        chunk = bytes(self.data[:size])
        del self.data[:size]
        return chunk

    def write(self, data, uuid):
        self.sent.append(bytes(data))

    def close(self):
        self.closed = True


class Server:
    def create_characteristic(self, uuid, **kwargs):
        return uuid
    def add_service(self, uuid, characteristics):
        pass
    def on_receive(self, callback):
        self.receive = callback
    def on_connected(self, callback):
        self.connected = callback
    def on_disconnected(self, callback):
        self.disconnected = callback
    def start(self):
        pass


class Device:
    def __init__(self, name):
        self.server = Server()
        self.closed = False
    def deinit(self):
        self.closed = True


class RadioTests(unittest.TestCase):
    def make_radio(self):
        radio = Radio('cami', Device)
        radio.start(0)
        client = Client()
        radio.ble.server.connected(radio.ble.server, client)
        return radio, client

    def test_preapproval_data_is_dropped(self):
        radio, client = self.make_radio()
        client.data.extend(b''.join(split_frame(b'message', 1)))
        radio.ble.server.receive(radio.ble.server, client)
        self.assertEqual(radio.poll(1), [])
        self.assertFalse(radio.ready)
        self.assertEqual(client.sent, [])
        radio.approve(1)
        radio.poll(1)
        self.assertIn(b'CHcami', client.sent)

    def test_buffered_writes_reassemble(self):
        radio, client = self.make_radio()
        radio.approve(1)
        frame = b'x' * 100
        client.data.extend(b''.join(split_frame(frame, 9)))
        radio.ble.server.receive(radio.ble.server, client)
        self.assertEqual(radio.poll(2), [frame])

    def test_extra_client_cannot_take_over(self):
        radio, client = self.make_radio()
        radio.approve(1)
        stranger = Client()
        radio.ble.server.connected(radio.ble.server, stranger)
        self.assertTrue(stranger.closed)
        self.assertIs(radio.client, client)
        self.assertTrue(radio.ready)

    def test_timeout_and_stop_clear_approval_and_queues(self):
        radio, client = self.make_radio()
        radio.poll(61)
        self.assertIsNone(radio.ble)
        self.assertFalse(radio.ready)
        self.assertTrue(client.closed)

    def test_disconnect_resets_state(self):
        radio, client = self.make_radio()
        radio.approve(1)
        radio.send(b'hello')
        radio.ble.server.disconnected(radio.ble.server, client)
        self.assertFalse(radio.ready)
        self.assertFalse(radio.tx_queue)
        self.assertFalse(radio.rx_queue)


if __name__ == '__main__':
    unittest.main()
