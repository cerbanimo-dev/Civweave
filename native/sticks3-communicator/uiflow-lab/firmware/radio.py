"""Opt-in UIFlow2 BLE lab adapter. Physical approval is not peer authentication.

No microphone, encryption, IP connection, discovery or pairing is started here
until start() is explicitly called by the local user.
"""
from transport.ble_frames import Assembler, split_frame, SERVICE, RX, TX


class Radio:
    def __init__(self, node_id, device_factory):
        self.node_id = node_id
        self.factory = device_factory
        self.ble = None
        self.client = None
        self.ready = False
        self.started = 0
        self.hello_at = -10
        self.transfer_id = 0
        self.tx_queue = []
        self.rx_queue = []
        self.rx_stream = bytearray()
        self.assembler = Assembler()
        self.notice = 'Radio off'

    def start(self, now):
        if self.ble is not None:
            return
        self.started = now
        try:
            self.ble = self.factory(name='CW-Pocket-' + self.node_id)
            server = self.ble.server
            server.add_service(SERVICE, [
                server.create_characteristic(RX, write=True),
                server.create_characteristic(TX, read=True, notify=True)])
            server.on_receive(self._receive)
            server.on_connected(self._connected)
            server.on_disconnected(self._disconnected)
            server.start()
            self.notice = 'Link open for 60s'
        except Exception:
            self.stop()
            raise

    def _connected(self, server, client):
        if self.client is not None:
            client.close()
            return
        self.client = client
        self.ready = False
        self.notice = 'A approve / B deny'

    def _disconnected(self, server, client):
        if client is self.client:
            self.client = None
            self.ready = False
            self.tx_queue = []
            self.rx_queue = []
            self.rx_stream = bytearray()
            self.assembler.reset()
            self.notice = 'Link disconnected'

    def _receive(self, server, client):
        # Bounded copying only; assemble/decode/store in the main loop.
        try:
            for _ in range(24):
                if not client.any(RX):
                    break
                chunk = client.read(RX, 20)
                if self.ready and client is self.client and chunk:
                    if len(self.rx_queue) >= 48:
                        self.notice = 'RX busy: retry'
                        self.rx_queue = []
                        self.rx_stream = bytearray()
                        self.assembler.reset()
                        break
                    self.rx_queue.append(bytes(chunk))
        except Exception:
            self.notice = 'BLE read failed'

    def approve(self, now):
        if self.client is not None and now - self.started < 60:
            # Never carry bytes written before the owner's approval into the
            # newly approved session.
            if self.client.any(RX):
                self.client.read(RX, 512)
                if self.client.any(RX):
                    self.stop()
                    self.notice = 'Preapproval flood'
                    return
            self.rx_queue = []
            self.rx_stream = bytearray()
            self.assembler.reset()
            self.ready = True
            self.hello_at = now - 3
            self.notice = 'BLE LAB plaintext'

    def send(self, frame):
        if not self.ready:
            return False
        self.transfer_id = (self.transfer_id % 255) + 1
        chunks = split_frame(frame, self.transfer_id)
        if len(self.tx_queue) + len(chunks) > 64:
            self.notice = 'TX busy: retry'
            return False
        self.tx_queue.extend(chunks)
        return True

    def control(self, down):
        if self.ready and len(self.tx_queue) < 64:
            self.tx_queue.append(b'CP1' if down else b'CP0')

    def poll(self, now):
        if self.ble is None:
            return []
        if not self.ready and now - self.started >= 60:
            self.stop()
            self.notice = 'Link window ended'
            return []
        complete = []
        for _ in range(min(24, len(self.rx_queue))):
            self.rx_stream.extend(self.rx_queue.pop(0))
            while len(self.rx_stream) >= 20:
                piece = bytes(self.rx_stream[:20])
                del self.rx_stream[:20]
                frame = self.assembler.feed(piece, now)
                if frame is not None:
                    complete.append(frame)
        if self.ready and self.client is not None:
            try:
                if now - self.hello_at >= 2:
                    self.client.write(b'CH' + self.node_id.encode('utf-8'), TX)
                    self.hello_at = now
                elif self.tx_queue:
                    self.client.write(self.tx_queue.pop(0), TX)
            except Exception:
                self.stop()
                self.notice = 'BLE write failed'
        return complete

    def stop(self):
        client, ble = self.client, self.ble
        self.client = self.ble = None
        self.ready = False
        self.tx_queue = []
        self.rx_queue = []
        self.rx_stream = bytearray()
        self.assembler.reset()
        if client is not None:
            try:
                client.close()
            except Exception:
                pass
        if ble is not None:
            try:
                ble.deinit()
            except Exception:
                pass
        self.notice = 'Radio off'
