"""20-byte-compatible GATT fragmentation. This is framing, not authentication.

One transfer per connection; missing/out-of-order pieces are discarded. The
message engine, not this adapter, owns retries and delivery acknowledgement.
"""

TAG = 0xC1
CHUNK_PAYLOAD = 15
MAX_FRAME = 161
MAX_CHUNKS = 11
TIMEOUT = 3.0
SERVICE = 'bc257ca0-197e-4ba4-8ab7-c70ef45c0020'
RX = 'bc257ca0-197e-4ba4-8ab7-c70ef45c0021'
TX = 'bc257ca0-197e-4ba4-8ab7-c70ef45c0022'


def split_frame(frame, transfer_id):
    if not isinstance(frame, (bytes, bytearray)) or not 1 <= len(frame) <= MAX_FRAME:
        raise ValueError('frame length must be 1..161 bytes')
    if type(transfer_id) is not int or not 1 <= transfer_id <= 255:
        raise ValueError('transfer_id must be 1..255')
    total = (len(frame) + CHUNK_PAYLOAD - 1) // CHUNK_PAYLOAD
    chunks = []
    for index in range(total):
        part = bytes(frame[index * CHUNK_PAYLOAD:(index + 1) * CHUNK_PAYLOAD])
        chunks.append(bytes((TAG, transfer_id, index, total, len(part))) + part +
                      bytes(CHUNK_PAYLOAD - len(part)))
    return chunks


class Assembler:
    def __init__(self):
        self.reset()

    def reset(self):
        self.transfer_id = None
        self.total = 0
        self.parts = []
        self.started = 0.0

    def feed(self, chunk, now):
        if self.transfer_id is not None and (now < self.started or now - self.started > TIMEOUT):
            self.reset()
        if not isinstance(chunk, (bytes, bytearray)) or len(chunk) != 20:
            self.reset()
            return None
        tag, transfer_id, index, total, count = chunk[:5]
        part = bytes(chunk[5:5 + count])
        if (tag != TAG or not transfer_id or not 1 <= total <= MAX_CHUNKS or
                not 1 <= count <= CHUNK_PAYLOAD or any(chunk[5 + count:]) or
                index >= total or (index < total - 1 and count != CHUNK_PAYLOAD) or
                ((total - 1) * CHUNK_PAYLOAD + len(part) > MAX_FRAME and index == total - 1)):
            self.reset()
            return None
        if index == 0 and (self.transfer_id != transfer_id or self.total != total):
            self.reset()
            self.transfer_id, self.total, self.started = transfer_id, total, now
        if self.transfer_id != transfer_id or self.total != total:
            self.reset()
            return None
        if index < len(self.parts):
            if self.parts[index] != part:
                self.reset()
            return None
        if index != len(self.parts):
            self.reset()
            return None
        self.parts.append(part)
        if len(self.parts) == self.total:
            frame = b''.join(self.parts)
            self.reset()
            return frame if len(frame) <= MAX_FRAME else None
        return None
