"""Static and simulated wire checks; does not replace a real StickS3 radio test."""
from pathlib import Path
import sys, types, json, time
if not hasattr(time,"ticks_ms"):
    time.ticks_ms=lambda: int(time.monotonic()*1000)
    time.ticks_diff=lambda a,b:a-b
    time.ticks_add=lambda a,b:a+b

SOURCE=Path(__file__).resolve().parents[1] / 'sticks3_ble_uiflow.py'
text=SOURCE.read_text()
assert "set_rotation(1 if battle else 0)" in text, 'landscape battle/portrait idle'
assert "val.get('source')!='server'" in text, 'device must reject non-server status'
assert "STATUS_TTL_MS=9000" in text, 'stale status guard'
assert "emit(b'P')" in text and "emit(b'T')" in text, 'PTT control signals'
assert "audio flow" in text, 'audio transport is not implemented yet; must be documented'
# Evaluate only library functions, not the infinite embedded loop.
safe = text.split('\nM5.begin()\n',1)[0]
M5=types.ModuleType('M5')
M5.__all__=[]
class LCD:
    def __getattr__(self,name):return lambda *args,**kwargs:None
M5.Lcd=LCD()
sys.modules['M5']=M5
M5BLE=types.ModuleType('m5ble')
M5BLE.M5BLE=type('Mock',(),{})
sys.modules['m5ble']=M5BLE
ctx={'__name__':'test_firmware'}
exec(compile(safe,str(SOURCE),'exec'),ctx)
make=lambda status:json.dumps(status,separators=(',',':')).encode()
valid=dict(schema='civweave.pocket.state.v1',source='server',fresh=True,mode='generating',agent='Moss',task='Task')
def wire(kind,data):
    total=sum(data)&65535
    ctx['consume'](bytes([1,ord(kind),len(data)>>8,len(data)&255,total>>8,total&255]))
    for offset in range(0,len(data),19):ctx['consume'](bytes([2])+data[offset:offset+19])
    ctx['consume'](bytes([3]))

wire('S',make({**valid,'source':'demo'}))
assert ctx['status']['mode']=='disconnected', 'fake status accepted'
wire('S',make(valid))
assert ctx['status']['mode']=='generating','verified server state rejected'
print('Contract tests passed: portrait/landscape, provenance, TTL, PTT markers, wire state gate')
