package com.nexusterminal.app.plugins

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.nexusterminal.app.engine.PtySessionManager
import com.nexusterminal.app.engine.TerminalForegroundService
import com.nexusterminal.app.monitor.SystemMonitorEngine
import com.nexusterminal.app.ssh.SshVault
import org.json.JSONObject
import java.io.File
import kotlin.concurrent.thread

@CapacitorPlugin(name = "NexusSystem")
class NexusSystemPlugin : Plugin() {

    @PluginMethod
    fun getSystemMetrics(call: PluginCall) {
        try {
            val cpuPct = SystemMonitorEngine.getCpuUsagePercent()
            val (ramUsed, ramTotal) = SystemMonitorEngine.getRamUsageMb(context)
            val (stUsed, stTotal, stFree) = SystemMonitorEngine.getStorageGb(context)
            val bat = SystemMonitorEngine.getBatteryInfo(context)
            val (netType, ips) = SystemMonitorEngine.getNetworkSummary(context)

            call.resolve(JSObject().apply {
                put("nativeAvailable", true)
                put("cpuUsagePercent", cpuPct ?: JSONObject.NULL)
                put("cpuCores", Runtime.getRuntime().availableProcessors())
                put("cpuHardware", SystemMonitorEngine.getCpuHardware())
                put("ramUsedMb", ramUsed)
                put("ramTotalMb", ramTotal)
                put("storageUsedGb", stUsed)
                put("storageTotalGb", stTotal)
                put("storageFreeGb", stFree)
                put("batteryPercent", bat.percent ?: JSONObject.NULL)
                put("batteryTempC", bat.tempC ?: JSONObject.NULL)
                put("batteryVoltageMv", bat.voltageMv ?: JSONObject.NULL)
                put("batteryStatus", bat.status)
                put("networkType", netType)
                put("ipAddresses", ips)
                put("deviceModel", "${Build.MANUFACTURER} ${Build.MODEL}")
                put("androidVersion", Build.VERSION.RELEASE ?: "")
                put("sdkInt", Build.VERSION.SDK_INT)
                put("abi", Build.SUPPORTED_ABIS.firstOrNull() ?: "arm64-v8a")
                put("supportedAbis", Build.SUPPORTED_ABIS.joinToString(", "))
                put("kernelVersion", SystemMonitorEngine.getKernelVersion())
                put("isRooted", SystemMonitorEngine.isDeviceRooted())
            })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Failed to read system metrics", t as? Exception)
        }
    }

    @PluginMethod
    fun getRunningProcesses(call: PluginCall) {
        val arr = JSArray()
        for (s in PtySessionManager.listSessions()) {
            arr.put(JSObject().apply {
                put("sessionId", s.sessionId)
                put("envId", s.envId)
                put("title", s.title)
                put("shell", s.shell)
                put("cwd", s.cwd)
                put("pid", s.pid)
                put("alive", s.alive)
                if (s.exitCode != null) put("exitCode", s.exitCode)
            })
        }
        call.resolve(JSObject().apply { put("processes", arr) })
    }

    @PluginMethod
    fun getStoragePermissions(call: PluginCall) {
        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
        }
        call.resolve(JSObject().apply {
            put("granted", granted)
            put("sdkInt", Build.VERSION.SDK_INT)
        })
    }

    @PluginMethod
    fun requestStoragePermission(call: PluginCall) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val intent = try {
                    Intent(
                        Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                        Uri.parse("package:${context.packageName}")
                    )
                } catch (_: Throwable) {
                    Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                }
                activity.startActivity(intent)
            } else {
                ActivityCompat.requestPermissions(
                    activity,
                    arrayOf(
                        Manifest.permission.READ_EXTERNAL_STORAGE,
                        Manifest.permission.WRITE_EXTERNAL_STORAGE
                    ),
                    2048
                )
            }
            call.resolve(JSObject().apply { put("launched", true) })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Unable to request storage permission", t as? Exception)
        }
    }

    @PluginMethod
    fun checkBatteryOptimization(call: PluginCall) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val ignoring = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pm.isIgnoringBatteryOptimizations(context.packageName)
        } else {
            true
        }
        call.resolve(JSObject().apply { put("ignoring", ignoring) })
    }

    @PluginMethod
    fun requestIgnoreBatteryOptimization(call: PluginCall) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(
                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:${context.packageName}")
                )
                activity.startActivity(intent)
            }
            call.resolve(JSObject().apply { put("launched", true) })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Unable to launch battery optimization prompt", t as? Exception)
        }
    }

    @PluginMethod
    fun saveSecureSecret(call: PluginCall) {
        val key = call.getString("key") ?: ""
        val value = call.getString("value") ?: ""
        if (key.isBlank()) {
            call.reject("Secret key is required")
            return
        }
        try {
            SshVault.saveSecret(context, key, value)
            call.resolve(JSObject().apply { put("ok", true) })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Failed to save encrypted secret", t as? Exception)
        }
    }

    @PluginMethod
    fun getSecureSecret(call: PluginCall) {
        val key = call.getString("key") ?: ""
        try {
            val value = if (key.isBlank()) "" else SshVault.getSecret(context, key)
            call.resolve(JSObject().apply { put("value", value) })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Failed to read encrypted secret", t as? Exception)
        }
    }

    @PluginMethod
    fun wipeAllAppData(call: PluginCall) {
        thread(isDaemon = true, name = "nexus-wipe-all") {
            try {
                PtySessionManager.killAll()
                TerminalForegroundService.stop(context)
                SshVault.clearAll(context)
                listOf("distros", "workspace", "backups", "sftp_staging").forEach { dir ->
                    File(context.filesDir, dir).deleteRecursively()
                }
                context.cacheDir.listFiles()?.forEach { it.deleteRecursively() }
                call.resolve(JSObject().apply { put("ok", true) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Wipe failed", t as? Exception)
            }
        }
    }
}

