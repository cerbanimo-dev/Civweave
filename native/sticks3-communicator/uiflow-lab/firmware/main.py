"""Civweave Pocket: run-once UIFlow2 application for StickS3.

Hardware execution has not been verified in this build environment. The portable
core and adapter contracts are covered by host tests. Install modules first;
run this file with mpremote, or use the supplied UIFlow2 launcher.
"""
import sys
import json
import time

BASE = '/flash/civweave_pocket'
if BASE not in sys.path:
    sys.path.append(BASE)

from core.game import Game
from core.messenger import Messenger
from core.protocol import validate_node_id
from firmware.input import Buttons
from firmware.radio import Radio
from transport.storage import StateStore

PAGES = ('Companion', 'Explore', 'Care', 'Train', 'Rest', 'Inbox',
         'Say hello', 'On my way', 'Meet up', 'Outbox', 'Retry last', 'Link')
MESSAGES = {'Say hello': 'Hello from my pocket!', 'On my way': 'On my way.',
            'Meet up': 'Meet at the Guild?'}
MINT = 0x8AE9BE
LAVENDER = 0xB8A2FF
GOLD = 0xF5CF86
INK = 0x101D2A
WHITE = 0xF3F5F1
MUTED = 0x91A4B5
SPRITE = (
    '...11..11...', '....1221....', '...122221...', '..12222221..',
    '.1222222221.', '.1223223221.', '.1222222221.', '..12233221..',
    '...122221...', '..11222211..', '..11....11..')


def read_config(default_id):
    config = {'node_id': default_id, 'peer': 'desk', 'companion': 'Mossling'}
    try:
        with open(BASE + '/config.json') as source:
            raw = source.read(2049)
        if len(raw) > 2048:
            raise ValueError('config too large')
        value = json.loads(raw)
        if not isinstance(value, dict):
            raise ValueError('config must be an object')
        config.update(value)
    except OSError:
        pass
    validate_node_id(config['node_id'])
    validate_node_id(config['peer'])
    if config['node_id'] == config['peer']:
        raise ValueError('node_id and peer must differ')
    Game(config['companion'])
    return config


def lines(text, size=16, maximum=4):
    # Fixed line bounds keep long received text inside the tiny viewport.
    text = str(text).replace('\r', '').replace('\n', ' ')
    result = []
    while text and len(result) < maximum:
        result.append(text[:size])
        text = text[size:]
    if text and result:
        result[-1] = result[-1][:-3] + '...'
    return result


class App:
    def __init__(self, m5, factory, config):
        self.m5 = m5
        self.config = config
        self.game = Game(config['companion'])
        self.messenger = Messenger(config['node_id'])
        self.radio = Radio(config['node_id'], factory)
        self.buttons = Buttons()
        self.store = StateStore(BASE + '/state-' + config['node_id'])
        self.page = 0
        self.inbox_index = 0
        self.notice = 'B menu / A choose'
        self.notice_until = 5
        self.last_input = 0
        self.last_save = 0
        self.last_draw = -1
        self.dirty = False
        self.ptt = False
        self.dimmed = False
        self.force_draw = True
        self.last_radio_notice = ''
        self.last_ready = False
        self.ignore_a_until_up = False
        for generation, snapshot in self.store.candidates():
            try:
                if snapshot.get('schema') != 'civweave.pocket.save.v1':
                    raise ValueError('save schema')
                game = Game.from_state(snapshot['game'])
                messenger = Messenger.from_state(snapshot['messages'], 0)
                if messenger.node_id != config['node_id']:
                    raise ValueError('wrong saved node')
                self.game, self.messenger = game, messenger
                # Overwrite a rejected newer slot, preserving the good slot if
                # the next write is interrupted.
                self.store.generation = generation
                self.notice = 'Progress restored'
                break
            except (ValueError, KeyError, TypeError):
                self.notice = 'Save rejected'
        if self.store.warning:
            print(self.store.warning)
        # The default system font is supported by the previously used UIFlow2 API.
        self.m5.Lcd.setFont(self.m5.Lcd.FONTS.Montserrat14)
        self.m5.Lcd.setRotation(0)
        if self.m5.Lcd.width() > self.m5.Lcd.height():
            self.m5.Lcd.setRotation(1)
        self.brightness(80)

    def brightness(self, value):
        try:
            self.m5.Lcd.setBrightness(value)
        except AttributeError:
            pass

    def say(self, text, now):
        self.notice = str(text)
        self.notice_until = now + 4
        self.force_draw = True
        print('POCKET:', self.notice)

    def save(self, now):
        try:
            self.store.save({'schema': 'civweave.pocket.save.v1',
                             'game': self.game.export_state(),
                             'messages': self.messenger.export_state()})
            self.dirty = False
            self.last_save = now
            return True
        except Exception as error:
            self.say('Save failed', now)
            print('SAVE:', repr(error))
            self.last_save = now  # avoid a tight failure/write loop
            return False

    def action(self, now):
        page = PAGES[self.page]
        if page in ('Explore', 'Care', 'Train', 'Rest', 'Companion'):
            result = self.game.act('care' if page == 'Companion' else page.lower())
            self.dirty = True
            self.say(result['text'], now)
        elif page == 'Inbox':
            if self.messenger.inbox:
                self.inbox_index = (self.inbox_index + 1) % len(self.messenger.inbox)
                self.force_draw = True
            else:
                self.say('Inbox is empty', now)
        elif page in MESSAGES:
            self.messenger.queue_text(self.config['peer'], MESSAGES[page], now)
            self.dirty = True
            self.say('Message queued', now)
        elif page == 'Retry last':
            retry = next((record for record in reversed(self.messenger.outbox)
                          if record['state'] in ('failed', 'expired')), None)
            if retry is None:
                self.say('Nothing to retry', now)
            else:
                self.messenger.queue_text(retry['to'], retry['body'], now)
                self.dirty = True
                self.say('New retry queued', now)
        elif page == 'Outbox':
            self.say('A send needs ACK', now)
        elif page == 'Link':
            if self.radio.ble is None:
                self.radio.start(now)
                self.say('Open laptop bridge', now)
            else:
                self.radio.stop()
                self.stop_ptt()
                self.say('Radio off', now)

    def stop_ptt(self):
        if self.ptt:
            self.radio.control(False)
        self.ptt = False
        self.buttons.cancel()
        self.ignore_a_until_up = True

    def handle(self, event, now):
        self.last_input = now
        self.force_draw = True
        if self.radio.client is not None and not self.radio.ready:
            if event == 'a_tap':
                self.radio.approve(now)
                self.say('BLE LAB plaintext', now)
            elif event in ('b_tap', 'b_hold'):
                self.radio.stop()
                self.stop_ptt()
                self.say('Connection denied', now)
            return
        if event == 'a_tap':
            self.action(now)
        elif event == 'b_tap':
            self.page = (self.page + 1) % len(PAGES)
            self.notice_until = 0
        elif event == 'b_hold':
            self.page = 0
            self.stop_ptt()
            if not self.dirty or self.save(now):
                self.say('Home / saved', now)
        elif event == 'ptt_start':
            self.ptt = True
            self.radio.control(True)
            self.say('Voice planned. Mic off.', now)
        elif event == 'ptt_stop':
            self.ptt = False
            self.radio.control(False)
            self.say('PTT ended. Mic off.', now)

    def tick(self, now, a_down, b_down):
        if self.dimmed and (a_down or b_down):
            self.dimmed = False
            self.last_input = now
            self.brightness(80)
            self.buttons.cancel()
        if self.ignore_a_until_up:
            self.ignore_a_until_up = bool(a_down)
            a_down = False
        for event in self.buttons.update(a_down, b_down, now):
            try:
                self.handle(event, now)
            except (ValueError, OverflowError) as error:
                self.say(str(error), now)
            except Exception as error:
                self.say('Action failed', now)
                print('ACTION:', repr(error))
        for frame in self.radio.poll(now):
            try:
                replies = self.messenger.receive(frame, now)
                self.dirty = True
                # ACKs confirm an application inbox, not human reading. Persist
                # a received frame before queueing its receipt when possible.
                if replies and self.save(now):
                    for reply in replies:
                        self.radio.send(reply)
            except ValueError:
                self.say('Packet rejected', now)
        if self.last_ready and not self.radio.ready:
            self.stop_ptt()
        self.last_ready = self.radio.ready
        for frame in self.messenger.tick(now, self.radio.ready):
            self.radio.send(frame)
        for event in self.messenger.drain_events():
            if event['event'] in ('received', 'delivered', 'failed', 'expired', 'transmit'):
                self.dirty = True
                self.say(event['event'] + ' ' + event['peer'], now)
                if event['event'] == 'received':
                    self.inbox_index = len(self.messenger.inbox) - 1
        if self.radio.notice != self.last_radio_notice:
            self.last_radio_notice = self.radio.notice
            self.force_draw = True
        if now - self.last_input >= 30 and not self.dimmed:
            self.dimmed = True
            self.brightness(12)
        if now - self.last_input >= 300 and self.radio.ble is not None:
            self.radio.stop()
            self.stop_ptt()
            self.say('Idle: radio off', now)
        if self.dirty and now - self.last_save >= 10:
            self.save(now)
        if self.force_draw or now - self.last_draw >= 1:
            self.draw(now)

    def draw(self, now):
        lcd = self.m5.Lcd
        width, height = lcd.width(), lcd.height()
        lcd.clear(INK)
        def text(value, y, color=WHITE):
            lcd.setTextColor(color, INK)
            lcd.drawString(str(value), 5, y)
        text('CIVWEAVE', 5, MINT)
        text(self.config['node_id'], 23, MUTED)
        text(PAGES[self.page], 45, LAVENDER)
        if self.radio.client is not None and not self.radio.ready:
            for index, value in enumerate(('Link request', 'BLE LAB', 'Plaintext', 'A approve', 'B deny')):
                text(value, 72 + index * 20, GOLD if index < 3 else WHITE)
        elif PAGES[self.page] == 'Inbox' and self.messenger.inbox:
            record = self.messenger.inbox[self.inbox_index % len(self.messenger.inbox)]
            text('From ' + record['from'], 72, MINT)
            for index, value in enumerate(lines(record['body'], 15, 5)):
                text(value, 94 + index * 18)
        elif PAGES[self.page] == 'Outbox' and self.messenger.outbox:
            record = self.messenger.outbox[-1]
            text('To ' + record['to'], 72, MINT)
            text(record['state'].upper(), 94, GOLD)
            for index, value in enumerate(lines(record['body'], 15, 3)):
                text(value, 118 + index * 18)
            text('Tries ' + str(record['attempts']) + '/4', 176, MUTED)
        elif PAGES[self.page] == 'Link':
            for index, value in enumerate(lines(self.radio.notice, 15, 3)):
                text(value, 75 + index * 19, GOLD)
            text('A start / stop', 143)
            text('LoRa: pending', 163, MUTED)
        else:
            color = MINT if self.game.companion == 'Mossling' else (
                GOLD if self.game.companion == 'Emberbit' else 0x83C8FF)
            for row, pixels in enumerate(SPRITE):
                for column, pixel in enumerate(pixels):
                    if pixel != '.':
                        pixel_color = LAVENDER if pixel == '1' else color if pixel == '2' else INK
                        lcd.fillRect((width - 60) // 2 + column * 5, 70 + row * 5, 5, 5, pixel_color)
            text(self.game.companion + ' L' + str(self.game.level), 132)
            text('Energy ' + str(self.game.energy), 153, MINT)
            text('Bond ' + str(self.game.bond), 172, LAVENDER)
        if now < self.notice_until and (self.radio.ready or self.radio.client is None):
            lcd.fillRect(0, height - 49, width, 28, INK)
            for index, value in enumerate(lines(self.notice, 16, 2)):
                text(value, height - 49 + index * 14, GOLD)
        lcd.fillRect(0, height - 20, width, 20, INK)
        text('MIC OFF' if self.ptt else ('BLE LAB' if self.radio.ready else 'OFFLINE'), height - 18, MUTED)
        self.last_draw = now
        self.force_draw = False


def run():
    import M5
    import machine
    import binascii
    M5.begin()
    try:
        M5.Mic.end()
    except AttributeError:
        pass
    try:
        import network
        network.WLAN(network.STA_IF).active(False)
        network.WLAN(network.AP_IF).active(False)
    except (ImportError, AttributeError, OSError):
        pass
    try:
        from m5ble import M5BLE
        factory = M5BLE.Device
    except ImportError:
        def factory(**kwargs):
            raise RuntimeError('m5ble is missing from this UIFlow2 image')
    identity = 'p-' + binascii.hexlify(machine.unique_id()[-3:]).decode()
    app = App(M5, factory, read_config(identity))
    previous, elapsed = time.ticks_ms(), 0.0
    print('Civweave Pocket hardware lab; device version:', sys.implementation)
    try:
        while True:
            current = time.ticks_ms()
            elapsed += max(0, time.ticks_diff(current, previous)) / 1000.0
            previous = current
            M5.update()
            app.tick(elapsed, bool(M5.BtnA.isPressed()), bool(M5.BtnB.isPressed()))
            time.sleep_ms(25)
    finally:
        app.stop_ptt()
        app.radio.stop()
        if app.dirty:
            app.save(elapsed)


if __name__ == '__main__':
    run()
