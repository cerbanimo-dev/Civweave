"""Pure, bounded 135x240 presentation for the StickS3 Pocket Companion.

Commands are shared by the device and the local simulator.  Text uses the
original 5x7 bitmap alphabet below, avoiding firmware-specific font metrics.
This module has no device, network, persistence, or game-state authority.
"""

WIDTH = 135
HEIGHT = 240
INK = 0x101629
PANEL = 0x1B2440
SKY = 0x293254
MINT = 0x9FE0C3
PAPER = 0xF6EEDB
MUTED = 0xABB5D0
VIOLET = 0xBCA4EE
PINK = 0xEDADBA
GOLD = 0xF2D18C

# Each integer is one row, five bits from left to right.  Sixth column and
# eighth row are spacing.  Browser previews must use these same glyphs.
FONT = {
    ' ': (0, 0, 0, 0, 0, 0, 0),
    'A': (14, 17, 17, 31, 17, 17, 17),
    'B': (30, 17, 17, 30, 17, 17, 30),
    'C': (14, 17, 16, 16, 16, 17, 14),
    'D': (30, 17, 17, 17, 17, 17, 30),
    'E': (31, 16, 16, 30, 16, 16, 31),
    'F': (31, 16, 16, 30, 16, 16, 16),
    'G': (14, 17, 16, 23, 17, 17, 15),
    'H': (17, 17, 17, 31, 17, 17, 17),
    'I': (14, 4, 4, 4, 4, 4, 14),
    'J': (7, 2, 2, 2, 18, 18, 12),
    'K': (17, 18, 20, 24, 20, 18, 17),
    'L': (16, 16, 16, 16, 16, 16, 31),
    'M': (17, 27, 21, 21, 17, 17, 17),
    'N': (17, 25, 25, 21, 19, 19, 17),
    'O': (14, 17, 17, 17, 17, 17, 14),
    'P': (30, 17, 17, 30, 16, 16, 16),
    'Q': (14, 17, 17, 17, 21, 18, 13),
    'R': (30, 17, 17, 30, 20, 18, 17),
    'S': (15, 16, 16, 14, 1, 1, 30),
    'T': (31, 4, 4, 4, 4, 4, 4),
    'U': (17, 17, 17, 17, 17, 17, 14),
    'V': (17, 17, 17, 17, 17, 10, 4),
    'W': (17, 17, 17, 21, 21, 27, 17),
    'X': (17, 17, 10, 4, 10, 17, 17),
    'Y': (17, 17, 10, 4, 4, 4, 4),
    'Z': (31, 1, 2, 4, 8, 16, 31),
    '0': (14, 17, 19, 21, 25, 17, 14),
    '1': (4, 12, 4, 4, 4, 4, 14),
    '2': (14, 17, 1, 2, 4, 8, 31),
    '3': (30, 1, 1, 14, 1, 1, 30),
    '4': (2, 6, 10, 18, 31, 2, 2),
    '5': (31, 16, 16, 30, 1, 1, 30),
    '6': (14, 16, 16, 30, 17, 17, 14),
    '7': (31, 1, 2, 4, 8, 8, 8),
    '8': (14, 17, 17, 14, 17, 17, 14),
    '9': (14, 17, 17, 15, 1, 1, 14),
    '.': (0, 0, 0, 0, 0, 6, 6),
    ',': (0, 0, 0, 0, 6, 6, 4),
    ':': (0, 6, 6, 0, 6, 6, 0),
    ';': (0, 6, 6, 0, 6, 6, 4),
    '-': (0, 0, 0, 31, 0, 0, 0),
    '_': (0, 0, 0, 0, 0, 0, 31),
    '/': (1, 2, 2, 4, 8, 8, 16),
    '!': (4, 4, 4, 4, 4, 0, 4),
    '?': (14, 17, 1, 2, 4, 0, 4),
    '>': (16, 8, 4, 2, 4, 8, 16),
    '<': (1, 2, 4, 8, 4, 2, 1),
    '+': (0, 4, 4, 31, 4, 4, 0),
    '=': (0, 0, 31, 0, 31, 0, 0),
    '(': (2, 4, 8, 8, 8, 4, 2),
    ')': (8, 4, 2, 2, 2, 4, 8),
    '[': (14, 8, 8, 8, 8, 8, 14),
    ']': (14, 2, 2, 2, 2, 2, 14),
    '%': (17, 2, 4, 4, 8, 16, 17),
    "'": (4, 4, 8, 0, 0, 0, 0),
    '#': (10, 10, 31, 10, 31, 10, 10),
    '&': (12, 18, 20, 8, 21, 18, 13),
    '*': (0, 21, 14, 31, 14, 21, 0),
}

CREATURES = {
    'mothbit': (
        (VIOLET, 0x796BAA, GOLD, MINT, INK, PAPER),
        (
            '.....b....b.....',
            '......b..b......',
            '..aa...cc...aa..',
            '.aaaab.cc.baaaa.',
            'aaaafbbccbbfaaaa',
            'aaafabbccbbafaaa',
            '.aaaabdeedbaaaa.',
            '..aabbdccdbbaa..',
            '...bbbdccdbbb...',
            '..aaaadccdaaaa..',
            '.aaafadccdafaaa.',
            '..aaabdccdbbaa..',
            '...abbddddbba...',
            '....bb.dd.bb....',
            '......c..c......',
            '................',
        ),
    ),
    'glowfin': (
        (0x8EDAD5, 0x4C929E, GOLD, 0xCDD7F3, INK, PAPER),
        (
            '................',
            '......aa........',
            '.....aaba.......',
            '.....abbaa......',
            '.....bbbb.......',
            '..aabaaaaaaa....',
            '.aabaaaafaaaa...',
            'aaaabaaaafaeaa..',
            '.aabaaaaaafaaa..',
            '..aabccccccca...',
            '.....bcccccb....',
            '.....abbba......',
            '......aaa.......',
            '................',
            '.........f......',
            '................',
        ),
    ),
    'pebblehop': (
        (0xB8D49D, 0x708B83, 0xD9D6BC, MINT, INK, PAPER),
        (
            '....aa....aa....',
            '...abba..abba...',
            '...abba..abba...',
            '....abaaaaba....',
            '...aaacccaaa....',
            '..aaaccccccaa...',
            '.aabaccccccabaa.',
            '.aabceccceccbaa.',
            '.aaaccccccaaaaa.',
            '..aaccccccaaaa..',
            '..abbbccbbbbaa..',
            '..abbbbbbbbbaa..',
            '...bbbaabbbb....',
            '..aaaa..aaaaa...',
            '..abba...abba...',
            '................',
        ),
    ),
    'breezelet': (
        (0xD7E8EC, 0x8CA4C4, GOLD, 0xA4D9CC, INK, PAPER),
        (
            '..........aa....',
            '........aaaa....',
            '......aaabb.....',
            '....aaaaab......',
            '...aaafaaa......',
            '..aaffffaaaa....',
            '.aaffffaaaaaa...',
            '.aafffaeaaeaaa..',
            'aaaffffacaafaa..',
            '.aaaaffffaaaa...',
            '..abbbdddbba....',
            '...abbdddb......',
            '....dd..dd......',
            '...dd....dd.....',
            '..d.......d.....',
            '................',
        ),
    ),
}


def _clean(value, limit=22):
    text = str(value)[:160].upper()
    return ''.join(char if char in FONT else '?' for char in text)[:limit]


def _rect(commands, x, y, width, height, color):
    x2 = min(WIDTH, x + width)
    y2 = min(HEIGHT, y + height)
    x = max(0, x)
    y = max(0, y)
    if x2 > x and y2 > y:
        commands.append(['rect', x, y, x2 - x, y2 - y, color])


def _text(commands, value, x, y, color=PAPER, limit=22):
    text = _clean(value, min(limit, (WIDTH - x) // 6))
    if text:
        commands.append(['text', text, x, y, color])


def _center(commands, value, y, color=PAPER, limit=21):
    text = _clean(value, limit)
    _text(commands, text, (WIDTH - len(text) * 6) // 2, y, color)


def _sprite(commands, creature, x, y, scale=3, frame=0):
    palette, rows = CREATURES.get(creature, CREATURES['mothbit'])
    bob = 1 if frame % 8 in (4, 5, 6, 7) else 0
    for row_index, row in enumerate(rows):
        start = 0
        while start < len(row):
            char = row[start]
            end = start + 1
            while end < len(row) and row[end] == char:
                end += 1
            if char != '.':
                color = palette[ord(char) - ord('a')]
                _rect(commands, x + start * scale, y + row_index * scale + bob,
                      (end - start) * scale, scale, color)
            start = end


def _bar(commands, label, value, maximum, y, color):
    value = max(0, min(maximum, int(value)))
    _text(commands, label, 7, y, MUTED)
    _rect(commands, 49, y + 1, 47, 5, SKY)
    if value:
        _rect(commands, 49, y + 1, max(1, 47 * value // maximum), 5, color)
    _text(commands, str(value), 103, y, color)


def _garden(commands, snapshot, frame):
    _rect(commands, 5, 34, 125, 77, PANEL)
    # A small violet harbor: skyline, lanterns, reeds, footpath and sky sparks.
    for x, y in ((16, 43), (108, 48), (91, 38), (30, 57)):
        _rect(commands, x, y, 2, 2, GOLD if (frame + x) % 8 < 5 else SKY)
    for x, roof in ((10, 78), (22, 71), (105, 73), (118, 81)):
        _rect(commands, x, roof, 8, 23, SKY)
        _rect(commands, x + 3, roof + 5, 2, 3, 0x847893)
    _rect(commands, 5, 98, 125, 13, 0x314657)
    for x in (8, 18, 32, 98, 111, 124):
        _rect(commands, x, 95, 2, 8, 0x638B8C)
        _rect(commands, x + 1, 94, 2, 3, MINT)
    _rect(commands, 42, 105, 51, 4, 0xA59B9A)
    creature = snapshot.get('encounter') or snapshot.get('active', {}).get('id', 'mothbit')
    if snapshot.get('screen') == 'collection':
        found = snapshot.get('collection', [])
        index = snapshot.get('selection', 0)
        if 0 <= index < len(found):
            creature = found[index]
    _rect(commands, 47, 100, 42, 3, INK)
    _sprite(commands, creature, 44, 53, frame=frame)
    berries = max(0, min(99, int(snapshot.get('berries', 0))))
    _center(commands, creature.upper() + '  BERRIES:' + str(berries), 115, GOLD)
    _bar(commands, 'ENERGY', snapshot.get('energy', 0), 10, 127, MINT)
    _bar(commands, 'BOND', snapshot.get('bond', 0), 100, 139, VIOLET)


def _link_panel(commands, link):
    connected = link.get('connected') is True
    fresh = connected and link.get('fresh') is True
    _rect(commands, 5, 34, 125, 111, PANEL)
    _center(commands, 'SIMULATED PHONE' if link.get('simulated') else
            ('PHONE LINK' if connected else 'OFFLINE'), 42, MINT if connected else GOLD)
    if connected:
        _center(commands, 'PHONE REPORTED' if fresh else 'STATUS STALE', 57, MUTED)
        if fresh:
            _center(commands, link.get('mode', 'UNKNOWN'), 72, VIOLET)
            _center(commands, link.get('agent', '') or 'NO GUIDE SELECTED', 87, PAPER)
            task = _clean(link.get('task', ''), 40)
            _center(commands, task[:20], 101, MUTED, 20)
            _center(commands, task[20:40], 112, MUTED, 20)
        else:
            _center(commands, 'QUERY FOR AN UPDATE', 79, PAPER)
            _center(commands, 'GAME WORKS OFFLINE', 100, MUTED)
    else:
        _center(commands, 'PAIR FROM ANDROID', 65, PAPER)
        _center(commands, 'GAME WORKS OFFLINE', 82, MUTED)
        _center(commands, 'NOTES STAY UNSENT', 99, MUTED)
    _center(commands, 'LORA: NOT ATTACHED', 132, GOLD)


def render(snapshot, link_snapshot, frame=0):
    """Return rect/text primitives without changing either input snapshot."""
    commands = [['rect', 0, 0, WIDTH, HEIGHT, INK]]
    link = link_snapshot or {}
    screen = snapshot.get('screen', 'home')
    _text(commands, 'CIVWEAVE', 5, 5, MINT)
    badge = ('SIM' if link.get('simulated') else
             'BLE' if link.get('connected') is True else 'OFFLINE')
    _text(commands, badge, WIDTH - len(badge) * 6 - 5, 5, GOLD)
    titles = {'home': 'POCKET GARDEN', 'trail': 'VIOLET TRAIL',
              'encounter': 'A NEW FRIEND', 'care': 'CARE & PLAY',
              'collection': 'YOUR COMPANIONS', 'link': 'COMMUNICATOR'}
    _center(commands, titles.get(screen, 'POCKET GARDEN'), 22, PAPER)
    if screen == 'link':
        _link_panel(commands, link)
    else:
        _garden(commands, snapshot, frame)
    options = snapshot.get('options', [])[:5]
    selected = snapshot.get('selection', 0)
    for index, label in enumerate(options):
        y = 153 + index * 12
        if index == selected:
            _rect(commands, 5, y - 2, 125, 11, VIOLET)
            _text(commands, '> ' + str(label), 9, y, INK, 20)
        else:
            _text(commands, '  ' + str(label), 9, y, PAPER, 20)
    notice = snapshot.get('device_notice') or snapshot.get('notice', '')
    _center(commands, notice, 216, GOLD)
    _rect(commands, 0, 227, WIDTH, 13, PANEL)
    _text(commands, 'A:NEXT B:GO HOLD B:UP', 5, 230, MUTED)
    return commands


def draw_on(display, commands):
    """Paint via fillRect only; compatible with M5.Lcd and its canvas."""
    for command in commands:
        if command[0] == 'rect':
            _, x, y, width, height, color = command
            display.fillRect(x, y, width, height, color)
        elif command[0] == 'text':
            _, text, x, y, color = command
            for char in text:
                for row, bits in enumerate(FONT.get(char, FONT['?'])):
                    column = 0
                    while column < 5:
                        if bits & (1 << (4 - column)):
                            end = column + 1
                            while end < 5 and bits & (1 << (4 - end)):
                                end += 1
                            display.fillRect(x + column, y + row, end - column, 1, color)
                            column = end
                        else:
                            column += 1
                x += 6
