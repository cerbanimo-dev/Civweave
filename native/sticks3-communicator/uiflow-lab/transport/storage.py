"""Two-slot snapshots for CPython and MicroPython.

Each write targets the older slot. A checksum and bounded read reject incomplete
files. This improves recovery; power-loss behavior still needs device testing.
The checksum is not a signature. Never store credentials in these snapshots.
"""
import json
import os
import hashlib
import binascii

MAX_BYTES = 32768


def checksum(text):
    return binascii.hexlify(hashlib.sha256(text.encode('utf-8')).digest()).decode()


class StateStore:
    def __init__(self, prefix='pocket-state'):
        self.prefix = prefix
        self.generation = 0
        self.warning = ''

    def slot_path(self, slot):
        return self.prefix + '.' + str(slot) + '.json'

    def candidates(self):
        valid = []
        self.warning = ''
        for slot in (0, 1):
            try:
                with open(self.slot_path(slot), 'r') as source:
                    raw = source.read(MAX_BYTES + 1)
                if len(raw.encode('utf-8')) > MAX_BYTES:
                    raise ValueError('snapshot too large')
                envelope = json.loads(raw)
                if (not isinstance(envelope, dict) or envelope.get('schema') != 1 or
                        type(envelope.get('generation')) is not int or
                        not 1 <= envelope['generation'] <= 2147483646 or
                        not isinstance(envelope.get('payload'), str) or
                        checksum(envelope['payload']) != envelope.get('sha256')):
                    raise ValueError('invalid snapshot')
                value = json.loads(envelope['payload'])
                if not isinstance(value, dict):
                    raise ValueError('snapshot is not an object')
                valid.append((envelope['generation'], value))
            except OSError:
                pass
            except (ValueError, TypeError, KeyError):
                self.warning = 'A damaged save slot was ignored.'
        valid.sort(key=lambda item: item[0], reverse=True)
        if valid:
            self.generation = valid[0][0]
        return valid

    def load(self):
        valid = self.candidates()
        return valid[0][1] if valid else None

    def save(self, value):
        if not isinstance(value, dict):
            raise ValueError('snapshot must be an object')
        payload = json.dumps(value)
        generation = self.generation + 1
        if generation > 2147483646:
            raise ValueError('save generation limit reached')
        envelope = json.dumps({'schema': 1, 'generation': generation,
                               'payload': payload, 'sha256': checksum(payload)})
        if len(envelope.encode('utf-8')) > MAX_BYTES:
            raise ValueError('snapshot exceeds 32 KiB')
        with open(self.slot_path(generation % 2), 'w') as output:
            output.write(envelope)
            output.flush()
        if hasattr(os, 'sync'):
            os.sync()
        self.generation = generation
        return generation
