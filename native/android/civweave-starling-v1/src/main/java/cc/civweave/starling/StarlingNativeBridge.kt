package cc.civweave.starling

import android.content.Context
import android.net.Uri
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import androidx.webkit.JavaScriptReplyProxy
import org.json.JSONObject
import org.json.JSONArray
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.Data
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Native Android Starling host entrypoint. Only a trusted, main-frame HTTPS
 * Civweave origin can see this WebMessageListener; NEVER addJavascriptInterface.
 * Job execution lives in WorkManager (StarlingNativeWorker.kt), not the PWA.
 */
class StarlingNativeBridge(private val context: Context) {
    companion object {
        const val BRIDGE_NAME = "CivweaveStarlingNative"
        private val TRUSTED = setOf(
            "https://civweave.cc",
            "https://civweave-staging.pages.dev"
        )
        private val GUILD = Regex("^[A-Za-z0-9:_-]{1,160}$")
        private val JOB = Regex("^[0-9a-f]{32}$")
        private val PERSONAS = setOf("kami", "aphra", "jae", "anthony", "rosa", "sana", "kit", "farah")
        private val MODELS = setOf("qwen35-4b-native", "qwen35-2b-native")
    }

    fun install(webView: WebView) {
        check(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            "Android System WebView must support origin-scoped WebMessageListener."
        }
        WebViewCompat.addWebMessageListener(
            webView, BRIDGE_NAME, TRUSTED
        ) { _, message, sourceOrigin: Uri, isMainFrame: Boolean, reply: JavaScriptReplyProxy ->
            if (!isMainFrame || sourceOrigin.toString() !in TRUSTED) return@addWebMessageListener
            val id = try { JSONObject(message.data ?: "").optString("id").take(60) } catch (_: Exception) { "" }
            try {
                val request = JSONObject(message.data ?: "")
                val method = request.optString("method")
                val path = request.optString("path")
                val body = request.optJSONObject("body")
                val answer = handle(method, path, body)
                reply.postMessage(JSONObject().put("id", id).put("ok", true).put("data", answer).toString())
            } catch (error: Exception) {
                reply.postMessage(JSONObject().put("id", id).put("ok", false)
                    .put("error", (error.message ?: "Native request rejected").take(240)).toString())
            }
        }
    }

    private fun handle(method: String, path: String, body: JSONObject?): JSONObject {
        if (method == "GET" && path == "/v1/starling/status") {
            return StarlingNativeWorker.status(context)
        }
        if (method == "POST" && path == "/v1/starling/jobs") {
            val job = requireJob(body ?: throw IllegalArgumentException("Missing job."))
            val store = StarlingNativeWorker.store(context)
            val old = store.get("job:" + job.getString("jobId"))
            if (old != null) {
                require(StarlingNativeWorker.sameRequest(old, job)) { "An existing job ID has different content." }
                return StarlingNativeWorker.project(old)
            }
            require(!store.anyRunning()) { "A native model generation is already active." }
            require(store.jobCount() < 200) { "The native job journal is full." }
            job.put("state", "queued")
                .put("createdAt", System.currentTimeMillis() / 1000.0)
                .put("updatedAt", System.currentTimeMillis() / 1000.0)
                .put("text", "").put("error", "")
                .put("reviewRequired", true).put("claimVerified", false)
            store.put("job:" + job.getString("jobId"), job)
            val input = Data.Builder().putString("jobId", job.getString("jobId")).build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                "starling-job-" + job.getString("jobId"), ExistingWorkPolicy.KEEP,
                OneTimeWorkRequestBuilder<StarlingNativeWorker>().setInputData(input).build()
            )
            return StarlingNativeWorker.project(job)
        }
        if (method == "GET" && path.startsWith("/v1/starling/jobs/")) {
            val id = path.removePrefix("/v1/starling/jobs/")
            require(JOB.matches(id)) { "Invalid job ID." }
            val job = StarlingNativeWorker.store(context).get("job:" + id)
                ?: throw IllegalArgumentException("Job not found.")
            return StarlingNativeWorker.project(job)
        }
        if (method == "POST" && path.startsWith("/v1/starling/jobs/") && path.endsWith("/cancel")) {
            val id = path.removePrefix("/v1/starling/jobs/").removeSuffix("/cancel")
            require(JOB.matches(id)) { "Invalid job ID." }
            val store = StarlingNativeWorker.store(context)
            val job = store.get("job:" + id) ?: throw IllegalArgumentException("Job not found.")
            if (job.optString("state") == "queued") job.put("state", "cancelled")
            if (job.optString("state") == "running") job.put("cancelRequested", true)
            store.put("job:" + id, job)
            WorkManager.getInstance(context).cancelUniqueWork("starling-job-" + id)
            return StarlingNativeWorker.project(job)
        }
        if (method == "POST" && path == "/v1/starling/schedule") {
            val policy = requireSchedule(body ?: throw IllegalArgumentException("Missing schedule."))
            val guild = policy.getString("guildId")
            val key = "schedule:" + guild
            val store = StarlingNativeWorker.store(context)
            if (!policy.getBoolean("enabled")) {
                store.remove(key)
                WorkManager.getInstance(context).cancelUniqueWork("starling-schedule-" + guild)
            } else {
                policy.put("paused", false)
                    .put("usedToday", 0).put("dayKey", "")
                    .put("nextAt", 0)
                store.put(key, policy)
                val data = Data.Builder().putString("guildId", guild).putBoolean("scheduled", true).build()
                val request = PeriodicWorkRequestBuilder<StarlingNativeWorker>(
                    policy.getLong("intervalMinutes"), TimeUnit.MINUTES
                ).setInputData(data).build()
                WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                    "starling-schedule-" + guild, ExistingPeriodicWorkPolicy.UPDATE, request
                )
            }
            return JSONObject().put("schema", "civweave.starling-host-schedule.v1")
                .put("guildId", guild).put("enabled", policy.getBoolean("enabled"))
                .put("mode", "local-only").put("reviewRequired", true)
        }
        throw IllegalArgumentException("Unsupported native Starling operation.")
    }

    private fun requireJob(body: JSONObject): JSONObject {
        require(body.optString("schema") == "civweave.starling-host-job.v1" && body.optString("action") == "draft-only")
        val jid = body.optString("jobId")
        val guild = body.optString("guildId")
        val persona = body.optString("personaId")
        val model = body.optString("model")
        val intention = body.optString("intention")
        val brief = body.optString("brief")
        val tokens = body.optInt("maxTokens", 440)
        require(JOB.matches(jid) && GUILD.matches(guild) && PERSONAS.contains(persona) && MODELS.contains(model))
        require(intention.length in 12..3000 && brief.length <= 1200 && tokens in 64..1000)
        return JSONObject().put("schema", "civweave.starling-host-job.v1")
            .put("jobId", jid).put("guildId", guild).put("personaId", persona)
            .put("model", model).put("intention", intention).put("brief", brief)
            .put("maxTokens", tokens).put("action", "draft-only")
    }

    private fun requireSchedule(body: JSONObject): JSONObject {
        require(body.optString("schema") == "civweave.starling-host-schedule.v1")
        val guild = body.optString("guildId")
        require(GUILD.matches(guild) && body.has("enabled") && body.get("enabled") is Boolean)
        val enabled = body.getBoolean("enabled")
        if (!enabled) return JSONObject().put("guildId", guild).put("enabled", false)
        val intention = body.optString("intention")
        val model = body.optString("model")
        val interval = body.optInt("intervalMinutes", 60)
        val daily = body.optInt("dailyLimit", 4)
        require(intention.length in 12..3000 && model in MODELS && interval in 15..1440 && daily in 1..12)
        require(body.optString("action") == "draft-only")
        return JSONObject().put("schema", "civweave.starling-host-schedule.v1")
            .put("guildId", guild).put("enabled", true).put("intention", intention)
            .put("model", model).put("intervalMinutes", interval).put("dailyLimit", daily)
            .put("action", "draft-only")
    }
}
