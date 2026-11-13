package com.nexusterminal.app.plugins

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.nexusterminal.app.files.FileEntryInfo
import com.nexusterminal.app.files.FileManagerEngine
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import kotlin.concurrent.thread

@CapacitorPlugin(name = "NexusFile")
class NexusFilePlugin : Plugin() {

    private fun entryToJs(e: FileEntryInfo): JSObject = JSObject().apply {
        put("name", e.name)
        put("path", e.path)
        put("isDirectory", e.isDirectory)
        put("isSymlink", e.isSymlink)
        put("size", e.size)
        put("lastModified", e.lastModified)
        put("permissions", e.permissions)
    }

    @PluginMethod
    fun getStorageRoots(call: PluginCall) {
        try {
            val arr = JSArray()
            for ((label, path) in FileManagerEngine.getStorageRoots(context)) {
                arr.put(JSObject().apply {
                    put("label", label)
                    put("path", path)
                })
            }
            call.resolve(JSObject().apply { put("roots", arr) })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Failed to read storage roots", t as? Exception)
        }
    }

    @PluginMethod
    fun listFiles(call: PluginCall) {
        val path = call.getString("path") ?: File(context.filesDir, "workspace").absolutePath
        val showHidden = call.getBoolean("showHidden") ?: true
        thread(isDaemon = true, name = "nexus-file-list") {
            try {
                val entries = FileManagerEngine.listFiles(path, showHidden)
                val arr = JSArray()
                entries.forEach { arr.put(entryToJs(it)) }
                call.resolve(JSObject().apply {
                    put("path", path)
                    put("entries", arr)
                })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Failed to list directory", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun readFile(call: PluginCall) {
        val path = call.getString("path") ?: ""
        thread(isDaemon = true, name = "nexus-file-read") {
            try {
                val f = File(path)
                if (!f.exists() || !f.isFile) {
                    call.reject("File not found: $path")
                    return@thread
                }
                if (f.length() > 4 * 1024 * 1024) {
                    call.reject("File exceeds 4 MB editor limit (${f.length() / 1024} KB)")
                    return@thread
                }
                val content = f.readText()
                call.resolve(JSObject().apply { put("content", content) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Failed to read file", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun writeFile(call: PluginCall) {
        val path = call.getString("path") ?: ""
        val content = call.getString("content") ?: ""
        thread(isDaemon = true, name = "nexus-file-write") {
            try {
                val f = File(path)
                f.parentFile?.mkdirs()
                f.writeText(content)
                call.resolve(JSObject().apply { put("ok", true) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Failed to write file", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun createDirectory(call: PluginCall) {
        val path = call.getString("path") ?: ""
        try {
            val f = File(path)
            if (!f.exists() && !f.mkdirs()) {
                call.reject("Could not create directory: $path")
                return
            }
            call.resolve(JSObject().apply { put("ok", true) })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Failed to create directory", t as? Exception)
        }
    }

    @PluginMethod
    fun deletePath(call: PluginCall) {
        val path = call.getString("path") ?: ""
        thread(isDaemon = true, name = "nexus-file-del") {
            try {
                val f = File(path)
                if (f.exists() && !f.deleteRecursively()) {
                    call.reject("Failed to delete $path")
                    return@thread
                }
                call.resolve(JSObject().apply { put("ok", true) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Failed to delete path", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun renamePath(call: PluginCall) {
        val path = call.getString("path") ?: ""
        val newName = call.getString("newName")?.trim() ?: ""
        if (newName.isBlank() || newName.contains('/')) {
            call.reject("Invalid new name")
            return
        }
        try {
            val src = File(path)
            val dest = File(src.parentFile, newName)
            if (!src.renameTo(dest)) {
                call.reject("Rename failed")
                return
            }
            call.resolve(JSObject().apply { put("path", dest.absolutePath) })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Rename failed", t as? Exception)
        }
    }

    @PluginMethod
    fun copyPath(call: PluginCall) {
        val sourcePath = call.getString("sourcePath") ?: ""
        val destDir = call.getString("destDir") ?: ""
        thread(isDaemon = true, name = "nexus-file-copy") {
            try {
                FileManagerEngine.copyPath(File(sourcePath), File(destDir))
                call.resolve(JSObject().apply { put("ok", true) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Copy failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun movePath(call: PluginCall) {
        val sourcePath = call.getString("sourcePath") ?: ""
        val destDir = call.getString("destDir") ?: ""
        thread(isDaemon = true, name = "nexus-file-move") {
            try {
                FileManagerEngine.movePath(File(sourcePath), File(destDir))
                call.resolve(JSObject().apply { put("ok", true) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Move failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun searchFiles(call: PluginCall) {
        val basePath = call.getString("basePath") ?: ""
        val query = call.getString("query") ?: ""
        thread(isDaemon = true, name = "nexus-file-search") {
            try {
                val results = FileManagerEngine.searchFiles(basePath, query)
                val arr = JSArray()
                results.forEach { arr.put(entryToJs(it)) }
                call.resolve(JSObject().apply { put("entries", arr) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Search failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun chmodPath(call: PluginCall) {
        val path = call.getString("path") ?: ""
        val octalMode = call.getString("octalMode") ?: "755"
        try {
            FileManagerEngine.chmod(path, octalMode)
            call.resolve(JSObject().apply { put("ok", true) })
        } catch (t: Throwable) {
            call.reject(t.message ?: "chmod failed", t as? Exception)
        }
    }

    @PluginMethod
    fun extractArchive(call: PluginCall) {
        val archivePath = call.getString("archivePath") ?: ""
        val destDir = call.getString("destDir") ?: ""
        thread(isDaemon = true, name = "nexus-file-extract") {
            try {
                FileManagerEngine.extractArchive(File(archivePath), File(destDir))
                call.resolve(JSObject().apply { put("ok", true) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Archive extraction failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun createArchive(call: PluginCall) {
        val sourceArr = call.getArray("sourcePaths") ?: JSArray()
        val outputPath = call.getString("outputPath") ?: ""
        val format = call.getString("format") ?: "zip"
        thread(isDaemon = true, name = "nexus-file-archive") {
            try {
                val sources = mutableListOf<File>()
                for (i in 0 until sourceArr.length()) {
                    sources.add(File(sourceArr.getString(i)))
                }
                val out = File(outputPath)
                FileManagerEngine.createArchive(sources, out, format)
                call.resolve(JSObject().apply { put("outputPath", out.absolutePath) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Archive creation failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun pickSafFile(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
        }
        startActivityForResult(call, intent, "onPickSafResult")
    }

    @ActivityCallback
    fun onPickSafResult(call: PluginCall, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            call.resolve(JSObject())
            return
        }
        val uri: Uri? = result.data?.data
        if (uri == null) {
            call.resolve(JSObject())
            return
        }
        var displayName = uri.lastPathSegment ?: "imported_file"
        try {
            context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) {
                    val idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (idx >= 0) displayName = c.getString(idx) ?: displayName
                }
            }
        } catch (_: Throwable) {
        }
        call.resolve(JSObject().apply {
            put("uri", uri.toString())
            put("name", displayName)
        })
    }

    @PluginMethod
    fun importSafFile(call: PluginCall) {
        val uriStr = call.getString("uri") ?: ""
        val destDir = call.getString("destDir") ?: "workspace"
        val fileName = call.getString("fileName")?.ifBlank { null } ?: "imported.bin"
        thread(isDaemon = true, name = "nexus-saf-import") {
            try {
                val folder = if (destDir.startsWith("/")) File(destDir) else File(context.filesDir, destDir)
                folder.mkdirs()
                val safeName = File(fileName).name
                val outFile = File(folder, safeName)
                val uri = Uri.parse(uriStr)
                context.contentResolver.openInputStream(uri)?.use { input ->
                    FileOutputStream(outFile).use { output ->
                        input.copyTo(output)
                    }
                } ?: throw IllegalStateException("Cannot open content URI for reading")
                call.resolve(JSObject().apply { put("path", outFile.absolutePath) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "SAF import failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun exportToSaf(call: PluginCall) {
        val sourcePath = call.getString("sourcePath") ?: ""
        if (sourcePath.isBlank() || !File(sourcePath).exists()) {
            call.reject("Source file not found")
            return
        }
        val mime = call.getString("mimeType") ?: "application/octet-stream"
        val suggested = call.getString("suggestedName")?.ifBlank { null } ?: File(sourcePath).name
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = mime
            putExtra(Intent.EXTRA_TITLE, suggested)
        }
        startActivityForResult(call, intent, "onExportSafResult")
    }

    @ActivityCallback
    fun onExportSafResult(call: PluginCall, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            call.resolve(JSObject().apply { put("ok", false) })
            return
        }
        val uri = result.data?.data ?: run {
            call.resolve(JSObject().apply { put("ok", false) })
            return
        }
        val sourcePath = call.getString("sourcePath") ?: ""
        thread(isDaemon = true, name = "nexus-saf-export") {
            try {
                context.contentResolver.openOutputStream(uri)?.use { out ->
                    FileInputStream(File(sourcePath)).use { input ->
                        input.copyTo(out)
                    }
                } ?: throw IllegalStateException("Cannot open destination URI for writing")
                call.resolve(JSObject().apply {
                    put("ok", true)
                    put("uri", uri.toString())
                })
            } catch (t: Throwable) {
                call.reject(t.message ?: "SAF export failed", t as? Exception)
            }
        }
    }
}

