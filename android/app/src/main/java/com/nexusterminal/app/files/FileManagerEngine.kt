package com.nexusterminal.app.files

import android.content.Context
import android.os.Environment
import android.system.Os
import com.nexusterminal.app.distro.DistroManager
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry
import org.apache.commons.compress.archivers.zip.ZipArchiveInputStream
import org.apache.commons.compress.archivers.zip.ZipArchiveOutputStream
import org.apache.commons.compress.compressors.gzip.GzipCompressorInputStream
import org.apache.commons.compress.compressors.gzip.GzipCompressorOutputStream
import org.apache.commons.compress.compressors.xz.XZCompressorInputStream
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.nio.file.Files

data class FileEntryInfo(
    val name: String,
    val path: String,
    val isDirectory: Boolean,
    val isSymlink: Boolean,
    val size: Long,
    val lastModified: Long,
    val permissions: String
)

object FileManagerEngine {

    fun getStorageRoots(context: Context): List<Pair<String, String>> {
        val roots = mutableListOf<Pair<String, String>>()
        val workspace = File(context.filesDir, "workspace").apply { mkdirs() }
        roots.add("Nexus Workspace" to workspace.absolutePath)

        val sdcard = Environment.getExternalStorageDirectory()
        if (sdcard != null && sdcard.exists()) {
            roots.add("Android Storage" to sdcard.absolutePath)
        }

        val (envs, _) = DistroManager.listEnvironments(context)
        for (env in envs) {
            val rootHome = File(env.rootfsPath, "root")
            if (rootHome.exists()) {
                roots.add("${env.name} (/root)" to rootHome.absolutePath)
            }
            roots.add("${env.name} (/)" to env.rootfsPath)
        }
        return roots
    }

    fun listFiles(path: String, showHidden: Boolean): List<FileEntryInfo> {
        val dir = File(path)
        if (!dir.exists() || !dir.isDirectory) {
            throw IllegalArgumentException("Not a readable directory: $path")
        }
        val list = dir.listFiles() ?: throw SecurityException("Permission denied reading $path")
        return list
            .filter { showHidden || !it.name.startsWith(".") }
            .map { toEntry(it) }
            .sortedWith(compareByDescending<FileEntryInfo> { it.isDirectory }.thenBy { it.name.lowercase() })
    }

    fun searchFiles(basePath: String, query: String, maxResults: Int = 150): List<FileEntryInfo> {
        val q = query.lowercase()
        val results = mutableListOf<FileEntryInfo>()
        val stack = ArrayDeque<File>()
        stack.add(File(basePath))
        while (stack.isNotEmpty() && results.size < maxResults) {
            val curr = stack.removeLast()
            val files = curr.listFiles() ?: continue
            for (f in files) {
                if (f.name.lowercase().contains(q)) {
                    results.add(toEntry(f))
                    if (results.size >= maxResults) break
                }
                if (f.isDirectory && !Files.isSymbolicLink(f.toPath())) {
                    stack.add(f)
                }
            }
        }
        return results
    }

    fun chmod(path: String, octalMode: String) {
        val mode = octalMode.toInt(8)
        Os.chmod(path, mode)
    }

    fun copyPath(src: File, destDir: File) {
        val target = File(destDir, src.name)
        if (src.isDirectory) {
            src.copyRecursively(target, overwrite = true)
        } else {
            src.copyTo(target, overwrite = true)
        }
    }

    fun movePath(src: File, destDir: File) {
        val target = File(destDir, src.name)
        if (!src.renameTo(target)) {
            copyPath(src, destDir)
            src.deleteRecursively()
        }
    }

    fun extractArchive(archiveFile: File, destDir: File) {
        destDir.mkdirs()
        val name = archiveFile.name.lowercase()
        if (name.endsWith(".zip")) {
            ZipArchiveInputStream(BufferedInputStream(FileInputStream(archiveFile))).use { zis ->
                var entry: ZipArchiveEntry? = zis.nextEntry
                while (entry != null) {
                    val out = File(destDir, entry.name)
                    if (!out.canonicalPath.startsWith(destDir.canonicalPath)) {
                        entry = zis.nextEntry
                        continue
                    }
                    if (entry.isDirectory) {
                        out.mkdirs()
                    } else {
                        out.parentFile?.mkdirs()
                        FileOutputStream(out).use { zis.copyTo(it) }
                    }
                    entry = zis.nextEntry
                }
            }
            return
        }

        val raw: InputStream = BufferedInputStream(FileInputStream(archiveFile))
        val decomp: InputStream = when {
            name.endsWith(".xz") || name.endsWith(".txz") -> XZCompressorInputStream(raw)
            name.endsWith(".gz") || name.endsWith(".tgz") -> GzipCompressorInputStream(raw)
            else -> raw
        }
        TarArchiveInputStream(decomp).use { tis ->
            var entry: TarArchiveEntry? = tis.nextEntry
            while (entry != null) {
                val out = File(destDir, entry.name.trimStart('/'))
                if (!out.canonicalPath.startsWith(destDir.canonicalPath)) {
                    entry = tis.nextEntry
                    continue
                }
                if (entry.isDirectory) {
                    out.mkdirs()
                } else if (entry.isSymbolicLink) {
                    out.parentFile?.mkdirs()
                    try { Os.symlink(entry.linkName, out.absolutePath) } catch (_: Throwable) {}
                } else {
                    out.parentFile?.mkdirs()
                    FileOutputStream(out).use { tis.copyTo(it) }
                    try { Os.chmod(out.absolutePath, entry.mode and 0x1FF) } catch (_: Throwable) {}
                }
                entry = tis.nextEntry
            }
        }
    }

    fun createArchive(sources: List<File>, outputFile: File, format: String) {
        outputFile.parentFile?.mkdirs()
        if (format == "zip") {
            ZipArchiveOutputStream(BufferedOutputStream(FileOutputStream(outputFile))).use { zos ->
                for (src in sources) {
                    addZipEntry(src.parentFile ?: src, src, zos)
                }
            }
        } else {
            GzipCompressorOutputStream(BufferedOutputStream(FileOutputStream(outputFile))).use { gz ->
                TarArchiveOutputStream(gz).use { tos ->
                    tos.setLongFileMode(TarArchiveOutputStream.LONGFILE_POSIX)
                    for (src in sources) {
                        addTarEntry(src.parentFile ?: src, src, tos)
                    }
                }
            }
        }
    }

    private fun addZipEntry(base: File, file: File, zos: ZipArchiveOutputStream) {
        val rel = base.toPath().relativize(file.toPath()).toString().replace('\\', '/')
        if (file.isDirectory) {
            zos.putArchiveEntry(ZipArchiveEntry(file, "$rel/"))
            zos.closeArchiveEntry()
            file.listFiles()?.forEach { addZipEntry(base, it, zos) }
        } else {
            zos.putArchiveEntry(ZipArchiveEntry(file, rel))
            FileInputStream(file).use { it.copyTo(zos) }
            zos.closeArchiveEntry()
        }
    }

    private fun addTarEntry(base: File, file: File, tos: TarArchiveOutputStream) {
        val rel = base.toPath().relativize(file.toPath()).toString().replace('\\', '/')
        if (file.isDirectory) {
            tos.putArchiveEntry(TarArchiveEntry(file, "$rel/"))
            tos.closeArchiveEntry()
            file.listFiles()?.forEach { addTarEntry(base, it, tos) }
        } else {
            tos.putArchiveEntry(TarArchiveEntry(file, rel))
            FileInputStream(file).use { it.copyTo(tos) }
            tos.closeArchiveEntry()
        }
    }

    private fun toEntry(f: File): FileEntryInfo {
        val isLink = Files.isSymbolicLink(f.toPath())
        var perms = "---------"
        try {
            val st = Os.lstat(f.absolutePath)
            perms = formatMode(st.st_mode)
        } catch (_: Throwable) {
        }
        return FileEntryInfo(
            name = f.name,
            path = f.absolutePath,
            isDirectory = f.isDirectory,
            isSymlink = isLink,
            size = if (f.isDirectory) 0L else f.length(),
            lastModified = f.lastModified(),
            permissions = perms
        )
    }

    private fun formatMode(mode: Int): String {
        val chars = CharArray(9)
        val bits = intArrayOf(256, 128, 64, 32, 16, 8, 4, 2, 1)
        val sym = charArrayOf('r', 'w', 'x', 'r', 'w', 'x', 'r', 'w', 'x')
        for (i in 0 until 9) {
            chars[i] = if ((mode and bits[i]) != 0) sym[i] else '-'
        }
        return String(chars)
    }
}

