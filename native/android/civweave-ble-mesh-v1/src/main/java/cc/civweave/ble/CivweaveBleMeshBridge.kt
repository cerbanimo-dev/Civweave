package cc.civweave.ble

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.ParcelUuid
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Native transport half of Civweave BLE mesh.
 * JavaScript owns signing, E2EE payloads, framing, replay suppression and routing.
 * This bridge owns Android central/peripheral BLE radio operations only.
 */
class CivweaveBleMeshBridge(private val activity: Activity, private val webView: WebView) {
    private val manager = activity.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    private val adapter: BluetoothAdapter? get() = manager.adapter
    private var advertiser: BluetoothLeAdvertiser? = null
    private var scanner: BluetoothLeScanner? = null
    private var gattServer: BluetoothGattServer? = null
    private var serviceUuid: UUID? = null
    private var rxUuid: UUID? = null
    private var txUuid: UUID? = null
    private var nodeId = ""
    private var started = false
    private val inboundDevices = ConcurrentHashMap<String, BluetoothDevice>()
    private val outboundGatts = ConcurrentHashMap<String, BluetoothGatt>()
    private val outboundRx = ConcurrentHashMap<String, BluetoothGattCharacteristic>()
    private val connecting = ConcurrentHashMap.newKeySet<String>()

    companion object {
        private val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        private const val MAX_PEERS = 12
    }

    @JavascriptInterface
    fun requiredPermissions(): String {
        val rows = JSONArray()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            rows.put(Manifest.permission.BLUETOOTH_SCAN)
            rows.put(Manifest.permission.BLUETOOTH_CONNECT)
            rows.put(Manifest.permission.BLUETOOTH_ADVERTISE)
        } else rows.put(Manifest.permission.ACCESS_FINE_LOCATION)
        return rows.toString()
    }

    private fun missingPermissions(): List<String> {
        val required = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) listOf(
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_ADVERTISE
        ) else listOf(Manifest.permission.ACCESS_FINE_LOCATION)
        return required.filter { activity.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
    }

    @JavascriptInterface
    @SuppressLint("MissingPermission")
    fun start(configJson: String): String {
        val missing = missingPermissions()
        if (missing.isNotEmpty()) return JSONObject().put("ok", false).put("reason", "permissions").put("missing", JSONArray(missing)).toString()
        val bt = adapter ?: return JSONObject().put("ok", false).put("reason", "no-bluetooth-adapter").toString()
        if (!bt.isEnabled) return JSONObject().put("ok", false).put("reason", "bluetooth-disabled").toString()
        val config = JSONObject(configJson)
        serviceUuid = UUID.fromString(config.getString("serviceUuid"))
        rxUuid = UUID.fromString(config.getString("rxUuid"))
        txUuid = UUID.fromString(config.getString("txUuid"))
        nodeId = config.optString("nodeId", "")
        stopInternal()
        openGattServer()
        startAdvertising()
        startScanning()
        started = true
        emit("civweave:native-ble-status", JSONObject().put("started", true).put("nodeId", nodeId))
        return status()
    }

    @JavascriptInterface
    @SuppressLint("MissingPermission")
    fun stop(): Boolean { stopInternal(); started = false; emit("civweave:native-ble-status", JSONObject().put("started", false)); return true }

    @JavascriptInterface
    fun status(): String = JSONObject()
        .put("ok", started).put("started", started).put("nodeId", nodeId)
        .put("advertising", advertiser != null && started).put("scanning", scanner != null && started)
        .put("inboundPeers", JSONArray(inboundDevices.keys().toList()))
        .put("outboundPeers", JSONArray(outboundGatts.keys().toList()))
        .put("missingPermissions", JSONArray(missingPermissions())).toString()

    @JavascriptInterface
    @SuppressLint("MissingPermission")
    fun scan(): Boolean { if (missingPermissions().isNotEmpty()) return false; startScanning(); return true }

    @JavascriptInterface
    @SuppressLint("MissingPermission")
    fun send(peerId: String, base64Frame: String): Boolean {
        if (missingPermissions().isNotEmpty()) return false
        val bytes = try { Base64.decode(base64Frame, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING) } catch (_: Throwable) { return false }
        if (bytes.isEmpty()) return false
        val inbound = inboundDevices[peerId]
        val server = gattServer
        val tx = serviceUuid?.let { server?.getService(it) }?.let { service -> txUuid?.let { service.getCharacteristic(it) } }
        if (inbound != null && server != null && tx != null) {
            @Suppress("DEPRECATION")
            runCatching { tx.value = bytes; server.notifyCharacteristicChanged(inbound, tx, false) }.onSuccess { return true }
        }
        val gatt = outboundGatts[peerId]
        val rx = outboundRx[peerId]
        if (gatt != null && rx != null) {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                gatt.writeCharacteristic(rx, bytes, BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE) == BluetoothStatusCodes.SUCCESS
            } else {
                @Suppress("DEPRECATION")
                runCatching { rx.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE; rx.value = bytes; gatt.writeCharacteristic(rx) }.getOrDefault(false)
            }
        }
        return false
    }

    @SuppressLint("MissingPermission")
    private fun openGattServer() {
        val serviceId = serviceUuid ?: return; val rxId = rxUuid ?: return; val txId = txUuid ?: return
        val server = manager.openGattServer(activity, serverCallback) ?: return
        val service = BluetoothGattService(serviceId, BluetoothGattService.SERVICE_TYPE_PRIMARY)
        val rx = BluetoothGattCharacteristic(rxId, BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE, BluetoothGattCharacteristic.PERMISSION_WRITE)
        val tx = BluetoothGattCharacteristic(txId, BluetoothGattCharacteristic.PROPERTY_NOTIFY, BluetoothGattCharacteristic.PERMISSION_READ)
        tx.addDescriptor(BluetoothGattDescriptor(CCCD_UUID, BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE))
        service.addCharacteristic(rx); service.addCharacteristic(tx); server.addService(service); gattServer = server
    }

    @SuppressLint("MissingPermission")
    private fun startAdvertising() {
        val bt = adapter ?: return; val uuid = serviceUuid ?: return; val adv = bt.bluetoothLeAdvertiser ?: return
        val settings = AdvertiseSettings.Builder().setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_POWER).setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM).setConnectable(true).build()
        val nodeHint = nodeId.toByteArray(StandardCharsets.UTF_8).let { if (it.size > 8) it.copyOf(8) else it }
        val data = AdvertiseData.Builder().setIncludeDeviceName(false).addServiceUuid(ParcelUuid(uuid)).addServiceData(ParcelUuid(uuid), nodeHint).build()
        advertiser = adv; adv.startAdvertising(settings, data, advertiseCallback)
    }

    @SuppressLint("MissingPermission")
    private fun startScanning() {
        val bt = adapter ?: return; val uuid = serviceUuid ?: return; val scan = bt.bluetoothLeScanner ?: return
        scanner = scan
        val filter = ScanFilter.Builder().setServiceUuid(ParcelUuid(uuid)).build()
        val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_POWER).build()
        runCatching { scan.stopScan(scanCallback) }; scan.startScan(listOf(filter), settings, scanCallback)
    }

    @SuppressLint("MissingPermission")
    private fun maybeConnect(device: BluetoothDevice) {
        val id = device.address ?: return
        if (outboundGatts.containsKey(id) || inboundDevices.containsKey(id) || connecting.contains(id)) return
        if (outboundGatts.size + inboundDevices.size >= MAX_PEERS) return
        connecting.add(id)
        val gatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) device.connectGatt(activity, false, clientCallback, BluetoothDevice.TRANSPORT_LE) else {
            @Suppress("DEPRECATION") device.connectGatt(activity, false, clientCallback)
        }
        outboundGatts[id] = gatt
    }

    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartFailure(errorCode: Int) { emit("civweave:native-ble-status", JSONObject().put("advertiseError", errorCode)) }
    }

    private val scanCallback = object : ScanCallback() {
        @SuppressLint("MissingPermission") override fun onScanResult(callbackType: Int, result: ScanResult) { maybeConnect(result.device) }
    }

    private val serverCallback = object : BluetoothGattServerCallback() {
        @SuppressLint("MissingPermission")
        override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
            val id = device.address ?: return
            if (newState == BluetoothProfile.STATE_CONNECTED) { inboundDevices[id] = device; emitPeer(id, "open", "native-peripheral") }
            else if (newState == BluetoothProfile.STATE_DISCONNECTED) { inboundDevices.remove(id); emitPeer(id, "disconnected", "native-peripheral") }
        }
        @SuppressLint("MissingPermission")
        override fun onCharacteristicWriteRequest(device: BluetoothDevice, requestId: Int, characteristic: BluetoothGattCharacteristic, preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray) {
            if (characteristic.uuid == rxUuid && offset == 0) emitFrame(device.address ?: "unknown", value)
            if (responseNeeded) gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
        }
        @SuppressLint("MissingPermission")
        override fun onDescriptorWriteRequest(device: BluetoothDevice, requestId: Int, descriptor: BluetoothGattDescriptor, preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray) {
            if (responseNeeded) gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
        }
    }

    private val clientCallback = object : BluetoothGattCallback() {
        @SuppressLint("MissingPermission")
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            val id = gatt.device.address ?: return
            if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                outboundGatts[id] = gatt; connecting.remove(id); runCatching { gatt.requestMtu(247) }; gatt.discoverServices()
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                connecting.remove(id); outboundRx.remove(id); outboundGatts.remove(id); runCatching { gatt.close() }; emitPeer(id, "disconnected", "native-central")
            }
        }
        @SuppressLint("MissingPermission")
        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) return
            val id = gatt.device.address ?: return; val service = serviceUuid?.let { gatt.getService(it) } ?: return
            val rx = rxUuid?.let { service.getCharacteristic(it) } ?: return; val tx = txUuid?.let { service.getCharacteristic(it) } ?: return
            outboundRx[id] = rx; gatt.setCharacteristicNotification(tx, true)
            tx.getDescriptor(CCCD_UUID)?.let { descriptor ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) gatt.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
                else { @Suppress("DEPRECATION") runCatching { descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE; gatt.writeDescriptor(descriptor) } }
            }
            emitPeer(id, "open", "native-central")
        }
        @Deprecated("Deprecated in API 33")
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            if (characteristic.uuid == txUuid) emitFrame(gatt.device.address ?: "unknown", characteristic.value ?: return)
        }
        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
            if (characteristic.uuid == txUuid) emitFrame(gatt.device.address ?: "unknown", value)
        }
    }

    @SuppressLint("MissingPermission")
    private fun stopInternal() {
        runCatching { scanner?.stopScan(scanCallback) }; runCatching { advertiser?.stopAdvertising(advertiseCallback) }
        outboundGatts.values.forEach { gatt -> runCatching { gatt.disconnect(); gatt.close() } }
        outboundGatts.clear(); outboundRx.clear(); connecting.clear(); inboundDevices.clear(); runCatching { gattServer?.close() }
        scanner = null; advertiser = null; gattServer = null
    }

    private fun emitFrame(peerId: String, bytes: ByteArray) = emit("civweave:native-ble-frame", JSONObject().put("peerId", peerId).put("base64", Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)))
    private fun emitPeer(peerId: String, state: String, role: String) = emit("civweave:native-ble-peer", JSONObject().put("peerId", peerId).put("state", state).put("role", role))
    private fun emit(name: String, detail: JSONObject) {
        val eventName = JSONObject.quote(name); val detailJson = detail.toString()
        webView.post { webView.evaluateJavascript("window.dispatchEvent(new CustomEvent($eventName,{detail:$detailJson}));", null) }
    }
}
