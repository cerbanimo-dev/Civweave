package cc.civweave.devicehost

import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import javax.net.ssl.HttpsURLConnection
import java.security.MessageDigest

/**
 * Independently verifies a pinned release before a USER-INITIATED PackageInstaller session.
 * No method is exposed to web pages or the loopback API.
 */
internal object HostUpdateManager {
    data class Staged(val release: HostReleasePolicy.Release, val file: File)

    private fun openPinned(url: String): HttpsURLConnection {
        if (!url.startsWith("https://civweave.cc/downloads/device-host/"))
            throw SecurityException("Release endpoint is not pinned.")
        val conn = URL(url).openConnection() as? HttpsURLConnection
            ?: throw SecurityException("HTTPS is required.")
        conn.instanceFollowRedirects = false
        conn.connectTimeout = 10_000
        conn.readTimeout = 20_000
        conn.useCaches = false
        conn.requestMethod = "GET"
        if (conn.responseCode != HttpURLConnection.HTTP_OK || conn.url.toString() != url) {
            conn.disconnect()
            throw SecurityException("Release download failed or redirected.")
        }
        return conn
    }

    fun prepare(activity: Activity): Staged {
        if (!HostReleasePolicy.verificationKeyConfigured()) {
            throw SecurityException("Native update trust key is not configured; installs disabled.")
        }
        val manifest = openPinned(HostReleasePolicy.RELEASE_MANIFEST)
        val json = try {
            manifest.inputStream.use { input ->
                val out = java.io.ByteArrayOutputStream()
                val buf = ByteArray(4096)
                while (true) {
                    val count = input.read(buf)
                    if (count < 0) break
                    if (out.size() + count > 16_384) throw SecurityException("Release metadata exceeds limit.")
                    out.write(buf,0,count)
                }
                out.toString(Charsets.UTF_8.name())
            }
        } finally { manifest.disconnect() }
        val release = HostReleasePolicy.verifyEnvelope(json, BuildConfig.VERSION_CODE.toLong())
        val tmp = File.createTempFile("host-update-", ".apk", activity.cacheDir)
        var completed = false
        try {
            val conn = openPinned(release.url)
            try {
                val sha = MessageDigest.getInstance("SHA-256")
                var total = 0L
                conn.inputStream.use { input ->
                    FileOutputStream(tmp).use { output ->
                        val buffer = ByteArray(32 * 1024)
                        while (true) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            total += count
                            if (total > release.sizeBytes || total > HostReleasePolicy.MAX_APK_BYTES)
                                throw SecurityException("Downloaded APK exceeds signed size.")
                            sha.update(buffer,0,count)
                            output.write(buffer,0,count)
                        }
                        output.fd.sync()
                    }
                }
                if (total != release.sizeBytes ||
                    sha.digest().joinToString("") { "%02x".format(it.toInt() and 255) } != release.sha256)
                    throw SecurityException("Native APK hash mismatch.")
            } finally { conn.disconnect() }
            verifyArchive(activity,tmp,release.versionCode)
            completed = true
            return Staged(release,tmp)
        } finally {
            if (!completed) tmp.delete()
        }
    }

    private fun certificateDigests(activity: Activity, archive: android.content.pm.PackageInfo): Set<String> {
        val signatures = if (Build.VERSION.SDK_INT >= 28) {
            archive.signingInfo?.apkContentsSigners?.toList()
        } else {
            @Suppress("DEPRECATION")
            archive.signatures?.toList()
        }
        return signatures.orEmpty().map { signature ->
            MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())
                .joinToString("") { "%02x".format(it.toInt() and 255) }
        }.toSet()
    }

    private fun verifyArchive(activity: Activity, file: File, expectedVersion: Long) {
        val pm = activity.packageManager
        val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES
                    else @Suppress("DEPRECATION") PackageManager.GET_SIGNATURES
        @Suppress("DEPRECATION")
        val candidate = pm.getPackageArchiveInfo(file.absolutePath, flags)
            ?: throw SecurityException("Downloaded file is not a valid Android APK.")
        if (candidate.packageName != HostReleasePolicy.EXPECTED_PACKAGE)
            throw SecurityException("Package identity mismatch.")
        val code = if (Build.VERSION.SDK_INT >= 28) candidate.longVersionCode
                   else @Suppress("DEPRECATION") candidate.versionCode.toLong()
        if (code != expectedVersion || code <= BuildConfig.VERSION_CODE)
            throw SecurityException("APK version does not match the signed manifest.")
        @Suppress("DEPRECATION")
        val installed = pm.getPackageInfo(HostReleasePolicy.EXPECTED_PACKAGE, flags)
        val expected = certificateDigests(activity, installed)
        val supplied = certificateDigests(activity, candidate)
        if (expected.isEmpty() || supplied.isEmpty() || expected != supplied)
            throw SecurityException("APK signing certificate does not match the installed host.")
    }

    /**
     * This is called only by a user's explicit Install button.
     * The receiver surfaces Android's confirmation through a notification, not a silent launch.
     */
    fun requestInstall(activity: Activity, staged: Staged): String {
        if (!HostReleasePolicy.verificationKeyConfigured())
            throw SecurityException("Native update signing key is not provisioned.")
        if (!activity.packageManager.canRequestPackageInstalls()) {
            activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + activity.packageName)))
            return "Android must authorize this app as an installation source. After granting permission, tap Install again."
        }
        if (!staged.file.isFile || staged.file.length() != staged.release.sizeBytes)
            throw SecurityException("Prepared update has been lost.")
        val digest = MessageDigest.getInstance("SHA-256")
        staged.file.inputStream().use { input ->
            val buf = ByteArray(32 * 1024)
            while (true) {
                val count=input.read(buf)
                if (count<0) break
                digest.update(buf,0,count)
            }
        }
        if (digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) } != staged.release.sha256)
            throw SecurityException("Prepared APK has changed.")
        verifyArchive(activity, staged.file, staged.release.versionCode)

        val installer = activity.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(HostReleasePolicy.EXPECTED_PACKAGE)
            setSize(staged.file.length())
            if (Build.VERSION.SDK_INT >= 31)
                setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED)
        }
        val sessionId = installer.createSession(params)
        try {
            installer.openSession(sessionId).use { session ->
                session.openWrite("base.apk",0,staged.file.length()).use { output ->
                    staged.file.inputStream().use { input -> input.copyTo(output) }
                    session.fsync(output)
                }
                val callback = Intent(activity, HostInstallResultReceiver::class.java)
                    .setAction(HostInstallResultReceiver.ACTION_RESULT)
                val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                    (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
                val receiver = PendingIntent.getBroadcast(activity, sessionId, callback, flags)
                session.commit(receiver.intentSender)
            }
        } catch (error: Exception) {
            runCatching { installer.abandonSession(sessionId) }
            throw error
        }
        return "Submitted verified self-update to Android. Watch for its confirmation notification; installation is not yet complete."
    }
}
