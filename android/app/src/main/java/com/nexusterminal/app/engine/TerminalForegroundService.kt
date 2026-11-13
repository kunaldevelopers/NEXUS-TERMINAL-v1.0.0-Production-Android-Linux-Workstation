package com.nexusterminal.app.engine

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.nexusterminal.app.MainActivity

class TerminalForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_ALL) {
            PtySessionManager.killAll()
            releaseWakeLock()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        val useWakeLock = intent?.getBooleanExtra(EXTRA_WAKELOCK, false) ?: false
        if (useWakeLock) acquireWakeLock() else releaseWakeLock()

        val count = PtySessionManager.listSessions().count { it.alive }
        startForeground(NOTIFICATION_ID, buildNotification(count))
        return START_STICKY
    }

    override fun onDestroy() {
        releaseWakeLock()
        super.onDestroy()
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NexusTerminal::PtyWakeLock").apply {
            setReferenceCounted(false)
            acquire(6 * 60 * 60 * 1000L) // capped 6h safety timeout
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (_: Exception) {
        }
        wakeLock = null
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                CHANNEL_ID,
                "NEXUS Terminal Active Sessions",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps active Linux PTY sessions alive within Android foreground limits"
            }
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(activeCount: Int): Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val stopIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, TerminalForegroundService::class.java).apply { action = ACTION_STOP_ALL },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("NEXUS TERMINAL Workstation")
            .setContentText("$activeCount active Linux PTY session(s) running")
            .setSmallIcon(com.nexusterminal.app.R.drawable.ic_terminal_notification)
            .setOngoing(true)
            .setContentIntent(openIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop All", stopIntent)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "nexus_terminal_sessions"
        private const val NOTIFICATION_ID = 4042
        const val ACTION_STOP_ALL = "com.nexusterminal.app.STOP_ALL_SESSIONS"
        const val EXTRA_WAKELOCK = "wakelock"

        fun startOrUpdate(context: Context, wakelock: Boolean) {
            val intent = Intent(context, TerminalForegroundService::class.java).apply {
                putExtra(EXTRA_WAKELOCK, wakelock)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, TerminalForegroundService::class.java))
        }
    }
}

