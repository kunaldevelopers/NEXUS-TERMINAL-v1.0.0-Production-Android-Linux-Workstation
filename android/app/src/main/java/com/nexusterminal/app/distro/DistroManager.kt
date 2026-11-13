package com.nexusterminal.app.distro

import android.content.Context
import android.system.Os
import com.nexusterminal.app.engine.PtySessionManager
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream
import org.apache.commons.compress.compressors.gzip.GzipCompressorInputStream
import org.apache.commons.compress.compressors.gzip.GzipCompressorOutputStream
import org.apache.commons.compress.compressors.xz.XZCompressorInputStream
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.file.Files
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

data class DistroEnvironment(
    val envId: String,
    val distroId: String,
    val variant: String,
    val name: String,
    val version: String,
    val arch: String,
    val pkgManager: String,
    val defaultShell: String,
    val rootfsPath: String,
    val sha256: String,
    val installedAt: Long
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("envId", envId)
        put("distroId", distroId)
        put("variant", variant)
        put("name", name)
        put("version", version)
        put("arch", arch)
        put("pkgManager", pkgManager)
        put("defaultShell", defaultShell)
        put("rootfsPath", rootfsPath)
        put("sha256", sha256)
        put("installedAt", installedAt)
    }

    companion object {
        fun fromJson(obj: JSONObject): DistroEnvironment = DistroEnvironment(
            envId = obj.getString("envId"),
            distroId = obj.getString("distroId"),
            variant = obj.optString("variant", "default"),
            name = obj.getString("name"),
            version = obj.optString("version", "latest"),
            arch = obj.optString("arch", "aarch64"),
            pkgManager = obj.optString("pkgManager", "apt"),
            defaultShell = obj.optString("defaultShell", "/bin/bash"),
            rootfsPath = obj.getString("rootfsPath"),
            sha256 = obj.optString("sha256", ""),
            installedAt = obj.optLong("installedAt", System.currentTimeMillis())
        )
    }
}

object DistroManager {

    private val cancelFlags = ConcurrentHashMap<String, AtomicBoolean>()

    private fun distrosRoot(context: Context): File =
        File(context.filesDir, "distros").apply { mkdirs() }

    private fun registryFile(context: Context): File =
        File(distrosRoot(context), "environments.json")

    @Synchronized
    private fun loadState(context: Context): Pair<MutableList<DistroEnvironment>, String?> {
        val f = registryFile(context)
        if (!f.exists()) return mutableListOf<DistroEnvironment>() to null
        val obj = JSONObject(f.readText())
        val arr = obj.optJSONArray("environments") ?: JSONArray()
        val list = mutableListOf<DistroEnvironment>()
        for (i in 0 until arr.length()) {
            list.add(DistroEnvironment.fromJson(arr.getJSONObject(i)))
        }
        val def = obj.optString("defaultEnvId", "").ifBlank { null }
        return list to def
    }

    @Synchronized
    private fun saveState(context: Context, list: List<DistroEnvironment>, defaultEnvId: String?) {
        val obj = JSONObject()
        val arr = JSONArray()
        list.forEach { arr.put(it.toJson()) }
        obj.put("environments", arr)
        obj.put("defaultEnvId", defaultEnvId ?: "")
        registryFile(context).writeText(obj.toString(2))
    }

    fun listEnvironments(context: Context): Pair<List<DistroEnvironment>, String?> =
        loadState(context)

    fun getEnvironment(context: Context, envId: String): DistroEnvironment? =
        loadState(context).first.firstOrNull { it.envId == envId }

    fun setDefaultEnvironment(context: Context, envId: String) {
        val (list, _) = loadState(context)
        if (list.none { it.envId == envId }) {
            throw IllegalArgumentException("Environment $envId not found")
        }
        saveState(context, list, envId)
    }

    fun renameEnvironment(context: Context, envId: String, newName: String) {
        val (list, def) = loadState(context)
        val idx = list.indexOfFirst { it.envId == envId }
        if (idx < 0) throw IllegalArgumentException("Environment $envId not found")
        list[idx] = list[idx].copy(name = newName.trim().ifBlank { list[idx].name })
        saveState(context, list, def)
    }

    fun deleteEnvironment(context: Context, envId: String) {
        PtySessionManager.stopEnvironmentSessions(envId)
        val (list, def) = loadState(context)
        val env = list.firstOrNull { it.envId == envId }
        list.removeAll { it.envId == envId }
        val newDef = if (def == envId) list.firstOrNull()?.envId else def
        saveState(context, list, newDef)
        if (env != null) {
            File(env.rootfsPath).deleteRecursively()
        } else {
            File(distrosRoot(context), envId).deleteRecursively()
        }
    }

    fun cancelInstall(envId: String) {
        cancelFlags[envId]?.set(true)
    }

    fun installDistro(
        context: Context,
        envId: String,
        distroId: String,
        variant: String,
        name: String,
        onProgress: (phase: String, percent: Int, message: String) -> Unit
    ): DistroEnvironment {
        val cancelled = AtomicBoolean(false)
        cancelFlags[envId] = cancelled

        val envDir = File(distrosRoot(context), envId).apply { mkdirs() }
        val rootfsDir = File(envDir, "rootfs").apply { mkdirs() }
        var archiveFile: File? = null

        try {
            onProgress("resolving", 2, "Resolving official ARM64 rootfs manifest & checksums...")
            val spec = DistroCatalog.resolve(distroId, variant)
            if (cancelled.get()) throw InterruptedException("Cancelled")

            archiveFile = File(context.cacheDir, "$envId.${spec.archiveType}")
            onProgress("downloading", 5, "Downloading ${spec.url}...")
            val actualSha = downloadWithSha256(spec.url, archiveFile, cancelled) { pct, dlMb, totalMb ->
                val scaled = 5 + (pct * 55 / 100)
                val info = if (totalMb > 0) {
                    String.format("%.1f / %.1f MB", dlMb, totalMb)
                } else {
                    String.format("%.1f MB", dlMb)
                }
                onProgress("downloading", scaled, "Downloading $info ($pct%)")
            }

            if (cancelled.get()) throw InterruptedException("Cancelled")
            onProgress("verifying", 62, "Verifying SHA-256 checksum...")
            if (!spec.expectedSha256.isNullOrBlank() &&
                !actualSha.equals(spec.expectedSha256, ignoreCase = true)
            ) {
                throw SecurityException(
                    "SHA-256 mismatch! Expected ${spec.expectedSha256}, got $actualSha"
                )
            }

            onProgress("extracting", 66, "Extracting ARM64 rootfs preserving symlinks & permissions...")
            extractTarArchive(archiveFile, rootfsDir, spec.archiveType, cancelled) { count ->
                if (count % 400 == 0) {
                    val pct = minOf(94, 66 + count / 350)
                    onProgress("extracting", pct, "Extracted $count filesystem entries...")
                }
            }

            onProgress("configuring", 96, "Configuring DNS, APT/Pacman PRoot compatibility & prompt...")
            flattenSingleSubdirIfNeeded(rootfsDir)
            configureRootfsForProot(rootfsDir, spec.distroId)

            val env = DistroEnvironment(
                envId = envId,
                distroId = spec.distroId,
                variant = spec.variant,
                name = name,
                version = spec.version,
                arch = "aarch64",
                pkgManager = spec.pkgManager,
                defaultShell = spec.defaultShell,
                rootfsPath = rootfsDir.absolutePath,
                sha256 = actualSha,
                installedAt = System.currentTimeMillis()
            )

            val (list, def) = loadState(context)
            list.add(env)
            saveState(context, list, def ?: env.envId)
            onProgress("completed", 100, "${env.name} installed & verified!")
            return env
        } catch (t: Throwable) {
            envDir.deleteRecursively()
            if (cancelled.get() || t is InterruptedException) {
                onProgress("cancelled", 0, "Installation cancelled")
            } else {
                onProgress("error", 0, t.message ?: "Installation failed")
            }
            throw t
        } finally {
            archiveFile?.delete()
            cancelFlags.remove(envId)
        }
    }

    fun backupEnvironment(context: Context, envId: String, outputPath: String?): File {
        val env = getEnvironment(context, envId)
            ?: throw IllegalArgumentException("Environment $envId not found")
        val backupsDir = File(context.filesDir, "backups").apply { mkdirs() }
        val outFile = if (!outputPath.isNullOrBlank()) {
            File(outputPath).also { it.parentFile?.mkdirs() }
        } else {
            File(backupsDir, "${env.distroId}-${env.envId}-backup.tar.gz")
        }
        val rootfs = File(env.rootfsPath)
        GzipCompressorOutputStream(BufferedOutputStream(FileOutputStream(outFile))).use { gz ->
            TarArchiveOutputStream(gz).use { tos ->
                tos.setLongFileMode(TarArchiveOutputStream.LONGFILE_POSIX)
                tos.setBigNumberMode(TarArchiveOutputStream.BIGNUMBER_POSIX)
                addDirectoryToTar(rootfs, rootfs, tos)
            }
        }
        return outFile
    }

    fun restoreEnvironment(
        context: Context,
        envId: String,
        distroId: String,
        name: String,
        archivePath: String
    ): DistroEnvironment {
        val src = File(archivePath)
        if (!src.exists()) throw IllegalArgumentException("Backup file not found: $archivePath")
        val envDir = File(distrosRoot(context), envId).apply { mkdirs() }
        val rootfsDir = File(envDir, "rootfs").apply { mkdirs() }
        val type = when {
            archivePath.endsWith(".xz", true) || archivePath.endsWith(".txz", true) -> "tar.xz"
            archivePath.endsWith(".gz", true) || archivePath.endsWith(".tgz", true) -> "tar.gz"
            else -> "tar"
        }
        val sha = computeFileSha256(src)
        extractTarArchive(src, rootfsDir, type, AtomicBoolean(false)) {}
        flattenSingleSubdirIfNeeded(rootfsDir)
        configureRootfsForProot(rootfsDir, distroId)

        val env = DistroEnvironment(
            envId = envId,
            distroId = distroId,
            variant = "restored",
            name = name,
            version = "Restored Backup",
            arch = "aarch64",
            pkgManager = DistroCatalog.pkgManagerForDistro(distroId),
            defaultShell = DistroCatalog.defaultShellForDistro(distroId),
            rootfsPath = rootfsDir.absolutePath,
            sha256 = sha,
            installedAt = System.currentTimeMillis()
        )
        val (list, def) = loadState(context)
        list.add(env)
        saveState(context, list, def ?: env.envId)
        return env
    }

    fun calculateDirectorySizeBytes(dir: File): Long {
        if (!dir.exists()) return 0L
        var total = 0L
        val stack = ArrayDeque<File>()
        stack.add(dir)
        while (stack.isNotEmpty()) {
            val curr = stack.removeLast()
            val files = curr.listFiles() ?: continue
            for (f in files) {
                if (Files.isSymbolicLink(f.toPath())) {
                    total += 64L
                } else if (f.isDirectory) {
                    stack.add(f)
                } else {
                    total += f.length()
                }
            }
        }
        return total
    }

    private fun downloadWithSha256(
        urlStr: String,
        dest: File,
        cancelled: AtomicBoolean,
        onTick: (percent: Int, dlMb: Double, totalMb: Double) -> Unit
    ): String {
        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            connectTimeout = 20000
            readTimeout = 30000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "NexusTerminal/1.0 (Android; arm64)")
        }
        try {
            val code = conn.responseCode
            if (code !in 200..299) throw IllegalStateException("Download HTTP $code")
            val totalBytes = conn.contentLengthLong
            val digest = MessageDigest.getInstance("SHA-256")
            var downloaded = 0L
            var lastEmit = 0L
            val buf = ByteArray(65536)

            conn.inputStream.use { input ->
                FileOutputStream(dest).use { out ->
                    while (true) {
                        if (cancelled.get()) throw InterruptedException("Cancelled")
                        val n = input.read(buf)
                        if (n <= 0) break
                        out.write(buf, 0, n)
                        digest.update(buf, 0, n)
                        downloaded += n
                        val now = System.currentTimeMillis()
                        if (now - lastEmit > 250) {
                            lastEmit = now
                            val pct = if (totalBytes > 0) ((downloaded * 100) / totalBytes).toInt() else 50
                            onTick(pct, downloaded / 1048576.0, totalBytes / 1048576.0)
                        }
                    }
                }
            }
            return digest.digest().joinToString("") { "%02x".format(it) }
        } finally {
            conn.disconnect()
        }
    }

    private fun computeFileSha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val buf = ByteArray(65536)
        FileInputStream(file).use { fis ->
            while (true) {
                val n = fis.read(buf)
                if (n <= 0) break
                digest.update(buf, 0, n)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun extractTarArchive(
        archive: File,
        rootfs: File,
        archiveType: String,
        cancelled: AtomicBoolean,
        onCount: (Int) -> Unit
    ) {
        val rootCanonical = rootfs.canonicalPath
        val rawIn: InputStream = BufferedInputStream(FileInputStream(archive), 65536)
        val decompressed: InputStream = when (archiveType) {
            "tar.xz" -> XZCompressorInputStream(rawIn)
            "tar.gz" -> GzipCompressorInputStream(rawIn)
            else -> rawIn
        }

        val deferredModes = mutableListOf<Pair<String, Int>>()
        var entriesCount = 0

        TarArchiveInputStream(decompressed).use { tar ->
            var entry: TarArchiveEntry? = tar.nextEntry
            val buf = ByteArray(65536)
            while (entry != null) {
                if (cancelled.get()) throw InterruptedException("Cancelled")
                val rel = entry.name.trimStart('/').removePrefix("./")
                if (rel.isBlank() || rel == ".") {
                    entry = tar.nextEntry
                    continue
                }
                val outFile = File(rootfs, rel)
                // Guard against path traversal outside rootfs (without resolving final symlink target)
                val parentNorm = outFile.parentFile?.toPath()?.normalize()
                if (parentNorm != null && !parentNorm.startsWith(rootfs.toPath().normalize())) {
                    entry = tar.nextEntry
                    continue
                }

                when {
                    entry.isCharacterDevice || entry.isBlockDevice || entry.isFIFO -> {
                        // Skip kernel device nodes (PRoot bind-mounts Android /dev)
                    }
                    entry.isDirectory -> {
                        outFile.mkdirs()
                        deferredModes.add(outFile.absolutePath to (entry.mode and 0x1FF))
                    }
                    entry.isSymbolicLink -> {
                        outFile.parentFile?.mkdirs()
                        if (outFile.exists() || Files.isSymbolicLink(outFile.toPath())) {
                            outFile.delete()
                        }
                        try {
                            Os.symlink(entry.linkName, outFile.absolutePath)
                        } catch (_: Throwable) {
                        }
                    }
                    entry.isLink -> {
                        outFile.parentFile?.mkdirs()
                        val targetRel = entry.linkName.trimStart('/').removePrefix("./")
                        val targetFile = File(rootfs, targetRel)
                        if (outFile.exists() || Files.isSymbolicLink(outFile.toPath())) {
                            outFile.delete()
                        }
                        try {
                            Os.link(targetFile.absolutePath, outFile.absolutePath)
                        } catch (_: Throwable) {
                            if (targetFile.exists()) {
                                targetFile.copyTo(outFile, overwrite = true)
                                try {
                                    Os.chmod(outFile.absolutePath, entry.mode and 0x1FF)
                                } catch (_: Throwable) {
                                }
                            }
                        }
                    }
                    else -> {
                        outFile.parentFile?.mkdirs()
                        if (Files.isSymbolicLink(outFile.toPath()) || outFile.exists()) {
                            outFile.delete()
                        }
                        FileOutputStream(outFile).use { fos ->
                            while (true) {
                                val n = tar.read(buf)
                                if (n <= 0) break
                                fos.write(buf, 0, n)
                            }
                        }
                        try {
                            Os.chmod(outFile.absolutePath, entry.mode and 0x1FF)
                        } catch (_: Throwable) {
                        }
                    }
                }
                entriesCount++
                onCount(entriesCount)
                entry = tar.nextEntry
            }
        }

        for ((path, mode) in deferredModes.asReversed()) {
            try {
                Os.chmod(path, if (mode == 0) 493 else mode)
            } catch (_: Throwable) {
            }
        }
    }

    private fun flattenSingleSubdirIfNeeded(rootfs: File) {
        if (File(rootfs, "etc").exists() || File(rootfs, "usr").exists()) return
        val children = rootfs.listFiles()?.filter { it.isDirectory } ?: return
        if (children.size == 1) {
            val inner = children[0]
            if (File(inner, "etc").exists() || File(inner, "bin").exists() || File(inner, "usr").exists()) {
                val tmpMove = File(rootfs.parentFile, "${rootfs.name}_flatten_tmp")
                inner.renameTo(tmpMove)
                rootfs.deleteRecursively()
                tmpMove.renameTo(rootfs)
            }
        }
    }

    private fun configureRootfsForProot(rootfs: File, distroId: String) {
        val etc = File(rootfs, "etc").apply { mkdirs() }
        File(rootfs, "root").mkdirs()
        File(rootfs, "tmp").apply {
            mkdirs()
            try { Os.chmod(absolutePath, 511) } catch (_: Throwable) {}
        }
        File(rootfs, "dev/shm").mkdirs()

        // DNS & hosts inside PRoot
        File(etc, "resolv.conf").apply {
            if (Files.isSymbolicLink(toPath())) delete()
            writeText("nameserver 1.1.1.1\nnameserver 8.8.8.8\nnameserver 9.9.9.9\n")
        }
        File(etc, "hosts").apply {
            if (!exists()) {
                writeText("127.0.0.1 localhost\n::1 localhost\n")
            }
        }

        // Disable APT privilege dropping inside fake-root PRoot
        if (distroId in listOf("debian", "ubuntu", "kali", "parrot")) {
            val aptConfD = File(etc, "apt/apt.conf.d").apply { mkdirs() }
            File(aptConfD, "01nexus-proot").writeText(
                "APT::Sandbox::User \"root\";\nAcquire::Retries \"3\";\n"
            )
        }

        // Disable Pacman sandbox & CheckSpace inside PRoot
        if (distroId == "archlinux") {
            val pacmanConf = File(etc, "pacman.conf")
            if (pacmanConf.exists()) {
                var txt = pacmanConf.readText()
                txt = txt.replace("\nCheckSpace", "\n#CheckSpace")
                txt = txt.replace("#DisableSandbox", "DisableSandbox")
                if (!txt.contains("DisableSandbox")) {
                    txt = txt.replace("[options]", "[options]\nDisableSandbox")
                }
                pacmanConf.writeText(txt)
            }
        }

        // Custom interactive prompt with Git branch + Exit code indicator
        val promptScript = """
            # NEXUS TERMINAL Prompt Configuration
            __nexus_prompt() {
              local rc=$?
              if [ "${'$'}NEXUS_CUSTOM_PROMPT" != "1" ]; then return; fi
              local rc_tag=""
              if [ "${'$'}NEXUS_PROMPT_EXIT" = "1" ] && [ "${'$'}rc" -ne 0 ]; then
                rc_tag=" \[\e[1;31m\][exit:${'$'}rc]\[\e[0m\]"
              fi
              local git_tag=""
              if [ "${'$'}NEXUS_PROMPT_GIT" = "1" ] && command -v git >/dev/null 2>&1; then
                local br
                br=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)
                if [ -n "${'$'}br" ]; then
                  git_tag=" \[\e[1;35m\](${'$'}br)\[\e[0m\]"
                fi
              fi
              PS1="\[\e[1;36m\]┌─[\[\e[1;32m\]${'$'}{NEXUS_DISTRO:-linux}\[\e[1;36m\]:\[\e[1;34m\]\w\[\e[1;36m\]]${'$'}git_tag${'$'}rc_tag\n\[\e[1;36m\]└─❯\[\e[0m\] "
            }
            if [ -n "${'$'}BASH_VERSION" ]; then
              PROMPT_COMMAND="__nexus_prompt"
            fi
        """.trimIndent() + "\n"

        val profileD = File(etc, "profile.d").apply { mkdirs() }
        File(profileD, "nexus-prompt.sh").writeText(promptScript)

        val bashrc = File(rootfs, "root/.bashrc")
        val existing = if (bashrc.exists()) bashrc.readText() else ""
        if (!existing.contains("nexus-prompt.sh")) {
            bashrc.writeText(existing + "\n[ -f /etc/profile.d/nexus-prompt.sh ] && . /etc/profile.d/nexus-prompt.sh\n")
        }
    }

    private fun addDirectoryToTar(root: File, current: File, tos: TarArchiveOutputStream) {
        val files = current.listFiles() ?: return
        for (f in files) {
            val rel = root.toPath().relativize(f.toPath()).toString().replace('\\', '/')
            if (rel.isEmpty()) continue
            if (Files.isSymbolicLink(f.toPath())) {
                val entry = TarArchiveEntry(rel, TarArchiveEntry.LF_SYMLINK)
                entry.linkName = Files.readSymbolicLink(f.toPath()).toString()
                tos.putArchiveEntry(entry)
                tos.closeArchiveEntry()
            } else if (f.isDirectory) {
                val entry = TarArchiveEntry(f, "$rel/")
                tos.putArchiveEntry(entry)
                tos.closeArchiveEntry()
                addDirectoryToTar(root, f, tos)
            } else {
                val entry = TarArchiveEntry(f, rel)
                try {
                    val mode = Os.stat(f.absolutePath).st_mode and 0x1FF
                    entry.mode = mode
                } catch (_: Throwable) {
                }
                tos.putArchiveEntry(entry)
                FileInputStream(f).use { it.copyTo(tos) }
                tos.closeArchiveEntry()
            }
        }
    }
}

