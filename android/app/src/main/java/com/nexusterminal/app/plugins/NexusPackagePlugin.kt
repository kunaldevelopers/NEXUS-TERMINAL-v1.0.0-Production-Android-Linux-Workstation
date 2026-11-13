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
import kotlin.concurrent.thread

@CapacitorPlugin(name = "NexusPackage")
class NexusPackagePlugin : Plugin() {

    private val validTokenRegex = Regex("^[a-zA-Z0-9.+_:/@=-]+$")
    private val apkVerRegex = Regex("^(.+?)-([0-9][^-]*-r[0-9]+)$")

    private fun emitLog(line: String) {
        notifyListeners("packageLog", JSObject().apply { put("line", line) })
    }

    private fun shellQuote(arg: String): String =
        "'" + arg.replace("'", "'\"'\"'") + "'"

    private fun parsePackageTokens(raw: String): List<String> {
        val tokens = raw.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
        if (tokens.isEmpty()) throw IllegalArgumentException("Package name is required")
        for (t in tokens) {
            if (!validTokenRegex.matches(t)) {
                throw IllegalArgumentException("Invalid characters in package name: $t")
            }
        }
        return tokens
    }

    private fun requireEnv(call: PluginCall): DistroEnvironment? {
        val envId = call.getString("envId") ?: ""
        val env = DistroManager.getEnvironment(context, envId)
        if (env == null) {
            call.reject("Linux environment '$envId' not found")
        }
        return env
    }

    @PluginMethod
    fun searchPackages(call: PluginCall) {
        val env = requireEnv(call) ?: return
        val query = call.getString("query")?.trim() ?: ""
        if (query.isBlank()) {
            call.reject("Search query is required")
            return
        }

        thread(isDaemon = true, name = "nexus-pkg-search") {
            try {
                val q = shellQuote(query)
                val cmd = when (env.pkgManager) {
                    "apk" -> "if [ -z \"\$(ls -A /var/cache/apk 2>/dev/null)\" ]; then apk update >/dev/null 2>&1; fi; apk search -v -- $q 2>&1 | head -n 80"
                    "pacman" -> "if [ ! -d /var/lib/pacman/sync ] || [ -z \"\$(ls -A /var/lib/pacman/sync 2>/dev/null)\" ]; then pacman -Sy --noconfirm >/dev/null 2>&1; fi; pacman -Ss -- $q 2>&1 | head -n 160"
                    else -> "if [ ! -d /var/lib/apt/lists ] || [ -z \"\$(ls -A /var/lib/apt/lists 2>/dev/null)\" ]; then DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null 2>&1; fi; apt-cache search -- $q 2>&1 | head -n 80"
                }

                val res = PtySessionManager.runCommandCapture(context, env, cmd, "/root") { line ->
                    emitLog(line)
                }

                val arr = JSArray()
                val lines = res.stdout.lines()
                when (env.pkgManager) {
                    "pacman" -> {
                        var i = 0
                        while (i < lines.size) {
                            val header = lines[i].trim()
                            if (header.contains('/') && !lines[i].startsWith("    ")) {
                                val afterSlash = header.substringAfter('/')
                                val parts = afterSlash.split(Regex("\\s+"), limit = 3)
                                val name = parts.getOrNull(0) ?: ""
                                val ver = parts.getOrNull(1) ?: ""
                                val desc = lines.getOrNull(i + 1)?.trim() ?: ""
                                if (name.isNotBlank()) {
                                    arr.put(JSObject().apply {
                                        put("name", name)
                                        put("version", ver)
                                        put("description", desc)
                                    })
                                }
                                i += 2
                            } else {
                                i += 1
                            }
                        }
                    }
                    "apk" -> {
                        for (line in lines) {
                            val trimmed = line.trim()
                            if (trimmed.isBlank() || trimmed.startsWith("WARNING:") || trimmed.startsWith("fetch ")) continue
                            val idx = trimmed.indexOf(" - ")
                            val left = if (idx > 0) trimmed.substring(0, idx).trim() else trimmed
                            val desc = if (idx > 0) trimmed.substring(idx + 3).trim() else ""
                            val m = apkVerRegex.find(left)
                            val name = m?.groupValues?.get(1) ?: left
                            val ver = m?.groupValues?.get(2) ?: ""
                            if (name.isNotBlank() && validTokenRegex.matches(name)) {
                                arr.put(JSObject().apply {
                                    put("name", name)
                                    put("version", ver)
                                    put("description", desc)
                                })
                            }
                        }
                    }
                    else -> {
                        for (line in lines) {
                            val idx = line.indexOf(" - ")
                            if (idx > 0) {
                                val name = line.substring(0, idx).trim()
                                val desc = line.substring(idx + 3).trim()
                                if (name.isNotBlank()) {
                                    arr.put(JSObject().apply {
                                        put("name", name)
                                        put("version", "")
                                        put("description", desc)
                                    })
                                }
                            }
                        }
                    }
                }

                call.resolve(JSObject().apply {
                    put("packages", arr)
                    put("rawLog", (res.stdout + res.stderr).trim())
                })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Package search failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun listInstalled(call: PluginCall) {
        val env = requireEnv(call) ?: return
        thread(isDaemon = true, name = "nexus-pkg-installed") {
            try {
                val cmd = when (env.pkgManager) {
                    "apk" -> "apk info -v 2>/dev/null | sort | head -n 500"
                    "pacman" -> "pacman -Q 2>/dev/null | head -n 500"
                    else -> "dpkg-query -W -f='\${Package}\\t\${Version}\\n' 2>/dev/null | sort | head -n 500"
                }
                val res = PtySessionManager.runCommandCapture(context, env, cmd, "/root")
                val arr = JSArray()
                for (line in res.stdout.lines()) {
                    val trimmed = line.trim()
                    if (trimmed.isBlank()) continue
                    when (env.pkgManager) {
                        "apk" -> {
                            val m = apkVerRegex.find(trimmed)
                            arr.put(JSObject().apply {
                                put("name", m?.groupValues?.get(1) ?: trimmed)
                                put("version", m?.groupValues?.get(2) ?: "")
                            })
                        }
                        "pacman" -> {
                            val parts = trimmed.split(Regex("\\s+"), limit = 2)
                            arr.put(JSObject().apply {
                                put("name", parts[0])
                                put("version", parts.getOrNull(1) ?: "")
                            })
                        }
                        else -> {
                            val parts = trimmed.split('\t', limit = 2)
                            arr.put(JSObject().apply {
                                put("name", parts[0])
                                put("version", parts.getOrNull(1) ?: "")
                            })
                        }
                    }
                }
                call.resolve(JSObject().apply { put("packages", arr) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Failed to list installed packages", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun getPackageInfo(call: PluginCall) {
        val env = requireEnv(call) ?: return
        val pkgName = call.getString("packageName") ?: ""
        thread(isDaemon = true, name = "nexus-pkg-info") {
            try {
                val token = parsePackageTokens(pkgName).first()
                val q = shellQuote(token)
                val cmd = when (env.pkgManager) {
                    "apk" -> "apk info -a -- $q 2>&1"
                    "pacman" -> "(pacman -Si -- $q 2>/dev/null || pacman -Qi -- $q) 2>&1"
                    else -> "apt-cache show -- $q 2>&1; echo ''; echo '--- DEPENDENCIES ---'; apt-cache depends -- $q 2>&1"
                }
                val res = PtySessionManager.runCommandCapture(context, env, cmd, "/root")
                val combined = (res.stdout + "\n" + res.stderr).trim()
                call.resolve(JSObject().apply {
                    put("info", combined)
                    put("output", combined)
                })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Failed to inspect package", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun installPackage(call: PluginCall) {
        val env = requireEnv(call) ?: return
        val pkgName = call.getString("packageName") ?: ""
        thread(isDaemon = true, name = "nexus-pkg-install") {
            try {
                val tokens = parsePackageTokens(pkgName)
                val args = tokens.joinToString(" ") { shellQuote(it) }
                val cmd = when (env.pkgManager) {
                    "apk" -> "apk add --no-cache $args || (apk update && apk add $args)"
                    "pacman" -> "pacman -S --noconfirm $args || pacman -Sy --noconfirm $args"
                    else -> "DEBIAN_FRONTEND=noninteractive apt-get install -y $args || (DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y $args)"
                }
                val res = PtySessionManager.runCommandCapture(context, env, cmd, "/root") { line ->
                    emitLog(line)
                }
                call.resolve(JSObject().apply {
                    put("exitCode", res.exitCode)
                    put("output", (res.stdout + res.stderr).trim())
                })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Package installation failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun removePackage(call: PluginCall) {
        val env = requireEnv(call) ?: return
        val pkgName = call.getString("packageName") ?: ""
        thread(isDaemon = true, name = "nexus-pkg-remove") {
            try {
                val tokens = parsePackageTokens(pkgName)
                val args = tokens.joinToString(" ") { shellQuote(it) }
                val cmd = when (env.pkgManager) {
                    "apk" -> "apk del $args"
                    "pacman" -> "pacman -R --noconfirm $args"
                    else -> "DEBIAN_FRONTEND=noninteractive apt-get remove -y $args"
                }
                val res = PtySessionManager.runCommandCapture(context, env, cmd, "/root") { line ->
                    emitLog(line)
                }
                call.resolve(JSObject().apply {
                    put("exitCode", res.exitCode)
                    put("output", (res.stdout + res.stderr).trim())
                })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Package removal failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun updateSystem(call: PluginCall) {
        val env = requireEnv(call) ?: return
        val upgrade = call.getBoolean("upgrade") ?: false
        thread(isDaemon = true, name = "nexus-pkg-update") {
            try {
                val cmd = when (env.pkgManager) {
                    "apk" -> if (upgrade) "apk update && apk upgrade" else "apk update"
                    "pacman" -> if (upgrade) "pacman -Syu --noconfirm" else "pacman -Sy --noconfirm"
                    else -> if (upgrade) {
                        "DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y"
                    } else {
                        "DEBIAN_FRONTEND=noninteractive apt-get update"
                    }
                }
                val res = PtySessionManager.runCommandCapture(context, env, cmd, "/root") { line ->
                    emitLog(line)
                }
                call.resolve(JSObject().apply {
                    put("exitCode", res.exitCode)
                    put("output", (res.stdout + res.stderr).trim())
                })
            } catch (t: Throwable) {
                call.reject(t.message ?: "System update failed", t as? Exception)
            }
        }
    }

    private fun resolveRepoFile(env: DistroEnvironment, requestedRelPath: String?): File {
        val rootfs = File(env.rootfsPath).canonicalFile
        val defaultRel = when (env.pkgManager) {
            "apk" -> "etc/apk/repositories"
            "pacman" -> "etc/pacman.d/mirrorlist"
            else -> {
                val deb822Ubuntu = File(rootfs, "etc/apt/sources.list.d/ubuntu.sources")
                val deb822Debian = File(rootfs, "etc/apt/sources.list.d/debian.sources")
                val classic = File(rootfs, "etc/apt/sources.list")
                when {
                    classic.exists() && classic.readText().lines().any { it.trim().startsWith("deb") } -> "etc/apt/sources.list"
                    deb822Ubuntu.exists() -> "etc/apt/sources.list.d/ubuntu.sources"
                    deb822Debian.exists() -> "etc/apt/sources.list.d/debian.sources"
                    else -> "etc/apt/sources.list"
                }
            }
        }
        val rel = requestedRelPath?.trimStart('/')?.ifBlank { null } ?: defaultRel
        val target = File(rootfs, rel).canonicalFile
        if (!target.path.startsWith(rootfs.path + File.separator)) {
            throw SecurityException("Invalid repository path")
        }
        return target
    }

    @PluginMethod
    fun getRepositories(call: PluginCall) {
        val env = requireEnv(call) ?: return
        try {
            val rootfs = File(env.rootfsPath).canonicalFile
            val target = resolveRepoFile(env, null)
            val relPath = "/" + rootfs.toPath().relativize(target.toPath()).toString().replace('\\', '/')
            val content = if (target.exists()) target.readText() else ""
            call.resolve(JSObject().apply {
                put("filePath", relPath)
                put("content", content)
            })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Failed to read repository config", t as? Exception)
        }
    }

    @PluginMethod
    fun saveRepositories(call: PluginCall) {
        val env = requireEnv(call) ?: return
        val filePath = call.getString("filePath")
        val content = call.getString("content") ?: ""
        try {
            val target = resolveRepoFile(env, filePath)
            target.parentFile?.mkdirs()
            target.writeText(content)
            call.resolve(JSObject().apply { put("ok", true) })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Failed to save repository config", t as? Exception)
        }
    }
}

