"""UIFlow2 application adapter for M5StickS3; start with Run Once.

Upload this file and pocket_game.py, pocket_save.py, pocket_link.py and
pocket_view.py to the same importable device directory. The app never opens
the microphone, changes firmware, or enables Wi-Fi. Bluetooth is optional.
"""

from pocket_view import HEIGHT, INK, WIDTH, draw_on, render

SERVICE = 'bc257ca0-197e-4ba4-8ab7-c70ef45c0010'
RX = 'bc257ca0-197e-4ba4-8ab7-c70ef45c0011'
TX = 'bc257ca0-197e-4ba4-8ab7-c70ef45c0012'
SAVE_PATH = 'civweave-pocket-save'


def _difference(now, then):
    return now - then


def _copy(value):
    if isinstance(value, dict):
        return {key: _copy(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_copy(item) for item in value]
    return value


class ButtonInput:
    """One event owner: A release = next, B release = select, B hold = back."""

    def __init__(self, diff_ms=None, hold_ms=650):
        self.diff_ms = diff_ms or _difference
        self.hold_ms = hold_ms
        self.a_down = False
        self.b_down = False
        self.b_started = 0
        self.b_held = False
        self.a_blocked = False

    def update(self, a_down, b_down, now_ms):
        events = []
        a_down = bool(a_down)
        b_down = bool(b_down)
        if a_down and not self.a_down:
            self.a_blocked = b_down
        if a_down and b_down:
            self.a_blocked = True
        if b_down and not self.b_down:
            self.b_started = now_ms
            self.b_held = False
        if self.b_down and not self.b_held and self.diff_ms(now_ms, self.b_started) >= self.hold_ms:
            events.append('back')
            self.b_held = True
        if self.b_down and not b_down:
            if not self.b_held:
                events.append('select')
            self.b_held = False
        if self.a_down and not a_down and not self.a_blocked and not b_down and not self.b_down:
            events.append('next')
        self.a_down = a_down
        self.b_down = b_down
        return events


class SaveScheduler:
    """Coalesce game edits; redraws never write flash; failed writes stay visible."""

    def __init__(self, store, saved, delay_ms=5000, retry_ms=30000, diff_ms=None):
        self.store = store
        self.saved = _copy(saved)
        self.pending = None
        self.started = None
        self.delay_ms = delay_ms
        self.retry_ms = retry_ms
        self.wait_ms = delay_ms
        self.diff_ms = diff_ms or _difference
        self.error = ''

    def queue(self, data, now_ms):
        if data == self.saved:
            self.pending = None
            self.started = None
            self.error = ''
            return
        self.pending = _copy(data)
        if self.started is None:
            self.started = now_ms
            self.wait_ms = self.delay_ms

    def tick(self, now_ms):
        if self.pending is None or self.started is None:
            return False
        if self.diff_ms(now_ms, self.started) < self.wait_ms:
            return False
        try:
            if not self.store.save(self.pending):
                raise ValueError('save rejected')
        except (OSError, ValueError) as error:
            self.error = 'SAVE FAILED - RAM ONLY'
            self.started = now_ms
            self.wait_ms = self.retry_ms
            print('Pocket save:', repr(error))
            return False
        self.saved = self.pending
        self.pending = None
        self.started = None
        self.error = ''
        return True


def apply_intents(intents, link, emit):
    """Forward only existing query/dismiss actions; local notes remain drafts."""
    notice = ''
    for intent in intents[:4]:
        kind = intent.get('type')
        if kind == 'note_draft':
            notice = 'LOCAL DRAFT / UNSENT'
        elif kind in ('query', 'dismiss'):
            if not link.snapshot().get('connected'):
                notice = 'NO PHONE LINKED'
                continue
            packet = link.query_bytes() if kind == 'query' else link.dismiss_bytes()
            if emit(packet):
                notice = 'QUERY REQUESTED' if kind == 'query' else 'DISMISS REQUESTED'
            else:
                notice = 'PHONE SEND FAILED'
    return notice


class BleAdapter:
    """Bounded adapter for the existing Pocket BLE service; no new wire format."""

    def __init__(self, link, module=None):
        self.link = link
        self.device = None
        self.client = None
        self.error = ''
        if module is None:
            self.error = 'BLE UNAVAILABLE'
            return
        try:
            self.device = module.Device('Civweave-Pocket')
            server = self.device.server
            server.add_service(SERVICE, [
                server.create_characteristic(RX, write=True),
                server.create_characteristic(TX, read=True, notify=True),
            ])
            server.on_receive(self.on_receive)
            server.on_connected(self.on_connected)
            server.on_disconnected(self.on_disconnected)
            server.start()
        except Exception as error:
            self.error = 'BLE UNAVAILABLE'
            self.client = None
            self.link.disconnect()
            print('Pocket BLE setup:', repr(error))

    def on_connected(self, server, client):
        self.client = client
        self.link.connect()

    def on_disconnected(self, server, client):
        self.client = None
        self.link.disconnect()

    def on_receive(self, server, client):
        # Callback does not create another parser or unbounded draining loop.
        if client is self.client:
            self.poll()

    def poll(self):
        if self.client is None:
            return
        try:
            for _ in range(8):
                if not self.client.any(RX):
                    break
                packet = self.client.read(RX)
                if packet:
                    for reply in self.link.consume(bytes(packet)):
                        self.emit(reply)
        except Exception as error:
            print('Pocket BLE receive:', repr(error))
            self.client = None
            self.link.disconnect()

    def emit(self, packet):
        if self.client is None or not self.link.snapshot().get('connected'):
            return False
        try:
            self.client.write(packet, TX)
            return True
        except Exception as error:
            print('Pocket BLE send:', repr(error))
            return False


def run_device(m5, game, link, store, clock, ble_module=None, iterations=None):
    """Run the hardware adapter; injected ports make loop behavior testable."""
    m5.begin()
    lcd = m5.Lcd
    lcd.setRotation(0)
    width, height = lcd.width(), lcd.height()
    if width != WIDTH or height != HEIGHT:
        message = 'Expected StickS3 portrait 135x240; got %sx%s' % (width, height)
        print(message)
        lcd.fillRect(0, 0, width, height, INK)
        if width >= 90 and height >= 24:
            draw_on(lcd, [['text', 'DISPLAY ERROR', 4, 5, 0xF2D18C],
                          ['text', 'CHECK STICKS3', 4, 16, 0xF6EEDB]])
        raise RuntimeError(message)
    target = lcd
    buffered = False
    if hasattr(lcd, 'newCanvas'):
        try:
            target = lcd.newCanvas(w=WIDTH, h=HEIGHT, bpp=16, psram=True)
            buffered = True
        except (MemoryError, AttributeError, TypeError, OSError) as error:
            print('Pocket canvas unavailable; direct LCD:', repr(error))
            target = lcd
    buttons = ButtonInput(diff_ms=clock.ticks_diff)
    save = SaveScheduler(store, game.export(), diff_ms=clock.ticks_diff)
    ble = BleAdapter(link, ble_module)
    last_draw = None
    notice = ble.error
    notice_at = clock.ticks_ms()
    frame = 0
    count = 0
    while iterations is None or count < iterations:
        count += 1
        m5.update()
        now = clock.ticks_ms()
        for action in buttons.update(m5.BtnA.isPressed(), m5.BtnB.isPressed(), now):
            intents = game.input(action)
            result = apply_intents(intents, link, ble.emit)
            if result:
                notice, notice_at = result, now
            save.queue(game.export(), now)
        ble.poll()
        save.tick(now)
        if last_draw is None or clock.ticks_diff(now, last_draw) >= 200:
            snapshot = game.snapshot()
            if save.error:
                snapshot['device_notice'] = save.error
            elif notice and clock.ticks_diff(now, notice_at) < 5000:
                snapshot['device_notice'] = notice
            draw_on(target, render(snapshot, link.snapshot(), frame))
            if buffered:
                target.push(0, 0)
            last_draw = now
            frame = (frame + 1) % 240
        clock.sleep_ms(20)
    return {'iterations': count, 'frames': frame, 'save_error': save.error}


def main():
    import time
    import M5
    from pocket_game import Game
    from pocket_link import LinkState
    from pocket_save import SaveStore
    try:
        from m5ble import M5BLE
    except ImportError:
        M5BLE = None
    store = SaveStore(SAVE_PATH)
    game = Game(store.load())
    link = LinkState(time.ticks_ms, ticks_diff=time.ticks_diff)
    print('Civweave Pocket: offline game + optional BLE status; LoRa not attached')
    run_device(M5, game, link, store, time, M5BLE)


if __name__ == '__main__':
    main()
