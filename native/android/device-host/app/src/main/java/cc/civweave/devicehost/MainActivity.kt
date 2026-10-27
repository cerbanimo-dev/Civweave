package cc.civweave.devicehost

import android.app.Activity
import android.Manifest
import android.content.pm.PackageManager
import kotlin.concurrent.thread
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * Native host management UI. The user explicitly starts/stops the foreground host.
 * Moving to a browser must NOT close the loopback API; service owns that lifecycle.
 */
class MainActivity : Activity() {
    private var host: LoopbackHostServer? = null
    private var bound = false
    private lateinit var codeView: TextView
    private lateinit var status: TextView
    private lateinit var startButton: Button
    private lateinit var stopButton: Button
    private lateinit var rotate: Button
    private lateinit var checkUpdates: Button
    private lateinit var installUpdate: Button
    private var stagedUpdate: HostUpdateManager.Staged? = null

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            bound = true
            host = (binder as DeviceHostService.LocalBinder).host()
            refresh()
        }
        override fun onServiceDisconnected(name: ComponentName) {
            host = null
            bound = false
            refresh()
        }
    }

    private fun hostIntent() = Intent(this, DeviceHostService::class.java)

    private fun refresh() {
        val running = host != null
        codeView.text = host?.currentCode() ?: "Not running"
        startButton.isEnabled = !running
        stopButton.isEnabled = running
        rotate.isEnabled = running
        status.text = if (running) {
            "Host active on this phone: http://127.0.0.1:8792\n" +
                "Pairing codes expire after two minutes. A persistent notification appears " +
                "where Android permits. The operating system can still stop this service."
        } else {
            "Host stopped. Tap Start to enable a temporary local connection, then " +
                "switch to Civweave Settings to pair."
        }
    }

    private fun bindRunningHost(flags: Int) {
        if (!bound && bindService(hostIntent(), connection, flags)) bound = true
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 40, 28, 28)
        }
        val title = TextView(this).apply {
            text = "Civweave Device Host"
            textSize = 24f
        }
        val details = TextView(this).apply {
            text = "This optional service reports native host capabilities to Civweave. " +
                "Updates require a pinned signing key and separate Android confirmation. " +
                "Start it, then enter the displayed code in Civweave Settings → Android Device Host."
            textSize = 16f
            setPadding(0, 14, 0, 14)
        }
        codeView = TextView(this).apply {
            textSize = 26f
            setTextIsSelectable(true)
            setPadding(0, 14, 0, 14)
        }
        startButton = Button(this).apply { text = "Start local host" }
        stopButton = Button(this).apply { text = "Stop local host" }
        rotate = Button(this).apply { text = "Generate a new pairing code" }
        checkUpdates = Button(this).apply {
            text = "Check for signed Host update"
            isEnabled = HostReleasePolicy.verificationKeyConfigured()
        }
        installUpdate = Button(this).apply {
            text = "Review and install verified update"
            isEnabled = false
        }
        status = TextView(this).apply {
            textSize = 14f
            setPadding(0, 16, 0, 16)
        }
        listOf(title, details, codeView, startButton, stopButton, rotate, checkUpdates, installUpdate, status).forEach {
            column.addView(it, LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
            ))
        }
        setContentView(ScrollView(this).apply { addView(column) })
        refresh()

        startButton.setOnClickListener {
            try {
                startForegroundService(hostIntent()) // Explicit action from visible Activity.
                bindRunningHost(Context.BIND_AUTO_CREATE)
                status.text = "Starting the user-enabled local host…"
            } catch (error: Exception) {
                status.text = "Android could not start the local host: " + error.javaClass.simpleName
            }
        }
        stopButton.setOnClickListener {
            if (bound) {
                unbindService(connection)
                bound = false
            }
            host = null
            stopService(hostIntent())
            refresh()
        }
        rotate.setOnClickListener {
            val next = host?.rotatePairingCode()
            if (next != null) {
                codeView.text = next
                status.text = "New code issued. All previous pairing sessions were revoked."
            }
        }
        checkUpdates.setOnClickListener {
            if (!HostReleasePolicy.verificationKeyConfigured()) {
                status.text = "No native release trust key has been provisioned. Updates disabled."
                return@setOnClickListener
            }
            stagedUpdate?.file?.delete()
            stagedUpdate = null
            installUpdate.isEnabled = false
            checkUpdates.isEnabled = false
            status.text = "Checking independently signed release and verifying the APK…"
            thread(name="civweave-host-update", isDaemon=true) {
                val result = runCatching { HostUpdateManager.prepare(this) }
                runOnUiThread {
                    if (isDestroyed) return@runOnUiThread
                    checkUpdates.isEnabled = HostReleasePolicy.verificationKeyConfigured()
                    result.onSuccess { staged ->
                        stagedUpdate = staged
                        installUpdate.isEnabled = true
                        status.text = "Verified update " + staged.release.versionName +
                            " is staged. Tap Review and install to request Android confirmation."
                    }.onFailure { error ->
                        status.text = "No trusted update is ready: " +
                            (error.message ?: error.javaClass.simpleName)
                    }
                }
            }
        }
        installUpdate.setOnClickListener {
            val staged = stagedUpdate
            if (staged == null) {
                status.text = "Check for a verified update first."
                return@setOnClickListener
            }
            if (android.os.Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1242)
                status.text = "Allow installation notifications, then tap Review and install again."
                return@setOnClickListener
            }
            try {
                status.text = HostUpdateManager.requestInstall(this, staged)
            } catch (error: Exception) {
                status.text = "Android installation not started: " +
                    (error.message ?: error.javaClass.simpleName)
            }
        }
        if (!HostReleasePolicy.verificationKeyConfigured()) {
            status.text = "Native updates disabled: release verification key not provisioned. " +
                "Start the host to pair with Civweave."
        }
        // Reconnect to an already running host, but do not launch one implicitly.
        bindRunningHost(0)
    }

    override fun onDestroy() {
        if (bound) unbindService(connection)
        bound = false
        host = null
        super.onDestroy()
    }
}
