package cc.civweave.devicehost

import android.util.Base64
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.time.Instant

/**
 * Native release trust boundary, independent of the PWA's verification.
 * No private keys, no runtime-provided trust root, no generic package installer.
 */
internal object HostReleasePolicy {
    const val EXPECTED_PACKAGE = "cc.civweave.devicehost"
    const val PINNED_ED25519_PUBLIC_KEY_B64URL = ""
    const val PINNED_KEY_ID = ""
    const val RELEASE_MANIFEST = "https://civweave.cc/downloads/device-host/stable.json"
    const val MAX_APK_BYTES = 128L * 1024L * 1024L
    private val apkUrl = Regex("^https://civweave\\.cc/downloads/device-host/[A-Za-z0-9._-]+\\.apk$")
    private val sha256 = Regex("^[0-9a-f]{64}$")
    private val versionName = Regex("^[0-9]+\\.[0-9]+\\.[0-9]+(?:[-.][A-Za-z0-9]+)*$")
    private val timestamp = Regex("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?Z$")

    data class Release(val versionCode: Long, val versionName: String,
        val url: String, val sha256: String, val sizeBytes: Long)

    fun verificationKeyConfigured(): Boolean {
        return PINNED_KEY_ID.matches(Regex("^[A-Za-z0-9._-]{1,80}$")) &&
            PINNED_ED25519_PUBLIC_KEY_B64URL.matches(Regex("^[A-Za-z0-9_-]{43}$"))
    }

    private fun exactKeys(row: JSONObject, vararg expected: String) {
        val keys = mutableSetOf<String>()
        val iterator = row.keys()
        while (iterator.hasNext()) keys.add(iterator.next())
        if (keys != expected.toSet()) throw SecurityException("Unexpected release metadata fields.")
    }

    private fun canonical(value: JSONObject, apk: JSONObject): ByteArray {
        // All string values are validated to an ASCII-only restricted alphabet.
        // This exact key ordering matches the JS canonicalReleaseBytes contract.
        val bytes = ("{\"apk\":{\"sha256\":\"" + apk.getString("sha256") +
            "\",\"sizeBytes\":" + apk.getLong("sizeBytes") +
            ",\"url\":\"" + apk.getString("url") +
            "\"},\"packageName\":\"" + EXPECTED_PACKAGE +
            "\",\"publishedAt\":\"" + value.getString("publishedAt") +
            "\",\"schema\":\"civweave.android-host-release.v1\",\"versionCode\":" +
            value.getLong("versionCode") + ",\"versionName\":\"" +
            value.getString("versionName") + "\"}")
        return bytes.toByteArray(StandardCharsets.UTF_8)
    }

    fun verifyEnvelope(json: String, installedVersion: Long): Release {
        if (!verificationKeyConfigured()) throw SecurityException("Release signing key is not provisioned.")
        if (json.length > 16_384) throw SecurityException("Oversized release manifest.")
        val root = JSONObject(json)
        exactKeys(root, "payload", "signature")
        val payload = root.getJSONObject("payload")
        val signature = root.getJSONObject("signature")
        exactKeys(payload, "schema", "packageName", "versionCode", "versionName", "publishedAt", "apk")
        exactKeys(signature, "keyId", "algorithm", "value")
        if (signature.getString("keyId") != PINNED_KEY_ID ||
            signature.getString("algorithm") != "Ed25519")
            throw SecurityException("Unknown release signature key.")
        if (payload.getString("schema") != "civweave.android-host-release.v1" ||
            payload.getString("packageName") != EXPECTED_PACKAGE)
            throw SecurityException("Unexpected package release.")
        val code = payload.getLong("versionCode")
        val name = payload.getString("versionName")
        if (code <= installedVersion || code <= 0 || !versionName.matches(name))
            throw SecurityException("Release is not a compatible upgrade.")
        val published = payload.getString("publishedAt")
        if (!timestamp.matches(published) ||
            Instant.parse(published).toEpochMilli() > System.currentTimeMillis() + 300_000)
            throw SecurityException("Invalid release publication date.")
        val apk = payload.getJSONObject("apk")
        exactKeys(apk, "url", "sha256", "sizeBytes")
        val url = apk.getString("url")
        val hash = apk.getString("sha256")
        val size = apk.getLong("sizeBytes")
        if (!apkUrl.matches(url) || !sha256.matches(hash) || size <= 0L || size > MAX_APK_BYTES)
            throw SecurityException("Untrusted APK location or size.")
        val encoded = Base64.decode(PINNED_ED25519_PUBLIC_KEY_B64URL,
            Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
        if (encoded.size != 32) throw SecurityException("Invalid trusted public key.")
        val spki = byteArrayOf(0x30,0x2a,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x03,0x21,0x00) + encoded
        val publicKey = KeyFactory.getInstance("Ed25519").generatePublic(X509EncodedKeySpec(spki))
        val raw = Base64.decode(signature.getString("value"),
            Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
        if (raw.size != 64) throw SecurityException("Invalid release signature.")
        val verifier = Signature.getInstance("Ed25519")
        verifier.initVerify(publicKey)
        verifier.update(canonical(payload, apk))
        if (!verifier.verify(raw)) throw SecurityException("Release signature could not be verified.")
        return Release(code, name, url, hash, size)
    }
}
