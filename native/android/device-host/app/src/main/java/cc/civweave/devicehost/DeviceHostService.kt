package cc.civweave.devicehost

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder

/**
 * User-started, user-stoppable local companion endpoint.
 *
 * The service is deliberately NOT_STARTED_ON_BOOT and NOT_STICKY. The system can
 * still stop it under memory/battery pressure. It is not an always-on guarantee.
 *
 * specialUse describes the user-visible local PWA companion interface. Reassess
 * this service type with Android policy and real devices before distribution.
 */
class DeviceHostService : Service() {
    companion object {
        const val ACTION_STOP = "cc.civweave.devicehost.STOP"
        private const val CHANNEL_ID = "civweave_device_host"
        private const val NOTIFICATION_ID = 1241
    }

    internal inner class LocalBinder : Binder() {
        fun host(): LoopbackHostServer? = server
    }

    private val binder = LocalBinder()
    private var server: LoopbackHostServer? = null

    override fun onCreate() {
        super.onCreate()
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Civweave local host", NotificationManager.IMPORTANCE_LOW)
        )
        val open = Intent(this, MainActivity::class.java)
        val pending = PendingIntent.getActivity(
            this, 0, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val notification = Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("Civweave Device Host is running")
            .setContentText("Local device bridge active · tap to manage or stop")
            .setContentIntent(pending)
            .setOngoing(true)
            .build()
        // Android 14+ validates the manifest-declared foreground service type.
        startForeground(NOTIFICATION_ID, notification)
        try {
            val host = LoopbackHostServer()
            host.start()
            server = host
        } catch (error: Exception) {
            stopSelf()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) stopSelf()
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onDestroy() {
        server?.close()
        server = null
        super.onDestroy()
    }
}
