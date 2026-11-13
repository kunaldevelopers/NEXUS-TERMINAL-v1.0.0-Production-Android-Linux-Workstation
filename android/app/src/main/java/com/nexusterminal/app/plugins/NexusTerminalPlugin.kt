package com.nexusterminal.app.plugins

import android.util.Base64
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.nexusterminal.app.distro.DistroManager
import com.nexusterminal.app.engine.PtyEventListener
import com.nexusterminal.app.engine.PtySessionManager
import com.nexusterminal.app.engine.TerminalForegroundService
import java.io.File
import java.nio.charset.StandardCharsets
import kotlin.concurrent.thread

@CapacitorPlugin(name = "NexusTerminal")
class NexusTerminalPlugin : Plugin(), PtyEventListener {

    override fun load() {
        super.load()
        PtySessionManager.addListener(this)
    }

    override fun handleOnDestroy() {
        PtySessionManager.removeListener(this)
        super.handleOnDestroy()
    }

    override fun onOutput(sessionId: String, dataBase64: String) {
        val data = JSObject().apply {
            put("sessionId", sessionId)
            put("dataBase64", dataBase64)
        }
        notifyListeners("terminalOutput", data)
    }

    override fun onExit(sessionId: String, exitCode: Int) {
        val data = JSObject().apply {
            put("sessionId", sessionId)
            put("exitCode", exitCode)
        }
        notifyListeners("terminalExit", data)
    }

    @PluginMethod
    fun createSession(call: PluginCall) {
        try {
            val envId = call.getString("envId") ?: "android-shell"
            val shell = call.getString("shell") ?: "/bin/bash"
            val cwd = call.getString("cwd") ?: "/root"
            val cols = call.getInt("cols") ?: 80
            val rows = call.getInt("rows") ?: 24
            val customPrompt = call.getBoolean("customPrompt") ?: true
            val promptShowGit = call.getBoolean("promptShowGit") ?: true
            val promptShowExitCode = call.getBoolean("promptShowExitCode") ?: true
            val initialCommand = call.getString("initialCommand") ?: ""
            val title = call.getString("title") ?: ""

            val env = if (envId.isBlank() || envId == "android-shell") {
                null
            } else {
                DistroManager.getEnvironment(context, envId)
                    ?: run {
                        call.reject("Linux environment '$envId' not found")
                        return
                    }
            }

            val info = PtySessionManager.createSession(
                context = context,
                env = env,
                envId = env?.envId ?: "android-shell",
                shell = shell,
                cwd = cwd,
                cols = cols,
                rows = rows,
                customPrompt = customPrompt,
                promptShowGit = promptShowGit,
                promptShowExitCode = promptShowExitCode,
                initialCommand = initialCommand,
                title = title
            )

            call.resolve(JSObject().apply {
                put("sessionId", info.sessionId)
                put("envId", info.envId)
                put("title", info.title)
                put("pid", info.pid)
            })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Failed to create PTY session", t as? Exception)
        }
    }

    @PluginMethod
    fun writeInput(call: PluginCall) {
        val sessionId = call.getString("sessionId")
        val dataBase64 = call.getString("dataBase64")
        if (sessionId.isNullOrBlank() || dataBase64 == null) {
            call.reject("Missing sessionId or dataBase64")
            return
        }
        val bytes = Base64.decode(dataBase64, Base64.DEFAULT)
        val written = PtySessionManager.writeInput(sessionId, bytes)
        call.resolve(JSObject().apply { put("bytesWritten", written) })
    }

    @PluginMethod
    fun writeText(call: PluginCall) {
        val sessionId = call.getString("sessionId")
        val text = call.getString("text")
        if (sessionId.isNullOrBlank() || text == null) {
            call.reject("Missing sessionId or text")
            return
        }
        val bytes = text.toByteArray(StandardCharsets.UTF_8)
        val written = PtySessionManager.writeInput(sessionId, bytes)
        call.resolve(JSObject().apply { put("bytesWritten", written) })
    }

    @PluginMethod
    fun resize(call: PluginCall) {
        val sessionId = call.getString("sessionId") ?: ""
        val cols = call.getInt("cols") ?: 80
        val rows = call.getInt("rows") ?: 24
        val ok = PtySessionManager.resize(sessionId, cols, rows)
        call.resolve(JSObject().apply { put("ok", ok) })
    }

    @PluginMethod
    fun sendSignal(call: PluginCall) {
        val sessionId = call.getString("sessionId") ?: ""
        val raw = call.data.opt("signal")
        val sig = when (raw) {
            is Number -> raw.toInt()
            is String -> when (raw.uppercase()) {
                "SIGINT", "INT" -> 2
                "SIGQUIT", "QUIT" -> 3
                "SIGKILL", "KILL" -> 9
                "SIGTERM", "TERM" -> 15
                "SIGSTOP", "STOP" -> 19
                "SIGTSTP", "TSTP" -> 20
                "SIGHUP", "HUP" -> 1
                else -> raw.toIntOrNull() ?: 2
            }
            else -> 2
        }
        val ok = PtySessionManager.sendSignal(sessionId, sig)
        call.resolve(JSObject().apply { put("ok", ok) })
    }

    @PluginMethod
    fun killSession(call: PluginCall) {
        val sessionId = call.getString("sessionId") ?: ""
        PtySessionManager.killSession(sessionId)
        call.resolve(JSObject().apply { put("ok", true) })
    }

    @PluginMethod
    fun listSessions(call: PluginCall) {
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
                put("createdAt", s.createdAt)
            })
        }
        call.resolve(JSObject().apply { put("sessions", arr) })
    }

    @PluginMethod
    fun getSessionBuffer(call: PluginCall) {
        val sessionId = call.getString("sessionId") ?: ""
        val b64 = PtySessionManager.getBufferBase64(sessionId)
        call.resolve(JSObject().apply { put("bufferBase64", b64) })
    }

    @PluginMethod
    fun runCommandCapture(call: PluginCall) {
        val envId = call.getString("envId") ?: ""
        val command = call.getString("command")
        val cwd = call.getString("cwd") ?: "/root"
        if (command.isNullOrBlank()) {
            call.reject("Command is required")
            return
        }

        thread(isDaemon = true, name = "nexus-cmd-capture") {
            try {
                if (envId.isBlank() || envId == "android-shell") {
                    val workspace = File(context.filesDir, "workspace").apply { mkdirs() }
                    val proc = ProcessBuilder("/system/bin/sh", "-c", command)
                        .directory(workspace)
                        .start()
                    val out = StringBuilder()
                    val err = StringBuilder()
                    val t1 = thread(isDaemon = true) {
                        proc.inputStream.bufferedReader().useLines { lines ->
                            lines.forEach { line ->
                                out.append(line).append('\n')
                                notifyListeners("commandOutput", JSObject().apply { put("line", line) })
                            }
                        }
                    }
                    val t2 = thread(isDaemon = true) {
                        proc.errorStream.bufferedReader().useLines { lines ->
                            lines.forEach { line ->
                                err.append(line).append('\n')
                                notifyListeners("commandOutput", JSObject().apply { put("line", line) })
                            }
                        }
                    }
                    val code = proc.waitFor()
                    t1.join(2000)
                    t2.join(2000)
                    call.resolve(JSObject().apply {
                        put("exitCode", code)
                        put("stdout", out.toString())
                        put("stderr", err.toString())
                    })
                    return@thread
                }

                val env = DistroManager.getEnvironment(context, envId)
                if (env == null) {
                    call.reject("Linux environment '$envId' not found")
                    return@thread
                }
                val result = PtySessionManager.runCommandCapture(context, env, command, cwd) { line ->
                    notifyListeners("commandOutput", JSObject().apply { put("line", line) })
                }
                call.resolve(JSObject().apply {
                    put("exitCode", result.exitCode)
                    put("stdout", result.stdout)
                    put("stderr", result.stderr)
                })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Command execution failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun setForegroundService(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        val wakelock = call.getBoolean("wakelock") ?: false
        try {
            if (enabled) {
                TerminalForegroundService.startOrUpdate(context, wakelock)
            } else {
                TerminalForegroundService.stop(context)
            }
            call.resolve(JSObject().apply { put("running", enabled) })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Foreground service update failed", t as? Exception)
        }
    }
}

