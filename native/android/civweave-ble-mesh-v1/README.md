# Civweave Android BLE Mesh Bridge v1

This is the native half of `/public/app/ble-object-transport-v1.js`. It lets an Android Civweave wrapper act as both a BLE GATT peripheral and central; browser Web Bluetooth can act as a central/GATT client but does not make the PWA itself an advertising phone-to-phone peripheral.

## Integration

Add `CivweaveBleMeshBridge.kt` to the Android wrapper, request its runtime permissions, then inject it into the Civweave WebView:

```kotlin
val bridge = CivweaveBleMeshBridge(this, webView)
webView.addJavascriptInterface(bridge, "CivweaveAndroidBleMesh")
```

Android 12+ manifest permissions:

```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
```

For Android 11 and below, retain the legacy Bluetooth permissions and the location permission required by BLE scanning on those releases.

## Responsibility split

The Kotlin bridge only advertises/scans the Civweave service, owns GATT central/peripheral connections, and transports raw small frames. JavaScript remains the protocol owner: signed community objects, end-to-end encrypted PM payloads, 20-byte-safe framing, replay suppression, canonical validation, and store/carry/forward routing.

BLE v1 deliberately allows only `civweave.private-message-envelope.v1` by default. Guild roster claims remain on the scoped signed local-object group mesh until BLE has a verified peer-group handshake, avoiding broadcast of roster metadata to unrelated nearby radios.
