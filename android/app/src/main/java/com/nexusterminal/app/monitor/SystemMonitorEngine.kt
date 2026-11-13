package com.nexusterminal.app.monitor

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.StatFs
import java.io.File
import java.net.Inet4Address
import java.net.NetworkInterface

object SystemMonitorEngine {

    private var prevIdle: Long = 0
    private var prevTotal: Long = 0

    fun getCpuUsagePercent(): Int? {
        return try {
            val line = File("/proc/stat").bufferedReader().use { it.readLine() } ?: return null
            val parts = line.trim().split(Regex("\\s+"))
            if (parts.size < 5) return null
            val nums = parts.drop(1).mapNotNull { it.toLongOrNull() }
            val idle = nums.getOrElse(3) { 0L } + nums.getOrElse(4) { 0L }
            val total = nums.sum()
            if (prevTotal == 0L) {
                prevTotal = total
                prevIdle = idle
                return null
            }
            val diffTotal = total - prevTotal
            val diffIdle = idle - prevIdle
            prevTotal = total
            prevIdle = idle
            if (diffTotal <= 0) 0 else (((diffTotal - diffIdle) * 100) / diffTotal).toInt().coerceIn(0, 100)
        } catch (_: Throwable) {
            null
        }
    }

    fun getRamUsageMb(context: Context): Pair<Long, Long> {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)
        val totalMb = mi.totalMem / (1024L * 1024L)
        val availMb = mi.availMem / (1024L * 1024L)
        return (totalMb - availMb).coerceAtLeast(0L) to totalMb
    }

    fun getStorageGb(context: Context): Triple<Double, Double, Double> {
        val stat = StatFs(context.filesDir.absolutePath)
        val total = stat.totalBytes / 1_073_741_824.0
        val free = stat.availableBytes / 1_073_741_824.0
        val used = (total - free).coerceAtLeast(0.0)
        return Triple(used, total, free)
    }

    data class BatteryInfo(val percent: Int?, val tempC: Double?, val voltageMv: Int?, val status: String)

    fun getBatteryInfo(context: Context): BatteryInfo {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            ?: return BatteryInfo(null, null, null, "Unknown")
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
        val pct = if (level >= 0 && scale > 0) (level * 100) / scale else null
        val tempTenths = intent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE)
        val tempC = if (tempTenths != Int.MIN_VALUE) tempTenths / 10.0 else null
        val voltage = intent.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1).takeIf { it > 0 }
        val statusCode = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val statusStr = when (statusCode) {
            BatteryManager.BATTERY_STATUS_CHARGING -> "Charging"
            BatteryManager.BATTERY_STATUS_FULL -> "Full"
            BatteryManager.BATTERY_STATUS_DISCHARGING -> "Discharging"
            else -> "Idle"
        }
        return BatteryInfo(pct, tempC, voltage, statusStr)
    }

    fun getNetworkSummary(context: Context): Pair<String, String> {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork)
        val transport = when {
            caps == null -> "Offline"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "Wi-Fi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "Cellular"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "Ethernet"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "VPN"
            else -> "Connected"
        }

        val ips = mutableListOf<String>()
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                if (!iface.isUp || iface.isLoopback) continue
                val addrs = iface.inetAddresses
                while (addrs.hasMoreElements()) {
                    val addr = addrs.nextElement()
                    if (addr is Inet4Address && !addr.isLoopbackAddress) {
                        ips.add("${iface.name}:${addr.hostAddress}")
                    }
                }
            }
        } catch (_: Throwable) {
        }
        return transport to (if (ips.isEmpty()) "127.0.0.1" else ips.joinToString(", "))
    }

    fun isDeviceRooted(): Boolean {
        val paths = listOf("/system/bin/su", "/system/xbin/su", "/sbin/su", "/su/bin/su")
        return paths.any { File(it).exists() }
    }

    fun getKernelVersion(): String {
        return try {
            File("/proc/version").readText().trim().take(120)
        } catch (_: Throwable) {
            System.getProperty("os.version") ?: "Linux"
        }
    }

    fun getCpuHardware(): String {
        return try {
            val lines = File("/proc/cpuinfo").readLines()
            val hw = lines.firstOrNull { it.startsWith("Hardware") || it.startsWith("model name") }
            hw?.substringAfter(':')?.trim() ?: Build.HARDWARE
        } catch (_: Throwable) {
            Build.HARDWARE
        }
    }
}

