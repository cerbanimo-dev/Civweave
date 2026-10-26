package cc.civweave.devicehost

import android.app.Activity
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * Optional companion host; the web application remains separately installed.
 * The first milestone provides only a paired, read-only device status interface.
 */
class MainActivity : Activity() {
    private var server: LoopbackHostServer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val context = this
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 40, 28, 28)
        }
        val title = TextView(this).apply {
            text = "Civweave Device Host"
            textSize = 24f
        }
        val details = TextView(this).apply {
            text = "This companion provides a local capability handshake for the Civweave PWA. " +
                "It does not install packages, run AI, or enable background Bluetooth yet. " +
                "Open Civweave Settings → Android Device Host to pair."
            textSize = 16f
            setPadding(0, 14, 0, 14)
        }
        val codeView = TextView(this).apply {
            textSize = 26f
            setTextIsSelectable(true)
            setPadding(0, 14, 0, 14)
        }
        val status = TextView(this).apply {
            textSize = 14f
            setPadding(0, 16, 0, 16)
        }
        val rotate = Button(this).apply { text = "Generate a new pairing code" }
        for (view in listOf(title, details, codeView, rotate, status)) {
            column.addView(view, LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
            ))
        }
        setContentView(ScrollView(this).apply { addView(column) })
        try {
            val host = LoopbackHostServer()
            host.start()
            server = host
            codeView.text = host.currentCode()
            status.text = "Host active on this phone only: http://127.0.0.1:8792\n" +
                "The pairing code expires after two minutes. The host may stop when Android " +
                "ends this activity; a background service is a separate milestone."
            rotate.setOnClickListener {
                codeView.text = host.rotatePairingCode()
                status.text = "New code issued; previous pairing credentials revoked."
            }
        } catch (error: Exception) {
            codeView.text = "Host unavailable"
            status.text = "Could not start local endpoint: " + error.javaClass.simpleName
            rotate.isEnabled = false
        }
    }

    override fun onDestroy() {
        server?.close()
        server = null
        super.onDestroy()
    }
}
