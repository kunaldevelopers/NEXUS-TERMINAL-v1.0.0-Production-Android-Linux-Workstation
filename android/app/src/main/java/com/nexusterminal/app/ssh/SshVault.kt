package com.nexusterminal.app.ssh

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class SshProfile(
    val profileId: String,
    val name: String,
    val host: String,
    val port: Int,
    val username: String,
    val authType: String, // "password" or "key"
    val keyId: String
)

data class SshKeyMeta(
    val keyId: String,
    val name: String,
    val createdAt: Long
)

object SshVault {

    private const val PREF_NAME = "nexus_secure_vault"

    private fun prefs(context: Context): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context,
            PREF_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun saveSecret(context: Context, key: String, value: String) {
        prefs(context).edit().putString("sec_$key", value).apply()
    }

    fun getSecret(context: Context, key: String): String =
        prefs(context).getString("sec_$key", "") ?: ""

    fun clearAll(context: Context) {
        prefs(context).edit().clear().apply()
    }

    fun listProfiles(context: Context): List<SshProfile> {
        val raw = prefs(context).getString("ssh_profiles", "[]") ?: "[]"
        val arr = JSONArray(raw)
        val out = mutableListOf<SshProfile>()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            out.add(
                SshProfile(
                    profileId = o.getString("profileId"),
                    name = o.getString("name"),
                    host = o.getString("host"),
                    port = o.optInt("port", 22),
                    username = o.getString("username"),
                    authType = o.optString("authType", "password"),
                    keyId = o.optString("keyId", "")
                )
            )
        }
        return out
    }

    fun saveProfile(
        context: Context,
        profileId: String?,
        name: String,
        host: String,
        port: Int,
        username: String,
        authType: String,
        password: String,
        keyId: String
    ): SshProfile {
        val id = profileId?.ifBlank { null } ?: "ssh_${UUID.randomUUID().toString().substring(0, 8)}"
        val list = listProfiles(context).toMutableList()
        list.removeAll { it.profileId == id }
        val profile = SshProfile(id, name, host, port, username, authType, keyId)
        list.add(profile)

        val arr = JSONArray()
        list.forEach { p ->
            arr.put(JSONObject().apply {
                put("profileId", p.profileId)
                put("name", p.name)
                put("host", p.host)
                put("port", p.port)
                put("username", p.username)
                put("authType", p.authType)
                put("keyId", p.keyId)
            })
        }
        val editor = prefs(context).edit().putString("ssh_profiles", arr.toString())
        if (password.isNotEmpty()) {
            editor.putString("pwd_$id", password)
        }
        editor.apply()
        return profile
    }

    fun getPassword(context: Context, profileId: String): String =
        prefs(context).getString("pwd_$profileId", "") ?: ""

    fun deleteProfile(context: Context, profileId: String) {
        val list = listProfiles(context).filter { it.profileId != profileId }
        val arr = JSONArray()
        list.forEach { p ->
            arr.put(JSONObject().apply {
                put("profileId", p.profileId)
                put("name", p.name)
                put("host", p.host)
                put("port", p.port)
                put("username", p.username)
                put("authType", p.authType)
                put("keyId", p.keyId)
            })
        }
        prefs(context).edit()
            .putString("ssh_profiles", arr.toString())
            .remove("pwd_$profileId")
            .apply()
    }

    fun listKeys(context: Context): List<SshKeyMeta> {
        val raw = prefs(context).getString("ssh_keys_meta", "[]") ?: "[]"
        val arr = JSONArray(raw)
        val out = mutableListOf<SshKeyMeta>()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            out.add(SshKeyMeta(o.getString("keyId"), o.getString("name"), o.optLong("createdAt", 0L)))
        }
        return out
    }

    fun importKey(context: Context, name: String, pem: String, passphrase: String): SshKeyMeta {
        val id = "key_${UUID.randomUUID().toString().substring(0, 8)}"
        val list = listKeys(context).toMutableList()
        val meta = SshKeyMeta(id, name.ifBlank { id }, System.currentTimeMillis())
        list.add(meta)
        val arr = JSONArray()
        list.forEach { k ->
            arr.put(JSONObject().apply {
                put("keyId", k.keyId)
                put("name", k.name)
                put("createdAt", k.createdAt)
            })
        }
        prefs(context).edit()
            .putString("ssh_keys_meta", arr.toString())
            .putString("keypem_$id", pem)
            .putString("keypass_$id", passphrase)
            .apply()
        return meta
    }

    fun getKeyMaterial(context: Context, keyId: String): Pair<String, String> {
        val p = prefs(context)
        return (p.getString("keypem_$keyId", "") ?: "") to (p.getString("keypass_$keyId", "") ?: "")
    }

    fun deleteKey(context: Context, keyId: String) {
        val list = listKeys(context).filter { it.keyId != keyId }
        val arr = JSONArray()
        list.forEach { k ->
            arr.put(JSONObject().apply {
                put("keyId", k.keyId)
                put("name", k.name)
                put("createdAt", k.createdAt)
            })
        }
        prefs(context).edit()
            .putString("ssh_keys_meta", arr.toString())
            .remove("keypem_$keyId")
            .remove("keypass_$keyId")
            .apply()
    }
}

