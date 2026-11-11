#!/usr/bin/env python3
"""Copy the lab into its own device directory; leave boot/main files alone.

Requires the user's explicitly named USB serial port and an existing StickS3
UIFlow2 installation. This script does not flash a firmware image or run it.
"""
import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from core.protocol import validate_node_id
from core.game import COMPANIONS

REMOTE = '/flash/civweave_pocket'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', required=True, help='Exact USB serial port, e.g. COM5')
    parser.add_argument('--node', required=True, help='Unique local node, e.g. cami')
    parser.add_argument('--peer', required=True, help='Canned-message destination, e.g. crew or desk')
    parser.add_argument('--companion', choices=COMPANIONS, default='Mossling')
    parser.add_argument('--plan', action='store_true', help='Show intended paths without touching hardware')
    args = parser.parse_args()
    try:
        validate_node_id(args.node)
        validate_node_id(args.peer)
        if args.node == args.peer:
            raise ValueError('node and peer must differ')
    except ValueError as error:
        parser.error(str(error))
    files = [path for directory in ('core', 'transport', 'firmware')
             for path in sorted((ROOT / directory).glob('*.py'))]
    if args.plan:
        print(json.dumps({'port': args.port, 'directory': REMOTE,
                          'copies': [str(path.relative_to(ROOT)) for path in files] + ['config.json'],
                          'node_id': args.node, 'peer': args.peer,
                          'writes_boot_file': False, 'flashes_firmware': False}, indent=2))
        return
    def call(*words):
        subprocess.run([sys.executable, '-m', 'mpremote', 'connect', args.port, *words],
                       check=True, timeout=45)
    # Fail before writes if this is not a compatible installed environment.
    call('exec', "import os, M5; from m5ble import M5BLE; print(os.uname()); print(os.stat('/flash'))")
    directories = [REMOTE] + [REMOTE + '/' + item for item in ('core', 'transport', 'firmware')]
    setup = 'import os\nfor path in ' + repr(directories) + ':\n'
    setup += '    try:\n        os.mkdir(path)\n    except OSError:\n'
    setup += '        if not (os.stat(path)[0] & 0x4000):\n            raise\n'
    call('exec', setup)
    for path in files:
        relative = path.relative_to(ROOT).as_posix()
        call('fs', 'cp', str(path), ':' + REMOTE + '/' + relative)
    with tempfile.TemporaryDirectory() as temporary:
        config = Path(temporary) / 'config.json'
        config.write_text(json.dumps({'node_id': args.node, 'peer': args.peer,
                                      'companion': args.companion}), encoding='utf-8')
        call('fs', 'cp', str(config), ':' + REMOTE + '/config.json')
    print('Files copied. Existing boot program was not replaced.')
    print('Run once: python -m mpremote connect ' + args.port + ' run firmware/uiflow_launcher.py')


if __name__ == '__main__':
    try:
        main()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        print('Copy stopped: ' + str(error), file=sys.stderr)
        sys.exit(1)
