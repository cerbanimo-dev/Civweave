# Civweave Pocket BLE v0.5 for M5StickS3 / UIFlow2 MicroPython
# Android phone is the BLE central; NO WIFI IS USED.
# Install via Python Custom Edit / Run Once before Run Always.
import time, gc, json
import M5
from M5 import *
try:
    from m5ble import M5BLE
except ImportError as exc:
    raise RuntimeError('UIFlow2 firmware needs m5ble; update UIFlow2') from exc

SERVICE = 'bc257ca0-197e-4ba4-8ab7-c70ef45c0010'
RX = 'bc257ca0-197e-4ba4-8ab7-c70ef45c0011'   # phone writes (write with response)
TX = 'bc257ca0-197e-4ba4-8ab7-c70ef45c0012'   # Stick sends notifications
DARK=0x111E30; MINT=0x85E4B0; WHITE=0xEAF6F0; ROSE=0xFFB4D3; GOLD=0xF8D38C
MAX_IMG=22000; MAX_STATUS=768; STATUS_TTL_MS=9000
# Wire: 01 <'I'|'S'> <u16 len> <u16 sum> / 02 <up to 19 bytes> / 03
# A completed 'I' is a JPEG asset; completed 'S' is JSON state. Phone awaits writes.
# Notifications: 'Q' status/query button; 'P' PTT start; 'T' PTT released;
# 'K' <0|1> image/status acceptance; 'V' <u16 length> voice-size readout.
ble=None
connected=False
client=None
status={'mode':'disconnected','agent':'','task':'Awaiting server','source':'offline','fresh':False}
last_server_ms=-100000
image=None
image_mode='idle'
image_seq=0
img_drawn=-1
rotation=-1
rx_type=None
rx_buf=None
rx_expect=0
rx_check=0
voice=False
ptt=False
pressed_at=0
hold_started=False
voice_bytes=0
voice_data=None
last_draw=0
notice='PAIR FROM ANDROID'; notice_at=0


def ms(): return time.ticks_ms()
def age(t): return time.ticks_diff(ms(),t)
def info(x):
    global notice,notice_at
    notice=str(x)[:32]; notice_at=ms()
    print('POCKET BLE:',notice)

def emit(data):
    if not connected or client is None:return
    try: client.write(data,TX)
    except Exception as ex: print('BLE TX:',repr(ex))

def set_rotation(value):
    global rotation
    if rotation!=value:
        rotation=value
        M5.Lcd.setRotation(value)
        M5.Lcd.clear(DARK)

def draw():
    global last_draw,img_drawn
    last_draw=ms()
    fresh = bool(status.get('fresh')) and age(last_server_ms)<STATUS_TTL_MS
    demo=status.get('mode') in ('demo_idle','demo_battle')
    mode=status.get('mode') if (fresh or demo) else 'disconnected'
    battle=mode=='generating' or (demo and status.get('mode')=='demo_battle')
    set_rotation(1 if battle else 0) # landscape battles / portrait idle
    if image is not None and image_mode==('battle' if battle else 'idle'):
        if img_drawn!=image_seq:
            try:
                M5.Lcd.drawJpg(image,0,0)
                img_drawn=image_seq
            except Exception as ex:
                print('JPG:',repr(ex)); img_drawn=-1
    else:
        M5.Lcd.clear(DARK)
        M5.Lcd.setTextColor(MINT,DARK)
        M5.Lcd.drawString('CIVWEAVE',8,10)
        M5.Lcd.setTextColor(WHITE,DARK)
        M5.Lcd.drawString(str(status.get('agent') or 'GIGAPET')[:15],8,48)
    # Bottom band visible even above cached art: must not misrepresent demo as work.
    width=240 if battle else 135
    h=135 if battle else 240
    M5.Lcd.fillRect(0,h-31,width,31,DARK)
    M5.Lcd.setTextColor(GOLD,DARK)
    text=('ART PREVIEW - DEMO' if demo else ('BATTLE VERIFIED' if battle else ('IDLE VERIFIED' if fresh else 'OFFLINE / BLE')))
    M5.Lcd.drawString(text[:19],3,h-26)
    if age(notice_at)<3000:
        M5.Lcd.drawString(notice[:23],3,h-12)
    elif ptt:
        M5.Lcd.drawString('MIC ON - HOLD A',3,h-12)
    elif connected:
        M5.Lcd.drawString('BLE CONNECTED',3,h-12)
    else:
        M5.Lcd.drawString('PAIR FROM PHONE',3,h-12)

def invalid():
    global rx_type,rx_buf,rx_expect,rx_check
    rx_type=None;rx_buf=None;rx_expect=0;rx_check=0

def apply_payload(kind,raw):
    global status,last_server_ms,image,image_mode,image_seq,img_drawn
    if kind==ord('I'):
        if len(raw)<64 or raw[:2]!=b'\xff\xd8' or raw[-2:]!=b'\xff\xd9': return False
        image=bytes(raw)
        image_mode='battle' if status.get('mode') in ('generating','demo_battle') else 'idle'
        image_seq+=1
        img_drawn=-1
        return True
    if kind==ord('S'):
        try: val=json.loads(raw)
        except Exception:return False
        if not isinstance(val,dict) or val.get('schema')!='civweave.pocket.state.v1':return False
        # Android bridge verifies upstream origin, freshness, and auth first.
        # Stick does not independently authenticate server status over BLE.
        if val.get('source')!='server' or val.get('fresh') is not True:return False
        if val.get('mode') not in ('idle','generating','completed','blocked','needs_human'):return False
        status={'mode':val['mode'],'agent':str(val.get('agent',''))[:32],
                'task':str(val.get('task',''))[:100],'fresh':True,'source':'server'}
        last_server_ms=ms()
        img_drawn=-1
        return True
    return False

def consume(pkt):
    global rx_type,rx_buf,rx_expect,rx_check
    if not pkt:return
    code=pkt[0]
    if code==1 and len(pkt)==6:
        kind=pkt[1]; count=(pkt[2]<<8)|pkt[3]
        cap=MAX_IMG if kind==ord('I') else MAX_STATUS if kind==ord('S') else 0
        if not cap or count>cap or count==0: invalid();return
        rx_type=kind; rx_expect=count; rx_check=(pkt[4]<<8)|pkt[5];rx_buf=bytearray()
    elif code==2 and rx_buf is not None:
        part=pkt[1:]
        if len(rx_buf)+len(part)>rx_expect: invalid();return
        rx_buf.extend(part)
    elif code==3 and rx_buf is not None:
        ok=len(rx_buf)==rx_expect and (sum(rx_buf)&65535)==rx_check
        if ok:ok=apply_payload(rx_type,rx_buf)
        emit(b'K1' if ok else b'K0')
        invalid()
    elif code==4: # deliberately clear status (disconnect/logout)
        reset_status()
    elif code==6 and pkt in (b'\x06I',b'\x06B'):
        # Explicit manual ART PREVIEW, never represented as server activity.
        status.clear()
        status.update({'mode':'demo_battle' if pkt==b'\x06B' else 'demo_idle',
             'agent':'Preview','task':'Artwork test only','fresh':False,'source':'demo'})
        global img_drawn
        img_drawn=-1
    # Future native version can support full BLE audio streaming with flow control.

def reset_status():
    global status,last_server_ms,img_drawn
    status={'mode':'disconnected','agent':'','task':'Awaiting server','source':'offline','fresh':False}
    last_server_ms=-100000; img_drawn=-1

def on_receive(server,c):
    try:
        while c.any(RX):
            p=c.read(RX)
            if p:consume(bytes(p))
    except Exception as ex: print('BLE RX:',repr(ex))

def on_connected(server,c):
    global connected,client
    connected=True;client=c;info('PHONE LINKED')

def on_disconnected(server,c):
    global connected,client,ptt,voice
    connected=False;client=None;ptt=False;voice=False
    reset_status();info('PHONE DISCONNECTED')

def buttons():
    global ptt,pressed_at,hold_started
    down=bool(BtnA.isPressed())
    if down and not hold_started:
        hold_started=True; pressed_at=ms()
    if down and hold_started and not ptt and age(pressed_at)>=400:
        # Mic is not enabled in this link validation version. A proper native BLE
        # audio flow must use MTU/credits and actual Mic.record buffers.
        ptt=True;emit(b'P');info('PTT - AUDIO PENDING')
    if not down and hold_started:
        hold_started=False
        if ptt:
            ptt=False;emit(b'T');info('PTT RELEASED')
        else:emit(b'Q');info('QUERY REQUESTED')
    if BtnB.wasPressed():emit(b'X');info('DISMISS')

M5.begin()
M5.Lcd.setFont(M5.Lcd.FONTS.Montserrat14)
set_rotation(0)
info('STARTING BLUETOOTH')
try:
    ble=M5BLE.Device('Civweave-Pocket')
    ble.server.add_service(SERVICE,[
        ble.server.create_characteristic(RX,write=True),
        ble.server.create_characteristic(TX,read=True,notify=True),
    ])
    ble.server.on_receive(on_receive)
    ble.server.on_connected(on_connected)
    ble.server.on_disconnected(on_disconnected)
    ble.server.start()
    info('BLE READY - PAIR PHONE')
    print('CIVWEAVE BLE V0.5 READY')
except Exception as ex:
    info('BLE ERROR '+str(ex)[:12]);print('BLE INIT ERROR:',repr(ex))
    raise
while True:
    M5.update()
    buttons()
    if age(last_draw)>1100:
        draw()
    time.sleep_ms(25)
