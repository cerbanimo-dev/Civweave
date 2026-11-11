"""CL1 lab-only short-message framing. CRC does not authenticate.

No peer identity or privacy guarantee follows from a valid frame. The transport
must establish an authenticated peer before these packets are trusted outside
a labelled development lab.
"""

TEXT = 1
ACK = 2
VERSION = 1
MAX_BODY = 120
MAX_NODE = 12
MAX_FRAME = 161
_NODE_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789_-"
_HEX = "0123456789abcdef"


def crc16(data):
    """CRC-16/CCITT-FALSE: poly 0x1021, init 0xffff, no reflection/xorout."""
    crc = 0xFFFF
    for value in data:
        crc ^= value << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def validate_node_id(value):
    if not isinstance(value, str) or not 1 <= len(value) <= MAX_NODE:
        raise ValueError("Node ID must be 1..12 lowercase ASCII characters")
    for char in value:
        if char not in _NODE_CHARS:
            raise ValueError("Node ID permits a-z, 0-9, underscore and hyphen")
    return value


def id_bytes(value):
    if isinstance(value, (bytes, bytearray)):
        result = bytes(value)
        if len(result) != 8:
            raise ValueError("Message ID must contain 8 bytes")
    elif isinstance(value, str) and len(value) == 16:
        if any(char not in _HEX for char in value):
            raise ValueError("Message ID must be lowercase hexadecimal")
        result = bytes(int(value[index:index + 2], 16) for index in range(0, 16, 2))
    else:
        raise ValueError("Message ID must be 8 bytes or 16 lowercase hex characters")
    if result == b"\x00" * 8:
        raise ValueError("Zero message ID is reserved")
    return result


def id_hex(value):
    return "".join("%02x" % item for item in id_bytes(value))


def _body_bytes(kind, body):
    if type(kind) is not int or kind not in (TEXT, ACK):
        raise ValueError("Unknown packet kind")
    if not isinstance(body, str):
        raise ValueError("Message body must be text")
    if kind == ACK:
        if body:
            raise ValueError("ACK body must be empty")
        return b""
    if not body.strip():
        raise ValueError("Message body cannot be blank")
    for char in body:
        cp = ord(char)
        if (cp < 32 and cp != 10) or 127 <= cp <= 159:
            raise ValueError("Control characters are not allowed except newline")
    try:
        raw = body.encode("utf-8")
    except (UnicodeError, ValueError):
        raise ValueError("Message body must be valid UTF-8")
    if len(raw) > MAX_BODY:
        raise ValueError("Message body exceeds 120 UTF-8 bytes")
    return raw


def encode(kind, message_id, sender, recipient, body=""):
    """Return one compact CL1 lab datagram; no production-envelope claim."""
    # Validation already restricts these fields to ASCII. Using UTF-8 here also
    # works on MicroPython ports that implement only the UTF-8 codec.
    source = validate_node_id(sender).encode("utf-8")
    target = validate_node_id(recipient).encode("utf-8")
    payload = _body_bytes(kind, body)
    ident = id_bytes(message_id)
    frame = b"CL" + bytes((VERSION, kind)) + ident
    frame += bytes((len(source), len(target), len(payload))) + source + target + payload
    checksum = crc16(frame)
    return frame + bytes((checksum >> 8, checksum & 255))


def decode(frame):
    """Strictly validate a datagram and return a JSON-safe packet dictionary."""
    if not isinstance(frame, (bytes, bytearray)) or not 19 <= len(frame) <= MAX_FRAME:
        raise ValueError("Invalid packet length")
    if frame[0:2] != b"CL" or frame[2] != VERSION:
        raise ValueError("Unsupported packet magic or version")
    kind = frame[3]
    if kind not in (TEXT, ACK):
        raise ValueError("Unknown packet kind")
    source_len, target_len, payload_len = frame[12], frame[13], frame[14]
    if not 1 <= source_len <= MAX_NODE or not 1 <= target_len <= MAX_NODE or payload_len > MAX_BODY:
        raise ValueError("Invalid declared field length")
    if len(frame) != 17 + source_len + target_len + payload_len:
        raise ValueError("Declared length does not match frame")
    if crc16(frame[:-2]) != ((frame[-2] << 8) | frame[-1]):
        raise ValueError("Packet checksum mismatch")
    try:
        source = bytes(frame[15:15 + source_len]).decode("utf-8")
        target = bytes(frame[15 + source_len:15 + source_len + target_len]).decode("utf-8")
        body = bytes(frame[15 + source_len + target_len:-2]).decode("utf-8")
    except (UnicodeError, ValueError):
        raise ValueError("Invalid text encoding")
    validate_node_id(source)
    validate_node_id(target)
    _body_bytes(kind, body)
    return {"v": VERSION, "kind": kind, "id": id_hex(frame[4:12]),
            "from": source, "to": target, "body": body}
