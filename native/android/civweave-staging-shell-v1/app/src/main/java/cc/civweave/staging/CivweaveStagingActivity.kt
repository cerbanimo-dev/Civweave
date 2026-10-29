package cc.civweave.staging

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import cc.civweave.starling.StarlingNativeBridge

/** Small installable staging shell. Loads the real Civweave staging UI.
 * The native bridge is installed before the first navigation, and only trusted
 * Civweave HTTPS origins receive it. All other links open externally. */
class CivweaveStagingActivity : Activity() {
    private lateinit var browser: WebView
    private val staging = "https://civweave-staging.pages.dev/"
    private val allowedSites = setOf("civweave-staging.pages.dev", "civweave.cc")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(24, 35, 30)
        window.navigationBarColor = Color.rgb(24, 35, 30)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(19, 27, 23))
            setOnApplyWindowInsetsListener { view, insets ->
                @Suppress("DEPRECATION")
                view.setPadding(0, insets.systemWindowInsetTop, 0, insets.systemWindowInsetBottom)
                insets
            }
        }
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(16, 0, 8, 0)
            setBackgroundColor(Color.rgb(29, 50, 39))
        }
        bar.addView(TextView(this).apply {
            text = "Civweave • Staging"
            textSize = 15f
            setTextColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(0, 52.dp, 1f)
            gravity = Gravity.CENTER_VERTICAL
        })
        val refresh = Button(this).apply {
            text = "Reload"
            setOnClickListener { browser.reload() }
        }
        bar.addView(refresh)
        root.addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 56.dp))

        browser = WebView(this)
        browser.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        WebView.setWebContentsDebuggingEnabled(true) // Staging/debug APK only.
        browser.webChromeClient = WebChromeClient()
        browser.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false
                val uri = request.url
                if (uri.scheme == "https" && allowedSites.contains(uri.host?.lowercase())) return false
                if (uri.scheme == "https" || uri.scheme == "http") {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
                    } catch (_: Exception) {}
                }
                return true
            }
        }
        StarlingNativeBridge(applicationContext).install(browser)
        root.addView(browser, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
        if (savedInstanceState == null) browser.loadUrl(staging)
        else browser.restoreState(savedInstanceState)
    }

    private val Int.dp: Int
        get() = (this * resources.displayMetrics.density + 0.5f).toInt()

    override fun onSaveInstanceState(outState: Bundle) {
        browser.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Legacy back navigation for a minimal standalone test wrapper")
    override fun onBackPressed() {
        if (browser.canGoBack()) browser.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        browser.destroy()
        super.onDestroy()
    }
}
