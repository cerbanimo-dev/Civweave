import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [membership,ble,controls,context,shell,kotlin]=await Promise.all([
  read('public/app/guild-membership-mesh-v1.js'),
  read('public/app/ble-object-transport-v1.js'),
  read('public/app/human-chat-ble-controls-v1.js'),
  read('public/app/human-chat-guild-context-v1.js'),
  read('public/service-worker-shell-assets-v1.js'),
  read('native/android/civweave-ble-mesh-v1/src/main/java/cc/civweave/ble/CivweaveBleMeshBridge.kt')
]);
new Function(membership);new Function(ble);new Function(controls);new Function(context);new Function(shell);
const checks=[];const check=(name,condition)=>{assert.ok(condition,name);checks.push(name)};
check('guild membership is a signed local object',membership.includes("KIND='civweave.guild-membership.v1'")&&membership.includes('mesh.createObject({'));
check('guild membership remains discovery-only',membership.includes('discoveryOnly:true')&&membership.includes('authoritativeAdmission:false'));
check('guild roster is group-scoped locally',membership.includes("consent:'group'")&&membership.includes('audience:[guild.audience]'));
check('guild chat roster grows automatically from signed claims',membership.includes('mergeGuildGroup(guild,members)')&&membership.includes("source:'signed-guild-membership-mesh'"));
check('contacts grow automatically from signed guild claims',membership.includes("'guild-signed-discovery'"));
check('BLE object transport keeps browser peripheral false',ble.includes('actualBrowserPeripheral:false')&&ble.includes('peripheral:false'));
check('BLE browser path uses Web Bluetooth GATT central',ble.includes('navigator.bluetooth.requestDevice')&&ble.includes('getPrimaryService(SERVICE_UUID)'));
check('BLE native bridge path is supported',ble.includes('CivweaveAndroidBleMesh')&&ble.includes('startNative'));
check('BLE frames fit legacy 20-byte ATT payloads',ble.includes('const HEADER_BYTES=8')&&ble.includes('const PAYLOAD_BYTES=12'));
check('BLE v1 carries E2EE PM envelopes by default',ble.includes("DEFAULT_KINDS=new Set(['civweave.private-message-envelope.v1'])"));
check('BLE receives objects through canonical mesh validation',ble.includes('mesh.ingest(object,{fromPeer:`ble:${peerId}`'));
check('BLE supports store-carry-forward replay suppression',ble.includes('storeCarryForward:true')&&ble.includes('alreadySent(peerId,object)'));
check('human chat exposes user-gesture nearby control',controls.includes('data-human-nearby')&&controls.includes('api.connectWebPeer()'));
check('guild context bootstraps roster and BLE runtimes',context.includes('/app/guild-membership-mesh-v1.js')&&context.includes('/app/ble-object-transport-v1.js')&&context.includes('/app/human-chat-ble-controls-v1.js'));
check('offline shell caches roster and BLE runtimes',shell.includes('/app/guild-membership-mesh-v1.js')&&shell.includes('/app/ble-object-transport-v1.js')&&shell.includes('/app/human-chat-ble-controls-v1.js'));
check('Android bridge advertises and scans the Civweave GATT service',kotlin.includes('startAdvertising()')&&kotlin.includes('startScanning()')&&kotlin.includes('openGattServer()'));
check('Android 12+ BLE permissions are explicit',kotlin.includes('Manifest.permission.BLUETOOTH_SCAN')&&kotlin.includes('Manifest.permission.BLUETOOTH_CONNECT')&&kotlin.includes('Manifest.permission.BLUETOOTH_ADVERTISE'));
check('Android bridge is injected through JavascriptInterface contract',kotlin.includes('@JavascriptInterface')&&kotlin.includes('fun send(peerId: String, base64Frame: String)'));
console.log(JSON.stringify({ok:true,checks:checks.length,guildRoster:'signed local discovery object',ble:'20-byte GATT framing + Web Bluetooth central + Android central/peripheral',browserPeripheral:false},null,2));
