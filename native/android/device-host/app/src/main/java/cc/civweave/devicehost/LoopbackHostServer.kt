package cc.civweave.devicehost

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Locale
import kotlin.concurrent.thread

/**
 * One foreground-activity-owned loopback server. Deliberately read-only after pairing.
 * No network interface except 127.0.0.1 is bound; no package installation endpoint exists.
 */
internal class LoopbackHostServer : AutoCloseable {
    private val random = SecureRandom()
    private val mutex = Any()
    private val alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ234567"
    private val allowedOrigins = setOf(
        "https://civweave.cc",
        "https://civweave-staging.pages.dev",
        "http://127.0.0.1:8790"
    )
    private var code = ""
    private var token = ""
    private var expiresAt = 0L
    private var badAttempts = 0
    @Volatile private var running = false
    private var listener: ServerSocket? = null

    init { rotatePairingCode() }

    fun currentCode(): String = synchronized(mutex) { code }

    fun rotatePairingCode(): String = synchronized(mutex) {
        code = (1..10).map { alphabet[random.nextInt(alphabet.length)] }.joinToString("")
        token = ""
        badAttempts = 0
        expiresAt = System.currentTimeMillis() + 120_000L
        code
    }

    fun start() {
        check(!running) { "Already running" }
        val socket = ServerSocket()
        socket.reuseAddress = false
        socket.bind(InetSocketAddress(InetAddress.getByName("127.0.0.1"), 8792), 4)
        listener = socket
        running = true
        thread(name = "civweave-device-host-loopback", isDaemon = true) {
            while (running) {
                try {
                    socket.accept().use { peer ->
                        peer.soTimeout = 3_000
                        handle(peer)
                    }
                } catch (_: SocketTimeoutException) {
                    // A local client can time out without terminating the host.
                } catch (_: Exception) {
                    if (!running) break
                }
            }
        }
    }

    override fun close() {
        running = false
        listener?.close()
        listener = null
        synchronized(mutex) { token = ""; code = "" }
    }

    private fun constantTimeMatch(a: String, b: String): Boolean {
        return MessageDigest.isEqual(a.toByteArray(Charsets.US_ASCII), b.toByteArray(Charsets.US_ASCII))
    }

    private fun pair(candidate: String): String? = synchronized(mutex) {
        if (System.currentTimeMillis() >= expiresAt || badAttempts >= 5 || code.isEmpty()) return null
        if (candidate.length != 10 || !constantTimeMatch(candidate, code)) {
            badAttempts++
            return null
        }
        val secret = ByteArray(32)
        random.nextBytes(secret)
        token = Base64.encodeToString(secret, Base64.NO_WRAP or Base64.NO_PADDING or Base64.URL_SAFE)
        code = "" // One successful pairing only. User must issue a new code for a new pairing.
        return token
    }

    private fun authorized(header: String?): Boolean = synchronized(mutex) {
        token.isNotEmpty() && header != null &&
            header.startsWith("Bearer ") &&
            constantTimeMatch(header.removePrefix("Bearer "), token)
    }

    private fun handle(peer: Socket) {
        val reader = BufferedReader(InputStreamReader(peer.getInputStream(), Charsets.UTF_8))
        val line = reader.readLine() ?: return
        if (line.length > 256) return
        val pieces = line.split(" ")
        if (pieces.size != 3 || !pieces[2].startsWith("HTTP/1.")) return
        val method = pieces[0]
        val path = pieces[1]
        val headers = HashMap<String, String>()
        var headerBytes = 0
        for (index in 0 until 32) {
            val next = reader.readLine() ?: return
            headerBytes += next.length
            if (headerBytes > 8192) return
            if (next.isEmpty()) break
            val cut = next.indexOf(':')
            if (cut < 1) return
            val key = next.substring(0, cut).trim().lowercase(Locale.ROOT)
            if (headers.containsKey(key)) return
            headers[key] = next.substring(cut + 1).trim()
            if (index == 31) return
        }
        val origin = headers["origin"]
        // Origin checks constrain browsers, not arbitrary native apps that can forge
        // headers. The pairing bearer token is mandatory for protected operations.
        if (origin !in allowedOrigins) {
            respond(peer, 403, JSONObject().put("error", "origin-not-allowed"), null)
            return
        }
        if (path !in setOf("/v1/pair", "/v1/status")) {
            respond(peer, 404, JSONObject().put("error", "not-found"), origin)
            return
        }
        if (method == "OPTIONS") {
            val intended = headers["access-control-request-method"]
            val supported = if (path == "/v1/pair") "POST" else "GET"
            if (intended == supported) respond(peer, 204, null, origin)
            else respond(peer, 405, JSONObject().put("error", "method-not-allowed"), origin)
            return
        }
        if (method == "GET" && path == "/v1/status") {
            if (!authorized(headers["authorization"])) {
                respond(peer, 401, JSONObject().put("error", "pairing-required"), origin)
                return
            }
            val body = JSONObject()
                .put("schema", "civweave.device-host-status.v1")
                .put("packageName", BuildConfig.APPLICATION_ID)
                .put("versionCode", BuildConfig.VERSION_CODE)
                .put("versionName", BuildConfig.VERSION_NAME)
                .put("capabilities", JSONArray().put("android.host.status.v1"))
            respond(peer, 200, body, origin)
            return
        }
        if (method == "POST" && path == "/v1/pair") {
            if (headers["content-type"]?.lowercase(Locale.ROOT)?.substringBefore(';') != "application/json" ||
                headers.containsKey("transfer-encoding")) {
                respond(peer, 415, JSONObject().put("error", "expected-json"), origin)
                return
            }
            val size = headers["content-length"]?.toIntOrNull()
            if (size == null || size < 2 || size > 512) {
                respond(peer, 413, JSONObject().put("error", "request-too-large"), origin)
                return
            }
            val chars = CharArray(size)
            var offset = 0
            while (offset < size) {
                val read = reader.read(chars, offset, size - offset)
                if (read < 1) return
                offset += read
            }
            val request = try { JSONObject(String(chars)) } catch (_: Exception) { JSONObject() }
            val value = request.optString("code", "")
            val secret = pair(value)
            if (secret == null) respond(peer, 403, JSONObject().put("error", "invalid-or-expired-code"), origin)
            else respond(peer, 200, JSONObject().put("schema", "civweave.device-host-pair.v1").put("token", secret), origin)
            return
        }
        respond(peer, 405, JSONObject().put("error", "method-not-allowed"), origin)
    }

    private fun respond(peer: Socket, code: Int, payload: JSONObject?, origin: String?) {
        val name = when (code) {
            200 -> "OK"
            204 -> "No Content"
            401 -> "Unauthorized"
            403 -> "Forbidden"
            404 -> "Not Found"
            405 -> "Method Not Allowed"
            413 -> "Content Too Large"
            415 -> "Unsupported Media Type"
            else -> "Error"
        }
        val data = payload?.toString()?.toByteArray(Charsets.UTF_8) ?: ByteArray(0)
        val headers = buildString {
            append("HTTP/1.1 $code $name\r\n")
            append("Content-Type: application/json; charset=utf-8\r\n")
            append("Content-Length: ${data.size}\r\n")
            append("Cache-Control: no-store\r\n")
            append("X-Content-Type-Options: nosniff\r\n")
            append("Connection: close\r\n")
            append("Vary: Origin\r\n")
            if (origin != null) {
                append("Access-Control-Allow-Origin: $origin\r\n")
                append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n")
                append("Access-Control-Allow-Headers: Authorization, Content-Type\r\n")
                append("Access-Control-Max-Age: 600\r\n")
                append("Access-Control-Allow-Private-Network: true\r\n")
            }
            append("\r\n")
        }
        val output = peer.getOutputStream()
        output.write(headers.toByteArray(Charsets.US_ASCII))
        output.write(data)
        output.flush()
    }
}
