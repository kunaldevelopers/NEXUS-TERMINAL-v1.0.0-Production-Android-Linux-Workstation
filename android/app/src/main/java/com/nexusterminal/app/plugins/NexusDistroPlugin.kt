package com.nexusterminal.app.plugins

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.nexusterminal.app.distro.DistroEnvironment
import com.nexusterminal.app.distro.DistroManager
import com.nexusterminal.app.engine.PtySessionManager
import java.io.File
import java.util.UUID
import kotlin.concurrent.thread

@CapacitorPlugin(name = "NexusDistro")
class NexusDistroPlugin : Plugin() {

    private fun envToJs(env: DistroEnvironment, computeSize: Boolean = true): JSObject {
        val sizeMb = if (computeSize) {
            DistroManager.calculateDirectorySizeBytes(File(env.rootfsPath)) / (1024.0 * 1024.0)
        } else {
            0.0
        }
        return JSObject().apply {
            put("envId", env.envId)
            put("distroId", env.distroId)
            put("variant", env.variant)
            put("name", env.name)
            put("version", env.version)
            put("arch", env.arch)
            put("pkgManager", env.pkgManager)
            put("defaultShell", env.defaultShell)
            put("rootfsPath", env.rootfsPath)
            put("sha256", env.sha256)
            put("sizeMb", sizeMb)
            put("runningCount", PtySessionManager.countRunningForEnv(env.envId))
            put("installedAt", env.installedAt)
        }
    }

    @PluginMethod
    fun getCatalog(call: PluginCall) {
        val nativeDir = context.applicationInfo.nativeLibraryDir
        val prootAvailable = File(nativeDir, "libproot.so").exists() &&
            File(nativeDir, "libproot_loader.so").exists()
        call.resolve(JSObject().apply {
            put("prootAvailable", prootAvailable)
        })
    }

    @PluginMethod
    fun listEnvironments(call: PluginCall) {
        thread(isDaemon = true, name = "nexus-list-envs") {
            try {
                val (list, defaultId) = DistroManager.listEnvironments(context)
                val arr = JSArray()
                for (env in list) {
                    arr.put(envToJs(env, computeSize = true))
                }
                call.resolve(JSObject().apply {
                    put("environments", arr)
                    put("defaultEnvId", defaultId ?: JSONObjectNullCompat.NULL)
                })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Failed to list environments", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun installDistro(call: PluginCall) {
        val envId = call.getString("envId")?.ifBlank { null }
            ?: "env-${UUID.randomUUID().toString().substring(0, 8)}"
        val distroId = call.getString("distroId")
        val variant = call.getString("variant") ?: "default"
        val name = call.getString("name")?.ifBlank { null } ?: distroId ?: envId

        if (distroId.isNullOrBlank()) {
            call.reject("distroId is required")
            return
        }

        thread(isDaemon = true, name = "nexus-install-$envId") {
            try {
                DistroManager.installDistro(
                    context = context,
                    envId = envId,
                    distroId = distroId,
                    variant = variant,
                    name = name
                ) { phase, percent, message ->
                    notifyListeners("distroProgress", JSObject().apply {
                        put("envId", envId)
                        put("name", name)
                        put("phase", phase)
                        put("percent", percent)
                        put("message", message)
                    })
                }
            } catch (_: Throwable) {
                // Progress listener has already emitted error/cancelled phase
            }
        }

        call.resolve(JSObject().apply {
            put("started", true)
            put("envId", envId)
        })
    }

    @PluginMethod
    fun cancelInstall(call: PluginCall) {
        val envId = call.getString("envId") ?: ""
        DistroManager.cancelInstall(envId)
        call.resolve(JSObject().apply { put("ok", true) })
    }

    @PluginMethod
    fun deleteEnvironment(call: PluginCall) {
        val envId = call.getString("envId") ?: ""
        thread(isDaemon = true, name = "nexus-del-$envId") {
            try {
                DistroManager.deleteEnvironment(context, envId)
                call.resolve(JSObject().apply { put("ok", true) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Failed to delete environment", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun renameEnvironment(call: PluginCall) {
        val envId = call.getString("envId") ?: ""
        val newName = call.getString("newName") ?: ""
        try {
            DistroManager.renameEnvironment(context, envId, newName)
            call.resolve(JSObject().apply { put("ok", true) })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Failed to rename environment", t as? Exception)
        }
    }

    @PluginMethod
    fun setDefaultEnvironment(call: PluginCall) {
        val envId = call.getString("envId") ?: ""
        try {
            DistroManager.setDefaultEnvironment(context, envId)
            call.resolve(JSObject().apply { put("ok", true) })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Failed to set default environment", t as? Exception)
        }
    }

    @PluginMethod
    fun stopEnvironment(call: PluginCall) {
        val envId = call.getString("envId") ?: ""
        PtySessionManager.stopEnvironmentSessions(envId)
        call.resolve(JSObject().apply { put("ok", true) })
    }

    @PluginMethod
    fun backupEnvironment(call: PluginCall) {
        val envId = call.getString("envId") ?: ""
        val outputPath = call.getString("outputPath")
        thread(isDaemon = true, name = "nexus-backup-$envId") {
            try {
                val outFile = DistroManager.backupEnvironment(context, envId, outputPath)
                call.resolve(JSObject().apply {
                    put("backupPath", outFile.absolutePath)
                    put("sizeMb", outFile.length() / (1024.0 * 1024.0))
                })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Backup failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun restoreEnvironment(call: PluginCall) {
        val envId = call.getString("envId")?.ifBlank { null }
            ?: "restored-${UUID.randomUUID().toString().substring(0, 8)}"
        val distroId = call.getString("distroId") ?: "debian"
        val name = call.getString("name")?.ifBlank { null } ?: "Restored $distroId"
        val archivePath = call.getString("archivePath")
        if (archivePath.isNullOrBlank()) {
            call.reject("archivePath is required")
            return
        }

        thread(isDaemon = true, name = "nexus-restore-$envId") {
            try {
                val env = DistroManager.restoreEnvironment(context, envId, distroId, name, archivePath)
                call.resolve(JSObject().apply {
                    put("envId", env.envId)
                    put("name", env.name)
                })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Restore failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun getEnvironmentDetails(call: PluginCall) {
        val envId = call.getString("envId") ?: ""
        thread(isDaemon = true, name = "nexus-env-detail") {
            val env = DistroManager.getEnvironment(context, envId)
            if (env == null) {
                call.reject("Environment '$envId' not found")
            } else {
                call.resolve(JSObject().apply {
                    put("env", envToJs(env, computeSize = true))
                })
            }
        }
    }

    private object JSONObjectNullCompat {
        val NULL: Any = org.json.JSONObject.NULL
    }
}

