#!/usr/bin/env python3
"""Small opaque store-and-forward relay for Civweave encrypted sync packets."""
from __future__ import annotations
import argparse, json, os, sqlite3, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

MAX_BODY = 1_700_000
MAX_PACKET = 1_500_000
MAX_LIFETIME = 31 * 86400

def now_iso():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

def epoch(value):
    try: return time.mktime(time.strptime(value[:19], '%Y-%m-%dT%H:%M:%S'))
    except Exception: return 0

class Store:
    def __init__(self, path: Path):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, source_device_id TEXT NOT NULL, protocol TEXT NOT NULL, nonce TEXT NOT NULL, ciphertext TEXT NOT NULL, digest TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS messages_channel ON messages(channel_id, created_at);
        CREATE TABLE IF NOT EXISTS receipts(message_id TEXT NOT NULL, device_id TEXT NOT NULL, acknowledged_at TEXT NOT NULL, PRIMARY KEY(message_id,device_id));
        ''')
        self.db.commit()
    def clean(self):
        cutoff=now_iso(); self.db.execute('DELETE FROM messages WHERE expires_at<=?',(cutoff,)); self.db.execute('DELETE FROM receipts WHERE message_id NOT IN (SELECT id FROM messages)'); self.db.commit()
    def publish(self,p):
        self.clean(); count=self.db.execute('SELECT COUNT(*) FROM messages WHERE channel_id=?',(p['channelId'],)).fetchone()[0]
        if count>=500: raise ValueError('mailbox full')
        self.db.execute('INSERT OR IGNORE INTO messages VALUES(?,?,?,?,?,?,?,?,?)',(p['messageId'],p['channelId'],p['sourceDeviceId'],p['protocol'],p['nonce'],p['ciphertext'],p['digest'],p['createdAt'],p['expiresAt'])); self.db.commit()
    def pull(self,channel,device,cursor):
        self.clean(); rows=self.db.execute('''SELECT m.* FROM messages m LEFT JOIN receipts r ON r.message_id=m.id AND r.device_id=? WHERE m.channel_id=? AND m.source_device_id<>? AND m.created_at>? AND r.message_id IS NULL ORDER BY m.created_at LIMIT 100''',(device,channel,device,cursor)).fetchall()
        return [dict(zip(['messageId','channelId','sourceDeviceId','protocol','nonce','ciphertext','digest','createdAt','expiresAt'],r)) for r in rows]
    def ack(self,message,device):
        self.db.execute('INSERT OR REPLACE INTO receipts VALUES(?,?,?)',(message,device,now_iso())); self.db.commit()

def valid_id(value,prefix): return isinstance(value,str) and value.startswith(prefix) and 8<len(value)<220 and all(c.isalnum() or c in '._:-' for c in value)
def packet(value):
    if not isinstance(value,dict) or value.get('protocol')!='civweave.relay-cipher.v1': raise ValueError('unsupported packet')
    for key,prefix in [('messageId','relay-message:'),('channelId','relay:'),('sourceDeviceId','device:')]:
        if not valid_id(value.get(key),prefix): raise ValueError('invalid identifier')
    if not isinstance(value.get('ciphertext'),str) or len(value['ciphertext'])>2_100_000 or len(value['ciphertext'])<20: raise ValueError('invalid ciphertext')
    if len(value['ciphertext'].encode())>MAX_PACKET: raise ValueError('packet too large')
    if not isinstance(value.get('digest'),str) or len(value['digest'])!=64: raise ValueError('invalid digest')
    created,expires=epoch(value.get('createdAt','')),epoch(value.get('expiresAt','')); now=time.time()
    if not created or expires<=now or expires>now+MAX_LIFETIME: raise ValueError('invalid expiry')
    return value

class Handler(BaseHTTPRequestHandler):
    store: Store
    server_version='CivweavePeerRelay/1.0'
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Access-Control-Allow-Headers','content-type,accept'); self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS'); self.send_header('Cache-Control','no-store'); super().end_headers()
    def send_json(self,status,value):
        data=json.dumps(value,separators=(',',':')).encode(); self.send_response(status); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
    def do_OPTIONS(self): self.send_response(204); self.end_headers()
    def do_GET(self):
        query=parse_qs(urlparse(self.path).query)
        if query.get('health')==['1']: return self.send_json(200,{'ok':True,'protocol':'civweave.encrypted-relay.v1','opaqueStorage':True,'relay':'lan-peer'})
        channel=(query.get('channel')or[''])[0]; device=(query.get('device')or[''])[0]; cursor=(query.get('cursor')or['1970-01-01T00:00:00.000Z'])[0]
        if not valid_id(channel,'relay:') or not valid_id(device,'device:'): return self.send_json(400,{'ok':False,'error':'invalid relay identifiers'})
        packets=self.store.pull(channel,device,cursor); return self.send_json(200,{'ok':True,'relay':f'http://{self.headers.get("Host")}/api/relay','packets':packets,'cursor':packets[-1]['createdAt'] if packets else cursor})
    def do_POST(self):
        try:
            length=int(self.headers.get('content-length','0'))
            if length<=0 or length>MAX_BODY: raise ValueError('invalid body size')
            body=json.loads(self.rfile.read(length)); action=body.get('action')
            if action=='publish':
                p=packet(body.get('packet')); self.store.publish(p); return self.send_json(201,{'ok':True,'stored':True,'messageId':p['messageId']})
            if action=='ack':
                if not valid_id(body.get('messageId'),'relay-message:') or not valid_id(body.get('deviceId'),'device:'): raise ValueError('invalid receipt')
                self.store.ack(body['messageId'],body['deviceId']); return self.send_json(200,{'ok':True,'acknowledged':True})
            raise ValueError('unsupported action')
        except Exception as exc: return self.send_json(400,{'ok':False,'error':str(exc)[:180]})
    def log_message(self,fmt,*args): print(f'[{now_iso()}] {self.address_string()} {fmt%args}')

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--host',default='0.0.0.0'); parser.add_argument('--port',type=int,default=8799); parser.add_argument('--db',default='civweave-relay.sqlite3'); args=parser.parse_args()
    Handler.store=Store(Path(args.db)); server=ThreadingHTTPServer((args.host,args.port),Handler)
    print(f'Civweave opaque peer relay listening on http://{args.host}:{args.port}/api/relay')
    print('The relay stores ciphertext only. Keep the relay-key file private.')
    try: server.serve_forever()
    except KeyboardInterrupt: pass

if __name__=='__main__': main()
