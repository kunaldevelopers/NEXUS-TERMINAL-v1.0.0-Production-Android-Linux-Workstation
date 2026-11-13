package com.nexusterminal.app.engine

import android.content.Context
import android.util.Base64
import com.nexusterminal.app.distro.DistroEnvironment
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread

data class PtySessionInfo(
    val sessionId: String,
    val envId: String,
    val title: String,
    val shell: String,
    val cwd: String,
    val pid: Int,
    val masterFd: Int,
    var alive: Boolean = true,
    var exitCode: Int? = null,
    val createdAt: Long = System.currentTimeMillis()
) {
    private val ringBuffer = ByteArrayOutputStream()
    private val maxRingBytes = 256 * 1024

    @Synchronized
    fun appendOutput(bytes: ByteArray, length: Int) {
        if (ringBuffer.size() + length > maxRingBytes) {
            val all = ringBuffer.toByteArray()
            val keep = maxRingBytes / 2
            ringBuffer.reset()
            if (all.size > keep) {
                ringBuffer.write(all, all.size - keep, keep)
            } else {
                ringBuffer.write(all)
            }
        }
        ringBuffer.write(bytes, 0, length)
    }

    @Synchronized
    fun snapshotBase64(): String {
        val bytes = ringBuffer.toByteArray()
        return if (bytes.isEmpty()) "" else Base64.encodeToString(bytes, Base64.NO_WRAP)
    }
}

interface PtyEventListener {
    fun onOutput(sessionId: String, dataBase64: String)
    fun onExit(sessionId: String, exitCode: Int)
}

object PtySessionManager {
    private val sessions = ConcurrentHashMap<String, PtySessionInfo>()
    private val listeners = CopyOnWriteArrayList<PtyEventListener>()

    fun addListener(listener: PtyEventListener) {
        listeners.addIfAbsent(listener)
    }

    fun removeListener(listener: PtyEventListener) {
        listeners.remove(listener)
    }

    fun createSession(
        context: Context,
        env: DistroEnvironment?,
        envId: String,
        shell: String,
        cwd: String,
        cols: Int,
        rows: Int,
        customPrompt: Boolean,
        promptShowGit: Boolean,
        promptShowExitCode: Boolean,
        initialCommand: String = "",
        title: String = ""
    ): PtySessionInfo {
        val spec = ProotCommandBuilder.buildInteractiveShellSpec(
            context = context,
            env = env,
            shell = shell,
            guestCwd = cwd,
            customPrompt = customPrompt,
            promptShowGit = promptShowGit,
            promptShowExitCode = promptShowExitCode,
            initialCommand = initialCommand
        )

        val pair = NativePty.createPtyProcess(
            cmd = spec.executable,
            cwd = spec.hostCwd,
            argv = spec.argv,
            envp = spec.envp,
            cols = cols,
            rows = rows
        ) ?: throw IllegalStateException("Failed to allocate native PTY and fork process")

        val pid = pair[0]
        val masterFd = pair[1]
        val sessionId = "pty_${UUID.randomUUID().toString().substring(0, 8)}"
        val displayTitle = title.ifBlank { env?.name ?: "Android Shell" }

        val info = PtySessionInfo(
            sessionId = sessionId,
            envId = envId,
            title = displayTitle,
            shell = shell,
            cwd = cwd,
            pid = pid,
            masterFd = masterFd
        )
        sessions[sessionId] = info

        // Reader thread streaming real PTY output bytes
        thread(isDaemon = true, name = "pty-read-$sessionId") {
            val buf = ByteArray(16384)
            while (info.alive) {
                val n = NativePty.readPty(masterFd, buf)
                if (n > 0) {
                    val slice = buf.copyOf(n)
                    info.appendOutput(slice, n)
                    val b64 = Base64.encodeToString(slice, Base64.NO_WRAP)
                    for (l in listeners) {
                        l.onOutput(sessionId, b64)
                    }
                } else if (n == -2) {
                    Thread.sleep(5)
                } else {
                    break
                }
            }
        }

        // Waiter thread capturing exact process exit status
        thread(isDaemon = true, name = "pty-wait-$sessionId") {
            val code = NativePty.waitForProcess(pid)
            info.alive = false
            info.exitCode = code
            NativePty.closeFd(masterFd)
            for (l in listeners) {
                l.onExit(sessionId, code)
            }
        }

        return info
    }

    fun writeInput(sessionId: String, data: ByteArray): Int {
        val info = sessions[sessionId] ?: return -1
        if (!info.alive) return -1
        return NativePty.writePty(info.masterFd, data, data.size)
    }

    fun resize(sessionId: String, cols: Int, rows: Int): Boolean {
        val info = sessions[sessionId] ?: return false
        return NativePty.setWindowSize(info.masterFd, cols, rows) == 0
    }

    fun sendSignal(sessionId: String, signal: Int): Boolean {
        val info = sessions[sessionId] ?: return false
        return NativePty.sendSignal(info.pid, signal) == 0
    }

    fun killSession(sessionId: String) {
        val info = sessions.remove(sessionId) ?: return
        if (info.alive) {
            NativePty.sendSignal(info.pid, 9)
            info.alive = false
        }
        NativePty.closeFd(info.masterFd)
    }

    fun stopEnvironmentSessions(envId: String) {
        sessions.values.filter { it.envId == envId }.forEach { killSession(it.sessionId) }
    }

    fun killAll() {
        sessions.keys.toList().forEach { killSession(it) }
    }

    fun listSessions(): List<PtySessionInfo> = sessions.values.sortedBy { it.createdAt }

    fun countRunningForEnv(envId: String): Int =
        sessions.values.count { it.envId == envId && it.alive }

    fun getBufferBase64(sessionId: String): String =
        sessions[sessionId]?.snapshotBase64() ?: ""

    data class CaptureResult(
        val exitCode: Int,
        val stdout: String,
        val stderr: String
    )

    fun runCommandCapture(
        context: Context,
        env: DistroEnvironment,
        command: String,
        cwd: String = "/root",
        onLine: ((String) -> Unit)? = null
    ): CaptureResult {
        val spec = ProotCommandBuilder.buildCommandCaptureSpec(context, env, command, cwd)
        val pb = ProcessBuilder(spec.argv.toList())
        pb.directory(File(spec.hostCwd))
        val pbEnv = pb.environment()
        pbEnv.clear()
        for (entry in spec.envp) {
            val eq = entry.indexOf('=')
            if (eq > 0) {
                pbEnv[entry.substring(0, eq)] = entry.substring(eq + 1)
            }
        }
        val proc = pb.start()
        val stdoutBuf = StringBuilder()
        val stderrBuf = StringBuilder()

        val outThread = thread(isDaemon = true) {
            proc.inputStream.bufferedReader().useLines { lines ->
                lines.forEach { line ->
                    stdoutBuf.append(line).append('\n')
                    onLine?.invoke(line)
                }
            }
        }
        val errThread = thread(isDaemon = true) {
            proc.errorStream.bufferedReader().useLines { lines ->
                lines.forEach { line ->
                    stderrBuf.append(line).append('\n')
                    onLine?.invoke(line)
                }
            }
        }
        val exitCode = proc.waitFor()
        outThread.join(2000)
        errThread.join(2000)
        return CaptureResult(exitCode, stdoutBuf.toString(), stderrBuf.toString())
    }
}

