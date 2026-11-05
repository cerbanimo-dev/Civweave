import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/app/starling-meeting-console-v1.html',import.meta.url),'utf8');
const ui=readFileSync(new URL('../public/app/starling-meeting-console-v1.mjs',import.meta.url),'utf8');
test('rehearsal UI exposes stop, emergency mute, floor grants, and mic opt-in',()=>{
 for(const id of ['silence','resume','interrupt','micstart','micstop','members','feed','offer','transcript'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(ui,/createStarlingLiveMediaBridge/);
 assert.match(ui,/bridge\.grantAndSpeak/);
 assert.match(ui,/bridge\.emergencyMute/);
 assert.match(ui,/bridge\.voiceActivity/);
 assert.match(ui,/getUserMedia/);
 assert.match(ui,/getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/);
 assert.doesNotMatch(ui,/fetch\(|WebSocket\(|localStorage|navigator\.sendBeacon/);
});
