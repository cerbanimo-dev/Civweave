package cc.civweave.devicehost

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

/**
 * Handles installer results. Never treats committing a session as success.
 * Android's pending user action is surfaced as a notification the user taps.
 */
class HostInstallResultReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_RESULT = "cc.civweave.devicehost.INSTALL_RESULT"
        private const val CHANNEL_ID = "civweave_device_host_install"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_RESULT) return
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Civweave Host installation", NotificationManager.IMPORTANCE_HIGH)
        )
        val prefs = context.getSharedPreferences("device-host-install",Context.MODE_PRIVATE)
        val next = when (status) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> "awaiting-user-approval"
            PackageInstaller.STATUS_SUCCESS -> "installed"
            else -> "failed"
        }
        prefs.edit().putString("lastState", next).apply()
        val launch = if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            @Suppress("DEPRECATION")
            val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
            confirm?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        } else {
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        if (launch == null) {
            prefs.edit().putString("lastState","missing-android-approval-intent").apply()
            return
        }
        val pending = PendingIntent.getActivity(
            context, status, launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val title = when (status) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> "Confirm Civweave Host update"
            PackageInstaller.STATUS_SUCCESS -> "Civweave Host update installed"
            else -> "Civweave Host update was not installed"
        }
        val description = when (status) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> "Tap to review and approve the Android installation"
            PackageInstaller.STATUS_SUCCESS -> "Android reported a completed installation"
            else -> "Android rejected or interrupted the installation"
        }
        val notice = Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(title)
            .setContentText(description)
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build()
        manager.notify(1242,notice)
    }
}
