package cc.civweave.starling

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.io.BufferedInputStream
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.security.MessageDigest
import java.util.UUID

/**
 * WorkManager-backed, durable, device-local Starling job runner.
 * WorkManager schedules inexact background work; it is NOT an unlimited
 * 24/7 foreground execution promise. This owner cannot claim tasks.
 */
class StarlingNativeWorker(context: Context, parameters: WorkerParameters) : Worker(context, parameters) {
    companion object {
        private const val JOB_SCHEMA = "civweave.starling-host-job.v1"
        private const val SCHEDULE_SCHEMA = "civweave.starling-host-schedule.v1"
        private val lock = Any()
        fun store(context: Context) = Journal(context.applicationContext)
        fun sameRequest(existing: JSONObject, submitted: JSONObject): Boolean {
            val fields = arrayOf("schema", "jobId", "guildId", "personaId", "model", "intention", "brief", "maxTokens", "action")
            return fields.all { existing.optString(it) == submitted.optString(it) }
        }
        fun project(job: JSONObject): JSONObject = JSONObject()
            .put("schema", JOB_SCHEMA)
            .put("jobId", job.optString("jobId"))
            .put("guildId", job.optString("guildId"))
            .put("personaId", job.optString("personaId"))
            .put("state", job.optString("state"))
            .put("text", job.optString("text").take(6000))
            .put("error", job.optString("error").take(300))
            .put("createdAt", job.optDouble("createdAt"))
            .put("updatedAt", job.optDouble("updatedAt"))
            .put("reviewRequired", true).put("claimVerified", false).put("backend", "android")

        fun status(context: Context): JSONObject {
            val all = store(context).all()
            val jobs = all.filterKeys { it.startsWith("job:") }
            val schedules = JSONArray()
            for ((key, value) in all) if (key.startsWith("schedule:")) {
                schedules.put(JSONObject()
                    .put("guildId", value.optString("guildId"))
                    .put("enabled", value.optBoolean("enabled"))
                    .put("paused", value.optBoolean("paused"))
                    .put("intervalMinutes", value.optInt("intervalMinutes"))
                    .put("dailyLimit", value.optInt("dailyLimit")))
            }
            return JSONObject().put("schema", "civweave.starling-host-status.v1")
                .put("backend", "android").put("mode", "local-only").put("online", true)
                .put("jobs", jobs.size)
                .put("running", jobs.values.any { it.optString("state") in arrayOf("running", "queued") })
                .put("schedules", schedules)
                .put("capabilities", JSONArray(listOf("draft-only", "durable-local-inference", "scheduled-offers")))
                .put("taskClaims", false).put("toolExecution", false)
        }

        private fun dayKey() = DateTimeFormatter.ISO_LOCAL_DATE
            .withZone(ZoneOffset.UTC).format(Instant.now())
        private fun nowSeconds() = System.currentTimeMillis() / 1000.0
    }

    override fun doWork(): Result {
        val direct = inputData.getString("jobId")
        val guild = inputData.getString("guildId")
        val jobId = if (direct != null) direct else if (guild != null) scheduledJob(guild) else return Result.failure()
        if (jobId.isEmpty()) return Result.success()
        return processJob(jobId)
    }

    private fun scheduledJob(guild: String): String {
        synchronized(lock) {
            val db = store(applicationContext)
            val policy = db.get("schedule:" + guild) ?: return ""
            if (!policy.optBoolean("enabled") || policy.optBoolean("paused")) return ""
            val now = nowSeconds()
            if (now < policy.optDouble("nextAt", 0.0)) return ""
            val day = dayKey()
            if (policy.optString("dayKey") != day) {
                policy.put("dayKey", day).put("usedToday", 0)
            }
            val used = policy.optInt("usedToday")
            if (used >= policy.optInt("dailyLimit", 4) || db.anyRunning()) return ""
            if (db.jobCount() >= 200) {
                policy.put("paused", true)
                db.put("schedule:" + guild, policy)
                return ""
            }
            val personas = listOf("kami", "aphra", "jae", "anthony", "rosa", "sana", "kit", "farah")
            val jid = UUID.randomUUID().toString().replace("-", "")
            val persona = personas[used % personas.size]
            val nowAt = nowSeconds()
            val job = JSONObject()
                .put("schema", JOB_SCHEMA).put("jobId", jid).put("guildId", guild)
                .put("personaId", persona).put("model", policy.getString("model"))
                .put("intention", policy.getString("intention"))
                .put("brief", "Draft one reviewable Guild contribution. Do not claim or complete work.")
                .put("maxTokens", 440).put("action", "draft-only")
                .put("state", "queued").put("createdAt", nowAt).put("updatedAt", nowAt)
                .put("text", "").put("error", "").put("reviewRequired", true).put("claimVerified", false)
            policy.put("usedToday", used + 1)
                .put("nextAt", now + policy.optInt("intervalMinutes", 60) * 60)
            db.put("job:" + jid, job)
            db.put("schedule:" + guild, policy)
            return jid
        }
    }

    private fun processJob(jobId: String): Result {
        val record: JSONObject
        synchronized(lock) {
            val db = store(applicationContext)
            record = db.get("job:" + jobId) ?: return Result.failure()
            if (record.optString("state") == "cancelled" || record.optString("state") == "completed") return Result.success()
            if (record.optString("state") == "running") {
                // A previous process may have been killed. No silent
                // double execution: recovery requires a new explicit job ID.
                record.put("state", "interrupted").put("error", "Worker restarted mid-generation; review required.")
                db.put("job:" + jobId, record)
                return Result.failure()
            }
            if (record.optString("state") != "queued") return Result.failure()
            if (db.all().any { (key, value) -> key.startsWith("job:") && key != "job:" + jobId && value.optString("state") == "running" }) return Result.retry()
            record.put("state", "running").put("updatedAt", nowSeconds())
            db.put("job:" + jobId, record)
        }
        try {
            val output = StarlingNativeEngines.engine.generate(record)
            synchronized(lock) {
                val db = store(applicationContext)
                val current = db.get("job:" + jobId) ?: return Result.failure()
                if (isStopped || current.optBoolean("cancelRequested")) {
                    current.put("state", "cancelled").put("error", "Cancelled by owner or Android.")
                } else {
                    current.put("text", output.take(6000)).put("state", "completed")
                }
                current.put("updatedAt", nowSeconds())
                db.put("job:" + jobId, current)
            }
            return Result.success()
        } catch (error: Exception) {
            synchronized(lock) {
                val db = store(applicationContext)
                val current = db.get("job:" + jobId) ?: return Result.failure()
                current.put("state", if (isStopped) "interrupted" else "failed")
                    .put("error", (error.message ?: "Local native model unavailable").take(300))
                    .put("updatedAt", nowSeconds())
                db.put("job:" + jobId, current)
                val scheduleKey = "schedule:" + current.optString("guildId")
                db.get(scheduleKey)?.let { policy ->
                    policy.put("paused", true)
                    db.put(scheduleKey, policy)
                }
            }
            return Result.failure()
        }
    }

    /** Private app storage; synchronous commit before reporting acceptance. */
    class Journal(context: Context) {
        private val prefs = context.getSharedPreferences("civweave-starling-native-v1", Context.MODE_PRIVATE)
        fun get(key: String): JSONObject? = synchronized(lock) {
            prefs.getString(key, null)?.let { JSONObject(it) }
        }
        fun put(key: String, value: JSONObject) = synchronized(lock) {
            check(prefs.edit().putString(key, value.toString()).commit()) { "Native journal persistence failed." }
        }
        fun remove(key: String) = synchronized(lock) {
            check(prefs.edit().remove(key).commit()) { "Could not persist schedule disable." }
        }
        fun all(): Map<String, JSONObject> = synchronized(lock) {
            prefs.all.mapNotNull { (key, value) ->
                if (value is String) try { key to JSONObject(value) } catch (_: Exception) { null } else null
            }.toMap()
        }
        fun anyRunning() = all().any { (key, value) ->
            key.startsWith("job:") && value.optString("state") in arrayOf("queued", "running")
        }
        fun jobCount() = all().keys.count { it.startsWith("job:") }
    }
}

/** Native host can inject an embedded GGUF runner. The safe fallback is a
 * fixed same-device llama.cpp endpoint, never a client-supplied URL. */
interface StarlingLocalEngine {
    fun generate(job: JSONObject): String
}

object StarlingNativeEngines {
    @Volatile var engine: StarlingLocalEngine = LoopbackLlamaEngine()
}

/** Does not depend on Termux Starling host (8767); a native APK may supply
 * its own packaged model inference engine instead. */
class LoopbackLlamaEngine : StarlingLocalEngine {
    override fun generate(job: JSONObject): String {
        val url = URL("http://127.0.0.1:8080/v1/chat/completions")
        val connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = 8000
        connection.readTimeout = 360000
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        try {
            val instruction = "You are " + job.getString("personaId") +
                " in the fictional Civweave Starling Collective. Guild goal: " +
                job.getString("intention") +
                ". Produce a reviewable draft only. No tool execution, fabricated claims, verified completions, governance votes, external actions or spending."
            val messages = JSONArray().put(JSONObject().put("role", "system").put("content", instruction))
                .put(JSONObject().put("role", "user").put("content",
                    job.optString("brief").ifBlank { "Propose one useful next step." }))
            val payload = JSONObject().put("model", job.getString("model"))
                .put("messages", messages).put("stream", false)
                .put("max_tokens", job.optInt("maxTokens", 440)).put("temperature", 0.2)
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            require(connection.responseCode == 200) { "Local llama.cpp endpoint unavailable (HTTP " + connection.responseCode + ")." }
            val bytes = connection.inputStream.use { stream ->
                val output = java.io.ByteArrayOutputStream()
                val chunk = ByteArray(8192)
                while (true) {
                    val read = stream.read(chunk)
                    if (read < 0) break
                    require(output.size() + read <= 120000) { "Local response exceeded 120 KB." }
                    output.write(chunk, 0, read)
                }
                output.toByteArray()
            }
            val result = JSONObject(String(bytes, Charsets.UTF_8))
            val choice = result.getJSONArray("choices").getJSONObject(0)
            require(choice.optString("finish_reason") != "length") { "The local draft stopped early at max_tokens." }
            val output = choice.getJSONObject("message").optString("content").trim()
            require(output.isNotEmpty()) { "Local model produced an empty draft." }
            return output
        } finally {
            connection.disconnect()
        }
    }
}
