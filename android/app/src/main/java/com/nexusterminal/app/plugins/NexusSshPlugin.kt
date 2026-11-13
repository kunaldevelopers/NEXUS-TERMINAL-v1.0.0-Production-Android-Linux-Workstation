package com.nexusterminal.app.plugins

import android.util.Base64
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.nexusterminal.app.ssh.SshEventListener
import com.nexusterminal.app.ssh.SshManager
import com.nexusterminal.app.ssh.SshVault
import java.util.concurrent.Executors
import kotlin.concurrent.thread

@CapacitorPlugin(name = "NexusSsh")
class NexusSshPlugin : Plugin(), SshEventListener {

    private val inputExecutor = Executors.newSingleThreadExecutor()

    override fun load() {
        super.load()
        SshManager.addListener(this)
    }

    override fun handleOnDestroy() {
        SshManager.removeListener(this)
        inputExecutor.shutdownNow()
        super.handleOnDestroy()
    }

    override fun onOutput(sshSessionId: String, dataBase64: String) {
        notifyListeners("sshOutput", JSObject().apply {
            put("sshSessionId", sshSessionId)
            put("dataBase64", dataBase64)
        })
    }

    override fun onClosed(sshSessionId: String, reason: String) {
        notifyListeners("sshClosed", JSObject().apply {
            put("sshSessionId", sshSessionId)
            put("reason", reason)
        })
    }

    @PluginMethod
    fun listProfiles(call: PluginCall) {
        try {
            val arr = JSArray()
            for (p in SshVault.listProfiles(context)) {
                arr.put(JSObject().apply {
                    put("profileId", p.profileId)
                    put("name", p.name)
                    put("host", p.host)
                    put("port", p.port)
                    put("username", p.username)
                    put("authType", p.authType)
                    put("keyId", p.keyId)
                })
            }
            call.resolve(JSObject().apply { put("profiles", arr) })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Failed to read SSH profiles", t as? Exception)
        }
    }

    @PluginMethod
    fun saveProfile(call: PluginCall) {
        try {
            val profileId = call.getString("profileId")
            val name = call.getString("name")?.ifBlank { null } ?: call.getString("host") ?: "SSH Server"
            val host = call.getString("host") ?: ""
            val port = call.getInt("port") ?: 22
            val username = call.getString("username") ?: "root"
            val authType = call.getString("authType") ?: "password"
            val password = call.getString("password") ?: ""
            val keyId = call.getString("keyId") ?: ""
            if (host.isBlank()) {
                call.reject("Host is required")
                return
            }
            val saved = SshVault.saveProfile(
                context = context,
                profileId = profileId,
                name = name,
                host = host,
                port = port,
                username = username,
                authType = authType,
                password = password,
                keyId = keyId
            )
            call.resolve(JSObject().apply { put("profileId", saved.profileId) })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Failed to save SSH profile", t as? Exception)
        }
    }

    @PluginMethod
    fun deleteProfile(call: PluginCall) {
        val profileId = call.getString("profileId") ?: ""
        SshVault.deleteProfile(context, profileId)
        call.resolve(JSObject().apply { put("ok", true) })
    }

    @PluginMethod
    fun listKeys(call: PluginCall) {
        try {
            val arr = JSArray()
            for (k in SshVault.listKeys(context)) {
                arr.put(JSObject().apply {
                    put("keyId", k.keyId)
                    put("name", k.name)
                    put("createdAt", k.createdAt)
                })
            }
            call.resolve(JSObject().apply { put("keys", arr) })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Failed to read SSH keys", t as? Exception)
        }
    }

    @PluginMethod
    fun importKey(call: PluginCall) {
        try {
            val name = call.getString("name") ?: "Imported Key"
            val pem = call.getString("privateKeyPem") ?: ""
            val passphrase = call.getString("passphrase") ?: ""
            if (pem.isBlank()) {
                call.reject("Private key PEM content is required")
                return
            }
            val meta = SshVault.importKey(context, name, pem, passphrase)
            call.resolve(JSObject().apply {
                put("keyId", meta.keyId)
                put("name", meta.name)
            })
        } catch (t: Throwable) {
            call.reject(t.message ?: "Failed to import SSH key", t as? Exception)
        }
    }

    @PluginMethod
    fun exportKey(call: PluginCall) {
        val keyId = call.getString("keyId") ?: ""
        val (pem, _) = SshVault.getKeyMaterial(context, keyId)
        call.resolve(JSObject().apply { put("privateKeyPem", pem) })
    }

    @PluginMethod
    fun deleteKey(call: PluginCall) {
        val keyId = call.getString("keyId") ?: ""
        SshVault.deleteKey(context, keyId)
        call.resolve(JSObject().apply { put("ok", true) })
    }

    @PluginMethod
    fun connectSsh(call: PluginCall) {
        val profileId = call.getString("profileId") ?: ""
        if (profileId.isBlank()) {
            call.reject("profileId is required")
            return
        }
        thread(isDaemon = true, name = "nexus-ssh-connect") {
            try {
                val sshSessionId = SshManager.connect(context, profileId)
                call.resolve(JSObject().apply { put("sshSessionId", sshSessionId) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "SSH connection failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun sendSshInput(call: PluginCall) {
        val sshSessionId = call.getString("sshSessionId") ?: ""
        val b64 = call.getString("dataBase64") ?: ""
        val bytes = Base64.decode(b64, Base64.DEFAULT)
        inputExecutor.execute {
            try {
                SshManager.sendInput(sshSessionId, bytes)
                call.resolve(JSObject().apply { put("ok", true) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Failed to write SSH input", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun resizeSsh(call: PluginCall) {
        val sshSessionId = call.getString("sshSessionId") ?: ""
        val cols = call.getInt("cols") ?: 80
        val rows = call.getInt("rows") ?: 24
        thread(isDaemon = true) {
            try {
                SshManager.resize(sshSessionId, cols, rows)
                call.resolve(JSObject().apply { put("ok", true) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Failed to resize SSH PTY", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun disconnectSsh(call: PluginCall) {
        val sshSessionId = call.getString("sshSessionId") ?: ""
        thread(isDaemon = true) {
            SshManager.disconnect(sshSessionId)
            call.resolve(JSObject().apply { put("ok", true) })
        }
    }

    @PluginMethod
    fun startTunnel(call: PluginCall) {
        val sshSessionId = call.getString("sshSessionId") ?: ""
        val localPort = call.getInt("localPort") ?: 8080
        val remoteHost = call.getString("remoteHost") ?: "127.0.0.1"
        val remotePort = call.getInt("remotePort") ?: 80
        thread(isDaemon = true, name = "nexus-ssh-tunnel") {
            try {
                val t = SshManager.startTunnel(sshSessionId, localPort, remoteHost, remotePort)
                call.resolve(JSObject().apply {
                    put("tunnelId", t.tunnelId)
                    put("localPort", t.localPort)
                    put("remoteHost", t.remoteHost)
                    put("remotePort", t.remotePort)
                })
            } catch (t: Throwable) {
                call.reject(t.message ?: "Port forwarding failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun stopTunnel(call: PluginCall) {
        val tunnelId = call.getString("tunnelId") ?: ""
        SshManager.stopTunnel(tunnelId)
        call.resolve(JSObject().apply { put("ok", true) })
    }

    @PluginMethod
    fun listTunnels(call: PluginCall) {
        val arr = JSArray()
        for (t in SshManager.listTunnels()) {
            arr.put(JSObject().apply {
                put("tunnelId", t.tunnelId)
                put("sshSessionId", t.sshSessionId)
                put("localPort", t.localPort)
                put("remoteHost", t.remoteHost)
                put("remotePort", t.remotePort)
            })
        }
        call.resolve(JSObject().apply { put("tunnels", arr) })
    }

    @PluginMethod
    fun sftpList(call: PluginCall) {
        val sshSessionId = call.getString("sshSessionId") ?: ""
        val remotePath = call.getString("remotePath") ?: "."
        thread(isDaemon = true, name = "nexus-sftp-list") {
            try {
                val (current, list) = SshManager.sftpList(sshSessionId, remotePath)
                val arr = JSArray()
                for (e in list) {
                    arr.put(JSObject().apply {
                        put("name", e.name)
                        put("isDir", e.isDir)
                        put("size", e.size)
                        put("permissions", e.permissions)
                    })
                }
                call.resolve(JSObject().apply {
                    put("currentPath", current)
                    put("entries", arr)
                })
            } catch (t: Throwable) {
                call.reject(t.message ?: "SFTP list failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun sftpDownload(call: PluginCall) {
        val sshSessionId = call.getString("sshSessionId") ?: ""
        val remotePath = call.getString("remotePath") ?: ""
        val localPath = call.getString("localPath") ?: ""
        thread(isDaemon = true, name = "nexus-sftp-get") {
            try {
                val savedPath = SshManager.sftpDownload(context, sshSessionId, remotePath, localPath)
                call.resolve(JSObject().apply { put("localPath", savedPath) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "SFTP download failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun sftpUpload(call: PluginCall) {
        val sshSessionId = call.getString("sshSessionId") ?: ""
        val localPath = call.getString("localPath") ?: ""
        val remotePath = call.getString("remotePath") ?: ""
        thread(isDaemon = true, name = "nexus-sftp-put") {
            try {
                SshManager.sftpUpload(sshSessionId, localPath, remotePath)
                call.resolve(JSObject().apply { put("ok", true) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "SFTP upload failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun sftpMkdir(call: PluginCall) {
        val sshSessionId = call.getString("sshSessionId") ?: ""
        val remotePath = call.getString("remotePath") ?: ""
        thread(isDaemon = true) {
            try {
                SshManager.sftpMkdir(sshSessionId, remotePath)
                call.resolve(JSObject().apply { put("ok", true) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "SFTP mkdir failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun sftpDelete(call: PluginCall) {
        val sshSessionId = call.getString("sshSessionId") ?: ""
        val remotePath = call.getString("remotePath") ?: ""
        val isDir = call.getBoolean("isDir") ?: false
        thread(isDaemon = true) {
            try {
                SshManager.sftpDelete(sshSessionId, remotePath, isDir)
                call.resolve(JSObject().apply { put("ok", true) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "SFTP delete failed", t as? Exception)
            }
        }
    }

    @PluginMethod
    fun sftpRename(call: PluginCall) {
        val sshSessionId = call.getString("sshSessionId") ?: ""
        val oldPath = call.getString("oldPath") ?: ""
        val newPath = call.getString("newPath") ?: ""
        thread(isDaemon = true) {
            try {
                SshManager.sftpRename(sshSessionId, oldPath, newPath)
                call.resolve(JSObject().apply { put("ok", true) })
            } catch (t: Throwable) {
                call.reject(t.message ?: "SFTP rename failed", t as? Exception)
            }
        }
    }
}

