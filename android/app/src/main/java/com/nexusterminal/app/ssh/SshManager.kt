package com.nexusterminal.app.ssh

import android.content.Context
import android.util.Base64
import com.jcraft.jsch.ChannelSftp
import com.jcraft.jsch.ChannelShell
import com.jcraft.jsch.JSch
import com.jcraft.jsch.Session
import java.io.File
import java.io.OutputStream
import java.nio.charset.StandardCharsets
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread

interface SshEventListener {
    fun onOutput(sshSessionId: String, dataBase64: String)
    fun onClosed(sshSessionId: String, reason: String)
}

data class ActiveTunnel(
    val tunnelId: String,
    val sshSessionId: String,
    val localPort: Int,
    val remoteHost: String,
    val remotePort: Int
)

data class ActiveSshConnection(
    val sshSessionId: String,
    val session: Session,
    val shellChannel: ChannelShell,
    val stdinStream: OutputStream
)

object SshManager {
    private val connections = ConcurrentHashMap<String, ActiveSshConnection>()
    private val tunnels = ConcurrentHashMap<String, ActiveTunnel>()
    private val listeners = CopyOnWriteArrayList<SshEventListener>()

    fun addListener(l: SshEventListener) {
        listeners.addIfAbsent(l)
    }

    fun removeListener(l: SshEventListener) {
        listeners.remove(l)
    }

    fun connect(context: Context, profileId: String): String {
        val profile = SshVault.listProfiles(context).firstOrNull { it.profileId == profileId }
            ?: throw IllegalArgumentException("SSH profile not found")

        val jsch = JSch()
        if (profile.authType == "key" && profile.keyId.isNotBlank()) {
            val (pem, pass) = SshVault.getKeyMaterial(context, profile.keyId)
            if (pem.isBlank()) throw IllegalStateException("SSH private key missing in encrypted vault")
            jsch.addIdentity(
                profile.keyId,
                pem.toByteArray(StandardCharsets.UTF_8),
                null,
                if (pass.isNotEmpty()) pass.toByteArray(StandardCharsets.UTF_8) else null
            )
        }

        val session = jsch.getSession(profile.username, profile.host, profile.port)
        if (profile.authType == "password") {
            session.setPassword(SshVault.getPassword(context, profileId))
        }
        session.setConfig("StrictHostKeyChecking", "no")
        session.setConfig("PreferredAuthentications", "publickey,password,keyboard-interactive")
        session.connect(15000)

        val shell = session.openChannel("shell") as ChannelShell
        shell.setPty(true)
        shell.setPtyType("xterm-256color")
        val inputStream = shell.inputStream
        val outputStream = shell.outputStream
        shell.connect(10000)

        val sshSessionId = "sshs_${UUID.randomUUID().toString().substring(0, 8)}"
        val conn = ActiveSshConnection(sshSessionId, session, shell, outputStream)
        connections[sshSessionId] = conn

        thread(isDaemon = true, name = "ssh-read-$sshSessionId") {
            val buf = ByteArray(16384)
            var reason = "Closed"
            try {
                while (session.isConnected && shell.isConnected) {
                    val n = inputStream.read(buf)
                    if (n < 0) break
                    if (n > 0) {
                        val b64 = Base64.encodeToString(buf.copyOf(n), Base64.NO_WRAP)
                        listeners.forEach { it.onOutput(sshSessionId, b64) }
                    }
                }
            } catch (e: Exception) {
                reason = e.message ?: "Stream error"
            } finally {
                disconnect(sshSessionId, reason)
            }
        }

        return sshSessionId
    }

    fun sendInput(sshSessionId: String, data: ByteArray) {
        val conn = connections[sshSessionId] ?: return
        conn.stdinStream.write(data)
        conn.stdinStream.flush()
    }

    fun resize(sshSessionId: String, cols: Int, rows: Int) {
        val conn = connections[sshSessionId] ?: return
        conn.shellChannel.setPtySize(cols, rows, cols * 8, rows * 16)
    }

    fun disconnect(sshSessionId: String, reason: String = "Disconnected by user") {
        val conn = connections.remove(sshSessionId) ?: return
        tunnels.values.filter { it.sshSessionId == sshSessionId }.forEach {
            tunnels.remove(it.tunnelId)
            try { conn.session.delPortForwardingL(it.localPort) } catch (_: Exception) {}
        }
        try { conn.shellChannel.disconnect() } catch (_: Exception) {}
        try { conn.session.disconnect() } catch (_: Exception) {}
        listeners.forEach { it.onClosed(sshSessionId, reason) }
    }

    fun startTunnel(sshSessionId: String, localPort: Int, remoteHost: String, remotePort: Int): ActiveTunnel {
        val conn = connections[sshSessionId] ?: throw IllegalStateException("SSH session not active")
        val assigned = conn.session.setPortForwardingL("127.0.0.1", localPort, remoteHost, remotePort)
        val id = "tun_${UUID.randomUUID().toString().substring(0, 6)}"
        val tunnel = ActiveTunnel(id, sshSessionId, assigned, remoteHost, remotePort)
        tunnels[id] = tunnel
        return tunnel
    }

    fun stopTunnel(tunnelId: String) {
        val t = tunnels.remove(tunnelId) ?: return
        val conn = connections[t.sshSessionId] ?: return
        try { conn.session.delPortForwardingL("127.0.0.1", t.localPort) } catch (_: Exception) {}
    }

    fun listTunnels(): List<ActiveTunnel> = tunnels.values.toList()

    private fun <T> withSftp(sshSessionId: String, block: (ChannelSftp) -> T): T {
        val conn = connections[sshSessionId] ?: throw IllegalStateException("SSH session not connected")
        val sftp = conn.session.openChannel("sftp") as ChannelSftp
        sftp.connect(10000)
        try {
            return block(sftp)
        } finally {
            try { sftp.disconnect() } catch (_: Exception) {}
        }
    }

    data class SftpEntry(val name: String, val isDir: Boolean, val size: Long, val permissions: String)

    fun sftpList(sshSessionId: String, remotePath: String): Pair<String, List<SftpEntry>> =
        withSftp(sshSessionId) { sftp ->
            val target = if (remotePath == "." || remotePath.isBlank()) sftp.pwd() else remotePath
            val list = sftp.ls(target)
            val entries = mutableListOf<SftpEntry>()
            for (item in list) {
                val ent = item as ChannelSftp.LsEntry
                if (ent.filename == ".") continue
                entries.add(
                    SftpEntry(
                        name = ent.filename,
                        isDir = ent.attrs.isDir,
                        size = ent.attrs.size,
                        permissions = ent.attrs.permissionsString
                    )
                )
            }
            target to entries.sortedWith(compareByDescending<SftpEntry> { it.isDir }.thenBy { it.name })
        }

    fun sftpDownload(context: Context, sshSessionId: String, remotePath: String, localPath: String): String =
        withSftp(sshSessionId) { sftp ->
            val dest = if (localPath.isNotBlank()) {
                File(localPath).also { it.parentFile?.mkdirs() }
            } else {
                val dlDir = File(context.filesDir, "workspace/sftp_downloads").apply { mkdirs() }
                File(dlDir, File(remotePath).name)
            }
            sftp.get(remotePath, dest.absolutePath)
            dest.absolutePath
        }

    fun sftpUpload(sshSessionId: String, localPath: String, remotePath: String) =
        withSftp(sshSessionId) { sftp ->
            sftp.put(localPath, remotePath)
        }

    fun sftpMkdir(sshSessionId: String, remotePath: String) =
        withSftp(sshSessionId) { sftp -> sftp.mkdir(remotePath) }

    fun sftpDelete(sshSessionId: String, remotePath: String, isDir: Boolean) =
        withSftp(sshSessionId) { sftp ->
            if (isDir) sftp.rmdir(remotePath) else sftp.rm(remotePath)
        }

    fun sftpRename(sshSessionId: String, oldPath: String, newPath: String) =
        withSftp(sshSessionId) { sftp -> sftp.rename(oldPath, newPath) }
}

